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
  DollarSign,
  TrendingUp,
  Trash2,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

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

  // Compute counts
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

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterTab === 'low_stock') {
        return p.current_stock <= p.low_stock_threshold;
      }
      if (filterTab === 'out_of_stock') {
        return p.current_stock <= 0;
      }
      return true;
    });
  }, [products, searchQuery, filterTab]);

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Products & Inventory</h1>
          <p className="page-description">Manage stock levels, average unit costs, and pricing</p>
        </div>

        <div className="toolbar-buttons">
          <button className="btn btn-primary" onClick={() => onOpenNewProduct()}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Products</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-subtext">Active catalog items</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Units on Hand</div>
          <div className="stat-value">{stats.totalStock}</div>
          <div className="stat-subtext">Across all product lines</div>
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
            {stats.outCount > 0 ? `${stats.outCount} completely out of stock` : 'Healthy stock'}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
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
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.35rem' }}>
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

      {/* Product List Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--gray-500)' }}>
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state" style={{ border: 'none' }}>
              <Package className="empty-icon" />
              <h3 className="empty-title">
                {searchQuery || filterTab !== 'all' ? 'No matching products found' : 'No products yet'}
              </h3>
              <p className="empty-desc">
                {searchQuery || filterTab !== 'all'
                  ? 'Try clearing your search or filter tab.'
                  : 'Add your shop items to track stock and calculate profits.'}
              </p>
              {!searchQuery && filterTab === 'all' && (
                <button className="btn btn-primary" onClick={() => onOpenNewProduct()}>
                  <Plus size={16} /> Add Product
                </button>
              )}
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
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

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{p.name}</div>
                          {p.sku && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                              SKU: {p.sku}
                            </div>
                          )}
                        </td>

                        <td>
                          <strong>{p.current_stock}</strong>{' '}
                          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                            {p.unit}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          {formatCurrency(p.average_cost_paise)}
                        </td>

                        <td style={{ textAlign: 'right', color: 'var(--gray-700)' }}>
                          {p.selling_price_suggestion_paise
                            ? formatCurrency(p.selling_price_suggestion_paise)
                            : '—'}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(stockValue)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {isOutOfStock ? (
                            <span className="badge badge-danger">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="badge badge-warning">Low Stock</span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </td>

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
                              title="Edit product"
                            >
                              <Edit2 size={14} /> Edit
                            </button>
                            {onOpenDeleteProduct && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onOpenDeleteProduct(p)}
                                title="Delete product"
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

