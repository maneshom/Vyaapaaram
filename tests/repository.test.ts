import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../src/storage/db';
import { Repository } from '../src/storage/repository';

describe('Repository Atomic Operations & Inventory Lifecycle', () => {
  let memoryStorage: InMemoryStorage;
  let repo: Repository;

  beforeEach(() => {
    memoryStorage = new InMemoryStorage();
    repo = new Repository(memoryStorage);
  });

  it('creates product and updates stock atomically on purchase', async () => {
    // 1. Create product with initial 0 stock
    const prod = await repo.saveProduct({
      name: 'Toor Dal 1kg',
      unit: 'kg',
      current_stock: 0,
      average_cost_paise: 0,
      low_stock_threshold: 5,
    });

    expect(prod.current_stock).toBe(0);

    // 2. Record purchase of 10 kg @ ₹100.00 (10000 paise)
    const { purchase, updatedProduct } = await repo.recordPurchase({
      product_id: prod.id,
      quantity_received: 10,
      unit_cost_paise: 10000,
      date: '2026-10-20',
      supplier: 'Deccan Mills',
    });

    expect(purchase.total_cost_paise).toBe(100000); // ₹1,000.00
    expect(updatedProduct.current_stock).toBe(10);
    expect(updatedProduct.average_cost_paise).toBe(10000); // ₹100.00

    // 3. Record second purchase of 10 kg @ ₹140.00 (14000 paise)
    // New moving avg cost should be (10 * 10000 + 10 * 14000) / 20 = 12000 paise (₹120.00)
    const second = await repo.recordPurchase({
      product_id: prod.id,
      quantity_received: 10,
      unit_cost_paise: 14000,
      date: '2026-10-21',
    });

    expect(second.updatedProduct.current_stock).toBe(20);
    expect(second.updatedProduct.average_cost_paise).toBe(12000);
  });

  it('records sale with captured COGS and reduces stock atomically', async () => {
    const prod = await repo.saveProduct({
      name: 'Coconut Oil 1L',
      unit: 'bottle',
      current_stock: 10,
      average_cost_paise: 20000, // ₹200.00
      selling_price_suggestion_paise: 25000,
    });

    // Make a sale of 3 bottles at customer-specific price ₹260.00 (26000 paise)
    const { sale, updatedProducts } = await repo.recordSale({
      items: [
        {
          product_id: prod.id,
          quantity: 3,
          selling_price_paise: 26000,
        },
      ],
      delivery_charged_paise: 4000, // ₹40.00 delivery
      courier_cost_paid_paise: 2500, // ₹25.00 courier cost
      customer_name: 'Aditi Rao',
    });

    // Check stock was deducted
    expect(updatedProducts[0].current_stock).toBe(7);
    const dbProduct = await repo.getProduct(prod.id);
    expect(dbProduct?.current_stock).toBe(7);

    // Check sale numbers & COGS captured
    expect(sale.items[0].cost_price_paise).toBe(20000); // Snapshot of ₹200 COGS per unit
    expect(sale.total_cogs_paise).toBe(60000); // 3 * 20000 = ₹600.00
    expect(sale.product_selling_revenue_paise).toBe(78000); // 3 * 26000 = ₹780.00
    expect(sale.delivery_charged_paise).toBe(4000);
    expect(sale.total_amount_paise).toBe(82000); // ₹820.00 bill to customer

    // Profit after direct sale costs = 78000 + 4000 - 60000 - 2500 = 19500 paise (₹195.00)
    expect(sale.profit_after_direct_costs_paise).toBe(19500);
  });

  it('preserves historical sale COGS and profit when later purchases change moving average cost', async () => {
    const prod = await repo.saveProduct({
      name: 'Coffee Blend',
      unit: 'pack',
      current_stock: 5,
      average_cost_paise: 10000, // ₹100.00
    });

    // Sale made at cost ₹100.00
    const { sale: pastSale } = await repo.recordSale({
      items: [{ product_id: prod.id, quantity: 2, selling_price_paise: 15000 }],
    });
    expect(pastSale.total_cogs_paise).toBe(20000);
    expect(pastSale.profit_after_direct_costs_paise).toBe(10000);

    // Later new purchase received at high cost ₹200.00
    await repo.recordPurchase({
      product_id: prod.id,
      quantity_received: 10,
      unit_cost_paise: 20000,
      date: '2026-10-22',
    });

    // Verify past sale record is UNCHANGED
    const retrievedPastSale = await repo.getSale(pastSale.id);
    expect(retrievedPastSale?.total_cogs_paise).toBe(20000);
    expect(retrievedPastSale?.profit_after_direct_costs_paise).toBe(10000);
  });

  it('prevents selling more than available stock', async () => {
    const prod = await repo.saveProduct({
      name: 'Limited Saffron',
      unit: 'box',
      current_stock: 2,
      average_cost_paise: 50000,
    });

    await expect(
      repo.recordSale({
        items: [{ product_id: prod.id, quantity: 3, selling_price_paise: 80000 }],
      })
    ).rejects.toThrow(/Available stock is only 2/);

    // Verify stock remains untouched
    const checkProd = await repo.getProduct(prod.id);
    expect(checkProd?.current_stock).toBe(2);
  });

  it('safely voids a sale, restores inventory stock, and retains an audit trail', async () => {
    const prod = await repo.saveProduct({
      name: 'Cardamom 100g',
      unit: 'pack',
      current_stock: 10,
      average_cost_paise: 30000,
    });

    // Make sale of 4 packs -> stock drops to 6
    const { sale } = await repo.recordSale({
      items: [{ product_id: prod.id, quantity: 4, selling_price_paise: 45000 }],
    });

    let currentProd = await repo.getProduct(prod.id);
    expect(currentProd?.current_stock).toBe(6);

    // Void the sale
    const { sale: voidedSale, restoredProducts } = await repo.voidSale(
      sale.id,
      'Customer returned unopened package'
    );

    expect(voidedSale.status).toBe('voided');
    expect(voidedSale.void_reason).toBe('Customer returned unopened package');
    expect(voidedSale.voided_at).toBeDefined();

    // Verify stock restored
    expect(restoredProducts[0].current_stock).toBe(10);
    currentProd = await repo.getProduct(prod.id);
    expect(currentProd?.current_stock).toBe(10);

    // Trying to void again must fail
    await expect(repo.voidSale(sale.id, 'Double void attempt')).rejects.toThrow(
      /already voided/
    );

    // Reports must exclude voided sale from revenues and profit
    const reports = await repo.getReportsData({
      type: 'this_month',
      startDate: '2020-01-01',
      endDate: '2030-12-31',
    });
    expect(reports.financialSummary.total_sales_count).toBe(0);
    expect(reports.financialSummary.total_revenue_paise).toBe(0);
  });

  it('allows deleting an unused product, but prevents deleting products with transaction history', async () => {
    // 1. Create a product without any purchases or sales
    const unusedProd = await repo.saveProduct({
      name: 'Unused Test Item',
      unit: 'pcs',
      current_stock: 0,
      average_cost_paise: 0,
    });

    const usageBefore = await repo.checkProductUsage(unusedProd.id);
    expect(usageBefore.canDelete).toBe(true);

    // Deleting should succeed
    await repo.deleteProduct(unusedProd.id);
    const deletedCheck = await repo.getProduct(unusedProd.id);
    expect(deletedCheck).toBeUndefined();

    // 2. Create another product and record a purchase for it
    const purchasedProd = await repo.saveProduct({
      name: 'Item With Purchases',
      unit: 'kg',
      current_stock: 0,
      average_cost_paise: 0,
    });
    await repo.recordPurchase({
      product_id: purchasedProd.id,
      quantity_received: 5,
      unit_cost_paise: 1000,
      date: '2026-10-21',
    });

    const usageAfterPurchase = await repo.checkProductUsage(purchasedProd.id);
    expect(usageAfterPurchase.canDelete).toBe(false);
    expect(usageAfterPurchase.purchaseCount).toBe(1);

    await expect(repo.deleteProduct(purchasedProd.id)).rejects.toThrow(
      /purchase record/
    );
  });

  it('stores and retrieves automotive part attributes: car_brand, car_model, and product_brand', async () => {
    const part = await repo.saveProduct({
      name: 'Front Brake Pads',
      car_brand: 'Maruti Suzuki',
      car_model: 'Swift / Dzire',
      product_brand: 'Bosch',
      sku: 'BP-MS-001',
      unit: 'set',
      current_stock: 10,
      average_cost_paise: 80000,
      selling_price_suggestion_paise: 120000,
      low_stock_threshold: 3,
    });

    expect(part.car_brand).toBe('Maruti Suzuki');
    expect(part.car_model).toBe('Swift / Dzire');
    expect(part.product_brand).toBe('Bosch');
    expect(part.sku).toBe('BP-MS-001');

    const fetched = await repo.getProduct(part.id);
    expect(fetched?.car_brand).toBe('Maruti Suzuki');
    expect(fetched?.car_model).toBe('Swift / Dzire');
    expect(fetched?.product_brand).toBe('Bosch');

    // Test seedSampleData loads automotive parts catalog correctly
    await repo.seedSampleData();
    const allProducts = await repo.getProducts();
    expect(allProducts.length).toBeGreaterThanOrEqual(4);
    const boschPart = allProducts.find((p) => p.product_brand === 'Bosch');
    expect(boschPart).toBeDefined();
    expect(boschPart?.car_brand).toBe('Maruti Suzuki');
  });

  it('restores backup data cleanly, replacing existing records', async () => {
    // 1. Initial product before restore
    await repo.saveProduct({
      name: 'Old Initial Part',
      unit: 'pcs',
      current_stock: 50,
      average_cost_paise: 1000,
    });
    const beforeProducts = await repo.getProducts();
    expect(beforeProducts.length).toBe(1);

    // 2. Prepare backup payload
    const backupPayload = {
      settings: {
        id: 'default',
        business_name: 'Metro Auto Spares & Performance',
        currency_format: 'text' as const,
      },
      products: [
        {
          id: 'prod_spark_01',
          name: 'Iridium Spark Plug',
          car_brand: 'Honda',
          car_model: 'City / Civic',
          product_brand: 'NGK',
          sku: 'NGK-SP-001',
          unit: 'pcs',
          current_stock: 12,
          average_cost_paise: 45000,
          selling_price_suggestion_paise: 75000,
          low_stock_threshold: 4,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      purchases: [
        {
          id: 'purch_01',
          product_id: 'prod_spark_01',
          product_name: 'Iridium Spark Plug',
          quantity_received: 12,
          unit_cost_paise: 45000,
          total_cost_paise: 540000,
          date: '2026-10-05',
          supplier: 'NGK Direct Distributor',
          note: 'Stock batch 1',
          created_at: '2026-10-05T00:00:00.000Z',
        },
      ],
      sales: [
        {
          id: 'sale_01',
          sale_number: 'SALE-1001',
          date: '2026-10-10',
          customer_name: 'Speedy Wheels Garage',
          customer_phone: '9876500000',
          items: [
            {
              product_id: 'prod_spark_01',
              product_name: 'Iridium Spark Plug',
              unit: 'pcs',
              quantity: 4,
              selling_price_paise: 75000,
              cost_price_paise: 45000,
              subtotal_paise: 300000,
              cogs_paise: 180000,
            },
          ],
          product_selling_revenue_paise: 300000,
          delivery_charged_paise: 10000,
          courier_cost_paid_paise: 6000,
          other_direct_expenses_paise: 1000,
          total_amount_paise: 310000,
          total_cogs_paise: 180000,
          profit_after_direct_costs_paise: 123000,
          status: 'completed' as const,
          created_at: '2026-10-10T00:00:00.000Z',
        },
      ],
    };

    // 3. Execute restore
    const summary = await repo.restoreBackup(backupPayload);
    expect(summary.productCount).toBe(1);
    expect(summary.purchaseCount).toBe(1);
    expect(summary.saleCount).toBe(1);
    expect(summary.hasSettings).toBe(true);

    // 4. Verify old product was replaced with restored product
    const restoredProducts = await repo.getProducts();
    expect(restoredProducts.length).toBe(1);
    expect(restoredProducts[0].id).toBe('prod_spark_01');
    expect(restoredProducts[0].name).toBe('Iridium Spark Plug');
    expect(restoredProducts[0].car_brand).toBe('Honda');
    expect(restoredProducts[0].car_model).toBe('City / Civic');
    expect(restoredProducts[0].product_brand).toBe('NGK');

    // 5. Verify purchases and sales
    const restoredPurchases = await repo.getPurchases();
    expect(restoredPurchases.length).toBe(1);
    expect(restoredPurchases[0].id).toBe('purch_01');
    expect(restoredPurchases[0].supplier).toBe('NGK Direct Distributor');

    const restoredSales = await repo.getSales();
    expect(restoredSales.length).toBe(1);
    expect(restoredSales[0].id).toBe('sale_01');
    expect(restoredSales[0].customer_name).toBe('Speedy Wheels Garage');

    // 6. Verify settings restored
    const restoredSettings = await repo.getSettings();
    expect(restoredSettings.business_name).toBe('Metro Auto Spares & Performance');
    expect(restoredSettings.currency_format).toBe('text');
  });

  it('rejects invalid backup structures with descriptive errors', async () => {
    // Non-object
    await expect(repo.restoreBackup(null as any)).rejects.toThrow(/not a valid JSON object/);
    await expect(repo.restoreBackup('string' as any)).rejects.toThrow(/not a valid JSON object/);

    // Empty object without relevant keys
    await expect(repo.restoreBackup({} as any)).rejects.toThrow(/does not contain products, purchases, sales, or settings/);

    // Invalid product record
    await expect(
      repo.restoreBackup({
        products: [{ name: 'Missing ID' } as any],
      })
    ).rejects.toThrow(/missing id or name/);

    // Invalid purchase record
    await expect(
      repo.restoreBackup({
        purchases: [{ id: 'purch_1' } as any],
      })
    ).rejects.toThrow(/missing id or product_id/);

    // Invalid sale record
    await expect(
      repo.restoreBackup({
        sales: [{ id: 'sale_1', items: 'not an array' } as any],
      })
    ).rejects.toThrow(/missing id or items array/);
  });

  it('populates non-empty default values when restoring JSON with new or missing fields', async () => {
    // Legacy backup payload with minimal fields (no car_brand, car_model, product_brand, unit, etc.)
    const legacyPayload = {
      products: [
        {
          id: 'legacy_prod_1',
          name: 'Universal Brake Fluid DOT 4',
          // car_brand, car_model, product_brand, unit, low_stock_threshold omitted
        },
      ],
      purchases: [
        {
          id: 'legacy_purch_1',
          product_id: 'legacy_prod_1',
          // supplier, date, quantity_received omitted
        },
      ],
      sales: [
        {
          id: 'legacy_sale_1',
          items: [
            {
              product_id: 'legacy_prod_1',
              selling_price_paise: 25000,
            },
          ],
          // sale_number, customer_name, status omitted
        },
      ],
    };

    const summary = await repo.restoreBackup(legacyPayload as any);
    expect(summary.productCount).toBe(1);
    expect(summary.purchaseCount).toBe(1);
    expect(summary.saleCount).toBe(1);

    const prods = await repo.getProducts();
    const p = prods[0];
    // Check non-empty default values are assigned
    expect(p.car_brand).toBe('Universal');
    expect(p.car_model).toBe('Universal');
    expect(p.product_brand).toBe('Standard / OEM');
    expect(p.unit).toBe('pcs');
    expect(p.low_stock_threshold).toBe(5);
    expect(p.current_stock).toBe(0);
    expect(p.average_cost_paise).toBe(0);
    expect(p.created_at).toBeTruthy();
    expect(p.updated_at).toBeTruthy();

    const purchases = await repo.getPurchases();
    expect(purchases[0].supplier).toBe('Direct Supplier');
    expect(purchases[0].product_name).toBe('Universal Brake Fluid DOT 4');
    expect(purchases[0].quantity_received).toBe(1);

    const sales = await repo.getSales();
    expect(sales[0].customer_name).toBe('Walk-in Customer');
    expect(sales[0].sale_number).toBeTruthy();
    expect(sales[0].status).toBe('completed');
  });
});

