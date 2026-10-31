import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { downloadJSONBackup } from '../../utils/export';
import {
  Settings as SettingsIcon,
  Save,
  Database,
  Trash2,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    refreshData,
  } = useApp();

  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [currencyFormat, setCurrencyFormat] = useState(settings.currency_format || 'symbol');

  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'danger' | 'info'>('info');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setCurrencyFormat(settings.currency_format || 'symbol');
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await updateSettings({
        business_name: businessName.trim() || 'Vyaapaaram Store',
        currency_format: currencyFormat as 'symbol' | 'text',
      });
      setMessageType('success');
      setMessage('Preferences saved successfully.');
    } catch (err: any) {
      setMessageType('danger');
      setMessage(err?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupDownload = async () => {
    try {
      const [prods, purchases, sales, currentSettings] = await Promise.all([
        repository.getProducts(),
        repository.getPurchases(),
        repository.getSales(),
        repository.getSettings(),
      ]);
      downloadJSONBackup({
        settings: currentSettings,
        products: prods,
        purchases,
        sales,
      });
      setMessageType('success');
      setMessage('JSON backup downloaded successfully.');
    } catch (e: any) {
      setMessageType('danger');
      setMessage(`Backup export failed: ${e?.message}`);
    }
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoring(true);
      setMessage(null);

      const fileText = await file.text();
      let backupData: any;
      try {
        backupData = JSON.parse(fileText);
      } catch {
        throw new Error('The selected file is not a valid JSON document.');
      }

      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Invalid backup structure.');
      }

      const pCount = Array.isArray(backupData.products) ? backupData.products.length : 0;
      const puCount = Array.isArray(backupData.purchases) ? backupData.purchases.length : 0;
      const sCount = Array.isArray(backupData.sales) ? backupData.sales.length : 0;
      const storeName = backupData.settings?.business_name;

      if (pCount === 0 && puCount === 0 && sCount === 0 && !storeName) {
        throw new Error('The selected file contains no valid products, purchases, sales, or settings.');
      }

      const confirmPrompt =
        `Restore from "${file.name}"?\n\n` +
        `Summary of backup contents:\n` +
        `• Products: ${pCount}\n` +
        `• Purchases: ${puCount}\n` +
        `• Sales: ${sCount}\n` +
        (storeName ? `• Store / Shop Name: ${storeName}\n` : '') +
        `\n⚠️ WARNING: Restoring will overwrite and replace all current local products, purchases, and sales! Are you sure you want to proceed?`;

      if (!window.confirm(confirmPrompt)) {
        return;
      }

      const result = await repository.restoreBackup(backupData);
      await refreshData();

      setMessageType('success');
      setMessage(
        `Backup restored successfully from "${file.name}"! Restored ${result.productCount} product(s), ${result.purchaseCount} purchase record(s), and ${result.saleCount} sale(s).`
      );
    } catch (err: any) {
      setMessageType('danger');
      setMessage(`Failed to restore backup: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadDemoData = async () => {
    if (
      window.confirm(
        'This will replace your current inventory, purchases, and sales with realistic retail sample data for demonstration. Are you sure?'
      )
    ) {
      try {
        await repository.seedSampleData();
        await refreshData();
        setMessageType('success');
        setMessage('Sample automotive demo data loaded successfully!');
      } catch (e: any) {
        setMessageType('danger');
        setMessage(`Failed to load demo data: ${e?.message}`);
      }
    }
  };

  const handleClearAllData = async () => {
    const confirmation = window.prompt(
      'WARNING: This will permanently wipe all local products, purchase records, and sales history on this device.\n\nType "DELETE" below to confirm:'
    );
    if (confirmation === 'DELETE') {
      try {
        await repository.clearAllData();
        await refreshData();
        setMessageType('info');
        setMessage('All local catalog, purchase, and sale records have been reset.');
      } catch (e: any) {
        setMessageType('danger');
        setMessage(`Failed to reset data: ${e?.message}`);
      }
    }
  };

  return (
    <div>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Settings & Preferences</h1>
          <p className="page-description">
            Store profile, currency display preference, and data backups
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`alert alert-${messageType}`}
          style={{ marginBottom: '1.25rem' }}
        >
          {message}
        </div>
      )}

      {/* Basic Settings Form */}
      <form onSubmit={handleSaveSettings}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <SettingsIcon size={18} style={{ color: 'var(--primary)' }} />
              <span>Store & Currency Preferences</span>
            </div>
          </div>

          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Business / Shop Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Balaji General Stores"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <div className="form-hint">Displayed in receipt headers and top title</div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Currency Display Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${currencyFormat === 'symbol' ? 'var(--primary)' : 'var(--gray-200)'}`,
                    backgroundColor: currencyFormat === 'symbol' ? 'var(--primary-light)' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="currencyFormat"
                    value="symbol"
                    checked={currencyFormat === 'symbol'}
                    onChange={() => setCurrencyFormat('symbol')}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Standard Indian Rupee Symbol (₹)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>e.g. ₹1,000.00</div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${currencyFormat === 'text' ? 'var(--primary)' : 'var(--gray-200)'}`,
                    backgroundColor: currencyFormat === 'text' ? 'var(--primary-light)' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="currencyFormat"
                    value="text"
                    checked={currencyFormat === 'text'}
                    onChange={() => setCurrencyFormat('text')}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Plain Text Fallback (Rs)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>e.g. Rs 1,000.00</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--gray-200)' }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </form>

      {/* Demo & Backup Tools Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Database size={18} style={{ color: 'var(--primary)' }} />
            <span>Data Management & Backup</span>
          </div>
        </div>

        <div className="card-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '1.25rem' }}>
            Export your entire store catalog, stock purchases, sales history, and preferences to a portable JSON backup file, or restore from a previous backup file.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBackupDownload}
              disabled={isRestoring}
              style={{ justifyContent: 'center' }}
            >
              <Download size={16} /> Export JSON Backup
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRestoreClick}
              disabled={isRestoring}
              style={{ justifyContent: 'center' }}
            >
              <Upload size={16} /> {isRestoring ? 'Restoring...' : 'Restore JSON Backup'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLoadDemoData}
              disabled={isRestoring}
              style={{ justifyContent: 'center' }}
            >
              <Sparkles size={16} /> Load Demo Data
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--gray-200)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.9rem' }}>
                  Danger Zone: Reset All Local Data
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                  Permanently wipe all catalog products, purchase stock, and sales records on this device.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearAllData}
                style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}
              >
                <Trash2 size={14} /> Clear Local Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
