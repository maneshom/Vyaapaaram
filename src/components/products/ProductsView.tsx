import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  ShoppingBag,
  Trash2,
  Layers,
  Tag,
  Filter,
  X,
  RotateCcw,
} from 'lucide-react';

interface ProductsViewProps {
  onOpenNewProduct: (prod?: Product) => void;
  onOpenNewPurchase: (productId?: string) => void;
  onOpenDeleteProduct?: (prod: Product) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  onOpenNewProduct,
  onOpenNewPurchase,
  onOpenDeleteProduct,
}) => {
  const { formatCurrency, dataVersion } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');
  const [selectedCarBrand, setSelectedCarBrand] = useState('all');
  const [selectedCarModel, setSelectedCarModel] = useState('all');
  const [selectedProductBrand, setSelectedProductBrand] = useState('all');

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const list = await repository.getProducts();
        if (mounted) setProducts(list);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadProducts();
    return () => {
      mounted = false;
    };
  }, [dataVersion]);

  // Aggregate KPI stats
  const stats = useMemo(() => {
    let totalStock = 0;
    let totalValuePaise = 0;
    let lowCount = 0;
    let outCount = 0;

    for (const p of products) {
      totalStock += p.current_stock;
      totalValuePaise += Math.max(0, p.current_stock) * p.average_cost_paise;
      if (p.current_stock <= 0) {
        outCount++;
        lowCount++;
      } else if (p.current_stock <= p.low_stock_threshold) {
        lowCount++;
      }
    }

    return { totalStock, totalValuePaise, lowCount, outCount };
  }, [products]);

  // Distinct lists for dropdown filter options
  const uniqueCarBrands = useMemo(() => {
    const brandMap = new Map<string, number>();
    for (const p of products) {
      if (p.car_brand?.trim()) {
        const b = p.car_brand.trim();
        brandMap.set(b, (brandMap.get(b) || 0) + 1);
      }
    }
    return Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [products]);

  const uniqueCarModels = useMemo(() => {
    const modelMap = new Map<string, { model: string; carBrand?: string; count: number }>();
    for (const p of products) {
      if (p.car_model?.trim()) {
        // If a car brand is currently selected, only show models for that car brand
        if (selectedCarBrand !== 'all' && p.car_brand?.trim() !== selectedCarBrand) {
          continue;
        }
        const m = p.car_model.trim();
        const existing = modelMap.get(m);
        if (existing) {
          existing.count += 1;
        } else {
          modelMap.set(m, { model: m, carBrand: p.car_brand?.trim(), count: 1 });
        }
      }
    }
    return Array.from(modelMap.values()).sort((a, b) => a.model.localeCompare(b.model));
  }, [products, selectedCarBrand]);

  const uniqueProductBrands = useMemo(() => {
    const brandMap = new Map<string, number>();
    for (const p of products) {
      if (p.product_brand?.trim()) {
        const b = p.product_brand.trim();
        brandMap.set(b, (brandMap.get(b) || 0) + 1);
      }
    }
    return Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Text Search across name, sku, car_brand, car_model, product_brand
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
        const carBrandMatch = p.car_brand ? p.car_brand.toLowerCase().includes(q) : false;
        const carModelMatch = p.car_model ? p.car_model.toLowerCase().includes(q) : false;
        const prodBrandMatch = p.product_brand ? p.product_brand.toLowerCase().includes(q) : false;

        if (!nameMatch && !skuMatch && !carBrandMatch && !carModelMatch && !prodBrandMatch) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCarBrand !== 'all' && p.car_brand?.trim() !== selectedCarBrand) {
        return false;
      }

      // 3. Model Filter
      if (selectedCarModel !== 'all' && p.car_model?.trim() !== selectedCarModel) {
        return false;
      }

      // 4. Product Brand Filter
      if (selectedProductBrand !== 'all' && p.product_brand?.trim() !== selectedProductBrand) {
        return false;
      }

      // 5. Stock status tab
      if (filterTab === 'low_stock') {
        return p.current_stock <= p.low_stock_threshold;
      }
      if (filterTab === 'out_of_stock') {
        return p.current_stock <= 0;
      }

      return true;
    });
  }, [products, searchQuery, filterTab, selectedCarBrand, selectedCarModel, selectedProductBrand]);

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedCarBrand !== 'all' ||
    selectedCarModel !== 'all' ||
    selectedProductBrand !== 'all' ||
    filterTab !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCarBrand('all');
    setSelectedCarModel('all');
    setSelectedProductBrand('all');
    setFilterTab('all');
  };

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Parts & Inventory</h1>
          <p className="page-description">
            Track spare parts, vehicle compatibility, brand stocks, and purchase costs
          </p>
        </div>

        <div className="toolbar-buttons">
          <button className="btn btn-primary" onClick={() => onOpenNewProduct()}>
            <Plus size={16} /> Add Part
          </button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Catalog Parts</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-subtext">Active spare part lines</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Units on Hand</div>
          <div className="stat-value">{stats.totalStock}</div>
          <div className="stat-subtext">Across all vehicle lines</div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-label" style={{ color: 'var(--primary-dark)' }}>
            Inventory Valuation
          </div>
          <div className="stat-value" style={{ color: '#042f2e' }}>
            {formatCurrency(stats.totalValuePaise)}
          </div>
          <div className="stat-subtext">Based on moving average costs</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Low / Out of Stock</div>
          <div className="stat-value" style={{ color: stats.lowCount > 0 ? 'var(--warning)' : 'inherit' }}>
            {stats.lowCount}
          </div>
          <div className="stat-subtext">
            {stats.outCount > 0 ? `${stats.outCount} completely out of stock` : 'Healthy stock levels'}
          </div>
        </div>
      </div>

      {/* Filters & Search Card */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        {/* Top Filter Row: Search & Stock Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
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
              style={{ paddingLeft: '2.25rem', paddingRight: searchQuery ? '2rem' : '0.85rem' }}
              placeholder="Search by part name, SKU, vehicle brand, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--gray-400)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterTab('all')}
            >
              All ({products.length})
            </button>
            <button
              className={`btn btn-sm ${filterTab === 'low_stock' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterTab('low_stock')}
            >
              Low Stock ({stats.lowCount})
            </button>
            <button
              className={`btn btn-sm ${filterTab === 'out_of_stock' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterTab('out_of_stock')}
            >
              Out of Stock ({stats.outCount})
            </button>
          </div>
        </div>

        {/* Second Filter Row: Category, Model, Product Brand Dropdowns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.65rem',
            alignItems: 'center',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--gray-100)',
          }}
        >
          {/* Category Filter */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--gray-600)',
                marginBottom: '0.25rem',
              }}
            >
              <Layers size={13} style={{ color: 'var(--primary)' }} />
              <span>Category</span>
            </label>
            <select
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.45rem 0.65rem' }}
              value={selectedCarBrand}
              onChange={(e) => {
                setSelectedCarBrand(e.target.value);
                setSelectedCarModel('all'); // Reset dependent model when category changes
              }}
            >
              <option value="all">All Categories ({uniqueCarBrands.length})</option>
              {uniqueCarBrands.map(({ brand, count }) => (
                <option key={brand} value={brand}>
                  {brand} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Model Filter */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--gray-600)',
                marginBottom: '0.25rem',
              }}
            >
              <Tag size={13} style={{ color: 'var(--primary)' }} />
              <span>Model</span>
            </label>
            <select
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.45rem 0.65rem' }}
              value={selectedCarModel}
              onChange={(e) => setSelectedCarModel(e.target.value)}
              disabled={uniqueCarModels.length === 0}
            >
              <option value="all">
                {selectedCarBrand === 'all'
                  ? `All Models (${uniqueCarModels.length})`
                  : `All ${selectedCarBrand} Models (${uniqueCarModels.length})`}
              </option>
              {uniqueCarModels.map(({ model, count }) => (
                <option key={model} value={model}>
                  {model} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Product Brand Filter */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--gray-600)',
                marginBottom: '0.25rem',
              }}
            >
              <Tag size={13} style={{ color: 'var(--primary)' }} />
              <span>Product Brand</span>
            </label>
            <select
              className="form-select"
              style={{ fontSize: '0.825rem', padding: '0.45rem 0.65rem' }}
              value={selectedProductBrand}
              onChange={(e) => setSelectedProductBrand(e.target.value)}
            >
              <option value="all">All Product Brands ({uniqueProductBrands.length})</option>
              {uniqueProductBrands.map(({ brand, count }) => (
                <option key={brand} value={brand}>
                  {brand} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Action */}
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
            {isFiltered && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  color: 'var(--gray-700)',
                  padding: '0.48rem 0.75rem',
                }}
                title="Reset all search & brand filters"
              >
                <RotateCcw size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Summary Pill Bar */}
        {isFiltered && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--gray-600)',
              backgroundColor: 'var(--gray-50)',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Filter size={12} style={{ color: 'var(--primary)' }} />
              <span>
                Showing <strong>{filteredProducts.length}</strong> of {products.length} parts
              </span>
              {selectedCarBrand !== 'all' && (
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  Category: {selectedCarBrand}
                </span>
              )}
              {selectedCarModel !== 'all' && (
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  Model: {selectedCarModel}
                </span>
              )}
              {selectedProductBrand !== 'all' && (
                <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                  Brand: {selectedProductBrand}
                </span>
              )}
            </div>
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Product List Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-500)' }}>
              Loading parts catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state" style={{ border: 'none' }}>
              <Package className="empty-icon" />
              <h3 className="empty-title">
                {isFiltered ? 'No matching parts found' : 'No parts in inventory yet'}
              </h3>
              <p className="empty-desc">
                {isFiltered
                  ? 'No parts match the selected Category, Model, Product Brand, or search terms.'
                  : 'Start by adding your catalog to track categories, models, stock, and margins.'}
              </p>
              {isFiltered ? (
                <button className="btn btn-secondary" onClick={handleResetFilters}>
                  <RotateCcw size={15} /> Clear All Filters
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => onOpenNewProduct()}>
                  <Plus size={16} /> Add Your First Part
                </button>
              )}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Part Details</th>
                    <th>Category / Model</th>
                    <th>Brand / Mfr</th>
                    <th style={{ textAlign: 'right' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Avg Unit Cost</th>
                    <th style={{ textAlign: 'right' }}>Suggested Price</th>
                    <th style={{ textAlign: 'right' }}>Stock Value</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock <= 0;
                    const isLowStock = p.current_stock <= p.low_stock_threshold && !isOutOfStock;
                    const stockValue = Math.max(0, p.current_stock) * p.average_cost_paise;

                    const hasVehicle = p.car_brand || p.car_model;

                    return (
                      <tr key={p.id}>
                        {/* Part Details */}
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{p.name}</div>
                          {p.sku && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>
                              Part #: {p.sku}
                            </div>
                          )}
                        </td>

                        {/* Category / Model */}
                        <td>
                          {hasVehicle ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Layers size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
                                {p.car_brand || ''} {p.car_model ? `• ${p.car_model}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>
                              Universal / General
                            </span>
                          )}
                        </td>

                        {/* Product Brand */}
                        <td>
                          {p.product_brand ? (
                            <span
                              className="badge badge-gray"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontWeight: 600,
                              }}
                            >
                              <Tag size={11} />
                              {p.product_brand}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>

                        {/* Stock */}
                        <td style={{ textAlign: 'right' }}>
                          <strong>{p.current_stock}</strong>{' '}
                          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                            {p.unit}
                          </span>
                        </td>

                        {/* Avg Cost */}
                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(p.average_cost_paise)}
                        </td>

                        {/* Suggested Selling Price */}
                        <td style={{ textAlign: 'right', color: 'var(--gray-700)' }}>
                          {p.selling_price_suggestion_paise
                            ? formatCurrency(p.selling_price_suggestion_paise)
                            : '—'}
                        </td>

                        {/* Stock Value */}
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(stockValue)}
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: 'center' }}>
                          {isOutOfStock ? (
                            <span className="badge badge-danger">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="badge badge-warning">Low Stock</span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenNewPurchase(p.id)}
                              title="Add stock via purchase"
                            >
                              <ShoppingBag size={14} /> Add Stock
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onOpenNewProduct(p)}
                              title="Edit part"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            {onOpenDeleteProduct && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onOpenDeleteProduct(p)}
                                title="Delete part"
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
