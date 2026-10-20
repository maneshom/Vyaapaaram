import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppSettings, CurrencyPreference } from '../types';
import { repository } from '../storage/repository';
import { syncService, SyncResult } from '../storage/sync';
import { formatMoney, FormatMoneyOptions } from '../utils/money';

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  formatCurrency: (paise: number, opts?: FormatMoneyOptions) => string;
  currencyPreference: CurrencyPreference;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
  dataVersion: number;
  refreshData: () => void;
}

const defaultInitialSettings: AppSettings = {
  id: 'default',
  business_name: 'Vyaapaaram Store',
  currency_format: 'symbol',
  cloud_sync_enabled: false,
  workspace_id: 'default-workspace',
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultInitialSettings);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(1);

  // Load initial settings and pending count
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const loaded = await repository.getSettings();
        if (mounted) setSettings(loaded);
        const pending = await syncService.getPendingCount();
        if (mounted) setPendingSyncCount(pending.total);
      } catch (e) {
        console.error('Failed to init app state:', e);
      }
    };
    init();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshData = useCallback(async () => {
    setDataVersion((v) => v + 1);
    try {
      const pending = await syncService.getPendingCount();
      setPendingSyncCount(pending.total);
    } catch (e) {
      console.error('Failed to update pending count:', e);
    }
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      const updated = await repository.saveSettings(newSettings);
      setSettings(updated);
    },
    []
  );

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncService.syncNow();
      setLastSyncResult(res);
      const pending = await syncService.getPendingCount();
      setPendingSyncCount(pending.total);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const formatCurrency = useCallback(
    (paise: number, opts: FormatMoneyOptions = {}) => {
      return formatMoney(paise, {
        preference: settings.currency_format,
        ...opts,
      });
    },
    [settings.currency_format]
  );

  const value: AppContextValue = {
    settings,
    updateSettings,
    formatCurrency,
    currencyPreference: settings.currency_format,
    isOnline,
    pendingSyncCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
    dataVersion,
    refreshData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}

