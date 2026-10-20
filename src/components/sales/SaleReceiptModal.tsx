import React from 'react';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatDateTime } from '../../utils/dates';
import { X, Printer, Ban } from 'lucide-react';

interface SaleReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onOpenVoid: (sale: Sale) => void;
}

export const SaleReceiptModal: React.FC<SaleReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  onOpenVoid,
}) => {
  const { formatCurrency, settings } = useApp();

  if (!isOpen || !sale) return null;

  const isVoided = sale.status === 'voided';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '600px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Sale Receipt #{sale.sale_number}</span>
            {isVoided ? (
              <span className="badge badge-danger">VOIDED</span>
            ) : (
              <span className="badge badge-success">COMPLETED</span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body receipt-box">
          {/* Business Header */}
          <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--gray-200)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-dark)' }}>
              {settings.business_name || 'Vyaapaaram Store'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '2px' }}>
              Sales & Inventory Receipt
            </div>
          </div>

          {/* Voided Warning Notice */}
          {isVoided && (
            <div
              className="alert alert-danger"
              style={{ marginTop: '1rem', marginBottom: '1rem', fontSize: '0.85rem' }}
            >
              <div>
                <strong>This sale has been voided.</strong>
                <div>Reason: {sale.void_reason || 'N/A'}</div>
                {sale.voided_at && (
                  <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                    Voided on: {formatDateTime(sale.voided_at)}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', marginTop: '2px', fontWeight: 600 }}>
                  Inventory stock has been restored.
                </div>
              </div>
            </div>
          )}

          {/* Sale Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              fontSize: '0.825rem',
              padding: '0.75rem 0',
              borderBottom: '1px solid var(--gray-200)',
            }}
          >
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Sale Number: </span>
              <strong>{sale.sale_number}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--gray-500)' }}>Date: </span>
              <span>{formatDateTime(sale.date)}</span>
            </div>
            {sale.customer_name && (
              <div>
                <span style={{ color: 'var(--gray-500)' }}>Customer: </span>
                <strong>{sale.customer_name}</strong>
              </div>
            )}
            {sale.customer_phone && (
              <div>
                <span style={{ color: 'var(--gray-500)' }}>Phone: </span>
                <span>{sale.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div style={{ margin: '1rem 0' }}>
            <table style={{ width: '100%', fontSize: '0.825rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '0.5rem' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>
                        Cost base: {formatCurrency(item.cost_price_paise)} / {item.unit}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                      {item.quantity} {item.unit}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      {formatCurrency(item.selling_price_paise)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>
                      {formatCurrency(item.subtotal_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div
            style={{
              backgroundColor: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.35rem',
                color: 'var(--gray-700)',
              }}
            >
              <span>Product Selling Revenue:</span>
              <span>{formatCurrency(sale.product_selling_revenue_paise)}</span>
            </div>

            {sale.delivery_charged_paise > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '0.35rem',
                  color: 'var(--gray-700)',
                }}
              >
                <span>Delivery charged to customer:</span>
                <span>{formatCurrency(sale.delivery_charged_paise)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1rem',
                fontWeight: 700,
                padding: '0.5rem 0',
                borderTop: '1px solid var(--gray-200)',
                borderBottom: '1px solid var(--gray-200)',
                color: 'var(--gray-900)',
              }}
            >
              <span>Total Customer Bill:</span>
              <span>{formatCurrency(sale.total_amount_paise)}</span>
            </div>

            {/* Direct Costs Section */}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                  textTransform: 'uppercase',
                  marginBottom: '0.25rem',
                }}
              >
                Direct Costs & COGS
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--gray-600)',
                  marginBottom: '0.25rem',
                }}
              >
                <span>Cost of Goods Sold (COGS):</span>
                <span>{formatCurrency(sale.total_cogs_paise)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--gray-600)',
                  marginBottom: '0.25rem',
                }}
              >
                <span>Courier cost paid:</span>
                <span>{formatCurrency(sale.courier_cost_paid_paise)}</span>
              </div>

              {sale.other_direct_expenses_paise > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--gray-600)',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span>Other direct expenses:</span>
                  <span>{formatCurrency(sale.other_direct_expenses_paise)}</span>
                </div>
              )}
            </div>

            {/* Profit After Direct Sale Costs */}
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isVoided ? 'var(--gray-200)' : 'var(--success-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 700,
                color: isVoided ? 'var(--gray-600)' : '#166534',
                fontSize: '0.95rem',
              }}
            >
              <span>Profit after direct sale costs:</span>
              <span>{formatCurrency(sale.profit_after_direct_costs_paise)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {!isVoided && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => onOpenVoid(sale)}
              >
                <Ban size={14} /> Void Sale
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

