import { IStorageProvider, storageProvider } from './db';
import {
  Product,
  Purchase,
  Sale,
  SaleItem,
  AppSettings,
  ReportPeriodFilter,
  FinancialSummary,
  InventorySummary,
  ProductReportItem,
} from '../types';
import {
  calculateMovingAverageCost,
  calculateSaleTotals,
  validateSaleInput,
  calculateFinancialSummary,
  calculateInventorySummary,
  calculateProductReportItems,
} from '../utils/calculations';
import { getTodayDateString, isDateInPeriod, getPeriodFilter } from '../utils/dates';

export class Repository {
  constructor(private storage: IStorageProvider = storageProvider) {}

  // -------------------------
  // Settings
  // -------------------------
  async getSettings(): Promise<AppSettings> {
    const existing = await this.storage.getSettings();
    if (existing) return existing;

    const defaultSettings: AppSettings = {
      id: 'default',
      business_name: 'Vyaapaaram Store',
      currency_format: 'symbol',
      cloud_sync_enabled: false,
      workspace_id: 'default-workspace',
    };
    await this.storage.putSettings(defaultSettings);
    return defaultSettings;
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settings,
    };
    await this.storage.putSettings(updated);
    return updated;
  }

  // -------------------------
  // Products
  // -------------------------
  async getProducts(): Promise<Product[]> {
    const prods = await this.storage.getProducts();
    return prods.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.storage.getProduct(id);
  }

  async saveProduct(params: {
    id?: string;
    name: string;
    sku?: string;
    unit: string;
    current_stock?: number;
    average_cost_paise?: number;
    selling_price_suggestion_paise?: number;
    low_stock_threshold?: number;
  }): Promise<Product> {
    const trimmedName = params.name.trim();
    if (!trimmedName) {
      throw new Error('Product name is required');
    }

    const now = new Date().toISOString();
    const isNew = !params.id;
    const id = params.id || (crypto.randomUUID ? crypto.randomUUID() : `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const existing = isNew ? undefined : await this.storage.getProduct(id);

    const product: Product = {
      id,
      name: trimmedName,
      sku: params.sku?.trim() || undefined,
      unit: params.unit?.trim() || 'pcs',
      current_stock: params.current_stock !== undefined ? Math.max(0, params.current_stock) : (existing?.current_stock ?? 0),
      average_cost_paise: params.average_cost_paise !== undefined ? Math.max(0, Math.round(params.average_cost_paise)) : (existing?.average_cost_paise ?? 0),
      selling_price_suggestion_paise: params.selling_price_suggestion_paise !== undefined ? Math.max(0, Math.round(params.selling_price_suggestion_paise)) : existing?.selling_price_suggestion_paise,
      low_stock_threshold: params.low_stock_threshold !== undefined ? Math.max(0, params.low_stock_threshold) : (existing?.low_stock_threshold ?? 5),
      created_at: existing?.created_at || now,
      updated_at: now,
      sync_status: 'pending',
    };

    await this.storage.putProduct(product);
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    // Check if product is referenced in purchases or sales
    const purchases = await this.storage.getPurchases();
    if (purchases.some((p) => p.product_id === id)) {
      throw new Error('Cannot delete product with existing purchase records. Adjust stock instead.');
    }
    const sales = await this.storage.getSales();
    if (sales.some((s) => s.items.some((i) => i.product_id === id))) {
      throw new Error('Cannot delete product with historical sales. Adjust stock instead.');
    }
    await this.storage.deleteProduct(id);
  }

  // -------------------------
  // Purchases (Stock Additions)
  // -------------------------
  async getPurchases(): Promise<Purchase[]> {
    return this.storage.getPurchases();
  }

  /**
   * Atomically records a purchase, recalculates the moving average cost,
   * and increases product inventory stock.
   */
  async recordPurchase(params: {
    product_id: string;
    quantity_received: number;
    unit_cost_paise: number;
    date: string;
    supplier?: string;
    note?: string;
  }): Promise<{ purchase: Purchase; updatedProduct: Product }> {
    if (params.quantity_received <= 0) {
      throw new Error('Quantity received must be greater than zero.');
    }
    if (params.unit_cost_paise < 0) {
      throw new Error('Purchase unit cost cannot be negative.');
    }

    const product = await this.storage.getProduct(params.product_id);
    if (!product) {
      throw new Error(`Product not found: ${params.product_id}`);
    }

    const { newStock, newAverageCostPaise } = calculateMovingAverageCost(
      product.current_stock,
      product.average_cost_paise,
      params.quantity_received,
      params.unit_cost_paise
    );

    const now = new Date().toISOString();
    const purchaseId = crypto.randomUUID ? crypto.randomUUID() : `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalCostPaise = Math.round(params.quantity_received * params.unit_cost_paise);

    const purchase: Purchase = {
      id: purchaseId,
      product_id: product.id,
      product_name: product.name,
      quantity_received: params.quantity_received,
      unit_cost_paise: Math.round(params.unit_cost_paise),
      total_cost_paise: totalCostPaise,
      date: params.date || getTodayDateString(),
      supplier: params.supplier?.trim() || undefined,
      note: params.note?.trim() || undefined,
      created_at: now,
      sync_status: 'pending',
    };

    const updatedProduct: Product = {
      ...product,
      current_stock: newStock,
      average_cost_paise: newAverageCostPaise,
      updated_at: now,
      sync_status: 'pending',
    };

    // Atomic persistence
    await this.storage.putPurchase(purchase);
    await this.storage.putProduct(updatedProduct);

    return { purchase, updatedProduct };
  }

  // -------------------------
  // Sales
  // -------------------------
  async getSales(): Promise<Sale[]> {
    return this.storage.getSales();
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return this.storage.getSale(id);
  }

  /**
   * Atomically records a sale, snapshots COGS, reduces inventory stock,
   * and computes profit after direct sale costs.
   */
  async recordSale(params: {
    items: Array<{
      product_id: string;
      quantity: number;
      selling_price_paise: number;
    }>;
    delivery_charged_paise?: number;
    courier_cost_paid_paise?: number;
    other_direct_expenses_paise?: number;
    customer_name?: string;
    customer_phone?: string;
    date?: string;
  }): Promise<{ sale: Sale; updatedProducts: Product[] }> {
    // 1. Fetch current products for validation and atomic update
    const allProducts = await this.storage.getProducts();
    const productMap = new Map<string, Product>();
    for (const p of allProducts) {
      productMap.set(p.id, p);
    }

    // 2. Validate sale input & available stock
    const validation = validateSaleInput({
      items: params.items,
      stockLookup: productMap,
      delivery_charged_paise: params.delivery_charged_paise,
      courier_cost_paid_paise: params.courier_cost_paid_paise,
      other_direct_expenses_paise: params.other_direct_expenses_paise,
    });

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    // 3. Prepare line items with captured moving average cost snapshot
    const itemPrep = params.items.map((item) => ({
      product: productMap.get(item.product_id)!,
      quantity: item.quantity,
      selling_price_paise: item.selling_price_paise,
    }));

    const calculated = calculateSaleTotals({
      items: itemPrep,
      delivery_charged_paise: params.delivery_charged_paise,
      courier_cost_paid_paise: params.courier_cost_paid_paise,
      other_direct_expenses_paise: params.other_direct_expenses_paise,
    });

    // 4. Generate next readable sale number (e.g. VY-1001)
    const existingSales = await this.storage.getSales();
    const saleSeq = 1001 + existingSales.length;
    const saleNumber = `VY-${saleSeq}`;

    const now = new Date().toISOString();
    const saleId = crypto.randomUUID ? crypto.randomUUID() : `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const sale: Sale = {
      id: saleId,
      sale_number: saleNumber,
      date: params.date || now,
      customer_name: params.customer_name?.trim() || undefined,
      customer_phone: params.customer_phone?.trim() || undefined,
      items: calculated.saleItems,
      product_selling_revenue_paise: calculated.product_selling_revenue_paise,
      delivery_charged_paise: calculated.delivery_charged_paise,
      courier_cost_paid_paise: calculated.courier_cost_paid_paise,
      other_direct_expenses_paise: calculated.other_direct_expenses_paise,
      total_cogs_paise: calculated.total_cogs_paise,
      total_amount_paise: calculated.total_amount_paise,
      profit_after_direct_costs_paise: calculated.profit_after_direct_costs_paise,
      status: 'completed',
      created_at: now,
      sync_status: 'pending',
    };

    // 5. Deduct stock for all affected products
    const updatedProducts: Product[] = [];
    for (const line of calculated.saleItems) {
      const prod = productMap.get(line.product_id)!;
      const updatedProd: Product = {
        ...prod,
        current_stock: prod.current_stock - line.quantity,
        updated_at: now,
        sync_status: 'pending',
      };
      productMap.set(prod.id, updatedProd);
      updatedProducts.push(updatedProd);
    }

    // 6. Save sale and updated products atomically
    await this.storage.putSale(sale);
    for (const up of updatedProducts) {
      await this.storage.putProduct(up);
    }

    return { sale, updatedProducts };
  }

  /**
   * Safely voids a sale, restores inventory stock, and retains an audit trail.
   */
  async voidSale(saleId: string, voidReason: string): Promise<{ sale: Sale; restoredProducts: Product[] }> {
    const sale = await this.storage.getSale(saleId);
    if (!sale) {
      throw new Error(`Sale not found: ${saleId}`);
    }

    if (sale.status === 'voided') {
      throw new Error(`Sale ${sale.sale_number} is already voided.`);
    }

    const trimmedReason = voidReason?.trim() || 'Voided by user';
    const now = new Date().toISOString();

    const restoredProducts: Product[] = [];
    for (const item of sale.items) {
      const prod = await this.storage.getProduct(item.product_id);
      if (prod) {
        const restored: Product = {
          ...prod,
          current_stock: prod.current_stock + item.quantity,
          updated_at: now,
          sync_status: 'pending',
        };
        await this.storage.putProduct(restored);
        restoredProducts.push(restored);
      }
    }

    const voidedSale: Sale = {
      ...sale,
      status: 'voided',
      void_reason: trimmedReason,
      voided_at: now,
      sync_status: 'pending',
    };

    await this.storage.putSale(voidedSale);
    return { sale: voidedSale, restoredProducts };
  }

  // -------------------------
  // Dashboard & Reports Aggregations
  // -------------------------
  async getDashboardMetrics(selectedPeriod: 'today' | 'this_month' | 'last_30_days') {
    const [products, allSales] = await Promise.all([
      this.getProducts(),
      this.getSales(),
    ]);

    const activeSales = allSales.filter((s) => s.status !== 'voided');

    const todayFilter = getPeriodFilter('today');
    const thisMonthFilter = getPeriodFilter('this_month');
    const selectedFilter = getPeriodFilter(selectedPeriod);

    const salesToday = activeSales.filter((s) => isDateInPeriod(s.date, todayFilter));
    const salesThisMonth = activeSales.filter((s) => isDateInPeriod(s.date, thisMonthFilter));
    const salesSelected = activeSales.filter((s) => isDateInPeriod(s.date, selectedFilter));

    const todaySummary = calculateFinancialSummary(salesToday, 'Today');
    const thisMonthSummary = calculateFinancialSummary(salesThisMonth, 'This Month');
    const selectedSummary = calculateFinancialSummary(salesSelected, selectedPeriod);

    const inventorySummary = calculateInventorySummary(products);
    const lowStockAlerts = products.filter(
      (p) => p.current_stock <= p.low_stock_threshold
    );

    const recentSales = allSales.slice(0, 5);

    return {
      todaySummary,
      thisMonthSummary,
      selectedSummary,
      inventorySummary,
      lowStockAlerts,
      recentSales,
      totalProductsCount: products.length,
    };
  }

  async getReportsData(filter: ReportPeriodFilter): Promise<{
    financialSummary: FinancialSummary;
    inventorySummary: InventorySummary;
    productReportItems: ProductReportItem[];
  }> {
    const [products, allSales] = await Promise.all([
      this.getProducts(),
      this.getSales(),
    ]);

    const periodSales = allSales.filter(
      (s) => s.status !== 'voided' && isDateInPeriod(s.date, filter)
    );

    const financialSummary = calculateFinancialSummary(periodSales, filter.type);
    const inventorySummary = calculateInventorySummary(products);
    const productReportItems = calculateProductReportItems(products, periodSales);

    return {
      financialSummary,
      inventorySummary,
      productReportItems,
    };
  }

  // -------------------------
  // Data reset & demo data
  // -------------------------
  async clearAllData(): Promise<void> {
    await this.storage.clearAllData();
  }

  async seedSampleData(): Promise<void> {
    await this.clearAllData();

    // 1. Seed realistic retail demo products
    const p1 = await this.saveProduct({
      name: 'Basmati Rice Premium (5kg)',
      sku: 'RIC-BAS-05',
      unit: 'pack',
      current_stock: 25,
      average_cost_paise: 42000, // ₹420.00
      selling_price_suggestion_paise: 55000, // ₹550.00
      low_stock_threshold: 8,
    });

    const p2 = await this.saveProduct({
      name: 'Organic Toor Dal (1kg)',
      sku: 'DAL-TOOR-01',
      unit: 'kg',
      current_stock: 4, // Low stock!
      average_cost_paise: 13000, // ₹130.00
      selling_price_suggestion_paise: 17500, // ₹175.00
      low_stock_threshold: 10,
    });

    const p3 = await this.saveProduct({
      name: 'Cold Pressed Coconut Oil (1L)',
      sku: 'OIL-COC-01',
      unit: 'bottle',
      current_stock: 15,
      average_cost_paise: 24000, // ₹240.00
      selling_price_suggestion_paise: 32000, // ₹320.00
      low_stock_threshold: 5,
    });

    const p4 = await this.saveProduct({
      name: 'Spiced Filter Coffee Blend (500g)',
      sku: 'COF-BLD-05',
      unit: 'pack',
      current_stock: 0, // Out of stock!
      average_cost_paise: 18000, // ₹180.00
      selling_price_suggestion_paise: 26000, // ₹260.00
      low_stock_threshold: 6,
    });

    const todayStr = getTodayDateString();

    // 2. Seed historical purchases
    await this.recordPurchase({
      product_id: p1.id,
      quantity_received: 30,
      unit_cost_paise: 42000,
      date: todayStr,
      supplier: 'Punjab Agro Wholesalers',
      note: 'Bulk harvest dispatch INV-492',
    });

    await this.recordPurchase({
      product_id: p2.id,
      quantity_received: 10,
      unit_cost_paise: 13000,
      date: todayStr,
      supplier: 'Deccan Organic Mills',
      note: 'First lot grade A',
    });

    // 3. Seed sales with customer-specific selling price & courier amounts
    await this.recordSale({
      items: [
        {
          product_id: p1.id,
          quantity: 2,
          selling_price_paise: 54000, // Customer-specific: ₹540.00 instead of ₹550
        },
        {
          product_id: p2.id,
          quantity: 3,
          selling_price_paise: 17500,
        },
      ],
      delivery_charged_paise: 5000, // ₹50.00 delivery charged to customer
      courier_cost_paid_paise: 3500, // ₹35.00 paid to courier after discount
      other_direct_expenses_paise: 500, // ₹5.00 packaging material
      customer_name: 'Ananya Sharma',
      customer_phone: '9876543210',
      date: todayStr,
    });

    await this.recordSale({
      items: [
        {
          product_id: p3.id,
          quantity: 2,
          selling_price_paise: 32000,
        },
      ],
      delivery_charged_paise: 0,
      courier_cost_paid_paise: 0,
      customer_name: 'Suresh Kumar (Walk-in)',
      date: todayStr,
    });
  }
}

export const repository = new Repository();

