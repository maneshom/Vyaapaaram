import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { rupeesToPaise, paiseToRupees } from '../../utils/money';
import { calculateMovingAverageCost } from '../../utils/calculations';
import { getTodayDateString } from '../../utils/dates';
import { useApp } from '../../context/AppContext';
import { X, ArrowRight, Info } from 'lucide-react';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string;
  onSave: (params: {
    product_id: string;
    quantity_received: number;
    unit_cost_paise: number;
    date: string;
    supplier?: string;
    note?: string;
  }) => Promise<void>;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  isOpen,
  onClose,
  products,
  initialProductId,
  onSave,
}) => {
  const { formatCurrency, currencyPreference } = useApp();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCostRupees, setUnitCostRupees] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialProductId && products.some((p) => p.id === initialProductId)) {
        setProductId(initialProductId);
      } else if (products.length > 0) {
        setProductId(products[0].id);
      }
      setQuantity('');
      setUnitCostRupees('');
      setDate(getTodayDateString());
      setSupplier('');
      setNote('');
      setError(null);
    }
  }, [isOpen, initialProductId, products]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === productId);
  }, [products, productId]);

  // Set default unit cost when product is selected if empty
  useEffect(() => {
    if (selectedProduct && !unitCostRupees && selectedProduct.average_cost_paise > 0) {
      setUnitCostRupees((selectedProduct.average_cost_paise / 100).toFixed(2));
    }
  }, [selectedProduct]);

  // Moving average cost live preview calculation
  const movingAvgPreview = useMemo(() => {
    if (!selectedProduct) return null;
    const qty = parseFloat(quantity);
    const unitCost = rupeesToPaise(unitCostRupees);

    if (isNaN(qty) || qty <= 0 || isNaN(unitCost) || unitCost < 0) {
      return null;
    }

    try {
      const result = calculateMovingAverageCost(
        selectedProduct.current_stock,
        selectedProduct.average_cost_paise,
        qty,
        unitCost
      );
      const totalPurchaseCost = Math.round(qty * unitCost);

      return {
        ...result,
        totalPurchaseCost,
      };
    } catch {
      return null;
    }
  }, [selectedProduct, quantity, unitCostRupees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Please select a product.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity received must be greater than zero.');
      return;
    }

    const unitCostPaise = rupeesToPaise(unitCostRupees);
    if (unitCostPaise < 0) {
      setError('Purchase unit cost cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        product_id: productId,
        quantity_received: qty,
        unit_cost_paise: unitCostPaise,
        date: date || getTodayDateString(),
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currencyPreference === 'symbol' ? '₹' : 'Rs ';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Record Purchase (Stock Addition)</div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Select Product *</label>
              <select
                className="form-select"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''} - Stock: {p.current_stock} {p.unit}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div
                style={{
                  backgroundColor: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.825rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Current Stock: </span>
                  <strong>
                    {selectedProduct.current_stock} {selectedProduct.unit}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--gray-500)' }}>Current Avg Cost: </span>
                  <strong>{formatCurrency(selectedProduct.average_cost_paise)}</strong>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Quantity Received *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="form-input"
                  placeholder="e.g. 10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Purchase Unit Cost *</label>
                <div className="form-input-prefix-wrapper">
                  <span className="input-prefix">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input has-prefix"
                    placeholder="0.00"
                    value={unitCostRupees}
                    onChange={(e) => setUnitCostRupees(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Live Moving Average Preview Card */}
            {movingAvgPreview && selectedProduct && (
              <div
                style={{
                  backgroundColor: 'var(--primary-light)',
                  border: '1px solid #99f6e4',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: 'var(--primary-dark)',
                    marginBottom: '0.35rem',
                  }}
                >
                  <Info size={14} />
                  <span>Cost & Stock Recalculation Preview</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: 'var(--gray-800)',
                  }}
                >
                  <div>
                    Total Batch Cost:{' '}
                    <strong>{formatCurrency(movingAvgPreview.totalPurchaseCost)}</strong>
                  </div>
                  <div>
                    New Stock Total:{' '}
                    <strong>
                      {movingAvgPreview.newStock} {selectedProduct.unit}
                    </strong>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: '0.35rem',
                    fontSize: '0.8rem',
                    color: 'var(--primary-dark)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>Moving Average Unit Cost:</span>
                  <span>{formatCurrency(selectedProduct.average_cost_paise)}</span>
                  <ArrowRight size={13} />
                  <span style={{ fontSize: '0.9rem', color: '#042f2e' }}>
                    {formatCurrency(movingAvgPreview.newAverageCostPaise)}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Purchase Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Supplier Name (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Metro Wholesalers"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes / Invoice Ref (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Invoice #4829, Batch #2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
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
              className="btn btn-primary"
              disabled={isSubmitting || !productId}
            >
              {isSubmitting ? 'Recording...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

