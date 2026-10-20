import React, { useState, useEffect, useMemo } from 'react';
import { Purchase, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { formatDate } from '../../utils/dates';
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Truck,
  ArrowUpRight,
} from 'lucide-react';

interface PurchasesViewProps {
  onOpenNewPurchase: () => void;
  products: Product[];
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  onOpenNewPurchase,
  products,
}) => {
  const { formatCurrency, dataVersion } = useApp();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadPurchases = async () => {
      setLoading(true);
      try {
        const list = await repository.getPurchases();
        if (mounted) setPurchases(list);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPurchases();
    return () => {
      mounted = false;
    };
  }, [dataVersion]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalSpentPaise = 0;
    let totalQty = 0;
    for (const p of purchases) {
      totalSpentPaise += p.total_cost_paise;
      totalQty += p.quantity_received;
    }
    return {
      count: purchases.length,
      totalSpentPaise,
      totalQty,
    };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return purchases;
    return purchases.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q)) ||
        (p.note && p.note.toLowerCase().includes(q))
    );
  }, [purchases, searchQuery]);

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Purchases & Stock Additions</h1>
          <p className="page-description">
            Track inward stock purchases and moving average inventory costs
          </p>
        </div>

        <div className="toolbar-buttons">
          <button
            className="btn btn-primary"
            onClick={onOpenNewPurchase}
            disabled={products.length === 0}
          >
            <Plus size={16} /> Record Purchase
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Purchases</div>
          <div className="stat-value">{stats.count}</div>
          <div className="stat-subtext">Recorded stock receipt events</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Units Received</div>
          <div className="stat-value">{stats.totalQty}</div>
          <div className="stat-subtext">Total inward inventory quantity</div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
            Total Purchase Cost
          </div>
          <div className="stat-value" style={{ color: '#042f2e' }}>
            {formatCurrency(stats.totalSpentPaise)}
          </div>
          <div className="stat-subtext">Cumulative stock expenditure</div>
        </div>
      </div>

      {/* Search Input */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
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
            placeholder="Search by product, supplier, or invoice ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Purchase History Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-500)' }}>
              Loading purchases...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="empty-state" style={{ border: 'none' }}>
              <ShoppingBag className="empty-icon" />
              <h3 className="empty-title">
                {searchQuery ? 'No matching purchases found' : 'No purchases recorded yet'}
              </h3>
              <p className="empty-desc">
                {searchQuery
                  ? 'Try clearing your search query.'
                  : 'Record stock purchases to track your inventory and calculate moving average costs.'}
              </p>
              {!searchQuery && products.length > 0 && (
                <button className="btn btn-primary" onClick={onOpenNewPurchase}>
                  <Plus size={16} /> Record First Purchase
                </button>
              )}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Qty Received</th>
                    <th style={{ textAlign: 'right' }}>Purchase Unit Cost</th>
                    <th style={{ textAlign: 'right' }}>Total Cost</th>
                    <th>Supplier</th>
                    <th>Notes / Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((pur) => (
                    <tr key={pur.id}>
                      <td>
                        <strong>{formatDate(pur.date)}</strong>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--gray-900)' }}>{pur.product_name}</strong>
                      </td>
                      <td>
                        <span className="badge badge-success">+{pur.quantity_received}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {formatCurrency(pur.unit_cost_paise)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(pur.total_cost_paise)}
                      </td>
                      <td>
                        {pur.supplier ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Truck size={14} style={{ color: 'var(--gray-400)' }} />
                            <span>{pur.supplier}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {pur.note ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                            {pur.note}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
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

