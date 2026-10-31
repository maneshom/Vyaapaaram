import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { Search, X, Plus, ChevronDown, Check, Package, Tag } from 'lucide-react';

export interface SearchableProductSelectProps {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (productId: string) => void;
  onOpenCreateProduct?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  onOpenCreateProduct,
  placeholder = 'Search part by name, category, brand, or SKU...',
  disabled = false,
  required = false,
  className = '',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
      const brandMatch = p.product_brand ? p.product_brand.toLowerCase().includes(q) : false;
      const carBrandMatch = p.car_brand ? p.car_brand.toLowerCase().includes(q) : false;
      const carModelMatch = p.car_model ? p.car_model.toLowerCase().includes(q) : false;
      const vehicleCombined = `${p.car_brand || ''} ${p.car_model || ''}`.toLowerCase();
      const vehicleMatch = vehicleCombined.includes(q);
      return nameMatch || skuMatch || brandMatch || carBrandMatch || carModelMatch || vehicleMatch;
    });
  }, [products, searchQuery]);

  const handleSelect = (productId: string) => {
    onSelectProduct(productId);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectProduct('');
    setSearchQuery('');
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-product-select-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      {/* If a product is already selected and dropdown is closed, show selected product card */}
      {selectedProduct && !isOpen ? (
        <div
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          style={{
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-md)',
            padding: '0.55rem 0.85rem',
            backgroundColor: '#ffffff',
            cursor: disabled ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.borderColor = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.currentTarget.style.borderColor = 'var(--gray-300)';
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)' }}>
              {selectedProduct.name}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--gray-600)',
                display: 'flex',
                gap: '0.45rem',
                flexWrap: 'wrap',
                marginTop: '0.15rem',
              }}
            >
              {(selectedProduct.car_brand || selectedProduct.car_model) && (
                <span>
                  📂 {[selectedProduct.car_brand, selectedProduct.car_model].filter(Boolean).join(' ')}
                </span>
              )}
              {selectedProduct.product_brand && (
                <span>🏷️ {selectedProduct.product_brand}</span>
              )}
              {selectedProduct.sku && (
                <span>#{selectedProduct.sku}</span>
              )}
              <span style={{ color: selectedProduct.current_stock > 0 ? 'var(--primary)' : 'var(--danger)', fontWeight: 600 }}>
                ({selectedProduct.current_stock} {selectedProduct.unit} in stock)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.2rem',
                  cursor: 'pointer',
                  color: 'var(--gray-400)',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '50%',
                }}
                title="Change or clear product"
              >
                <X size={15} />
              </button>
            )}
            <ChevronDown size={16} style={{ color: 'var(--gray-400)' }} />
          </div>
        </div>
      ) : (
        /* Unified Search Input */
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '0.75rem',
              color: 'var(--gray-400)',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            style={{
              paddingLeft: '2.1rem',
              paddingRight: searchQuery ? '3.8rem' : '2.2rem',
              fontSize: '0.85rem',
            }}
            placeholder={placeholder}
            value={searchQuery}
            disabled={disabled}
            required={required && !selectedProductId}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredProducts.length === 1) {
                  handleSelect(filteredProducts[0].id);
                }
              }
            }}
          />

          <div
            style={{
              position: 'absolute',
              right: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.2rem',
                  cursor: 'pointer',
                  color: 'var(--gray-400)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search query"
              >
                <X size={14} />
              </button>
            )}

            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  setIsOpen((prev) => !prev);
                  if (!isOpen) inputRef.current?.focus();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.25rem',
                cursor: disabled ? 'default' : 'pointer',
                color: 'var(--gray-500)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Toggle product list"
            >
              <ChevronDown
                size={15}
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Menu of Products + Create New Option */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--card-shadow-lg)',
            zIndex: 1000,
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {/* Create New Product / Part Option */}
          {onOpenCreateProduct && (
            <div
              onClick={() => {
                setIsOpen(false);
                onOpenCreateProduct();
              }}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-dark)',
                fontSize: '0.825rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--gray-200)',
              }}
            >
              <Plus size={15} style={{ color: 'var(--primary)' }} />
              <span>
                {searchQuery.trim()
                  ? `+ Create new part: "${searchQuery.trim()}"`
                  : '+ Create new product / part'}
              </span>
            </div>
          )}

          {/* Filtered Products List */}
          {filteredProducts.length > 0 ? (
            <div>
              {filteredProducts.map((p) => {
                const isSelected = p.id === selectedProductId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p.id)}
                    style={{
                      padding: '0.55rem 0.85rem',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--gray-100)',
                      backgroundColor: isSelected ? 'var(--gray-100)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--gray-200)'
                        : 'var(--gray-50)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--gray-100)'
                        : 'transparent';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--gray-600)',
                          display: 'flex',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                          marginTop: '0.1rem',
                        }}
                      >
                        {(p.car_brand || p.car_model) && (
                          <span>{[p.car_brand, p.car_model].filter(Boolean).join(' ')}</span>
                        )}
                        {p.product_brand && <span>• {p.product_brand}</span>}
                        {p.sku && <span>• #{p.sku}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: p.current_stock > 0 ? 'var(--gray-700)' : 'var(--danger)',
                        }}
                      >
                        {p.current_stock} {p.unit}
                      </div>
                      {isSelected && (
                        <Check size={14} style={{ color: 'var(--primary)', marginTop: '2px' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                fontSize: '0.825rem',
                color: 'var(--gray-500)',
                textAlign: 'center',
              }}
            >
              No parts found matching "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

