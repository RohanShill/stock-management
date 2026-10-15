import { getDatabase } from '../database/db.js';
import { isDemoMode } from './demoConfig.js';
import { seedDemoData } from './demoSeed.js';

/**
 * Safe Demo-Data Reset Function
 * Cleanly wipes all demo data tables and re-seeds the pristine fictional dataset.
 * Leaves all production databases completely untouched.
 */
export async function resetDemoData(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const db = await getDatabase();

    // Clear all existing demo tables
    await db.execAsync?.(`
      DELETE FROM sync_queue;
      DELETE FROM expenses;
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
      DELETE FROM stock_movements;
      DELETE FROM pipe_segments;
      DELETE FROM product_variants;
      DELETE FROM products;
      DELETE FROM subcategories;
      DELETE FROM categories;
      DELETE FROM suppliers;
      DELETE FROM customers;
      DELETE FROM stores;
    `);

    // Re-seed all fictional sample entities
    const stats = await seedDemoData(db);

    return {
      success: true,
      message: 'Demo data successfully reset to original fictional sample state.',
      details: stats,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during demo data reset';
    console.error('[DemoManager] Failed to reset demo data:', err);
    return {
      success: false,
      message: errorMsg,
    };
  }
}
