import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export type TabType = 'dashboard' | 'products' | 'purchases' | 'sales' | 'reports' | 'settings';

interface HeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onTabChange }) => {
  const {
    settings,
    isOnline,
    pendingSyncCount,
    isSyncing,
    triggerSync,
    lastSyncResult,
  } = useApp();

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="brand-section" onClick={() => onTabChange('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <span>व्य</span>
          </div>
          <div>
            <div className="brand-title">{settings.business_name || 'Vyaapaaram'}</div>
            <div className="brand-subtitle">Inventory & Profit</div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <button
            className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={`nav-link ${currentTab === 'products' ? 'active' : ''}`}
            onClick={() => onTabChange('products')}
          >
            <Package size={18} />
            Products
          </button>
          <button
            className={`nav-link ${currentTab === 'purchases' ? 'active' : ''}`}
            onClick={() => onTabChange('purchases')}
          >
            <ShoppingBag size={18} />
            Purchases
          </button>
          <button
            className={`nav-link ${currentTab === 'sales' ? 'active' : ''}`}
            onClick={() => onTabChange('sales')}
          >
            <TrendingUp size={18} />
            Sales
          </button>
          <button
            className={`nav-link ${currentTab === 'reports' ? 'active' : ''}`}
            onClick={() => onTabChange('reports')}
          >
            <BarChart3 size={18} />
            Reports
          </button>
        </nav>

        {/* Header Right Actions */}
        <div className="header-actions">
          {/* Connectivity / Sync Status Badge */}
          <button
            onClick={() => triggerSync()}
            disabled={isSyncing}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            title={
              isOnline
                ? pendingSyncCount > 0
                  ? `${pendingSyncCount} changes waiting to sync. Click to sync now.`
                  : 'Connected and synced.'
                : 'Working offline. Changes are saved locally on this device.'
            }
          >
            {isSyncing ? (
              <>
                <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Syncing...</span>
              </>
            ) : !isOnline ? (
              <>
                <WifiOff size={14} style={{ color: 'var(--warning)' }} />
                <span style={{ color: 'var(--warning)' }}>Offline</span>
              </>
            ) : pendingSyncCount > 0 ? (
              <>
                <RefreshCw size={14} style={{ color: 'var(--accent)' }} />
                <span>Sync ({pendingSyncCount})</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--success)' }}>Synced</span>
              </>
            )}
          </button>

          {/* Settings Icon */}
          <button
            className={`btn btn-secondary btn-sm ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
            title="Settings"
            aria-label="Settings"
            style={{ width: 36, height: 36, padding: 0 }}
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

