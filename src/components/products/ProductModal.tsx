import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { rupeesToPaise, paiseToInputString } from '../../utils/money';
import { useApp } from '../../context/AppContext';
import { X, Trash2, Layers, Tag, Package } from 'lucide-react';
import { SearchableCombobox } from '../common/SearchableCombobox';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (params: {
    id?: string;
    name: string;
    sku?: string;
    car_brand?: string;
    car_model?: string;
    product_brand?: string;
    unit: string;
    current_stock?: number;
    average_cost_paise?: number;
    selling_price_suggestion_paise?: number;
    low_stock_threshold?: number;
  }) => Promise<void>;
  product?: Product | null;
  onDelete?: (product: Product) => void;
  existingProducts?: Product[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  onDelete,
  existingProducts = [],
}) => {
  const { currencyPreference } = useApp();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [currentStock, setCurrentStock] = useState('0');
  const [avgCostRupees, setAvgCostRupees] = useState('');
  const [sellingPriceRupees, setSellingPriceRupees] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Distinct lists based strictly on values already stored in the catalog
  const storedCarBrands = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of existingProducts) {
      if (p.car_brand?.trim()) set.add(p.car_brand.trim());
    }
    return Array.from(set).sort();
  }, [existingProducts]);

  const storedCarModels = React.useMemo(() => {
    const set = new Set<string>();
    // If a car brand is currently typed/selected, look for models under this car brand first
    if (carBrand.trim()) {
      for (const p of existingProducts) {
        if (p.car_brand?.trim().toLowerCase() === carBrand.trim().toLowerCase() && p.car_model?.trim()) {
          set.add(p.car_model.trim());
        }
      }
    }
    // If no models found for this specific brand or no brand selected, include all stored models
    if (set.size === 0) {
      for (const p of existingProducts) {
        if (p.car_model?.trim()) set.add(p.car_model.trim());
      }
    }
    return Array.from(set).sort();
  }, [existingProducts, carBrand]);

  const storedProductBrands = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of existingProducts) {
      if (p.product_brand?.trim()) set.add(p.product_brand.trim());
    }
    return Array.from(set).sort();
  }, [existingProducts]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku || '');
      setCarBrand(product.car_brand || '');
      setCarModel(product.car_model || '');
      setProductBrand(product.product_brand || '');
      setUnit(product.unit || 'pcs');
      setCurrentStock(product.current_stock.toString());
      setAvgCostRupees(paiseToInputString(product.average_cost_paise));
      setSellingPriceRupees(paiseToInputString(product.selling_price_suggestion_paise));
      setLowStockThreshold(product.low_stock_threshold.toString());
    } else {
      setName('');
      setSku('');
      setCarBrand('');
      setCarModel('');
      setProductBrand('');
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
      setError('Part / Product name is required.');
      return;
    }

    const stockNum = parseFloat(currentStock) || 0;
    if (stockNum < 0) {
      setError('Current stock cannot be negative.');
      return;
    }

    const thresholdNum = parseFloat(lowStockThreshold) || 0;
    if (thresholdNum < 0) {
      setError('Low stock alert level cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        id: product ? product.id : undefined,
        name: name.trim(),
        sku: sku.trim() || undefined,
        car_brand: carBrand.trim() || undefined,
        car_model: carModel.trim() || undefined,
        product_brand: productBrand.trim() || undefined,
        unit: unit.trim() || 'pcs',
        current_stock: stockNum,
        average_cost_paise: avgCostRupees ? rupeesToPaise(avgCostRupees) : 0,
        selling_price_suggestion_paise: sellingPriceRupees ? rupeesToPaise(sellingPriceRupees) : undefined,
        low_stock_threshold: thresholdNum,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save part');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currencyPreference === 'symbol' ? '₹' : 'Rs ';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Package size={20} style={{ color: 'var(--primary)' }} />
            <span>{product ? 'Edit Part' : 'Add New Part'}</span>
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

            {/* Part Name */}
            <div className="form-group">
              <label className="form-label">Part / Product Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Front Brake Pad Set, Engine Oil Filter, Clutch Plate"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Category & Model Box */}
            <div
              style={{
                backgroundColor: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--gray-800)',
                  marginBottom: '0.65rem',
                }}
              >
                <Layers size={16} style={{ color: 'var(--primary)' }} />
                <span>Category & Model</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Category</span>
                    {storedCarBrands.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 400 }}>
                        {storedCarBrands.length} stored
                      </span>
                    )}
                  </label>
                  <SearchableCombobox
                    value={carBrand}
                    onChange={(val) => setCarBrand(val)}
                    options={storedCarBrands}
                    placeholder="Search or enter category..."
                    createLabel="Create new category"
                  />
                  <div className="form-hint">Search existing or type to create new</div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Model / Sub-category</span>
                    {storedCarModels.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 400 }}>
                        {storedCarModels.length} stored
                      </span>
                    )}
                  </label>
                  <SearchableCombobox
                    value={carModel}
                    onChange={(val) => setCarModel(val)}
                    options={storedCarModels}
                    placeholder={
                      carBrand.trim()
                        ? `Search or enter ${carBrand} model...`
                        : 'Search or enter model / sub-category...'
                    }
                    createLabel="Create new model"
                  />
                  <div className="form-hint">Search existing or type to create new</div>
                </div>
              </div>
            </div>

            {/* Product Brand & SKU/Part Number */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Tag size={14} style={{ color: 'var(--primary)' }} />
                    <span>Product / Part Brand</span>
                  </div>
                  {storedProductBrands.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 400 }}>
                      {storedProductBrands.length} stored
                    </span>
                  )}
                </label>
                <SearchableCombobox
                  value={productBrand}
                  onChange={(val) => setProductBrand(val)}
                  options={storedProductBrands}
                  placeholder="Search or enter brand (e.g. Bosch, Brembo)..."
                  createLabel="Create new part brand"
                />
                <div className="form-hint">Search existing or type to create new</div>
              </div>

              <div className="form-group">
                <label className="form-label">Part Number / SKU (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BP-MS-001, 16510M68K00"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
                <div className="form-hint">Unique catalog or OEM number</div>
              </div>

              <div className="form-group">
                <label className="form-label">Unit of Measure</label>
                <select
                  className="form-select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="set">Set (set)</option>
                  <option value="pair">Pair (pair)</option>
                  <option value="kit">Kit (kit)</option>
                  <option value="box">Box (box)</option>
                  <option value="pack">Pack (pack)</option>
                  <option value="l">Liters (L)</option>
                  <option value="meter">Meters (m)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
                <div className="form-hint">Billing unit</div>
              </div>
            </div>

            {/* Stock Levels */}
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
                <div className="form-hint">Units currently on hand in inventory</div>
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
                <div className="form-hint">Warns when stock falls to or below this</div>
              </div>
            </div>

            {/* Pricing & Cost */}
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
                <div className="form-hint">Suggested price; editable during sale</div>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: product && onDelete ? 'space-between' : 'flex-end' }}>
            {product && onDelete && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onDelete(product)}
                disabled={isSubmitting}
                style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Delete this part"
              >
                <Trash2 size={15} />
                <span>Delete Part</span>
              </button>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                {isSubmitting ? 'Saving...' : product ? 'Update Part' : 'Add Part'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
