import { Product, Purchase, Sale, AppSettings } from '../types';
import { formatMoney } from './money';

export function exportReportsToCSV(params: {
  businessName: string;
  periodLabel: string;
  financialSummary: {
    total_sales_count: number;
    product_selling_revenue_paise: number;
    delivery_charged_paise: number;
    total_revenue_paise: number;
    total_cogs_paise: number;
    courier_cost_paid_paise: number;
    other_direct_expenses_paise: number;
    profit_after_direct_costs_paise: number;
  };
  productReportItems: Array<{
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
  }>;
}): void {
  const lines: string[] = [];

  lines.push(`"${params.businessName} - Profit & Inventory Report"`);
  lines.push(`"Period: ${params.periodLabel}"`);
  lines.push(`"Generated: ${new Date().toLocaleString('en-IN')}"`);
  lines.push('');

  // Financial Summary Section
  lines.push('"FINANCIAL SUMMARY"');
  lines.push('"Metric","Amount"');
  lines.push(`"Completed Sales Count",${params.financialSummary.total_sales_count}`);
  lines.push(`"Product Selling Revenue",${params.financialSummary.product_selling_revenue_paise / 100}`);
  lines.push(`"Delivery Charged to Customer",${params.financialSummary.delivery_charged_paise / 100}`);
  lines.push(`"Total Revenue",${params.financialSummary.total_revenue_paise / 100}`);
  lines.push(`"Cost of Goods Sold (COGS)",${params.financialSummary.total_cogs_paise / 100}`);
  lines.push(`"Courier Cost Paid",${params.financialSummary.courier_cost_paid_paise / 100}`);
  lines.push(`"Direct Sale Expenses",${params.financialSummary.other_direct_expenses_paise / 100}`);
  lines.push(`"Profit after direct sale costs",${params.financialSummary.profit_after_direct_costs_paise / 100}`);
  lines.push('');

  // Product Inventory & Performance Section
  lines.push('"PRODUCT STOCK & PERFORMANCE"');
  lines.push('"Product Name","SKU","Unit","Current Stock","Avg Unit Cost (Rs)","Stock Value (Rs)","Units Sold","Revenue (Rs)","COGS (Rs)","Profit (Rs)"');

  for (const item of params.productReportItems) {
    lines.push(
      [
        `"${item.product_name.replace(/"/g, '""')}"`,
        `"${item.sku ? item.sku.replace(/"/g, '""') : ''}"`,
        `"${item.unit}"`,
        item.current_stock,
        item.average_cost_paise / 100,
        item.current_stock_value_paise / 100,
        item.quantity_sold_in_period,
        item.revenue_in_period_paise / 100,
        item.cogs_in_period_paise / 100,
        item.profit_in_period_paise / 100,
      ].join(',')
    );
  }

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  link.setAttribute('download', `Vyaapaaram_Report_${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadJSONBackup(data: {
  settings: AppSettings;
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
}): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vyaapaaram_backup_${new Date().toISOString().substring(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

