import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { Product, Sale } from '../../types';
import { formatDateTime } from '../../utils/dates';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Plus,
  ShoppingBag,
  ArrowRight,
  Receipt,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenNewSale: () => void;
  onOpenNewPurchase: (productId?: string) => void;
  onOpenNewProduct: () => void;
  onViewSaleReceipt: (sale: Sale) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewSale,
  onOpenNewPurchase,
  onOpenNewProduct,
  onViewSaleReceipt,
  onNavigateTab,
}) => {
  const { formatCurrency, dataVersion } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'this_month' | 'last_30_days'>('this_month');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await repository.getDashboardMetrics(selectedPeriod);
        if (mounted) setMetrics(data);
      } catch (e) {
        console.error('Failed to load dashboard metrics:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMetrics();
    return () => {
      mounted = false;
    };
  }, [selectedPeriod, dataVersion]);

  if (loading && !metrics) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--gray-500)' }}>
        Loading dashboard...
      </div>
    );
  }

  const {
    todaySummary,
    thisMonthSummary,
    selectedSummary,
    inventorySummary,
    lowStockAlerts,
    recentSales,
    totalProductsCount,
  } = metrics || {};

  const hasAnyProducts = totalProductsCount > 0;
  const hasAnySales = recentSales && recentSales.length > 0;

  return (
    <div>
      {/* Top Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Overview of your store inventory, sales, and profits</p>
        </div>

        <div className="toolbar-buttons">
          <button className="btn btn-secondary" onClick={() => onOpenNewProduct()}>
            <Plus size={16} /> Add Product
          </button>
          <button className="btn btn-secondary" onClick={() => onOpenNewPurchase()}>
            <ShoppingBag size={16} /> Record Purchase
          </button>
          <button className="btn btn-primary" onClick={onOpenNewSale} disabled={!hasAnyProducts}>
            <TrendingUp size={16} /> Record Sale
          </button>
        </div>
      </div>

      {/* Empty State Onboarding if no products or sales yet */}
      {!hasAnyProducts && (
        <div className="empty-state" style={{ marginBottom: '1.5rem' }}>
          <Package className="empty-icon" style={{ color: 'var(--primary)' }} />
          <h2 className="empty-title">Welcome to Vyaapaaram!</h2>
          <p className="empty-desc">
            Get started by adding your shop&apos;s products, recording stock purchases, and logging your sales.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => onOpenNewProduct()}>
              <Plus size={16} /> Add Your First Product
            </button>
          </div>
        </div>
      )}

      {/* Key Metric Stat Cards */}
      <div className="stat-grid">
        {/* Sales Today */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Sales Today</span>
            <span className="badge badge-gray">{todaySummary?.total_sales_count || 0} sales</span>
          </div>
          <div className="stat-value">{formatCurrency(todaySummary?.total_revenue_paise || 0)}</div>
          <div className="stat-subtext">
            Profit: <strong>{formatCurrency(todaySummary?.profit_after_direct_costs_paise || 0)}</strong>
          </div>
        </div>

        {/* Sales This Month */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Sales This Month</span>
            <span className="badge badge-gray">{thisMonthSummary?.total_sales_count || 0} sales</span>
          </div>
          <div className="stat-value">{formatCurrency(thisMonthSummary?.total_revenue_paise || 0)}</div>
          <div className="stat-subtext">
            Profit: <strong>{formatCurrency(thisMonthSummary?.profit_after_direct_costs_paise || 0)}</strong>
          </div>
        </div>

        {/* Profit After Direct Sale Costs (Selected Period) */}
        <div className="stat-card highlight">
          <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
            <span>Profit After Direct Costs</span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                className={`btn btn-sm ${selectedPeriod === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', minHeight: 24 }}
                onClick={() => setSelectedPeriod('today')}
              >
                Today
              </button>
              <button
                className={`btn btn-sm ${selectedPeriod === 'this_month' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', minHeight: 24 }}
                onClick={() => setSelectedPeriod('this_month')}
              >
                Month
              </button>
              <button
                className={`btn btn-sm ${selectedPeriod === 'last_30_days' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', minHeight: 24 }}
                onClick={() => setSelectedPeriod('last_30_days')}
              >
                30D
              </button>
            </div>
          </div>
          <div className="stat-value" style={{ color: '#042f2e' }}>
            {formatCurrency(selectedSummary?.profit_after_direct_costs_paise || 0)}
          </div>
          <div className="stat-subtext">
            Margin: <strong>{selectedSummary?.profit_margin_percentage || 0}%</strong> on revenue
          </div>
        </div>

        {/* Current Stock Snapshot */}
        <div className="stat-card">
          <div className="stat-label">
            <span>Inventory Stock</span>
            {inventorySummary?.low_stock_products_count > 0 ? (
              <span className="badge badge-warning">
                {inventorySummary.low_stock_products_count} Low
              </span>
            ) : (
              <span className="badge badge-success">Healthy</span>
            )}
          </div>
          <div className="stat-value">{inventorySummary?.total_stock_quantity || 0} units</div>
          <div className="stat-subtext">
            Valuation: <strong>{formatCurrency(inventorySummary?.estimated_stock_value_paise || 0)}</strong>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Banner */}
      {lowStockAlerts && lowStockAlerts.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--warning)', marginBottom: '1.25rem' }}>
          <div
            className="card-header"
            style={{ backgroundColor: 'var(--warning-bg)', borderBottomColor: '#fde68a' }}
          >
            <div className="card-title" style={{ color: 'var(--warning)' }}>
              <AlertTriangle size={18} />
              <span>Low Stock Alerts ({lowStockAlerts.length} items need reorder)</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('products')}
            >
              View Products
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Alert Level</th>
                    <th>Average Cost</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockAlerts.slice(0, 4).map((p: Product) => (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ color: 'var(--gray-900)' }}>{p.name}</strong>
                        {p.sku && <span style={{ color: 'var(--gray-500)', fontSize: '0.75rem', marginLeft: '6px' }}>({p.sku})</span>}
                      </td>
                      <td>
                        {p.current_stock <= 0 ? (
                          <span className="badge badge-danger">Out of Stock (0 {p.unit})</span>
                        ) : (
                          <span className="badge badge-warning">
                            {p.current_stock} {p.unit} left
                          </span>
                        )}
                      </td>
                      <td>{p.low_stock_threshold} {p.unit}</td>
                      <td>{formatCurrency(p.average_cost_paise)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenNewPurchase(p.id)}
                        >
                          <Plus size={14} /> Add Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Recent Sales List */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            <span>Recent Sales</span>
          </div>
          {hasAnySales && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('sales')}
            >
              All Sales <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {!hasAnySales ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--gray-500)' }}>
              No sales recorded yet. Click &quot;Record Sale&quot; to make your first sale!
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date & Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Bill Total</th>
                    <th style={{ textAlign: 'right' }}>Direct Profit</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s: Sale) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.sale_number}</strong>
                      </td>
                      <td>
                        <div>{formatDateTime(s.date)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                          {s.customer_name || 'Walk-in Customer'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem' }}>
                          {s.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(s.total_amount_paise)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: s.status === 'voided' ? 'var(--gray-400)' : '#166534',
                        }}
                      >
                        {formatCurrency(s.profit_after_direct_costs_paise)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {s.status === 'voided' ? (
                          <span className="badge badge-danger">Voided</span>
                        ) : (
                          <span className="badge badge-success">Completed</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewSaleReceipt(s)}
                          title="View receipt"
                        >
                          <Receipt size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

