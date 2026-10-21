import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppSettings, CurrencyPreference } from '../types';
import { repository } from '../storage/repository';
import { formatMoney, FormatMoneyOptions } from '../utils/money';

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  formatCurrency: (paise: number, opts?: FormatMoneyOptions) => string;
  currencyPreference: CurrencyPreference;
  dataVersion: number;
  refreshData: () => void;
}

const defaultInitialSettings: AppSettings = {
  id: 'default',
  business_name: 'Vyaapaaram Store',
  currency_format: 'symbol',
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultInitialSettings);
  const [dataVersion, setDataVersion] = useState<number>(1);

  // Load initial settings
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const loaded = await repository.getSettings();
        if (mounted) setSettings(loaded);
      } catch (e) {
        console.error('Failed to init app state:', e);
      }
    };
    init();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshData = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      const updated = await repository.saveSettings(newSettings);
      setSettings(updated);
    },
    []
  );

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
    dataVersion,
    refreshData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
