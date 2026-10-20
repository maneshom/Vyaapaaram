export type SyncStatus = 'synced' | 'pending' | 'local_only' | 'failed';

export type CurrencyPreference = 'symbol' | 'text'; // 'symbol' = ₹, 'text' = Rs

export interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string; // e.g. "pcs", "kg", "box", "pack"
  current_stock: number;
  average_cost_paise: number; // Moving average cost per unit in integer paise
  selling_price_suggestion_paise?: number; // Optional default selling price
  low_stock_threshold: number; // Alert threshold (e.g. 5)
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  synced_at?: string;
  sync_error?: string;
}

export interface Purchase {
  id: string;
  product_id: string;
  product_name: string;
  quantity_received: number;
  unit_cost_paise: number; // Cost paid per unit in integer paise
  total_cost_paise: number; // quantity * unit_cost_paise
  date: string; // ISO date string YYYY-MM-DD
  supplier?: string;
  note?: string;
  created_at: string;
  sync_status: SyncStatus;
  synced_at?: string;
  sync_error?: string;
}

export interface SaleItem {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  selling_price_paise: number; // Customer-specific selling price per unit
  cost_price_paise: number; // Captured moving average cost at the exact time of sale (COGS)
  subtotal_paise: number; // quantity * selling_price_paise
  cogs_paise: number; // quantity * cost_price_paise
}

export type SaleStatus = 'completed' | 'voided';

export interface Sale {
  id: string;
  sale_number: string;
  date: string; // ISO string
  customer_name?: string;
  customer_phone?: string;
  items: SaleItem[];
  product_selling_revenue_paise: number; // sum of item subtotals
  delivery_charged_paise: number; // Charged to customer (default 0)
  courier_cost_paid_paise: number; // Owner actually paid to courier after discount (default 0)
  other_direct_expenses_paise: number; // Other direct sale expenses (default 0)
  total_cogs_paise: number; // sum of item COGS
  total_amount_paise: number; // product_selling_revenue + delivery_charged
  profit_after_direct_costs_paise: number; // Revenue + Delivery Charged - COGS - Courier Cost - Direct Expenses
  status: SaleStatus;
  void_reason?: string;
  voided_at?: string;
  created_at: string;
  sync_status: SyncStatus;
  synced_at?: string;
  sync_error?: string;
}

export interface AppSettings {
  id: string; // singleton 'default'
  business_name: string;
  currency_format: CurrencyPreference;
  supabase_url?: string;
  supabase_anon_key?: string;
  cloud_sync_enabled: boolean;
  workspace_id: string;
  last_synced_at?: string;
}

export interface ReportPeriodFilter {
  type: 'today' | 'this_month' | 'last_30_days' | 'custom';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface FinancialSummary {
  period_label: string;
  total_sales_count: number;
  product_selling_revenue_paise: number;
  delivery_charged_paise: number;
  total_revenue_paise: number;
  total_cogs_paise: number;
  courier_cost_paid_paise: number;
  other_direct_expenses_paise: number;
  profit_after_direct_costs_paise: number;
  profit_margin_percentage: number;
  average_sale_value_paise: number;
}

export interface InventorySummary {
  total_products_count: number;
  total_stock_quantity: number;
  low_stock_products_count: number;
  out_of_stock_products_count: number;
  estimated_stock_value_paise: number; // sum of (current_stock * average_cost_paise)
}

export interface ProductReportItem {
  product_id: string;
  product_name: string;
  sku?: string;
  unit: string;
  current_stock: number;
  average_cost_paise: number;
  current_stock_value_paise: number;
  quantity_sold_in_period: number;
  revenue_in_period_paise: number;
  cogs_in_period_paise: number;
  profit_in_period_paise: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
}

