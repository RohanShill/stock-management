import { webDatabaseInstance } from './webDatabase.js';

let dbInstance: any = null;

export async function getDatabase(): Promise<any> {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = webDatabaseInstance;
  return dbInstance;
}

export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM stores;
    DELETE FROM categories;
    DELETE FROM subcategories;
    DELETE FROM products;
    DELETE FROM product_variants;
  `);
}
