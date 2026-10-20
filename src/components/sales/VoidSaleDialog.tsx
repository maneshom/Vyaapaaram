import React, { useState } from 'react';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, X } from 'lucide-react';

interface VoidSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onConfirmVoid: (saleId: string, reason: string) => Promise<void>;
}

export const VoidSaleDialog: React.FC<VoidSaleDialogProps> = ({
  isOpen,
  onClose,
  sale,
  onConfirmVoid,
}) => {
  const { formatCurrency } = useApp();
  const [reason, setReason] = useState('Customer return / Order cancelled');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !sale) return null;

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for voiding this sale.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirmVoid(sale.id, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to void sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--danger)' }}>
            <AlertTriangle size={20} />
            <span>Void Sale #{sale.sale_number}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleVoid}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--gray-700)' }}>
              Are you sure you want to void sale <strong>{sale.sale_number}</strong> totaling{' '}
              <strong>{formatCurrency(sale.total_amount_paise)}</strong>?
            </div>

            <div
              className="alert alert-warning"
              style={{ fontSize: '0.825rem', marginBottom: '1rem' }}
            >
              <div>
                <strong>Inventory Stock Restoration:</strong>
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                  {sale.items.map((item, idx) => (
                    <li key={idx}>
                      +{item.quantity} {item.unit} will be added back to &quot;{item.product_name}&quot;.
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: '0.35rem', fontWeight: 600 }}>
                  This sale will remain in history as voided for financial audit compliance.
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Reason for Voiding *</label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="Customer return / Order cancelled">Customer return / Order cancelled</option>
                <option value="Billing entry mistake">Billing entry mistake</option>
                <option value="Wrong products or quantity recorded">Wrong products or quantity recorded</option>
                <option value="Delivery failed / Courier return">Delivery failed / Courier return</option>
                <option value="Other">Other reason</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Voiding...' : 'Confirm & Restore Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

