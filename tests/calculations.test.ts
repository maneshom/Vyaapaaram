import { describe, it, expect } from 'vitest';
import {
  calculateMovingAverageCost,
  calculateSaleTotals,
  validateSaleInput,
  calculateFinancialSummary,
  calculateInventorySummary,
} from '../src/utils/calculations';
import { Product, Sale } from '../src/types';

describe('Calculations & Costing Logic', () => {
  describe('Moving Average Cost (MAC)', () => {
    it('sets average unit cost to purchase unit cost when initial stock is 0', () => {
      const result = calculateMovingAverageCost(0, 0, 10, 5000); // 10 units @ ₹50.00
      expect(result.newStock).toBe(10);
      expect(result.newAverageCostPaise).toBe(5000);
    });

    it('correctly calculates weighted moving average cost on subsequent stock receipts', () => {
      // Current: 10 units @ ₹50.00 = ₹500 (50,000 paise)
      // New: 10 units @ ₹70.00 = ₹700 (70,000 paise)
      // Total: 20 units, Total Cost: ₹1,200 (120,000 paise) -> New Average: ₹60.00 (6,000 paise)
      const result = calculateMovingAverageCost(10, 5000, 10, 7000);
      expect(result.newStock).toBe(20);
      expect(result.newAverageCostPaise).toBe(6000);
    });

    it('handles fractional weights and rounds properly to integer paise', () => {
      // Current: 15 units @ ₹33.33 (3333 paise)
      // New: 7 units @ ₹45.50 (4550 paise)
      // (15 * 3333 + 7 * 4550) / 22 = (49995 + 31850) / 22 = 81845 / 22 = 3720.227 -> 3720 paise
      const result = calculateMovingAverageCost(15, 3333, 7, 4550);
      expect(result.newStock).toBe(22);
      expect(result.newAverageCostPaise).toBe(3720);
    });

    it('throws error for invalid purchase quantity or negative cost', () => {
      expect(() => calculateMovingAverageCost(10, 5000, 0, 5000)).toThrow();
      expect(() => calculateMovingAverageCost(10, 5000, -5, 5000)).toThrow();
      expect(() => calculateMovingAverageCost(10, 5000, 5, -100)).toThrow();
    });
  });

  describe('Sale Totals & Profit After Direct Sale Costs', () => {
    const mockProduct: Product = {
      id: 'prod-1',
      name: 'Test Item',
      unit: 'pcs',
      current_stock: 50,
      average_cost_paise: 2000, // ₹20.00
      low_stock_threshold: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    it('matches the exact example from specification', () => {
      // Product cost: ₹20 (2000 paise)
      // Product selling price: ₹30 (3000 paise)
      // Delivery charged to customer: ₹5 (500 paise)
      // Courier cost paid after discount: ₹2 (200 paise)
      // Expected Profit after direct sale costs: ₹13 (1300 paise)
      const res = calculateSaleTotals({
        items: [
          {
            product: mockProduct,
            quantity: 1,
            selling_price_paise: 3000,
          },
        ],
        delivery_charged_paise: 500,
        courier_cost_paid_paise: 200,
        other_direct_expenses_paise: 0,
      });

      expect(res.product_selling_revenue_paise).toBe(3000); // ₹30
      expect(res.delivery_charged_paise).toBe(500); // ₹5
      expect(res.total_amount_paise).toBe(3500); // ₹35 bill to customer
      expect(res.total_cogs_paise).toBe(2000); // ₹20 COGS
      expect(res.courier_cost_paid_paise).toBe(200); // ₹2 Courier cost
      expect(res.profit_after_direct_costs_paise).toBe(1300); // ₹13 Profit after direct costs
    });

    it('works normally when delivery charge and courier cost are 0', () => {
      const res = calculateSaleTotals({
        items: [
          {
            product: mockProduct,
            quantity: 2,
            selling_price_paise: 3000, // 2 * 3000 = 6000
          },
        ],
        delivery_charged_paise: 0,
        courier_cost_paid_paise: 0,
        other_direct_expenses_paise: 0,
      });

      expect(res.product_selling_revenue_paise).toBe(6000);
      expect(res.total_cogs_paise).toBe(4000); // 2 * 2000
      expect(res.profit_after_direct_costs_paise).toBe(2000); // 6000 - 4000 = 2000
    });

    it('deducts direct sale expenses if present', () => {
      const res = calculateSaleTotals({
        items: [
          {
            product: mockProduct,
            quantity: 1,
            selling_price_paise: 3000,
          },
        ],
        delivery_charged_paise: 500,
        courier_cost_paid_paise: 200,
        other_direct_expenses_paise: 100, // ₹1 packaging
      });

      // 3000 + 500 - 2000 - 200 - 100 = 1200 paise (₹12)
      expect(res.profit_after_direct_costs_paise).toBe(1200);
    });
  });

  describe('Sale Input Validation', () => {
    const stockMap = new Map<string, Product>([
      [
        'prod-1',
        {
          id: 'prod-1',
          name: 'Rice Bag',
          unit: 'pack',
          current_stock: 5,
          average_cost_paise: 40000,
          low_stock_threshold: 2,
          created_at: '',
          updated_at: '',
          sync_status: 'synced',
        },
      ],
    ]);

    it('fails when selling quantity exceeds available stock', () => {
      const check = validateSaleInput({
        items: [{ product_id: 'prod-1', quantity: 6, selling_price_paise: 50000 }],
        stockLookup: stockMap,
      });
      expect(check.valid).toBe(false);
      expect(check.errors[0]).toContain('Available stock is only 5');
    });

    it('succeeds when selling quantity is less than or equal to stock', () => {
      const check = validateSaleInput({
        items: [{ product_id: 'prod-1', quantity: 5, selling_price_paise: 50000 }],
        stockLookup: stockMap,
      });
      expect(check.valid).toBe(true);
      expect(check.errors.length).toBe(0);
    });

    it('rejects invalid or negative values', () => {
      const check = validateSaleInput({
        items: [{ product_id: 'prod-1', quantity: -1, selling_price_paise: -100 }],
        stockLookup: stockMap,
      });
      expect(check.valid).toBe(false);
      expect(check.errors.length).toBeGreaterThan(0);
    });
  });
});

