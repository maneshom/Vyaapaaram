import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Product, Purchase, Sale, AppSettings } from '../types';

export interface VyaapaaramDB extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: {
      'by-sync-status': string;
      'by-updated-at': string;
    };
  };
  purchases: {
    key: string;
    value: Purchase;
    indexes: {
      'by-product-id': string;
      'by-date': string;
      'by-sync-status': string;
    };
  };
  sales: {
    key: string;
    value: Sale;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-sync-status': string;
      'by-sale-number': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'vyaapaaram_db';
const DB_VERSION = 1;

export interface IStorageProvider {
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  putProduct(product: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;

  getPurchases(): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  putPurchase(purchase: Purchase): Promise<void>;

  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  putSale(sale: Sale): Promise<void>;

  getSettings(): Promise<AppSettings | undefined>;
  putSettings(settings: AppSettings): Promise<void>;

  clearAllData(): Promise<void>;
  executeTransaction<T>(
    stores: Array<'products' | 'purchases' | 'sales' | 'settings'>,
    mode: 'readonly' | 'readwrite',
    operation: (txn: IDBPDatabase<VyaapaaramDB> | InMemoryStorage) => Promise<T>
  ): Promise<T>;
}

// In-memory implementation for Node / Vitest testing or non-browser environments
export class InMemoryStorage implements IStorageProvider {
  products: Map<string, Product> = new Map();
  purchases: Map<string, Purchase> = new Map();
  sales: Map<string, Sale> = new Map();
  settings: Map<string, AppSettings> = new Map();

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async putProduct(product: Product): Promise<void> {
    this.products.set(product.id, { ...product });
  }

  async deleteProduct(id: string): Promise<void> {
    this.products.delete(id);
  }

  async getPurchases(): Promise<Purchase[]> {
    return Array.from(this.purchases.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    return this.purchases.get(id);
  }

  async putPurchase(purchase: Purchase): Promise<void> {
    this.purchases.set(purchase.id, { ...purchase });
  }

  async getSales(): Promise<Sale[]> {
    return Array.from(this.sales.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async putSale(sale: Sale): Promise<void> {
    this.sales.set(sale.id, { ...sale });
  }

  async getSettings(): Promise<AppSettings | undefined> {
    return this.settings.get('default');
  }

  async putSettings(settings: AppSettings): Promise<void> {
    this.settings.set('default', { ...settings });
  }

  async clearAllData(): Promise<void> {
    this.products.clear();
    this.purchases.clear();
    this.sales.clear();
  }

  async executeTransaction<T>(
    _stores: Array<'products' | 'purchases' | 'sales' | 'settings'>,
    _mode: 'readonly' | 'readwrite',
    operation: (txn: InMemoryStorage) => Promise<T>
  ): Promise<T> {
    // Synchronous state simulation with rollback on error
    const backup = {
      products: new Map(this.products),
      purchases: new Map(this.purchases),
      sales: new Map(this.sales),
      settings: new Map(this.settings),
    };
    try {
      return await operation(this);
    } catch (err) {
      this.products = backup.products;
      this.purchases = backup.purchases;
      this.sales = backup.sales;
      this.settings = backup.settings;
      throw err;
    }
  }
}

// Browser IndexedDB implementation
class IndexedDBStorage implements IStorageProvider {
  private dbPromise: Promise<IDBPDatabase<VyaapaaramDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<VyaapaaramDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<VyaapaaramDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Products store
          if (!db.objectStoreNames.contains('products')) {
            const productStore = db.createObjectStore('products', { keyPath: 'id' });
            productStore.createIndex('by-sync-status', 'sync_status');
            productStore.createIndex('by-updated-at', 'updated_at');
          }

          // Purchases store
          if (!db.objectStoreNames.contains('purchases')) {
            const purchaseStore = db.createObjectStore('purchases', { keyPath: 'id' });
            purchaseStore.createIndex('by-product-id', 'product_id');
            purchaseStore.createIndex('by-date', 'date');
            purchaseStore.createIndex('by-sync-status', 'sync_status');
          }

          // Sales store
          if (!db.objectStoreNames.contains('sales')) {
            const saleStore = db.createObjectStore('sales', { keyPath: 'id' });
            saleStore.createIndex('by-date', 'date');
            saleStore.createIndex('by-status', 'status');
            saleStore.createIndex('by-sync-status', 'sync_status');
            saleStore.createIndex('by-sale-number', 'sale_number');
          }

          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async getProducts(): Promise<Product[]> {
    const db = await this.getDB();
    return db.getAll('products');
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const db = await this.getDB();
    return db.get('products', id);
  }

  async putProduct(product: Product): Promise<void> {
    const db = await this.getDB();
    await db.put('products', product);
  }

  async deleteProduct(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('products', id);
  }

  async getPurchases(): Promise<Purchase[]> {
    const db = await this.getDB();
    const purchases = await db.getAll('purchases');
    return purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    const db = await this.getDB();
    return db.get('purchases', id);
  }

  async putPurchase(purchase: Purchase): Promise<void> {
    const db = await this.getDB();
    await db.put('purchases', purchase);
  }

  async getSales(): Promise<Sale[]> {
    const db = await this.getDB();
    const sales = await db.getAll('sales');
    return sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const db = await this.getDB();
    return db.get('sales', id);
  }

  async putSale(sale: Sale): Promise<void> {
    const db = await this.getDB();
    await db.put('sales', sale);
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const db = await this.getDB();
    return db.get('settings', 'default');
  }

  async putSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    await db.put('settings', settings);
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['products', 'purchases', 'sales'], 'readwrite');
    await Promise.all([
      tx.objectStore('products').clear(),
      tx.objectStore('purchases').clear(),
      tx.objectStore('sales').clear(),
      tx.done,
    ]);
  }

  async executeTransaction<T>(
    stores: Array<'products' | 'purchases' | 'sales' | 'settings'>,
    mode: 'readonly' | 'readwrite',
    operation: (txn: IDBPDatabase<VyaapaaramDB>) => Promise<T>
  ): Promise<T> {
    const db = await this.getDB();
    return await operation(db);
  }
}

// Select active storage provider based on runtime environment
const hasIndexedDB = typeof window !== 'undefined' && 'indexedDB' in window;
export const storageProvider: IStorageProvider = hasIndexedDB
  ? new IndexedDBStorage()
  : new InMemoryStorage();

