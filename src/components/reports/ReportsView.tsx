import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { ReportPeriodFilter } from '../../types';
import { getPeriodFilter, getTodayDateString } from '../../utils/dates';
import { exportReportsToCSV } from '../../utils/export';
import {
  BarChart3,
  Download,
  HelpCircle,
  Package,
  TrendingUp,
  Truck,
  DollarSign,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { formatCurrency, settings, dataVersion } = useApp();
  const [periodType, setPeriodType] = useState<'this_month' | 'last_30_days' | 'today' | 'custom'>('this_month');
  const [customStart, setCustomStart] = useState(getTodayDateString());
  const [customEnd, setCustomEnd] = useState(getTodayDateString());
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadReports = async () => {
      setLoading(true);
      try {
        const filter = getPeriodFilter(periodType, customStart, customEnd);
        const data = await repository.getReportsData(filter);
        if (mounted) setReportData(data);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadReports();
    return () => {
      mounted = false;
    };
  }, [periodType, customStart, customEnd, dataVersion]);

  const { financialSummary, inventorySummary, productReportItems } = reportData || {};

  const handleExportCSV = () => {
    if (!financialSummary || !productReportItems) return;
    exportReportsToCSV({
      businessName: settings.business_name || 'Vyaapaaram Store',
      periodLabel: financialSummary.period_label,
      financialSummary,
      productReportItems,
    });
  };

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Profit & Inventory Reports</h1>
          <p className="page-description">
            Transparent breakdown of revenues, direct costs, and net store profit
          </p>
        </div>

        <div className="toolbar-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => setShowFormulaHelp((v) => !v)}
            title="View calculation formula"
          >
            <HelpCircle size={16} /> Formula Definition
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportCSV}
            disabled={!financialSummary}
          >
            <Download size={16} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* Formula Explainer Banner */}
      {showFormulaHelp && (
        <div
          className="alert alert-info"
          style={{ marginBottom: '1.25rem', display: 'block', backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontWeight: 700, color: '#1e3a8a' }}>
            <HelpCircle size={18} />
            <span>How Profit after Direct Sale Costs is Calculated</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.6 }}>
            <div style={{ fontFamily: 'monospace', backgroundColor: '#dbeafe', padding: '0.5rem 0.75rem', borderRadius: '4px', margin: '0.35rem 0', fontWeight: 600 }}>
              Profit after direct sale costs = Product selling revenue + Delivery charged to customer - Cost of Goods Sold (COGS) - Courier cost paid - Direct sale expenses
            </div>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.8rem' }}>
              <li><strong>Product selling revenue:</strong> Customer-specific selling price multiplied by quantities sold.</li>
              <li><strong>Delivery charged to customer:</strong> Shipping amount charged on customer invoices.</li>
              <li><strong>Cost of Goods Sold (COGS):</strong> Captured moving average cost at the time each sale took place. Later purchases do not rewrite historical profits.</li>
              <li><strong>Courier cost paid:</strong> Actual discounted amount you paid to courier services.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Period Filter Card */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${periodType === 'this_month' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriodType('this_month')}
          >
            This Month
          </button>
          <button
            className={`btn btn-sm ${periodType === 'last_30_days' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriodType('last_30_days')}
          >
            Last 30 Days
          </button>
          <button
            className={`btn btn-sm ${periodType === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriodType('today')}
          >
            Today
          </button>
          <button
            className={`btn btn-sm ${periodType === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriodType('custom')}
          >
            Custom Range
          </button>
        </div>

        {periodType === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span style={{ color: 'var(--gray-500)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--gray-500)' }}>
          Calculating reports...
        </div>
      ) : (
        <>
          {/* Section 1: Period Financial Performance */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.75rem' }}>
              Financial Results ({financialSummary?.period_label || 'Selected Period'})
            </h2>

            <div className="stat-grid">
              {/* Gross Revenue */}
              <div className="stat-card">
                <div className="stat-label">Sales Revenue</div>
                <div className="stat-value">
                  {formatCurrency(financialSummary?.total_revenue_paise || 0)}
                </div>
                <div className="stat-subtext">
                  Products: {formatCurrency(financialSummary?.product_selling_revenue_paise || 0)}
                  {financialSummary?.delivery_charged_paise > 0 &&
                    ` + Delivery: ${formatCurrency(financialSummary.delivery_charged_paise)}`}
                </div>
              </div>

              {/* Cost of Goods Sold */}
              <div className="stat-card">
                <div className="stat-label">Cost of Goods Sold (COGS)</div>
                <div className="stat-value" style={{ color: 'var(--gray-800)' }}>
                  {formatCurrency(financialSummary?.total_cogs_paise || 0)}
                </div>
                <div className="stat-subtext">Inventory cost of items sold</div>
              </div>

              {/* Courier Costs */}
              <div className="stat-card">
                <div className="stat-label">Courier & Direct Expenses</div>
                <div className="stat-value" style={{ color: 'var(--gray-800)' }}>
                  {formatCurrency(
                    (financialSummary?.courier_cost_paid_paise || 0) +
                      (financialSummary?.other_direct_expenses_paise || 0)
                  )}
                </div>
                <div className="stat-subtext">
                  Courier: {formatCurrency(financialSummary?.courier_cost_paid_paise || 0)}
                </div>
              </div>

              {/* Profit After Direct Sale Costs */}
              <div className="stat-card highlight">
                <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
                  Profit After Direct Costs
                </div>
                <div className="stat-value" style={{ color: '#042f2e' }}>
                  {formatCurrency(financialSummary?.profit_after_direct_costs_paise || 0)}
                </div>
                <div className="stat-subtext">
                  Margin: <strong>{financialSummary?.profit_margin_percentage || 0}%</strong> across {financialSummary?.total_sales_count || 0} sales
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Current Inventory Status (Kept separate from period metrics) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.75rem' }}>
              Current Stock Snapshot (Present Status)
            </h2>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Total Stock Quantity</div>
                <div className="stat-value">{inventorySummary?.total_stock_quantity || 0} units</div>
                <div className="stat-subtext">
                  Across {inventorySummary?.total_products_count || 0} active products
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Low / Out of Stock Items</div>
                <div
                  className="stat-value"
                  style={{
                    color: inventorySummary?.low_stock_products_count > 0 ? 'var(--warning)' : 'inherit',
                  }}
                >
                  {inventorySummary?.low_stock_products_count || 0}
                </div>
                <div className="stat-subtext">
                  {inventorySummary?.out_of_stock_products_count || 0} out of stock
                </div>
              </div>

              <div className="stat-card highlight">
                <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
                  Estimated Stock Value
                </div>
                <div className="stat-value" style={{ color: '#042f2e' }}>
                  {formatCurrency(inventorySummary?.estimated_stock_value_paise || 0)}
                </div>
                <div className="stat-subtext">Sum of (Stock × Moving Avg Cost)</div>
              </div>
            </div>
          </div>

          {/* Section 3: Product-level Performance & Stock List */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Package size={18} style={{ color: 'var(--primary)' }} />
                <span>Product Stock & Period Sales Breakdown</span>
              </div>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Current Stock</th>
                      <th style={{ textAlign: 'right' }}>Avg Unit Cost</th>
                      <th style={{ textAlign: 'right' }}>Stock Value</th>
                      <th style={{ textAlign: 'center' }}>Units Sold (Period)</th>
                      <th style={{ textAlign: 'right' }}>Period Revenue</th>
                      <th style={{ textAlign: 'right' }}>Period COGS</th>
                      <th style={{ textAlign: 'right' }}>Period Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productReportItems?.map((item: any) => (
                      <tr key={item.product_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '2px' }}>
                            {item.sku && <span>Part #: {item.sku}</span>}
                            {(item.car_brand || item.car_model) && (
                              <span>📂 {[item.car_brand, item.car_model].filter(Boolean).join(' ')}</span>
                            )}
                            {item.product_brand && (
                              <span>🏷️ {item.product_brand}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {item.is_out_of_stock ? (
                            <span className="badge badge-danger">0 {item.unit}</span>
                          ) : item.is_low_stock ? (
                            <span className="badge badge-warning">
                              {item.current_stock} {item.unit}
                            </span>
                          ) : (
                            <span>
                              {item.current_stock} {item.unit}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(item.average_cost_paise)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(item.current_stock_value_paise)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <strong>{item.quantity_sold_in_period}</strong> {item.unit}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(item.revenue_in_period_paise)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--gray-600)' }}>
                          {formatCurrency(item.cogs_in_period_paise)}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.profit_in_period_paise > 0 ? '#166534' : 'inherit',
                          }}
                        >
                          {formatCurrency(item.profit_in_period_paise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

