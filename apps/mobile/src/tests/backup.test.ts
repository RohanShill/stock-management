(global as any).__DEV__ = true;

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService, StoreBackupPackage } from '../services/BackupService.js';

vi.mock('../database/db.js', () => ({
  getDatabase: vi.fn(),
}));

describe('BackupService', () => {
  const mockDb = {
    getAllAsync: vi.fn(),
    getFirstAsync: vi.fn(),
    runAsync: vi.fn(),
    execAsync: vi.fn(),
    withTransactionAsync: vi.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBackupString', () => {
    it('rejects non-JSON string', () => {
      const result = BackupService.validateBackupString('invalid-json{{{');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid JSON');
    });

    it('rejects JSON with wrong format header', () => {
      const result = BackupService.validateBackupString(JSON.stringify({ format: 'random_app' }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('official Manju Stores backup');
    });

    it('rejects JSON missing tables or metadata', () => {
      const result = BackupService.validateBackupString(
        JSON.stringify({ format: 'manju_stores_backup', metadata: null, data: null })
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('incomplete');
    });

    it('accepts valid backup package', () => {
      const validPkg: StoreBackupPackage = {
        format: 'manju_stores_backup',
        metadata: {
          version: 1,
          appVersion: '1.0.2',
          createdAt: new Date().toISOString(),
          storeId: 'store-1',
          storeName: 'MANJU STORES',
          totalProducts: 5,
          totalVariants: 12,
          totalCategories: 3,
          totalSubcategories: 6,
          totalSales: 20,
          totalPurchases: 10,
          totalMovements: 40,
        },
        data: {
          stores: [{ id: 'store-1', name: 'MANJU STORES' }],
          categories: [{ id: 'c1', name: 'Paint' }],
          subcategories: [{ id: 'sc1', name: 'Wall paint' }],
          custom_field_definitions: [],
          products: [{ id: 'p1', name: 'Finolex Primer' }],
          product_variants: [{ id: 'v1', size: '10L', currentStock: 25 }],
          stock_movements: [],
          suppliers: [],
          customers: [],
          purchases: [],
          purchase_items: [],
          sales: [],
          sale_items: [],
          expenses: [],
        },
      };

      const result = BackupService.validateBackupString(JSON.stringify(validPkg));
      expect(result.valid).toBe(true);
      expect(result.metadata?.totalProducts).toBe(5);
      expect(result.metadata?.storeName).toBe('MANJU STORES');
    });
  });

  describe('createBackupData', () => {
    it('queries all database tables and packages metadata', async () => {
      const { getDatabase } = await import('../database/db.js');
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any);

      mockDb.getAllAsync.mockImplementation((sql: string) => {
        if (sql.includes('FROM stores')) return Promise.resolve([{ id: 'store-1', name: 'Manju Hardware' }]);
        if (sql.includes('FROM categories')) return Promise.resolve([{ id: 'c1', name: 'Hardware' }]);
        if (sql.includes('FROM products')) return Promise.resolve([{ id: 'p1', name: 'Nails' }, { id: 'p2', name: 'Screws' }]);
        if (sql.includes('FROM product_variants')) return Promise.resolve([{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]);
        return Promise.resolve([]);
      });

      const backup = await BackupService.createBackupData('store-1');
      expect(backup.format).toBe('manju_stores_backup');
      expect(backup.metadata.storeName).toBe('Manju Hardware');
      expect(backup.metadata.totalProducts).toBe(2);
      expect(backup.metadata.totalVariants).toBe(3);
      expect(backup.metadata.totalCategories).toBe(1);
      expect(backup.data.stores).toHaveLength(1);
      expect(backup.data.products).toHaveLength(2);
    });
  });

  describe('restoreBackup', () => {
    it('executes atomic restore inside transaction and inserts records', async () => {
      const { getDatabase } = await import('../database/db.js');
      vi.mocked(getDatabase).mockResolvedValue(mockDb as any);
      mockDb.runAsync.mockResolvedValue({});
      mockDb.execAsync.mockResolvedValue({});

      const pkg: StoreBackupPackage = {
        format: 'manju_stores_backup',
        metadata: {
          version: 1,
          appVersion: '1.0.2',
          createdAt: new Date().toISOString(),
          storeId: 'store-1',
          storeName: 'MANJU STORES',
          totalProducts: 1,
          totalVariants: 1,
          totalCategories: 1,
          totalSubcategories: 0,
          totalSales: 0,
          totalPurchases: 0,
          totalMovements: 0,
        },
        data: {
          stores: [{ id: 'store-1', name: 'MANJU STORES' }],
          categories: [{ id: 'c1', name: 'Pipes', storeId: 'store-1' }],
          subcategories: [],
          custom_field_definitions: [],
          products: [{ id: 'p1', name: 'PVC Pipe', categoryId: 'c1', storeId: 'store-1' }],
          product_variants: [{ id: 'v1', size: '1 inch', productId: 'p1', storeId: 'store-1' }],
          stock_movements: [],
          suppliers: [],
          customers: [],
          purchases: [],
          purchase_items: [],
          sales: [],
          sale_items: [],
          expenses: [],
          pipe_segments: [{ id: 'seg-1', storeId: 'store-1', variantId: 'v1', originalLengthMm: 3000, currentLengthMm: 1500, status: 'available', createdAt: '2026-11-05', updatedAt: '2026-11-05' }],
        },
      };

      const result = await BackupService.restoreBackup(pkg, 'store-1');
      expect(result.success).toBe(true);
      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = OFF;');
      expect(mockDb.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM pipe_segments WHERE storeId = ?;', ['store-1']);
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM products WHERE storeId = ?;', ['store-1']);
    });
  });
});
