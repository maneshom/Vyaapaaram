import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { formatDateTime } from '../../utils/dates';
import {
  TrendingUp,
  Plus,
  Search,
  Receipt,
  Ban,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface SalesViewProps {
  onOpenNewSale: () => void;
  onViewSaleReceipt: (sale: Sale) => void;
  products: Product[];
}

export const SalesView: React.FC<SalesViewProps> = ({
  onOpenNewSale,
  onViewSaleReceipt,
  products,
}) => {
  const { formatCurrency, dataVersion } = useApp();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all');

  useEffect(() => {
    let mounted = true;
    const loadSales = async () => {
      setLoading(true);
      try {
        const list = await repository.getSales();
        if (mounted) setSales(list);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadSales();
    return () => {
      mounted = false;
    };
  }, [dataVersion]);

  // Aggregate stats (active sales only)
  const stats = useMemo(() => {
    let activeCount = 0;
    let voidedCount = 0;
    let totalRevenuePaise = 0;
    let totalProfitPaise = 0;
    let totalDeliveryCharged = 0;
    let totalCourierCostPaid = 0;

    for (const s of sales) {
      if (s.status === 'voided') {
        voidedCount++;
      } else {
        activeCount++;
        totalRevenuePaise += s.total_amount_paise;
        totalProfitPaise += s.profit_after_direct_costs_paise;
        totalDeliveryCharged += s.delivery_charged_paise;
        totalCourierCostPaid += s.courier_cost_paid_paise;
      }
    }

    return {
      activeCount,
      voidedCount,
      totalRevenuePaise,
      totalProfitPaise,
      totalDeliveryCharged,
      totalCourierCostPaid,
    };
  }, [sales]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.sale_number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.customer_phone && s.customer_phone.includes(q)) ||
        s.items.some((i) => i.product_name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'completed') return s.status === 'completed';
      if (statusFilter === 'voided') return s.status === 'voided';
      return true;
    });
  }, [sales, searchQuery, statusFilter]);

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Sales History</h1>
          <p className="page-description">
            Customer-specific sales, courier tracking, and direct sale profits
          </p>
        </div>

        <div className="toolbar-buttons">
          <button
            className="btn btn-primary"
            onClick={onOpenNewSale}
            disabled={products.length === 0}
          >
            <Plus size={16} /> Record Sale
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-label">Completed Sales</div>
          <div className="stat-value">{stats.activeCount}</div>
          <div className="stat-subtext">
            {stats.voidedCount > 0 ? `${stats.voidedCount} voided sales archived` : 'All sales active'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Sales Revenue</div>
          <div className="stat-value">{formatCurrency(stats.totalRevenuePaise)}</div>
          <div className="stat-subtext">
            Includes {formatCurrency(stats.totalDeliveryCharged)} delivery charged
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
            Profit After Direct Costs
          </div>
          <div className="stat-value" style={{ color: '#042f2e' }}>
            {formatCurrency(stats.totalProfitPaise)}
          </div>
          <div className="stat-subtext">
            Courier costs paid: {formatCurrency(stats.totalCourierCostPaid)}
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search by sale #, customer name, phone, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({sales.length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({stats.activeCount})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'voided' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('voided')}
          >
            Voided ({stats.voidedCount})
          </button>
        </div>
      </div>

      {/* Sales List Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-500)' }}>
              Loading sales...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="empty-state" style={{ border: 'none' }}>
              <TrendingUp className="empty-icon" />
              <h3 className="empty-title">
                {searchQuery || statusFilter !== 'all' ? 'No matching sales found' : 'No sales recorded yet'}
              </h3>
              <p className="empty-desc">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try clearing your search or filter tab.'
                  : 'Start recording sales with customer prices and courier amounts.'}
              </p>
              {!searchQuery && statusFilter === 'all' && products.length > 0 && (
                <button className="btn btn-primary" onClick={onOpenNewSale}>
                  <Plus size={16} /> Record First Sale
                </button>
              )}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Delivery</th>
                    <th style={{ textAlign: 'right' }}>Total Bill</th>
                    <th style={{ textAlign: 'right' }}>Profit (Direct)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr
                      key={sale.id}
                      style={{ opacity: sale.status === 'voided' ? 0.75 : 1 }}
                    >
                      <td>
                        <strong>{sale.sale_number}</strong>
                      </td>
                      <td>{formatDateTime(sale.date)}</td>
                      <td>
                        <div>{sale.customer_name || 'Walk-in Customer'}</div>
                        {sale.customer_phone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            {sale.customer_phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem' }}>
                          {sale.items
                            .map((i) => `${i.quantity}x ${i.product_name}`)
                            .join(', ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--gray-600)' }}>
                        {sale.delivery_charged_paise > 0
                          ? formatCurrency(sale.delivery_charged_paise)
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(sale.total_amount_paise)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: sale.status === 'voided' ? 'var(--gray-500)' : '#166534',
                        }}
                      >
                        {formatCurrency(sale.profit_after_direct_costs_paise)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {sale.status === 'voided' ? (
                          <span className="badge badge-danger">Voided</span>
                        ) : (
                          <span className="badge badge-success">Completed</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewSaleReceipt(sale)}
                          title="View sale receipt"
                        >
                          <Receipt size={14} /> Receipt
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

