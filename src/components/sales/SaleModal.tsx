import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { rupeesToPaise, paiseToInputString } from '../../utils/money';
import { calculateSaleTotals } from '../../utils/calculations';
import { getTodayDateString } from '../../utils/dates';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { X, Plus, Trash2, AlertTriangle, HelpCircle } from 'lucide-react';
import { SearchableCombobox } from '../common/SearchableCombobox';
import { SearchableProductSelect } from '../common/SearchableProductSelect';

interface SaleLineItemState {
  productId: string;
  quantityStr: string;
  sellingPriceRupees: string;
}

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOpenCreateProduct?: () => void;
  onSave: (params: {
    items: Array<{
      product_id: string;
      quantity: number;
      selling_price_paise: number;
    }>;
    delivery_charged_paise?: number;
    courier_cost_paid_paise?: number;
    other_direct_expenses_paise?: number;
    customer_name?: string;
    customer_phone?: string;
    date?: string;
  }) => Promise<void>;
}

export const SaleModal: React.FC<SaleModalProps> = ({
  isOpen,
  onClose,
  products,
  onOpenCreateProduct,
  onSave,
}) => {
  const { formatCurrency, currencyPreference } = useApp();
  const [items, setItems] = useState<SaleLineItemState[]>([]);
  const [deliveryChargedRupees, setDeliveryChargedRupees] = useState('');
  const [courierCostPaidRupees, setCourierCostPaidRupees] = useState('');
  const [otherExpensesRupees, setOtherExpensesRupees] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [storedCustomerNames, setStoredCustomerNames] = useState<string[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with one item line when opened and load past customers
  useEffect(() => {
    if (isOpen) {
      if (products.length > 0) {
        const firstInStock = products.find((p) => p.current_stock > 0) || products[0];
        setItems([
          {
            productId: firstInStock.id,
            quantityStr: '1',
            sellingPriceRupees: firstInStock.selling_price_suggestion_paise
              ? paiseToInputString(firstInStock.selling_price_suggestion_paise)
              : paiseToInputString(firstInStock.average_cost_paise),
          },
        ]);
      } else {
        setItems([]);
      }
      setDeliveryChargedRupees('');
      setCourierCostPaidRupees('');
      setOtherExpensesRupees('');
      setCustomerName('');
      setCustomerPhone('');
      setDate(getTodayDateString());
      setError(null);

      // Load past customer names for combobox
      repository.getSales().then((list) => {
        const set = new Set<string>();
        for (const s of list) {
          if (s.customer_name?.trim()) set.add(s.customer_name.trim());
        }
        setStoredCustomerNames(Array.from(set).sort());
      }).catch(() => {});
    }
  }, [isOpen, products]);

  // Product lookup map
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Handle adding another line item
  const handleAddItem = () => {
    const firstInStock = products.find((p) => p.current_stock > 0) || products[0];
    if (!firstInStock) return;
    setItems((prev) => [
      ...prev,
      {
        productId: firstInStock.id,
        quantityStr: '1',
        sellingPriceRupees: firstInStock.selling_price_suggestion_paise
          ? paiseToInputString(firstInStock.selling_price_suggestion_paise)
          : paiseToInputString(firstInStock.average_cost_paise),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, newProductId: string) => {
    const prod = productMap.get(newProductId);
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: newProductId,
        sellingPriceRupees: prod?.selling_price_suggestion_paise
          ? paiseToInputString(prod.selling_price_suggestion_paise)
          : paiseToInputString(prod?.average_cost_paise),
      };
      return next;
    });
  };

  const handleQuantityChange = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantityStr: val };
      return next;
    });
  };

  const handleSellingPriceChange = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], sellingPriceRupees: val };
      return next;
    });
  };

  // Stock check validation
  const stockErrors = useMemo(() => {
    const errors: string[] = [];
    const aggregatedQty = new Map<string, number>();

    for (const item of items) {
      const qty = parseFloat(item.quantityStr) || 0;
      aggregatedQty.set(item.productId, (aggregatedQty.get(item.productId) || 0) + qty);
    }

    for (const [prodId, reqQty] of aggregatedQty.entries()) {
      const prod = productMap.get(prodId);
      if (prod) {
        if (reqQty > prod.current_stock) {
          errors.push(
            `Cannot sell ${reqQty} ${prod.unit} of "${prod.name}". Available stock is only ${prod.current_stock} ${prod.unit}.`
          );
        }
      }
    }

    return errors;
  }, [items, productMap]);

  // Live calculation of totals
  const saleCalculation = useMemo(() => {
    const validItems = items
      .map((it) => {
        const prod = productMap.get(it.productId);
        const qty = parseFloat(it.quantityStr);
        const price = rupeesToPaise(it.sellingPriceRupees);
        if (!prod || isNaN(qty) || qty <= 0) return null;
        return {
          product: prod,
          quantity: qty,
          selling_price_paise: price,
        };
      })
      .filter(Boolean) as Array<{
      product: Product;
      quantity: number;
      selling_price_paise: number;
    }>;

    return calculateSaleTotals({
      items: validItems,
      delivery_charged_paise: rupeesToPaise(deliveryChargedRupees),
      courier_cost_paid_paise: rupeesToPaise(courierCostPaidRupees),
      other_direct_expenses_paise: rupeesToPaise(otherExpensesRupees),
    });
  }, [
    items,
    productMap,
    deliveryChargedRupees,
    courierCostPaidRupees,
    otherExpensesRupees,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Please add at least one product to the sale.');
      return;
    }

    if (stockErrors.length > 0) {
      setError(stockErrors[0]);
      return;
    }

    const payloadItems = items.map((it) => {
      const prod = productMap.get(it.productId);
      const qty = parseFloat(it.quantityStr);
      const price = rupeesToPaise(it.sellingPriceRupees);
      if (!prod) throw new Error('Invalid product');
      if (isNaN(qty) || qty <= 0) throw new Error(`Invalid quantity for ${prod.name}`);
      if (price < 0) throw new Error(`Selling price cannot be negative for ${prod.name}`);

      return {
        product_id: it.productId,
        quantity: qty,
        selling_price_paise: price,
      };
    });

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave({
        items: payloadItems,
        delivery_charged_paise: rupeesToPaise(deliveryChargedRupees),
        courier_cost_paid_paise: rupeesToPaise(courierCostPaidRupees),
        other_direct_expenses_paise: rupeesToPaise(otherExpensesRupees),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currencyPreference === 'symbol' ? '₹' : 'Rs ';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">Record Sale</div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {stockErrors.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Stock Warning:</strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                    {stockErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Customer & Date */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Customer Name</span>
                  {storedCustomerNames.length > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 400 }}>
                      {storedCustomerNames.length} stored
                    </span>
                  )}
                </label>
                <SearchableCombobox
                  value={customerName}
                  onChange={(val) => setCustomerName(val)}
                  options={storedCustomerNames}
                  placeholder="Search or enter customer..."
                  createLabel="Create new customer"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Customer Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sale Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line Items */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                }}
              >
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Sale Products *
                </label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.25rem' }}
                >
                  <Plus size={14} /> Add Product
                </button>
              </div>

              {items.map((item, idx) => {
                const prod = productMap.get(item.productId);
                const isOutOfStock = prod ? prod.current_stock <= 0 : false;
                const isLowStock = prod
                  ? prod.current_stock <= prod.low_stock_threshold && prod.current_stock > 0
                  : false;

                const qty = parseFloat(item.quantityStr) || 0;
                const price = rupeesToPaise(item.sellingPriceRupees);
                const lineSubtotal = Math.round(qty * price);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1fr 1.3fr 1.2fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--gray-100)',
                    }}
                  >
                    <div>
                      <SearchableProductSelect
                        products={products}
                        selectedProductId={item.productId}
                        onSelectProduct={(id) => handleProductChange(idx, id)}
                        onOpenCreateProduct={onOpenCreateProduct}
                        placeholder="Search part by name, vehicle, brand, SKU..."
                        required
                      />
                      {prod && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            marginTop: '2px',
                            color: isOutOfStock
                              ? 'var(--danger)'
                              : isLowStock
                              ? 'var(--warning)'
                              : 'var(--gray-500)',
                          }}
                        >
                          {(prod.car_brand || prod.car_model || prod.product_brand) && (
                            <span style={{ fontWeight: 600, color: 'var(--gray-700)', marginRight: '0.4rem' }}>
                              📂 {[prod.car_brand, prod.car_model].filter(Boolean).join(' ')} {prod.product_brand ? `| 🏷️ ${prod.product_brand}` : ''} •
                            </span>
                          )}
                          Available: {prod.current_stock} {prod.unit} | Cost:{' '}
                          {formatCurrency(prod.average_cost_paise)}
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        className="form-input"
                        placeholder="Qty"
                        value={item.quantityStr}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <div className="form-input-prefix-wrapper">
                        <span className="input-prefix" style={{ fontSize: '0.75rem', left: '0.5rem' }}>
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input has-prefix"
                          style={{ paddingLeft: '1.6rem' }}
                          placeholder="Price"
                          value={item.sellingPriceRupees}
                          onChange={(e) => handleSellingPriceChange(idx, e.target.value)}
                          required
                          title="Customer-specific selling price"
                        />
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                      {formatCurrency(lineSubtotal)}
                    </div>

                    <div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="modal-close"
                          style={{ color: 'var(--danger)', padding: '0.4rem' }}
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '1.25rem 1rem',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--gray-300)',
                    marginTop: '0.5rem',
                  }}
                >
                  <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '0.75rem' }}>
                    No products added to this sale yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn btn-primary btn-sm"
                    style={{ gap: '0.35rem' }}
                  >
                    <Plus size={15} /> Add Product
                  </button>
                </div>
              )}

              {/* Add button under products list */}
              {items.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '0.35rem', fontWeight: 600 }}
                  >
                    <Plus size={15} /> Add Another Product
                  </button>
                </div>
              )}
            </div>

            {/* Courier & Direct Sale Expenses */}
            <div
              style={{
                backgroundColor: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--gray-800)',
                  marginBottom: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>Delivery & Direct Expenses</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--gray-500)' }}>
                  (Optional - defaults to 0)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Delivery charged to customer
                  </label>
                  <div className="form-input-prefix-wrapper">
                    <span className="input-prefix">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input has-prefix"
                      placeholder="0.00"
                      value={deliveryChargedRupees}
                      onChange={(e) => setDeliveryChargedRupees(e.target.value)}
                    />
                  </div>
                  <div className="form-hint" style={{ fontSize: '0.7rem' }}>
                    Added to customer bill
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Courier cost paid
                  </label>
                  <div className="form-input-prefix-wrapper">
                    <span className="input-prefix">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input has-prefix"
                      placeholder="0.00"
                      value={courierCostPaidRupees}
                      onChange={(e) => setCourierCostPaidRupees(e.target.value)}
                    />
                  </div>
                  <div className="form-hint" style={{ fontSize: '0.7rem' }}>
                    Actual cost paid after discount
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Other direct expenses
                  </label>
                  <div className="form-input-prefix-wrapper">
                    <span className="input-prefix">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input has-prefix"
                      placeholder="0.00"
                      value={otherExpensesRupees}
                      onChange={(e) => setOtherExpensesRupees(e.target.value)}
                    />
                  </div>
                  <div className="form-hint" style={{ fontSize: '0.7rem' }}>
                    Packaging, travel, etc.
                  </div>
                </div>
              </div>
            </div>

            {/* Live Profit & Total Summary Breakdown Card */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ color: 'var(--gray-600)' }}>Products Selling Revenue:</span>
                <span>{formatCurrency(saleCalculation.product_selling_revenue_paise)}</span>
              </div>

              {saleCalculation.delivery_charged_paise > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    marginBottom: '0.35rem',
                    color: 'var(--gray-700)',
                  }}
                >
                  <span>+ Delivery charged to customer:</span>
                  <span>{formatCurrency(saleCalculation.delivery_charged_paise)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1rem',
                  fontWeight: 700,
                  paddingTop: '0.35rem',
                  borderTop: '1px dashed var(--gray-200)',
                  marginBottom: '0.5rem',
                }}
              >
                <span>Total Customer Bill:</span>
                <span>{formatCurrency(saleCalculation.total_amount_paise)}</span>
              </div>

              {/* Profit formula breakdown */}
              <div
                style={{
                  backgroundColor: 'var(--success-bg)',
                  border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.825rem',
                  marginTop: '0.5rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#166534',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}
                >
                  <span>Profit after direct sale costs:</span>
                  <span>
                    {formatCurrency(saleCalculation.profit_after_direct_costs_paise)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.725rem',
                    color: '#15803d',
                    marginTop: '0.25rem',
                  }}
                >
                  Revenue ({formatCurrency(saleCalculation.product_selling_revenue_paise)})
                  {saleCalculation.delivery_charged_paise > 0 &&
                    ` + Delivery (${formatCurrency(saleCalculation.delivery_charged_paise)})`}
                  {' - '}COGS ({formatCurrency(saleCalculation.total_cogs_paise)})
                  {saleCalculation.courier_cost_paid_paise > 0 &&
                    ` - Courier (${formatCurrency(saleCalculation.courier_cost_paid_paise)})`}
                  {saleCalculation.other_direct_expenses_paise > 0 &&
                    ` - Direct (${formatCurrency(saleCalculation.other_direct_expenses_paise)})`}
                </div>
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
              disabled={isSubmitting || items.length === 0 || stockErrors.length > 0}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={16} />
              <span>{isSubmitting ? 'Recording Sale...' : 'Record Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

