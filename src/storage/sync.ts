import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IStorageProvider, storageProvider } from './db';
import { Product, Purchase, Sale, AppSettings } from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  syncedProducts: number;
  syncedPurchases: number;
  syncedSales: number;
  error?: string;
}

export class SyncService {
  private client: SupabaseClient | null = null;
  private currentUrl = '';
  private currentKey = '';

  constructor(private storage: IStorageProvider = storageProvider) {}

  private getSupabaseClient(settings: AppSettings): SupabaseClient | null {
    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env : {}) || {};
    const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
    const url = settings.supabase_url || metaEnv.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
    const key = settings.supabase_anon_key || metaEnv.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return null;
    }

    if (!this.client || this.currentUrl !== url || this.currentKey !== key) {
      this.currentUrl = url;
      this.currentKey = key;
      this.client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }

    return this.client;
  }

  isOnline(): boolean {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine;
    }
    return true;
  }

  async getPendingCount(): Promise<{ products: number; purchases: number; sales: number; total: number }> {
    const [products, purchases, sales] = await Promise.all([
      this.storage.getProducts(),
      this.storage.getPurchases(),
      this.storage.getSales(),
    ]);

    const pendingProducts = products.filter((p) => p.sync_status === 'pending' || p.sync_status === 'failed').length;
    const pendingPurchases = purchases.filter((p) => p.sync_status === 'pending' || p.sync_status === 'failed').length;
    const pendingSales = sales.filter((s) => s.sync_status === 'pending' || s.sync_status === 'failed').length;

    return {
      products: pendingProducts,
      purchases: pendingPurchases,
      sales: pendingSales,
      total: pendingProducts + pendingPurchases + pendingSales,
    };
  }

  /**
   * Performs idempotent sync of pending local changes to Supabase cloud.
   */
  async syncNow(): Promise<SyncResult> {
    const settings = (await this.storage.getSettings()) || {
      id: 'default',
      business_name: 'Vyaapaaram Store',
      currency_format: 'symbol',
      cloud_sync_enabled: false,
      workspace_id: 'default-workspace',
    };

    if (!this.isOnline()) {
      return {
        success: false,
        message: 'No internet connection. Changes remain safely stored locally.',
        syncedProducts: 0,
        syncedPurchases: 0,
        syncedSales: 0,
      };
    }

    const supabase = this.getSupabaseClient(settings);
    if (!supabase) {
      // Cloud sync not configured
      return {
        success: true,
        message: 'Cloud sync is not configured. Data is stored safely on this device.',
        syncedProducts: 0,
        syncedPurchases: 0,
        syncedSales: 0,
      };
    }

    const [products, purchases, sales] = await Promise.all([
      this.storage.getProducts(),
      this.storage.getPurchases(),
      this.storage.getSales(),
    ]);

    const pendingProducts = products.filter((p) => p.sync_status === 'pending' || p.sync_status === 'failed');
    const pendingPurchases = purchases.filter((p) => p.sync_status === 'pending' || p.sync_status === 'failed');
    const pendingSales = sales.filter((s) => s.sync_status === 'pending' || s.sync_status === 'failed');

    let syncedProducts = 0;
    let syncedPurchases = 0;
    let syncedSales = 0;

    try {
      const workspaceId = settings.workspace_id || 'default-workspace';
      const now = new Date().toISOString();

      // 1. Sync Products (Idempotent upsert by id)
      if (pendingProducts.length > 0) {
        const payload = pendingProducts.map((p) => ({
          id: p.id,
          workspace_id: workspaceId,
          name: p.name,
          sku: p.sku || null,
          unit: p.unit,
          current_stock: p.current_stock,
          average_cost_paise: p.average_cost_paise,
          selling_price_suggestion_paise: p.selling_price_suggestion_paise || null,
          low_stock_threshold: p.low_stock_threshold,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));

        const { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });
        if (error) throw new Error(`Products sync failed: ${error.message}`);

        for (const p of pendingProducts) {
          await this.storage.putProduct({
            ...p,
            sync_status: 'synced',
            synced_at: now,
            sync_error: undefined,
          });
        }
        syncedProducts = pendingProducts.length;
      }

      // 2. Sync Purchases (Idempotent upsert by id)
      if (pendingPurchases.length > 0) {
        const payload = pendingPurchases.map((p) => ({
          id: p.id,
          workspace_id: workspaceId,
          product_id: p.product_id,
          product_name: p.product_name,
          quantity_received: p.quantity_received,
          unit_cost_paise: p.unit_cost_paise,
          total_cost_paise: p.total_cost_paise,
          date: p.date,
          supplier: p.supplier || null,
          note: p.note || null,
          created_at: p.created_at,
        }));

        const { error } = await supabase.from('purchases').upsert(payload, { onConflict: 'id' });
        if (error) throw new Error(`Purchases sync failed: ${error.message}`);

        for (const pur of pendingPurchases) {
          await this.storage.putPurchase({
            ...pur,
            sync_status: 'synced',
            synced_at: now,
            sync_error: undefined,
          });
        }
        syncedPurchases = pendingPurchases.length;
      }

      // 3. Sync Sales (Idempotent upsert by id)
      if (pendingSales.length > 0) {
        const payload = pendingSales.map((s) => ({
          id: s.id,
          workspace_id: workspaceId,
          sale_number: s.sale_number,
          date: s.date,
          customer_name: s.customer_name || null,
          customer_phone: s.customer_phone || null,
          items: s.items,
          product_selling_revenue_paise: s.product_selling_revenue_paise,
          delivery_charged_paise: s.delivery_charged_paise,
          courier_cost_paid_paise: s.courier_cost_paid_paise,
          other_direct_expenses_paise: s.other_direct_expenses_paise,
          total_cogs_paise: s.total_cogs_paise,
          total_amount_paise: s.total_amount_paise,
          profit_after_direct_costs_paise: s.profit_after_direct_costs_paise,
          status: s.status,
          void_reason: s.void_reason || null,
          voided_at: s.voided_at || null,
          created_at: s.created_at,
        }));

        const { error } = await supabase.from('sales').upsert(payload, { onConflict: 'id' });
        if (error) throw new Error(`Sales sync failed: ${error.message}`);

        for (const s of pendingSales) {
          await this.storage.putSale({
            ...s,
            sync_status: 'synced',
            synced_at: now,
            sync_error: undefined,
          });
        }
        syncedSales = pendingSales.length;
      }

      // Update last synced timestamp in settings
      await this.storage.putSettings({
        ...settings,
        last_synced_at: now,
      });

      return {
        success: true,
        message: `Synced ${syncedProducts} products, ${syncedPurchases} purchases, ${syncedSales} sales to cloud.`,
        syncedProducts,
        syncedPurchases,
        syncedSales,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Unknown sync error';

      // Mark pending records with failure status and error
      for (const p of pendingProducts) {
        await this.storage.putProduct({ ...p, sync_status: 'failed', sync_error: errMsg });
      }
      for (const pur of pendingPurchases) {
        await this.storage.putPurchase({ ...pur, sync_status: 'failed', sync_error: errMsg });
      }
      for (const s of pendingSales) {
        await this.storage.putSale({ ...s, sync_status: 'failed', sync_error: errMsg });
      }

      return {
        success: false,
        message: `Sync failed: ${errMsg}`,
        syncedProducts,
        syncedPurchases,
        syncedSales,
        error: errMsg,
      };
    }
  }
}

export const syncService = new SyncService();
