import {
  Product,
  Purchase,
  Sale,
  SaleItem,
  FinancialSummary,
  InventorySummary,
  ProductReportItem,
} from '../types';

/**
 * Calculates new moving average cost and new stock when a purchase is received.
 *
 * Moving Average Cost Formula:
 * - If current stock is 0 or negative: new average cost = purchase unit cost.
 * - Otherwise:
 *   new_avg_cost = Math.round((current_stock * current_avg_cost + purchase_qty * purchase_unit_cost) / (current_stock + purchase_qty))
 */
export function calculateMovingAverageCost(
  currentStock: number,
  currentAverageCostPaise: number,
  purchaseQuantity: number,
  purchaseUnitCostPaise: number
): { newStock: number; newAverageCostPaise: number } {
  if (purchaseQuantity <= 0) {
    throw new Error('Purchase quantity must be greater than zero');
  }
  if (purchaseUnitCostPaise < 0) {
    throw new Error('Purchase unit cost cannot be negative');
  }

  const newStock = currentStock + purchaseQuantity;

  if (currentStock <= 0) {
    return {
      newStock,
      newAverageCostPaise: Math.round(purchaseUnitCostPaise),
    };
  }

  const existingTotalCost = currentStock * currentAverageCostPaise;
  const newBatchCost = purchaseQuantity * purchaseUnitCostPaise;
  const newAverageCostPaise = Math.round(
    (existingTotalCost + newBatchCost) / newStock
  );

  return {
    newStock,
    newAverageCostPaise,
  };
}

/**
 * Calculates line items and profit for a sale.
 *
 * Profit after direct sale costs =
 *   product selling revenue
 *   + delivery charged to customer
 *   - cost of goods sold (COGS)
 *   - courier cost paid
 *   - other direct sale expenses
 */
export function calculateSaleTotals(params: {
  items: Array<{
    product: Product;
    quantity: number;
    selling_price_paise: number;
  }>;
  delivery_charged_paise?: number;
  courier_cost_paid_paise?: number;
  other_direct_expenses_paise?: number;
}): {
  saleItems: SaleItem[];
  product_selling_revenue_paise: number;
  delivery_charged_paise: number;
  courier_cost_paid_paise: number;
  other_direct_expenses_paise: number;
  total_cogs_paise: number;
  total_amount_paise: number;
  profit_after_direct_costs_paise: number;
} {
  const delivery_charged_paise = Math.max(0, params.delivery_charged_paise || 0);
  const courier_cost_paid_paise = Math.max(0, params.courier_cost_paid_paise || 0);
  const other_direct_expenses_paise = Math.max(0, params.other_direct_expenses_paise || 0);

  let product_selling_revenue_paise = 0;
  let total_cogs_paise = 0;

  const saleItems: SaleItem[] = params.items.map((item) => {
    const qty = Math.max(0, item.quantity);
    const sellingPrice = Math.max(0, item.selling_price_paise);
    const costPrice = Math.max(0, item.product.average_cost_paise);

    const subtotal = Math.round(qty * sellingPrice);
    const cogs = Math.round(qty * costPrice);

    product_selling_revenue_paise += subtotal;
    total_cogs_paise += cogs;

    return {
      product_id: item.product.id,
      product_name: item.product.name,
      unit: item.product.unit,
      quantity: qty,
      selling_price_paise: sellingPrice,
      cost_price_paise: costPrice,
      subtotal_paise: subtotal,
      cogs_paise: cogs,
    };
  });

  const total_amount_paise = product_selling_revenue_paise + delivery_charged_paise;

  const profit_after_direct_costs_paise =
    product_selling_revenue_paise +
    delivery_charged_paise -
    total_cogs_paise -
    courier_cost_paid_paise -
    other_direct_expenses_paise;

  return {
    saleItems,
    product_selling_revenue_paise,
    delivery_charged_paise,
    courier_cost_paid_paise,
    other_direct_expenses_paise,
    total_cogs_paise,
    total_amount_paise,
    profit_after_direct_costs_paise,
  };
}

/**
 * Validates sale line items against inventory constraints and rules.
 */
