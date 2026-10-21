import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { repository } from '../../storage/repository';
import { useApp } from '../../context/AppContext';
import { Trash2, AlertTriangle, X, AlertCircle } from 'lucide-react';

interface DeleteProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirmDelete: (productId: string) => Promise<void>;
  onZeroStock?: (product: Product) => Promise<void>;
}

export const DeleteProductDialog: React.FC<DeleteProductDialogProps> = ({
  isOpen,
  onClose,
  product,
  onConfirmDelete,
  onZeroStock,
}) => {
  const { formatCurrency } = useApp();
  const [checking, setChecking] = useState(true);
  const [canDelete, setCanDelete] = useState(true);
  const [usageReason, setUsageReason] = useState<string | null>(null);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [saleCount, setSaleCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      let isMounted = true;
      setChecking(true);
      setError(null);

      repository
        .checkProductUsage(product.id)
        .then((res) => {
          if (isMounted) {
            setCanDelete(res.canDelete);
            setUsageReason(res.reason || null);
            setPurchaseCount(res.purchaseCount);
            setSaleCount(res.saleCount);
            setChecking(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err?.message || 'Failed to check product usage');
            setChecking(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirmDelete(product.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetZeroStock = async () => {
    if (!onZeroStock) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onZeroStock(product);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update stock');
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
          <div
            className="modal-title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: canDelete ? 'var(--danger)' : 'var(--gray-800)' }}
          >
            {canDelete ? <Trash2 size={20} color="var(--danger)" /> : <AlertCircle size={20} color="var(--warning)" />}
            <span>{canDelete ? 'Delete Product' : 'Product In Use'}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleDelete}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {checking ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--gray-500)' }}>
                Checking product transaction history...
              </div>
            ) : canDelete ? (
              <div>
                <p style={{ fontSize: '0.95rem', color: 'var(--gray-800)', marginBottom: '0.75rem' }}>
                  Are you sure you want to permanently delete <strong>{product.name}</strong>?
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--gray-50)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.825rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <strong>SKU:</strong> {product.sku || 'None'}
                  </div>
                  <div>
                    <strong>Current Stock:</strong> {product.current_stock} {product.unit}
                  </div>
                  <div>
                    <strong>Cost Valuation:</strong>{' '}
                    {formatCurrency(Math.max(0, product.current_stock) * product.average_cost_paise)}
                  </div>
                </div>

                <div className="alert alert-warning" style={{ fontSize: '0.825rem', marginBottom: 0 }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>This action is permanent and cannot be undone.</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                      Cannot delete &quot;{product.name}&quot;
                    </div>
                    <div style={{ fontSize: '0.825rem' }}>{usageReason}</div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--gray-50)',
                    border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.825rem',
                    color: 'var(--gray-700)',
                    lineHeight: 1.5,
                  }}
                >
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Why is this restricted?</strong>
                  </p>
                  <ul style={{ paddingLeft: '1.25rem' }}>
                    <li>
                      <strong>Purchases ({purchaseCount}):</strong> Required to verify supplier inward invoices and moving average cost formulas.
                    </li>
                    <li>
                      <strong>Sales ({saleCount}):</strong> Customer receipts and profit reports rely on captured COGS data.
                    </li>
                  </ul>
                  <p style={{ marginTop: '0.5rem' }}>
                    If you no longer sell this product, you can set its stock to <strong>0</strong> or rename it.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {canDelete ? 'Cancel' : 'Close'}
            </button>

            {!checking && !canDelete && product.current_stock > 0 && onZeroStock && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSetZeroStock}
                disabled={isSubmitting}
                style={{ color: 'var(--warning)', fontWeight: 600 }}
              >
                Set Stock to 0
              </button>
            )}

            {!checking && canDelete && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                <Trash2 size={16} />
                <span>{isSubmitting ? 'Deleting...' : 'Delete Product'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

