import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { repository } from '../../storage/repository';
import { downloadJSONBackup } from '../../utils/export';
import { formatDateTime } from '../../utils/dates';
import {
  Settings as SettingsIcon,
  Save,
  Cloud,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    isOnline,
    pendingSyncCount,
    isSyncing,
    triggerSync,
    lastSyncResult,
    refreshData,
  } = useApp();

  const [businessName, setBusinessName] = useState(settings.business_name || '');
  const [currencyFormat, setCurrencyFormat] = useState(settings.currency_format || 'symbol');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase_url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabase_anon_key || '');
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(settings.cloud_sync_enabled || false);
  const [workspaceId, setWorkspaceId] = useState(settings.workspace_id || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBusinessName(settings.business_name || '');
    setCurrencyFormat(settings.currency_format || 'symbol');
    setSupabaseUrl(settings.supabase_url || '');
    setSupabaseAnonKey(settings.supabase_anon_key || '');
    setCloudSyncEnabled(settings.cloud_sync_enabled || false);
    setWorkspaceId(settings.workspace_id || '');
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setMessage(null);

    try {
      await updateSettings({
        business_name: businessName.trim() || 'Vyaapaaram Store',
        currency_format: currencyFormat,
        supabase_url: supabaseUrl.trim() || undefined,
        supabase_anon_key: supabaseAnonKey.trim() || undefined,
        cloud_sync_enabled: cloudSyncEnabled,
        workspace_id: workspaceId.trim() || 'default-workspace',
      });
      setSaveSuccess(true);
      setMessage('Settings saved successfully.');
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setMessage(`Failed to save settings: ${err?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedDemoData = async () => {
    if (
      window.confirm(
        'This will replace current data with realistic sample grocery & retail products, purchases, and sales. Continue?'
      )
    ) {
      try {
        await repository.seedSampleData();
        refreshData();
        setMessage('Sample data loaded successfully!');
      } catch (err: any) {
        setMessage(`Failed to load sample data: ${err?.message}`);
      }
    }
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        'WARNING: This will permanently delete all local products, purchases, and sales on this device. Are you sure?'
      )
    ) {
      try {
        await repository.clearAllData();
        refreshData();
        setMessage('All store data has been cleared.');
      } catch (err: any) {
        setMessage(`Failed to clear data: ${err?.message}`);
      }
    }
  };

  const handleBackupDownload = async () => {
    try {
      const [products, purchases, sales, currentSettings] = await Promise.all([
        repository.getProducts(),
        repository.getPurchases(),
        repository.getSales(),
        repository.getSettings(),
      ]);
      downloadJSONBackup({
        settings: currentSettings,
        products,
        purchases,
        sales,
      });
    } catch (err: any) {
      setMessage(`Backup failed: ${err?.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Action Toolbar */}
      <div className="action-toolbar">
        <div className="toolbar-title-wrap">
          <h1 className="page-title">Settings</h1>
          <p className="page-description">
            Store profile, currency display preference, and cloud sync setup
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`alert ${saveSuccess ? 'alert-success' : 'alert-info'}`}
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
                placeholder="e.g. Vyaapaaram General Store"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <div className="form-hint">Displayed on header and printable sales receipts</div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Rupee Currency Display Format</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    border: `2px solid ${currencyFormat === 'symbol' ? 'var(--primary)' : 'var(--gray-300)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: currencyFormat === 'symbol' ? 'var(--primary-light)' : '#ffffff',
                  }}
                >
                  <input
                    type="radio"
                    name="currency"
                    value="symbol"
                    checked={currencyFormat === 'symbol'}
                    onChange={() => setCurrencyFormat('symbol')}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Rupee Symbol (₹)</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>e.g. ₹1,000.00 (Default)</div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    border: `2px solid ${currencyFormat === 'text' ? 'var(--primary)' : 'var(--gray-300)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: currencyFormat === 'text' ? 'var(--primary-light)' : '#ffffff',
                  }}
                >
                  <input
                    type="radio"
                    name="currency"
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
        </div>

        {/* Offline & Cloud Sync Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cloud size={18} style={{ color: 'var(--primary)' }} />
              <span>Offline & Cloud Synchronization</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isOnline ? (
                <span className="badge badge-success">
                  <Wifi size={12} /> Online
                </span>
              ) : (
                <span className="badge badge-warning">
                  <WifiOff size={12} /> Offline
                </span>
              )}
            </div>
          </div>

          <div className="card-body">
            <div
              style={{
                backgroundColor: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {pendingSyncCount > 0
                    ? `${pendingSyncCount} changes waiting to sync`
                    : 'All records in sync with storage'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                  {settings.last_synced_at
                    ? `Last synced: ${formatDateTime(settings.last_synced_at)}`
                    : 'Works seamlessly offline even without cloud configured'}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={triggerSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Sync Now</span>
                  </>
                )}
              </button>
            </div>

            {lastSyncResult && (
              <div
                className={`alert ${lastSyncResult.success ? 'alert-success' : 'alert-danger'}`}
                style={{ fontSize: '0.825rem', marginBottom: '1rem' }}
              >
                <div>
                  <strong>{lastSyncResult.message}</strong>
                  {lastSyncResult.error && (
                    <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {lastSyncResult.error}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Supabase URL (Optional)</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
              <div className="form-hint">Cloud database endpoint for multi-device sync</div>
            </div>

            <div className="form-group">
              <label className="form-label">Supabase Anon Public API Key (Optional)</label>
              <input
                type="password"
                className="form-input"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
              />
              <div className="form-hint">Used for client-side authenticated sync</div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Business / Workspace ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="default-workspace"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
              />
              <div className="form-hint">Scopes all cloud records to your shop</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBackupDownload}
              style={{ justifyContent: 'center' }}
            >
              <Download size={16} /> Export JSON Backup
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSeedDemoData}
              style={{ justifyContent: 'center' }}
            >
              <Database size={16} /> Load Sample Demo Data
            </button>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--danger)' }}>
                  Clear All Data
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                  Erase local products, purchases, and sales on this browser
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={handleClearAllData}
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