export function validateSaleInput(params: {
  items: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
    selling_price_paise: number;
  }>;
  stockLookup: Map<string, Product>;
  delivery_charged_paise?: number;
  courier_cost_paid_paise?: number;
  other_direct_expenses_paise?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.items || params.items.length === 0) {
    errors.push('A sale must have at least one product.');
    return { valid: false, errors };
  }

  // Aggregate quantity per product in case same product added multiple times
  const requestedQtyMap = new Map<string, number>();

  for (let i = 0; i < params.items.length; i++) {
    const item = params.items[i];
    const product = params.stockLookup.get(item.product_id);
    const label = product?.name || item.product_name || `Item #${i + 1}`;

    if (!product) {
      errors.push(`Product "${label}" does not exist in inventory.`);
      continue;
    }

    if (item.quantity <= 0) {
      errors.push(`Quantity for "${label}" must be greater than zero.`);
    }

    if (item.selling_price_paise < 0) {
      errors.push(`Selling price for "${label}" cannot be negative.`);
    }

    const currentReq = requestedQtyMap.get(item.product_id) || 0;
    requestedQtyMap.set(item.product_id, currentReq + item.quantity);
  }

  // Stock check
  for (const [productId, totalRequested] of requestedQtyMap.entries()) {
    const product = params.stockLookup.get(productId);
    if (product) {
      if (totalRequested > product.current_stock) {
        errors.push(
          `Cannot sell ${totalRequested} ${product.unit} of "${product.name}". Available stock is only ${product.current_stock} ${product.unit}.`
        );
      }
    }
  }

  if (params.delivery_charged_paise !== undefined && params.delivery_charged_paise < 0) {
    errors.push('Delivery charged cannot be negative.');
  }

  if (params.courier_cost_paid_paise !== undefined && params.courier_cost_paid_paise < 0) {
    errors.push('Courier cost paid cannot be negative.');
  }

  if (params.other_direct_expenses_paise !== undefined && params.other_direct_expenses_paise < 0) {
    errors.push('Direct sale expenses cannot be negative.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Computes financial summary for a given set of sales (voided sales excluded).
 */
export function calculateFinancialSummary(
  sales: Sale[],
  periodLabel: string
): FinancialSummary {
  const validSales = sales.filter((s) => s.status !== 'voided');

  let product_selling_revenue_paise = 0;
  let delivery_charged_paise = 0;
  let total_cogs_paise = 0;
  let courier_cost_paid_paise = 0;
  let other_direct_expenses_paise = 0;
  let profit_after_direct_costs_paise = 0;

  for (const sale of validSales) {
    product_selling_revenue_paise += sale.product_selling_revenue_paise;
    delivery_charged_paise += sale.delivery_charged_paise;
    total_cogs_paise += sale.total_cogs_paise;
    courier_cost_paid_paise += sale.courier_cost_paid_paise;
    other_direct_expenses_paise += sale.other_direct_expenses_paise;
    profit_after_direct_costs_paise += sale.profit_after_direct_costs_paise;
  }

  const total_revenue_paise = product_selling_revenue_paise + delivery_charged_paise;
  const total_sales_count = validSales.length;

  const profit_margin_percentage =
    total_revenue_paise > 0
      ? Math.round((profit_after_direct_costs_paise / total_revenue_paise) * 10000) / 100
      : 0;

  const average_sale_value_paise =
    total_sales_count > 0 ? Math.round(total_revenue_paise / total_sales_count) : 0;

  return {
    period_label: periodLabel,
    total_sales_count,
    product_selling_revenue_paise,
    delivery_charged_paise,
    total_revenue_paise,
    total_cogs_paise,
    courier_cost_paid_paise,
    other_direct_expenses_paise,
    profit_after_direct_costs_paise,
    profit_margin_percentage,
    average_sale_value_paise,
  };
}

/**
 * Computes current inventory snapshot.
 */
export function calculateInventorySummary(products: Product[]): InventorySummary {
  let total_products_count = products.length;
  let total_stock_quantity = 0;
  let low_stock_products_count = 0;
  let out_of_stock_products_count = 0;
  let estimated_stock_value_paise = 0;

  for (const product of products) {
    total_stock_quantity += product.current_stock;
    const value = Math.max(0, product.current_stock) * product.average_cost_paise;
    estimated_stock_value_paise += value;

    if (product.current_stock <= 0) {
      out_of_stock_products_count++;
      low_stock_products_count++; // Also counts as low stock
    } else if (product.current_stock <= product.low_stock_threshold) {
      low_stock_products_count++;
    }
  }

  return {
    total_products_count,
    total_stock_quantity,
    low_stock_products_count,
    out_of_stock_products_count,
    estimated_stock_value_paise,
  };
}

/**
 * Builds detailed product-level stock and performance metrics for reports.
 */
export function calculateProductReportItems(
  products: Product[],
  sales: Sale[]
): ProductReportItem[] {
  const validSales = sales.filter((s) => s.status !== 'voided');

  // Map to track period sales per product
  const salesByProduct = new Map<
    string,
    { qty: number; revenue: number; cogs: number }
  >();

  for (const sale of validSales) {
    for (const item of sale.items) {
      const existing = salesByProduct.get(item.product_id) || {
        qty: 0,
        revenue: 0,
        cogs: 0,
      };
      existing.qty += item.quantity;
      existing.revenue += item.subtotal_paise;
      existing.cogs += item.cogs_paise;
      salesByProduct.set(item.product_id, existing);
    }
  }

  return products.map((prod) => {
    const perf = salesByProduct.get(prod.id) || { qty: 0, revenue: 0, cogs: 0 };
    const stockVal = Math.max(0, prod.current_stock) * prod.average_cost_paise;

    return {
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      car_brand: prod.car_brand,
      car_model: prod.car_model,
      product_brand: prod.product_brand,
      unit: prod.unit,
      current_stock: prod.current_stock,
      average_cost_paise: prod.average_cost_paise,
      current_stock_value_paise: stockVal,
      quantity_sold_in_period: perf.qty,
      revenue_in_period_paise: perf.revenue,
      cogs_in_period_paise: perf.cogs,
      profit_in_period_paise: perf.revenue - perf.cogs,
      is_low_stock: prod.current_stock <= prod.low_stock_threshold && prod.current_stock > 0,
      is_out_of_stock: prod.current_stock <= 0,
    };
  });
}

