import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { rupeesToPaise, paiseToInputString } from '../../utils/money';
import { useApp } from '../../context/AppContext';
import { X } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: {
    id?: string;
    name: string;
    sku?: string;
    unit: string;
    current_stock?: number;
    average_cost_paise?: number;
    selling_price_suggestion_paise?: number;
    low_stock_threshold?: number;
  }) => Promise<void>;
  product?: Product | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
}) => {
  const { currencyPreference } = useApp();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [currentStock, setCurrentStock] = useState('0');
  const [avgCostRupees, setAvgCostRupees] = useState('');
  const [sellingPriceRupees, setSellingPriceRupees] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku || '');
      setUnit(product.unit || 'pcs');
      setCurrentStock(product.current_stock.toString());
      setAvgCostRupees(paiseToInputString(product.average_cost_paise));
      setSellingPriceRupees(paiseToInputString(product.selling_price_suggestion_paise));
      setLowStockThreshold(product.low_stock_threshold.toString());
    } else {
      setName('');
      setSku('');
      setUnit('pcs');
      setCurrentStock('0');
      setAvgCostRupees('');
      setSellingPriceRupees('');
      setLowStockThreshold('5');
    }
    setError(null);
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    const stockNum = parseFloat(currentStock) || 0;
    if (stockNum < 0) {
      setError('Current stock cannot be negative.');
      return;
    }

    const thresholdNum = parseFloat(lowStockThreshold) || 0;
    if (thresholdNum < 0) {
      setError('Low stock threshold cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        id: product ? product.id : undefined,
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit: unit.trim() || 'pcs',
        current_stock: stockNum,
        average_cost_paise: avgCostRupees ? rupeesToPaise(avgCostRupees) : 0,
        selling_price_suggestion_paise: sellingPriceRupees ? rupeesToPaise(sellingPriceRupees) : undefined,
        low_stock_threshold: thresholdNum,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currencyPreference === 'symbol' ? '₹' : 'Rs ';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {product ? 'Edit Product' : 'Add New Product'}
          </div>
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
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Basmati Rice 5kg, Cotton Shirt"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">SKU / Item Code (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. RIC-001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit of Measure</label>
                <select
                  className="form-select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="pack">Pack</option>
                  <option value="box">Box</option>
                  <option value="bottle">Bottle</option>
                  <option value="l">Liters (L)</option>
                  <option value="meter">Meters (m)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                />
                <div className="form-hint">Available quantity on hand</div>
              </div>

              <div className="form-group">
                <label className="form-label">Low Stock Alert Level</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="form-input"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
                <div className="form-hint">Alerts when stock drops to or below this</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Average Unit Cost</label>
                <div className="form-input-prefix-wrapper">
                  <span className="input-prefix">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input has-prefix"
                    placeholder="0.00"
                    value={avgCostRupees}
                    onChange={(e) => setAvgCostRupees(e.target.value)}
                  />
                </div>
                <div className="form-hint">Used for inventory valuation & COGS</div>
              </div>

              <div className="form-group">
                <label className="form-label">Default Selling Price (Optional)</label>
                <div className="form-input-prefix-wrapper">
                  <span className="input-prefix">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input has-prefix"
                    placeholder="0.00"
                    value={sellingPriceRupees}
                    onChange={(e) => setSellingPriceRupees(e.target.value)}
                  />
                </div>
                <div className="form-hint">Suggested price; editable on each sale</div>
              </div>
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

