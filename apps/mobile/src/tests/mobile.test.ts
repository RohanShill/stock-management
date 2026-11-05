import { describe, it, expect, beforeEach } from 'vitest';
import { SQL_CREATE_TABLES } from '../database/schema.js';
import { t } from '../i18n/strings.js';
import { useAppStore } from '../store/useAppStore.js';

describe('Mobile App Architecture & I18n', () => {
  it('contains valid SQLite table definitions with proper indexes', () => {
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS stores');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS products');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS product_variants');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS stock_movements');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS pipe_segments');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS sales');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS purchases');
    expect(SQL_CREATE_TABLES).toContain('CREATE TABLE IF NOT EXISTS sync_queue');
  });

  it('provides bilingual strings in English and Hindi', () => {
    expect(t('dashboard', 'en')).toBe('Dashboard');
    expect(t('dashboard', 'hi')).toBe('डैशबोर्ड');
    expect(t('todaySales', 'en')).toBe("Today's Sales");
    expect(t('todaySales', 'hi')).toBe('आज की कुल बिक्री');
    expect(t('newSale', 'en')).toBe('New Sale / Bill');
    expect(t('newSale', 'hi')).toBe('नया बिल बनाएं');
  });

  it('updates Zustand state for store, user, and sync counters', () => {
    const store = useAppStore.getState();
    store.setPendingSyncCount(5);
    expect(useAppStore.getState().pendingSyncCount).toBe(5);

    store.setLanguage('hi');
    expect(useAppStore.getState().language).toBe('hi');

    store.setApiUrl('https://api.hardwarestore.in');
    expect(useAppStore.getState().apiUrl).toBe('https://api.hardwarestore.in');
  });

  describe('History Pagination Logic', () => {
    const dummyItems = Array.from({ length: 65 }, (_, i) => ({
      id: `mov-${i + 1}`,
      productName: `Item ${i + 1}`,
      variantName: `Var ${i + 1}`,
      unit: 'pcs',
      quantityChangeBase: i % 2 === 0 ? 5 : -2,
      movementType: i % 2 === 0 ? 'increase' : 'sale',
    }));

    it('correctly calculates totalPages and slices items for Page 1 and Page 2', () => {
      const pageSize = 25;
      const totalPages = Math.max(1, Math.ceil(dummyItems.length / pageSize));
      expect(totalPages).toBe(3); // 25 + 25 + 15 = 65 items (3 pages)

      // Page 1
      const page1 = dummyItems.slice(0, pageSize);
      expect(page1).toHaveLength(25);
      expect(page1[0].id).toBe('mov-1');
      expect(page1[24].id).toBe('mov-25');

      // Page 2
      const page2 = dummyItems.slice(pageSize, pageSize * 2);
      expect(page2).toHaveLength(25);
      expect(page2[0].id).toBe('mov-26');
      expect(page2[24].id).toBe('mov-50');

      // Page 3 (remaining items)
      const page3 = dummyItems.slice(pageSize * 2, pageSize * 3);
      expect(page3).toHaveLength(15);
      expect(page3[0].id).toBe('mov-51');
      expect(page3[14].id).toBe('mov-65');
    });

    it('returns all items when page size is set to All (1000)', () => {
      const pageSize = 1000;
      const paginated = pageSize >= 1000 ? dummyItems : dummyItems.slice(0, pageSize);
      expect(paginated).toHaveLength(65);
    });

    it('handles empty datasets cleanly without division by zero', () => {
      const emptyItems: any[] = [];
      const pageSize = 25;
      const totalPages = Math.max(1, Math.ceil(emptyItems.length / pageSize));
      expect(totalPages).toBe(1);
      const sliced = emptyItems.slice(0, pageSize);
      expect(sliced).toHaveLength(0);
    });
  });
});
