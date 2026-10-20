-- Vyaapaaram Initial Schema Migration
-- Database schema for inventory, purchases, sales, and profit management
-- Scoped to user workspace with Row Level Security (RLS)

-- 1. Workspaces / Businesses
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_preference TEXT NOT NULL DEFAULT 'symbol',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workspaces"
  ON workspaces
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC NOT NULL DEFAULT 0,
  average_cost_paise BIGINT NOT NULL DEFAULT 0,
  selling_price_suggestion_paise BIGINT,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage products in their workspace"
  ON products
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(workspace_id, name);

-- 3. Purchases Table (Stock additions)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity_received NUMERIC NOT NULL CHECK (quantity_received > 0),
  unit_cost_paise BIGINT NOT NULL CHECK (unit_cost_paise >= 0),
  total_cost_paise BIGINT NOT NULL CHECK (total_cost_paise >= 0),
  date DATE NOT NULL,
  supplier TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage purchases in their workspace"
  ON purchases
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_purchases_workspace_date ON purchases(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);

-- 4. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  sale_number TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL,
  product_selling_revenue_paise BIGINT NOT NULL CHECK (product_selling_revenue_paise >= 0),
  delivery_charged_paise BIGINT NOT NULL DEFAULT 0 CHECK (delivery_charged_paise >= 0),
  courier_cost_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (courier_cost_paid_paise >= 0),
  other_direct_expenses_paise BIGINT NOT NULL DEFAULT 0 CHECK (other_direct_expenses_paise >= 0),
  total_cogs_paise BIGINT NOT NULL DEFAULT 0 CHECK (total_cogs_paise >= 0),
  total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise >= 0),
  profit_after_direct_costs_paise BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sales in their workspace"
  ON sales
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_sales_workspace_date ON sales(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(workspace_id, status);

