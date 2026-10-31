# Vyaapaaram (व्यापारम्)

A simple, reliable inventory, sales, and profit management Progressive Web App (PWA) tailored for small business owners and shopkeepers.

---

## 🎯 Product Goals

1. **Track Products & Stock Additions (Purchases)**: Record inward inventory with supplier details, invoice references, and automatic moving average cost recalculation.
2. **Customer-Specific Sales Pricing**: Allow customer-specific selling prices that differ from default catalog prices on every line item.
3. **Delivery & Courier Accounting**: Track courier amounts as two separate optional fields on every sale:
   - *Delivery charged to customer* (added to customer bill)
   - *Courier cost paid* (actual discounted cost paid to courier)
4. **Transparent Profit Calculation**: Understand exact stock levels, valuation, and **Profit after direct sale costs** through clear period reports and product-level breakdowns.
5. **Local Storage & Fast PWA**: Instant response times with local IndexedDB storage and full offline capabilities as an installable PWA.

---

## 💰 Money & Currency Standards

- **Default Currency**: Indian Rupee (`₹` / `INR`).
- **Storage & Arithmetic**: Stored and calculated as **integer minor units (paise)** to eliminate IEEE-754 floating-point precision errors (₹1.00 = 100 paise).
- **Number Formatting**: Formatted using the Indian numbering system (e.g., `₹1,23,456.78`).
- **Naming Rule**: Never uses "R" as an abbreviation. Uses `₹` by default, or plain-text fallback `Rs` (configurable under **Settings**).

---

## 🧮 Core Formulas & Costing Logic

### 1. Moving Average Cost (MAC)
When new inventory is received via a purchase:
$$\text{New Average Cost} = \text{round}\left(\frac{\text{Current Stock} \times \text{Current Avg Cost} + \text{Purchase Qty} \times \text{Purchase Unit Cost}}{\text{Current Stock} + \text{Purchase Qty}}\right)$$

*If current stock is 0 or negative, the new average cost equals the purchase unit cost.*

### 2. Profit After Direct Sale Costs
$$\text{Profit after direct sale costs} = \text{Product Selling Revenue} + \text{Delivery Charged to Customer} - \text{COGS} - \text{Courier Cost Paid} - \text{Other Direct Sale Expenses}$$

#### Example:
- Product moving average cost: ₹20
- Product customer selling price: ₹30
- Delivery charged to customer: ₹5
- Courier cost paid after discount: ₹2
- **Profit after direct sale costs**: ₹30 + ₹5 - ₹20 - ₹2 = **₹13**

### 3. Historical Data Integrity & Cost of Goods Sold (COGS)
- When a sale is completed, the product's moving average cost is snapshot into `cost_price_paise` on each line item.
- Subsequent purchases or cost changes **never rewrite historical sale profit**.
- Voiding a sale restores product inventory stock, flags the record as `voided` with timestamp and reason, and preserves an audit trail without deleting history.
- Selling more than available stock is strictly blocked.

---

## 📱 Navigation & Key Sections

1. **Dashboard**:
   - Sales today, sales this month, and profit for the selected summary period (Today, Month, 30 Days).
   - Real-time stock counts, total inventory valuation, and low-stock alerts.
   - Recent sales stream with quick receipt modals and empty-state onboarding.
2. **Products (Parts & Inventory)**:
   - Parts catalog management with vehicle compatibility (Part Name, Car Brand, Car Model, Product Brand, SKU / Part #, Unit, Stock, Average Cost, Suggested Price, Low-stock alert threshold).
   - Multi-dimensional filtering by Car Brand, Car Model, Product Brand, and stock levels (All, Low Stock, Out of Stock), plus fast search across all part and vehicle fields.
   - Direct "+ Add Stock" action from product rows.
3. **Purchases (Stock Additions)**:
   - Record inward stock with live moving-average preview and total cost breakdown.
   - Historical purchase records with date, product, unit cost, supplier, and invoice notes.
4. **Sales**:
   - Multi-item sales with line-by-line customer pricing, stock validation, delivery charged, courier paid, and other direct expenses.
   - Live profit breakdown card during entry.
   - Itemized printable receipts (`window.print()`) and safe sale voiding dialog.
5. **Reports**:
   - Period filters: This Month (default), Last 30 Days, Today, and Custom date ranges.
   - Revenue, COGS, Delivery totals, Courier costs, Profit after direct costs, and Margin %.
   - Current stock snapshot separated from period metrics.
   - Product-level stock and sales breakdown table.
   - One-click CSV report export.
6. **Settings**:
   - Store name and Rupee format toggle (`₹` vs `Rs`).
   - JSON data backup export, demo data loader, and reset tools.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Lucide Icons
- **Bundler & PWA**: Vite 8, `vite-plugin-pwa` (Workbox offline service worker and web manifest)
- **Local Storage**: IndexedDB via `idb` with automatic in-memory fallback for headless/test environments
- **Testing**: Vitest (Unit and integration tests for calculations, money math, and repository transactions)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run Tests
```bash
npm test
```

### 4. Build for Production
```bash
npm run build
```

---

## 🌐 Deploy to GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds, tests, and deploys the app to GitHub Pages **when a pull request is merged into `master`** (or manually via `workflow_dispatch`).

### One-Time Setup in GitHub:
1. Go to your repository on GitHub: `https://github.com/maneshom/Vyaapaaram`.
2. Click **Settings** > **Pages** (under the "Code and automation" section).
3. Under **Build and deployment** > **Source**, select **GitHub Actions** (instead of "Deploy from a branch").
4. When you merge code into `master` (or trigger manually via **Actions** > **Deploy to GitHub Pages** > **Run workflow**), the workflow runs and publishes the live site at:
   `https://maneshom.github.io/Vyaapaaram/`