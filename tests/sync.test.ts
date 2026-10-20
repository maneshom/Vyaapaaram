import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryStorage } from '../src/storage/db';
import { SyncService } from '../src/storage/sync';
import { Product, Purchase, Sale } from '../src/types';

describe('Offline Persistence & Idempotent Sync', () => {
  let memoryStorage: InMemoryStorage;
  let syncService: SyncService;

  beforeEach(() => {
    memoryStorage = new InMemoryStorage();
    syncService = new SyncService(memoryStorage);
  });

  it('tracks pending sync items count accurately', async () => {
    const p1: Product = {
      id: 'p-1',
      name: 'Item 1',
      unit: 'pcs',
      current_stock: 10,
      average_cost_paise: 1000,
      low_stock_threshold: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };
    await memoryStorage.putProduct(p1);

    const pur: Purchase = {
      id: 'pur-1',
      product_id: 'p-1',
      product_name: 'Item 1',
      quantity_received: 5,
      unit_cost_paise: 1000,
      total_cost_paise: 5000,
      date: '2026-10-20',
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };
    await memoryStorage.putPurchase(pur);

    const counts = await syncService.getPendingCount();
    expect(counts.products).toBe(1);
    expect(counts.purchases).toBe(1);
    expect(counts.total).toBe(2);
  });

  it('handles offline condition gracefully without crashing or losing data', async () => {
    // Mock navigator.onLine as false
    vi.spyOn(syncService, 'isOnline').mockReturnValue(false);

    const result = await syncService.syncNow();
    expect(result.success).toBe(false);
    expect(result.message).toContain('No internet connection');
    expect(result.syncedProducts).toBe(0);
  });

  it('informs user if cloud sync is unconfigured while keeping local data safe', async () => {
    vi.spyOn(syncService, 'isOnline').mockReturnValue(true);

    const result = await syncService.syncNow();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Cloud sync is not configured');
  });
});

