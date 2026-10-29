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
    'ALTER TABLE product_variants ADD COLUMN displayOrder INTEGER DEFAULT 0;',
    'ALTER TABLE subcategories ADD COLUMN customValues TEXT;',
    'ALTER TABLE customers ADD COLUMN email TEXT;',
    "UPDATE products SET baseUnit = 'l' WHERE baseUnit = 'liter';",
    "UPDATE products SET baseUnit = 'piece' WHERE baseUnit = 'pcs';",
    "CREATE INDEX IF NOT EXISTS idx_movements_store_created ON stock_movements(storeId, createdAt DESC);",
    "CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId, deletedAt, active);",
    "CREATE INDEX IF NOT EXISTS idx_variants_store ON product_variants(storeId, deletedAt, active);",
    "CREATE INDEX IF NOT EXISTS idx_variants_size ON product_variants(productId, size);",
    "CREATE INDEX IF NOT EXISTS idx_products_brand ON products(storeId, categoryId, subcategoryId, brand);",
    "CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(storeId, deletedAt, active);",
  ];

  for (const query of safeAlterQueries) {
    try {
      await db.execAsync(query);
    } catch {
      // Column already exists or already migrated; safe to ignore
    }
  }

  const cleanupQueries = [
    // 1. Soft-delete old demo / dummy products and variants
    `UPDATE products SET deletedAt = datetime('now'), active = 0 
     WHERE deletedAt IS NULL AND (
       id LIKE 'demo-%' OR 
       id LIKE 'prod-demo%' OR
       LOWER(name) LIKE '%albow%' OR 
       LOWER(name) LIKE '%elbow%' OR
       LOWER(name) LIKE '%emulsion%' OR
       LOWER(name) LIKE '%distemper%' OR
       LOWER(name) LIKE '%primer%' OR
       LOWER(name) LIKE '%solvent%' OR
       LOWER(name) LIKE '%waterproof%' OR
       LOWER(name) LIKE '%wall putty%' OR
       LOWER(name) LIKE '%putty%' OR
       LOWER(brand) LIKE '%asian paint%' OR
       LOWER(brand) LIKE '%berger%' OR
       LOWER(brand) LIKE '%dr. fixit%' OR
       LOWER(brand) LIKE '%birla white%' OR
       LOWER(brand) = 'general'
     );`,
    `UPDATE product_variants SET deletedAt = datetime('now'), active = 0 
     WHERE deletedAt IS NULL AND (
       id LIKE 'demo-%' OR 
       id LIKE 'demo-var-%' OR
       LOWER(size) LIKE '%albow%' OR 
       LOWER(size) LIKE '%elbow%' OR 
       LOWER(name) LIKE '%albow%' OR 
       LOWER(name) LIKE '%elbow%'
     );`,
    // 2. Cascade soft-delete to variants whose parent product is soft-deleted or inactive
    `UPDATE product_variants SET deletedAt = datetime('now'), active = 0
     WHERE deletedAt IS NULL AND productId IN (
       SELECT id FROM products WHERE deletedAt IS NOT NULL OR active = 0
     );`,
    // 3. Cascade soft-delete to products whose category or subcategory is soft-deleted or inactive
    `UPDATE products SET deletedAt = datetime('now'), active = 0
     WHERE deletedAt IS NULL AND (
       categoryId IN (SELECT id FROM categories WHERE deletedAt IS NOT NULL OR active = 0) OR
       (subcategoryId IS NOT NULL AND subcategoryId IN (SELECT id FROM subcategories WHERE deletedAt IS NOT NULL OR active = 0))
     );`,
    // 4. Cascade again to variants of newly soft-deleted products
    `UPDATE product_variants SET deletedAt = datetime('now'), active = 0
     WHERE deletedAt IS NULL AND productId IN (
       SELECT id FROM products WHERE deletedAt IS NOT NULL OR active = 0
     );`,
  ];

  for (const query of cleanupQueries) {
    try {
      await db.execAsync(query);
    } catch {
      // Safe to ignore if tables not ready yet
    }
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbFileName = 'manju_hardware_store.db';
  dbInstance = await SQLite.openDatabaseAsync(dbFileName);

  // Enable WAL mode, fast synchronous writes, in-memory temp tables, and page cache
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  await dbInstance.execAsync('PRAGMA synchronous = NORMAL;');
  await dbInstance.execAsync('PRAGMA cache_size = -64000;');
  await dbInstance.execAsync('PRAGMA temp_store = MEMORY;');

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
