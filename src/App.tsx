import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from './context/AppContext';
import { Header, TabType } from './components/common/Header';
import { MobileNav } from './components/common/MobileNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductsView } from './components/products/ProductsView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { SalesView } from './components/sales/SalesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';

import { ProductModal } from './components/products/ProductModal';
import { PurchaseModal } from './components/purchases/PurchaseModal';
import { SaleModal } from './components/sales/SaleModal';
import { SaleReceiptModal } from './components/sales/SaleReceiptModal';
import { VoidSaleDialog } from './components/sales/VoidSaleDialog';

import { repository } from './storage/repository';
import { Product, Sale } from './types';

export const App: React.FC = () => {
  const { refreshData, dataVersion } = useApp();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseTargetProductId, setPurchaseTargetProductId] = useState<string | undefined>();

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [activeVoidSale, setActiveVoidSale] = useState<Sale | null>(null);

  const [products, setProducts] = useState<Product[]>([]);

  // Load products list for dropdowns
  const loadProducts = useCallback(async () => {
    try {
      const prods = await repository.getProducts();
      setProducts(prods);
    } catch (e) {
      console.error('Failed to load products in App:', e);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts, dataVersion]);

  // Handlers for Opening Modals
  const handleOpenNewProduct = (prod?: Product) => {
    setEditingProduct(prod || null);
    setIsProductModalOpen(true);
  };

  const handleOpenNewPurchase = (productId?: string) => {
    setPurchaseTargetProductId(productId);
    setIsPurchaseModalOpen(true);
  };

  const handleOpenNewSale = () => {
    setIsSaleModalOpen(true);
  };

  const handleViewReceipt = (sale: Sale) => {
    setActiveReceiptSale(sale);
  };

  const handleOpenVoidSale = (sale: Sale) => {
    setActiveReceiptSale(null); // Close receipt if open
    setActiveVoidSale(sale);
  };

  // Handlers for Saving
  const handleSaveProduct = async (params: any) => {
    await repository.saveProduct(params);
    refreshData();
    loadProducts();
  };

  const handleSavePurchase = async (params: any) => {
    await repository.recordPurchase(params);
    refreshData();
    loadProducts();
  };

  const handleSaveSale = async (params: any) => {
    const result = await repository.recordSale(params);
    refreshData();
    loadProducts();
    // Open receipt modal for newly completed sale
    setActiveReceiptSale(result.sale);
  };

  const handleConfirmVoidSale = async (saleId: string, reason: string) => {
    const result = await repository.voidSale(saleId, reason);
    refreshData();
    loadProducts();
    // Show updated receipt marked as voided
    setActiveReceiptSale(result.sale);
  };

  return (
    <div className="app-container">
      {/* Header with Navigation and Sync Status */}
      <Header currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main View Container */}
      <main className="main-content">
        {currentTab === 'dashboard' && (
          <DashboardView
            onOpenNewSale={handleOpenNewSale}
            onOpenNewPurchase={handleOpenNewPurchase}
            onOpenNewProduct={handleOpenNewProduct}
            onViewSaleReceipt={handleViewReceipt}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'products' && (
          <ProductsView
            onOpenNewProduct={handleOpenNewProduct}
            onOpenNewPurchase={handleOpenNewPurchase}
          />
        )}

        {currentTab === 'purchases' && (
          <PurchasesView
            onOpenNewPurchase={() => handleOpenNewPurchase()}
            products={products}
          />
        )}

        {currentTab === 'sales' && (
          <SalesView
            onOpenNewSale={handleOpenNewSale}
            onViewSaleReceipt={handleViewReceipt}
            products={products}
            onOpenNewProduct={handleOpenNewProduct}
          />
        )}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Product Add / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={editingProduct}
        onSave={handleSaveProduct}
      />

      {/* Purchase / Stock Addition Modal */}
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        products={products}
        initialProductId={purchaseTargetProductId}
        onSave={handleSavePurchase}
      />

      {/* Record Sale Modal */}
      <SaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        products={products}
        onSave={handleSaveSale}
      />

      {/* Sale Receipt & Details Modal */}
      <SaleReceiptModal
        isOpen={!!activeReceiptSale}
        onClose={() => setActiveReceiptSale(null)}
        sale={activeReceiptSale}
        onOpenVoid={handleOpenVoidSale}
      />

      {/* Safe Void Sale Dialog */}
      <VoidSaleDialog
        isOpen={!!activeVoidSale}
        onClose={() => setActiveVoidSale(null)}
        sale={activeVoidSale}
        onConfirmVoid={handleConfirmVoidSale}
      />
    </div>
  );
};

