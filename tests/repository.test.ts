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
});

