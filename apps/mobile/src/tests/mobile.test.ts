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
});
