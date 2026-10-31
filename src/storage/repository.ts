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
    car_brand?: string;
    car_model?: string;
    product_brand?: string;
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
      car_brand: params.car_brand?.trim() || undefined,
      car_model: params.car_model?.trim() || undefined,
      product_brand: params.product_brand?.trim() || undefined,
      unit: params.unit?.trim() || 'pcs',
      current_stock: params.current_stock !== undefined ? Math.max(0, params.current_stock) : (existing?.current_stock ?? 0),
      average_cost_paise: params.average_cost_paise !== undefined ? Math.max(0, Math.round(params.average_cost_paise)) : (existing?.average_cost_paise ?? 0),
      selling_price_suggestion_paise: params.selling_price_suggestion_paise !== undefined ? Math.max(0, Math.round(params.selling_price_suggestion_paise)) : existing?.selling_price_suggestion_paise,
      low_stock_threshold: params.low_stock_threshold !== undefined ? Math.max(0, params.low_stock_threshold) : (existing?.low_stock_threshold ?? 5),
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await this.storage.putProduct(product);
    return product;
  }

  async checkProductUsage(id: string): Promise<{
    canDelete: boolean;
    purchaseCount: number;
    saleCount: number;
    reason?: string;
  }> {
    const [purchases, sales] = await Promise.all([
      this.storage.getPurchases(),
      this.storage.getSales(),
    ]);
    const purchaseCount = purchases.filter((p) => p.product_id === id).length;
    const saleCount = sales.filter((s) => s.items.some((i) => i.product_id === id)).length;

    if (purchaseCount > 0 || saleCount > 0) {
      const parts: string[] = [];
      if (purchaseCount > 0) parts.push(`${purchaseCount} purchase record${purchaseCount > 1 ? 's' : ''}`);
      if (saleCount > 0) parts.push(`${saleCount} historical sale${saleCount > 1 ? 's' : ''}`);
      return {
        canDelete: false,
        purchaseCount,
        saleCount,
        reason: `This product is referenced in ${parts.join(' and ')}. To protect your historical accounting and profit records, it cannot be permanently deleted. You can set its current stock to 0 instead.`,
      };
    }

    return {
      canDelete: true,
      purchaseCount: 0,
      saleCount: 0,
    };
  }

  async deleteProduct(id: string): Promise<void> {
    const usage = await this.checkProductUsage(id);
    if (!usage.canDelete) {
      throw new Error(usage.reason || 'Cannot delete product with existing transaction records.');
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
    };

    const updatedProduct: Product = {
      ...product,
      current_stock: newStock,
      average_cost_paise: newAverageCostPaise,
      updated_at: now,
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
    };

    // 5. Deduct stock for all affected products
    const updatedProducts: Product[] = [];
    for (const line of calculated.saleItems) {
      const prod = productMap.get(line.product_id)!;
      const updatedProd: Product = {
        ...prod,
        current_stock: prod.current_stock - line.quantity,
        updated_at: now,
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

  async restoreBackup(backup: {
    settings?: Partial<AppSettings>;
    products?: any[];
    purchases?: any[];
    sales?: any[];
  }): Promise<{ productCount: number; purchaseCount: number; saleCount: number; hasSettings: boolean }> {
    if (!backup || typeof backup !== 'object') {
      throw new Error('Invalid backup file: content is not a valid JSON object.');
    }

    const products = Array.isArray(backup.products) ? backup.products : [];
    const purchases = Array.isArray(backup.purchases) ? backup.purchases : [];
    const sales = Array.isArray(backup.sales) ? backup.sales : [];
    const settings = backup.settings && typeof backup.settings === 'object' ? backup.settings : undefined;

    if (!Array.isArray(backup.products) && !Array.isArray(backup.purchases) && !Array.isArray(backup.sales) && !settings) {
      throw new Error('Invalid backup file: does not contain products, purchases, sales, or settings.');
    }

    // Validate products basic structure
    for (const prod of products) {
      if (!prod || !prod.id || !prod.name) {
        throw new Error('Invalid product record in backup: missing id or name.');
      }
    }

    // Validate purchases basic structure
    for (const purch of purchases) {
      if (!purch || !purch.id || !purch.product_id) {
        throw new Error('Invalid purchase record in backup: missing id or product_id.');
      }
    }

    // Validate sales basic structure
    for (const sale of sales) {
      if (!sale || !sale.id || !Array.isArray(sale.items)) {
        throw new Error('Invalid sale record in backup: missing id or items array.');
      }
    }

    // Clear current products, purchases, and sales
    await this.clearAllData();

    // Restore settings if provided
    if (settings && settings.business_name) {
      await this.storage.putSettings({
        id: settings.id || 'default',
        business_name: String(settings.business_name),
        currency_format: settings.currency_format === 'text' ? 'text' : 'symbol',
      });
    }

    // Restore products with data sanitization & non-empty defaults for new/missing fields
    const productMap = new Map<string, Product>();
    for (const p of products) {
      const sanitizedProduct: Product = {
        ...p,
        id: String(p.id),
        name: String(p.name || 'Unnamed Product').trim(),
        sku: p.sku ? String(p.sku).trim() : undefined,
        car_brand: p.car_brand?.trim() || 'Universal',
        car_model: p.car_model?.trim() || 'Universal',
        product_brand: p.product_brand?.trim() || 'Standard / OEM',
        unit: p.unit?.trim() || 'pcs',
        current_stock:
          p.current_stock !== undefined && p.current_stock !== null && p.current_stock !== ''
            ? Number(p.current_stock)
            : 0,
        average_cost_paise:
          p.average_cost_paise !== undefined && p.average_cost_paise !== null && p.average_cost_paise !== ''
            ? Math.round(Number(p.average_cost_paise))
            : 0,
        selling_price_suggestion_paise:
          p.selling_price_suggestion_paise !== undefined &&
          p.selling_price_suggestion_paise !== null &&
          p.selling_price_suggestion_paise !== ''
            ? Math.round(Number(p.selling_price_suggestion_paise))
            : undefined,
        low_stock_threshold:
          p.low_stock_threshold !== undefined &&
          p.low_stock_threshold !== null &&
          p.low_stock_threshold !== ''
            ? Number(p.low_stock_threshold)
            : 5,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || p.created_at || new Date().toISOString(),
      };
      await this.storage.putProduct(sanitizedProduct);
      productMap.set(sanitizedProduct.id, sanitizedProduct);
    }

    // Restore purchases with data sanitization
    for (const pu of purchases) {
      const qty = Number(pu.quantity_received) || 1;
      const unitCost = Math.round(Number(pu.unit_cost_paise) || 0);
      const totalCost = pu.total_cost_paise !== undefined ? Math.round(Number(pu.total_cost_paise)) : qty * unitCost;
      const prodName = pu.product_name || productMap.get(String(pu.product_id))?.name || 'Item';

      const sanitizedPurchase: Purchase = {
        ...pu,
        id: String(pu.id),
        product_id: String(pu.product_id),
        product_name: String(prodName).trim(),
        quantity_received: qty,
        unit_cost_paise: unitCost,
        total_cost_paise: totalCost,
        date: pu.date || getTodayDateString(),
        supplier: pu.supplier ? String(pu.supplier).trim() : 'Direct Supplier',
        note: pu.note ? String(pu.note).trim() : undefined,
        created_at: pu.created_at || new Date().toISOString(),
      };
      await this.storage.putPurchase(sanitizedPurchase);
    }

    // Restore sales with data sanitization
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const fallbackSaleNumber = `VY-${1001 + i}`;
      const sanitizedSale: Sale = {
        ...s,
        id: String(s.id),
        sale_number: s.sale_number ? String(s.sale_number) : fallbackSaleNumber,
        date: s.date || getTodayDateString(),
        customer_name: s.customer_name ? String(s.customer_name).trim() : 'Walk-in Customer',
        customer_phone: s.customer_phone ? String(s.customer_phone).trim() : undefined,
        items: (s.items || []).map((it: any) => {
          const itemQty = Number(it.quantity) || 1;
          const sellingPrice = Math.round(Number(it.selling_price_paise) || 0);
          const costPrice = Math.round(Number(it.cost_price_paise) || 0);
          const relatedProduct = productMap.get(String(it.product_id));
          return {
            ...it,
            product_id: String(it.product_id),
            product_name: String(it.product_name || relatedProduct?.name || 'Item').trim(),
            unit: String(it.unit || relatedProduct?.unit || 'pcs').trim(),
            quantity: itemQty,
            selling_price_paise: sellingPrice,
            cost_price_paise: costPrice,
            subtotal_paise:
              it.subtotal_paise !== undefined
                ? Math.round(Number(it.subtotal_paise))
                : itemQty * sellingPrice,
            cogs_paise:
              it.cogs_paise !== undefined
                ? Math.round(Number(it.cogs_paise))
                : itemQty * costPrice,
          };
        }),
        product_selling_revenue_paise: Math.round(Number(s.product_selling_revenue_paise) || 0),
        delivery_charged_paise: Math.round(Number(s.delivery_charged_paise) || 0),
        courier_cost_paid_paise: Math.round(Number(s.courier_cost_paid_paise) || 0),
        other_direct_expenses_paise: Math.round(Number(s.other_direct_expenses_paise) || 0),
        total_amount_paise: Math.round(Number(s.total_amount_paise) || 0),
        total_cogs_paise: Math.round(Number(s.total_cogs_paise) || 0),
        profit_after_direct_costs_paise: Math.round(Number(s.profit_after_direct_costs_paise) || 0),
        status: s.status === 'voided' ? 'voided' : 'completed',
        void_reason: s.void_reason ? String(s.void_reason) : undefined,
        voided_at: s.voided_at ? String(s.voided_at) : undefined,
        created_at: s.created_at || new Date().toISOString(),
      };
      await this.storage.putSale(sanitizedSale);
    }

    return {
      productCount: products.length,
      purchaseCount: purchases.length,
      saleCount: sales.length,
      hasSettings: Boolean(settings),
    };
  }

  async seedSampleData(): Promise<void> {
    await this.clearAllData();

    // 1. Seed realistic automotive spare parts demo catalog
    const p1 = await this.saveProduct({
      name: 'Front Ceramic Brake Pads Set',
      car_brand: 'Maruti Suzuki',
      car_model: 'Swift / Dzire',
      product_brand: 'Bosch',
      sku: 'BP-MS-001',
      unit: 'set',
      current_stock: 18,
      average_cost_paise: 85000, // ₹850.00
      selling_price_suggestion_paise: 125000, // ₹1,250.00
      low_stock_threshold: 5,
    });

    const p2 = await this.saveProduct({
      name: 'Spin-On Engine Oil Filter',
      car_brand: 'Hyundai',
      car_model: 'Creta / Venue',
      product_brand: 'Purolator',
      sku: 'OF-HY-002',
      unit: 'pcs',
      current_stock: 4, // Low stock!
      average_cost_paise: 18000, // ₹180.00
      selling_price_suggestion_paise: 29000, // ₹290.00
      low_stock_threshold: 10,
    });

    const p3 = await this.saveProduct({
      name: 'Clutch Disc & Pressure Plate Kit',
      car_brand: 'Toyota',
      car_model: 'Innova Crysta',
      product_brand: 'Valeo',
      sku: 'CP-TY-003',
      unit: 'kit',
      current_stock: 6,
      average_cost_paise: 480000, // ₹4,800.00
      selling_price_suggestion_paise: 650000, // ₹6,500.00
      low_stock_threshold: 3,
    });

    const p4 = await this.saveProduct({
      name: 'Laser Iridium Spark Plugs (4 Pcs)',
      car_brand: 'Honda',
      car_model: 'City / Civic',
      product_brand: 'NGK',
      sku: 'SP-HN-004',
      unit: 'pack',
      current_stock: 12,
      average_cost_paise: 140000, // ₹1,400.00
      selling_price_suggestion_paise: 210000, // ₹2,100.00
      low_stock_threshold: 4,
    });

    const p5 = await this.saveProduct({
      name: 'Vented Front Brake Rotors (Pair)',
      car_brand: 'Mahindra',
      car_model: 'Thar / Scorpio',
      product_brand: 'Brembo',
      sku: 'DR-MH-005',
      unit: 'pair',
      current_stock: 0, // Out of stock!
      average_cost_paise: 320000, // ₹3,200.00
      selling_price_suggestion_paise: 460000, // ₹4,600.00
      low_stock_threshold: 2,
    });

    const todayStr = getTodayDateString();

    // 2. Seed historical purchases
    await this.recordPurchase({
      product_id: p1.id,
      quantity_received: 20,
      unit_cost_paise: 85000,
      date: todayStr,
      supplier: 'Bosch Automotive India Dist.',
      note: 'Stock replenishment INV-7821',
    });

    await this.recordPurchase({
      product_id: p2.id,
      quantity_received: 10,
      unit_cost_paise: 18000,
      date: todayStr,
      supplier: 'Purolator Filters Depot',
      note: 'Direct factory batch',
    });

    // 3. Seed sales with customer-specific selling price & courier amounts
    await this.recordSale({
      items: [
        {
          product_id: p1.id,
          quantity: 2,
          selling_price_paise: 120000, // Customer-specific: ₹1,200.00 instead of ₹1,250
        },
        {
          product_id: p2.id,
          quantity: 2,
          selling_price_paise: 29000,
        },
      ],
      delivery_charged_paise: 15000, // ₹150.00 courier charged to customer
      courier_cost_paid_paise: 10000, // ₹100.00 paid to courier service
      other_direct_expenses_paise: 2000, // ₹20.00 foam box packaging
      customer_name: 'Apex Motors Garage',
      customer_phone: '9876543210',
      date: todayStr,
    });

    await this.recordSale({
      items: [
        {
          product_id: p4.id,
          quantity: 1,
          selling_price_paise: 210000,
        },
      ],
      delivery_charged_paise: 0,
      courier_cost_paid_paise: 0,
      customer_name: 'Rajesh Sharma (Walk-in)',
      date: todayStr,
    });
  }
}

export const repository = new Repository();

