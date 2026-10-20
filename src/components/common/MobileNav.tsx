import React from 'react';
import { TabType } from './Header';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Settings,
} from 'lucide-react';

interface MobileNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onTabChange }) => {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <button
        className={`mobile-nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        <LayoutDashboard size={20} />
        <span>Home</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'products' ? 'active' : ''}`}
        onClick={() => onTabChange('products')}
      >
        <Package size={20} />
        <span>Products</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'purchases' ? 'active' : ''}`}
        onClick={() => onTabChange('purchases')}
      >
        <ShoppingBag size={20} />
        <span>Purchases</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'sales' ? 'active' : ''}`}
        onClick={() => onTabChange('sales')}
      >
        <TrendingUp size={20} />
        <span>Sales</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'reports' ? 'active' : ''}`}
        onClick={() => onTabChange('reports')}
      >
        <BarChart3 size={20} />
        <span>Reports</span>
      </button>

      <button
        className={`mobile-nav-item ${currentTab === 'settings' ? 'active' : ''}`}
        onClick={() => onTabChange('settings')}
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
};

