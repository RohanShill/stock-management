import * as SQLite from 'expo-sqlite';
import { SQL_CREATE_TABLES } from './schema.js';
import { isDemoMode, DEMO_DB_NAME } from '../demo/demoConfig.js';
import { seedDemoDataIfEmpty } from '../demo/demoSeed.js';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function runVersionedMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const safeAlterQueries = [
    'ALTER TABLE categories ADD COLUMN icon TEXT;',
    'ALTER TABLE categories ADD COLUMN displayOrder INTEGER DEFAULT 0;',
    'ALTER TABLE subcategories ADD COLUMN displayOrder INTEGER DEFAULT 0;',
    'ALTER TABLE products ADD COLUMN modelNumber TEXT;',
    'ALTER TABLE products ADD COLUMN imageUrl TEXT;',
    'ALTER TABLE products ADD COLUMN customValues TEXT;',
    'ALTER TABLE product_variants ADD COLUMN customValues TEXT;',
    'ALTER TABLE customers ADD COLUMN email TEXT;',
  ];

  for (const query of safeAlterQueries) {
    try {
      await db.execAsync(query);
    } catch {
      // Column already exists or already migrated; safe to ignore
    }
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbFileName = 'manju_hardware_store.db';
  dbInstance = await SQLite.openDatabaseAsync(dbFileName);

  // Enable WAL mode and foreign keys for high performance and integrity
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');

  // Run initial schema migration
  await dbInstance.execAsync(SQL_CREATE_TABLES);

  // Run non-destructive column migrations
  await runVersionedMigrations(dbInstance);

  return dbInstance;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS sync_conflicts;
    DROP TABLE IF EXISTS sync_metadata;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS custom_field_definitions;
    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS sale_items;
    DROP TABLE IF EXISTS sales;
    DROP TABLE IF EXISTS purchase_items;
    DROP TABLE IF EXISTS purchases;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS suppliers;
    DROP TABLE IF EXISTS pipe_segments;
    DROP TABLE IF EXISTS stock_movements;
    DROP TABLE IF EXISTS product_variants;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS subcategories;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS stores;
  `);
  await db.execAsync(SQL_CREATE_TABLES);
}
