import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const db = {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: vi.fn().mockResolvedValue([]),
  };
  return { mockDb: db };
});

vi.mock('../database/db.js', () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

import {
  isDemoMode,
  DEMO_NOTICE_TEXT,
  DEMO_APP_NAME,
  DEMO_APPLICATION_ID,
  DEMO_DB_NAME,
  DEMO_WEB_STORAGE_KEY,
} from '../demo/demoConfig.js';
import {
  DEMO_STORE,
  DEMO_CATEGORIES,
  DEMO_SUBCATEGORIES,
  DEMO_PRODUCTS,
  DEMO_SUPPLIERS,
  DEMO_CUSTOMERS,
  DEMO_PURCHASES,
  DEMO_SALES,
} from '../demo/demoData.js';
import { seedDemoData } from '../demo/demoSeed.js';
import { resetDemoData } from '../demo/demoManager.js';
import { SyncEngine } from '../sync/syncEngine.js';

describe('Client Evaluation Demo Architecture & Isolation', () => {
  const originalEnv = process.env.EXPO_PUBLIC_DEMO_MODE;
  const originalAppEnv = process.env.APP_ENV;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_DEMO_MODE = originalEnv;
    process.env.APP_ENV = originalAppEnv;
  });

  it('correctly detects Demo mode when EXPO_PUBLIC_DEMO_MODE is set', () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);

    process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
    process.env.APP_ENV = undefined;
    expect(isDemoMode()).toBe(false);

    process.env.APP_ENV = 'demo';
    expect(isDemoMode()).toBe(true);
  });

  it('defines distinct Demo App Name and separate Android Application ID', () => {
    expect(DEMO_APP_NAME).toBe('Hardware Store (Demo)');
    expect(DEMO_APPLICATION_ID).toBe('com.hardwarestore.manager.demo');
    expect(DEMO_DB_NAME).toBe('hardware_store_demo.db');
    expect(DEMO_WEB_STORAGE_KEY).toBe('hw_store_demo_db_v1');
    expect(DEMO_NOTICE_TEXT).toBe('DEMO VERSION — SAMPLE DATA');
  });

  it('provides a rich fictional sample dataset with zero real client data', () => {
    expect(DEMO_STORE.name).toContain('Demo');
    expect(DEMO_STORE.email).toContain('example.com');
    expect(DEMO_STORE.phone).toBe('+91 98765 00000');

    expect(DEMO_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_SUBCATEGORIES.length).toBeGreaterThanOrEqual(8);
    expect(DEMO_PRODUCTS.length).toBeGreaterThanOrEqual(10);
    expect(DEMO_SUPPLIERS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_CUSTOMERS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_PURCHASES.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_SALES.length).toBeGreaterThanOrEqual(2);

    // Verify all supplier emails use fictional domains
    for (const sup of DEMO_SUPPLIERS) {
      expect(sup.email).toContain('example.com');
    }
  });

  it('seeds fictional sample dataset deterministically with proper counts', async () => {
    const stats = await seedDemoData(mockDb);
    expect(stats.storeCount).toBe(1);
    expect(stats.categoryCount).toBe(DEMO_CATEGORIES.length);
    expect(stats.productCount).toBe(DEMO_PRODUCTS.length);
    expect(stats.supplierCount).toBe(DEMO_SUPPLIERS.length);
    expect(stats.purchaseCount).toBe(DEMO_PURCHASES.length);
    expect(stats.saleCount).toBe(DEMO_SALES.length);
  });

  it('strictly blocks cloud sync in Demo mode to protect production data', async () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';

    const result = await SyncEngine.synchronize(
      'http://production-server.example.com',
      'test-token',
      'demo-store',
      'test-device'
    );

    expect(result.success).toBe(false);
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
    expect(result.error).toContain('Demo Mode: Synchronization to production database is strictly disabled');
  });

  it('executes safe demo data reset without throwing errors', async () => {
    process.env.EXPO_PUBLIC_DEMO_MODE = 'true';

    const res = await resetDemoData();
    expect(res.success).toBe(true);
    expect(res.message).toContain('Demo data successfully reset');
  });
});
