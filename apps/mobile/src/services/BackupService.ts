import { Platform } from 'react-native';
import { getDatabase } from '../database/db.js';

export interface BackupMetadata {
  version: number;
  appVersion: string;
  createdAt: string;
  storeId: string;
  storeName: string;
  totalProducts: number;
  totalVariants: number;
  totalCategories: number;
  totalSubcategories: number;
  totalSales: number;
  totalPurchases: number;
  totalMovements: number;
  checksum?: string;
}

export interface StoreBackupPackage {
  format: 'manju_stores_backup';
  metadata: BackupMetadata;
  data: {
    stores: any[];
    categories: any[];
    subcategories: any[];
    custom_field_definitions: any[];
    products: any[];
    product_variants: any[];
    stock_movements: any[];
    suppliers: any[];
    customers: any[];
    purchases: any[];
    purchase_items: any[];
    sales: any[];
    sale_items: any[];
    expenses: any[];
    pipe_segments?: any[];
  };
}

export interface LocalBackupInfo {
  filename: string;
  uri: string;
  sizeBytes: number;
  createdAt: string;
  formattedDate: string;
  isAutoBackup: boolean;
}

function getFileSystem(): any {
  try {
    return require('expo-file-system/legacy');
  } catch {
    return require('expo-file-system');
  }
}

export class BackupService {
  private static readonly BACKUP_FORMAT = 'manju_stores_backup';
  private static readonly CURRENT_BACKUP_VERSION = 1;
  private static readonly APP_VERSION = '1.0.2';
  private static readonly MAX_AUTO_BACKUPS = 7;

  /**
   * Returns directory path for storing local backup files
   */
  private static async getBackupsDirectory(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    try {
      const FileSystem = getFileSystem();
      const dir = `${FileSystem.documentDirectory}backups/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      return dir;
    } catch (e) {
      console.warn('Could not initialize backups directory:', e);
      return null;
    }
  }

  /**
   * Extracts all store tables from SQLite and bundles into a JSON package
   */
  static async createBackupData(storeId: string = 'store-1'): Promise<StoreBackupPackage> {
    const db = await getDatabase();

    const [
      stores,
      categories,
      subcategories,
      customFields,
      products,
      variants,
      stockMovements,
      suppliers,
      customers,
      purchases,
      purchaseItems,
      sales,
      saleItems,
      expenses,
      pipeSegments,
    ] = await Promise.all([
      db.getAllAsync<any>('SELECT * FROM stores WHERE id = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM categories WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM subcategories WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM custom_field_definitions WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM products WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM product_variants WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM stock_movements WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM suppliers WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM customers WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM purchases WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>(
        'SELECT * FROM purchase_items WHERE purchaseId IN (SELECT id FROM purchases WHERE storeId = ?);',
        [storeId]
      ),
      db.getAllAsync<any>('SELECT * FROM sales WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>(
        'SELECT * FROM sale_items WHERE saleId IN (SELECT id FROM sales WHERE storeId = ?);',
        [storeId]
      ),
      db.getAllAsync<any>('SELECT * FROM expenses WHERE storeId = ?;', [storeId]),
      db.getAllAsync<any>('SELECT * FROM pipe_segments WHERE storeId = ?;', [storeId]).catch(() => []),
    ]);

    const storeName = stores?.[0]?.name || 'MANJU STORES';

    const metadata: BackupMetadata = {
      version: this.CURRENT_BACKUP_VERSION,
      appVersion: this.APP_VERSION,
      createdAt: new Date().toISOString(),
      storeId,
      storeName,
      totalProducts: (products || []).length,
      totalVariants: (variants || []).length,
      totalCategories: (categories || []).length,
      totalSubcategories: (subcategories || []).length,
      totalSales: (sales || []).length,
      totalPurchases: (purchases || []).length,
      totalMovements: (stockMovements || []).length,
    };

    return {
      format: this.BACKUP_FORMAT,
      metadata,
      data: {
        stores: stores || [],
        categories: categories || [],
        subcategories: subcategories || [],
        custom_field_definitions: customFields || [],
        products: products || [],
        product_variants: variants || [],
        stock_movements: stockMovements || [],
        suppliers: suppliers || [],
        customers: customers || [],
        purchases: purchases || [],
        purchase_items: purchaseItems || [],
        sales: sales || [],
        sale_items: saleItems || [],
        expenses: expenses || [],
        pipe_segments: pipeSegments || [],
      },
    };
  }

  /**
   * Generates a backup JSON and opens the native Share sheet (WhatsApp, Drive, Email, etc.)
   */
  static async exportBackupToFile(storeId: string = 'store-1'): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const backupPackage = await this.createBackupData(storeId);
      const jsonContent = JSON.stringify(backupPackage, null, 2);
      const dateTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const filename = `ManjuStores_Backup_${dateTag}.json`;

      // Web download
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { success: true };
      }

      // Native Mobile (Android & iOS)
      const FileSystem = getFileSystem();
      const Sharing = require('expo-sharing');
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Sharing && typeof Sharing.isAvailableAsync === 'function' && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save or Share Manju Stores Backup',
          UTI: 'public.json',
        });
      }

      return { success: true, filePath: fileUri };
    } catch (err: any) {
      console.error('exportBackupToFile failed:', err);
      return { success: false, error: err?.message || 'Failed to export backup.' };
    }
  }

  /**
   * Validates a backup string and returns parsed metadata for preview before restoring
   */
  static validateBackupString(jsonStr: string): { valid: boolean; metadata?: BackupMetadata; error?: string; pkg?: StoreBackupPackage } {
    try {
      const parsed = JSON.parse(jsonStr) as StoreBackupPackage;

      if (!parsed || parsed.format !== this.BACKUP_FORMAT) {
        return {
          valid: false,
          error: 'Invalid backup file format. This is not an official Manju Stores backup.',
        };
      }

      if (!parsed.metadata || !parsed.data) {
        return {
          valid: false,
          error: 'Backup file is incomplete or corrupted.',
        };
      }

      if (!Array.isArray(parsed.data.products) || !Array.isArray(parsed.data.categories)) {
        return {
          valid: false,
          error: 'Backup file data structure is invalid.',
        };
      }

      return { valid: true, metadata: parsed.metadata, pkg: parsed };
    } catch (e: any) {
      return { valid: false, error: 'File is not a valid JSON document.' };
    }
  }

  /**
   * Universal URI reader that works across Web, Android (content://, file://) and iOS
   */
  static async readUriContent(uri: string): Promise<string> {
    const FileSystem = getFileSystem();

    // 1. Android content:// URIs are stream-handled directly by FileSystem
    if (uri.startsWith('content://')) {
      try {
        return await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch (safErr) {
        if (FileSystem.StorageAccessFramework?.readAsStringAsync) {
          try {
            return await FileSystem.StorageAccessFramework.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          } catch {}
        }
      }
    }

    // 2. Try React Native built-in fetch (handles file:// and web)
    try {
      const response = await fetch(uri);
      const text = await response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch {}

    // 3. Fallback to FileSystem readAsStringAsync
    try {
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (fsErr) {
      console.warn('FileSystem.readAsStringAsync failed:', fsErr);
    }

    throw new Error('Could not read the selected backup file. Please ensure the file is accessible.');
  }

  /**
   * Prompts user to select a backup file using system Document Picker
   */
  static async pickBackupFile(): Promise<{ canceled: boolean; fileContent?: string; filename?: string; error?: string }> {
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { canceled: true };
      }

      const asset = result.assets[0];
      const text = await this.readUriContent(asset.uri);

      return { canceled: false, fileContent: text, filename: asset.name };
    } catch (err: any) {
      console.error('pickBackupFile error:', err);
      return { canceled: true, error: err?.message || 'Error opening file.' };
    }
  }

  /**
   * Restores all database tables from a backup package inside an atomic transaction
   */
  static async restoreBackup(pkg: StoreBackupPackage, storeId: string = 'store-1'): Promise<{ success: boolean; error?: string }> {
    const db = await getDatabase();

    try {
      // 1. Silent emergency snapshot of current state before overwrite
      try {
        await this.createLocalAutoBackup(storeId, 'pre_restore');
      } catch (snapErr) {
        console.warn('Could not create pre-restore snapshot, continuing:', snapErr);
      }

      // 2. Temporarily disable foreign keys BEFORE starting transaction
      // (SQLite strictly ignores PRAGMA foreign_keys changes while a transaction is open)
      await db.execAsync('PRAGMA foreign_keys = OFF;');

      try {
        await db.withTransactionAsync(async () => {
          const targetStoreId = pkg.metadata?.storeId || storeId;

          // Clean existing records for this store
          await db.runAsync('DELETE FROM sync_queue WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM expenses WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM sale_items WHERE saleId IN (SELECT id FROM sales WHERE storeId = ?);', [targetStoreId]);
          await db.runAsync('DELETE FROM sales WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM purchase_items WHERE purchaseId IN (SELECT id FROM purchases WHERE storeId = ?);', [targetStoreId]);
          await db.runAsync('DELETE FROM purchases WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM pipe_segments WHERE storeId = ?;', [targetStoreId]).catch(() => {});
          await db.runAsync('DELETE FROM stock_movements WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM product_variants WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM products WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM custom_field_definitions WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM subcategories WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM categories WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM suppliers WHERE storeId = ?;', [targetStoreId]);
          await db.runAsync('DELETE FROM customers WHERE storeId = ?;', [targetStoreId]);

          // Helper to insert rows safely with sanitization
          const insertRows = async (tableName: string, rows: any[]) => {
            if (!rows || rows.length === 0) return;
            for (const row of rows) {
              const keys = Object.keys(row);
              if (keys.length === 0) continue;
              const cols = keys.map((k) => `"${k}"`).join(', ');
              const placeholders = keys.map(() => '?').join(', ');
              const values = keys.map((k) => {
                const val = row[k];
                if (val === undefined) return null;
                if (typeof val === 'boolean') return val ? 1 : 0;
                if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                return val;
              });
              await db.runAsync(
                `INSERT OR REPLACE INTO ${tableName} (${cols}) VALUES (${placeholders});`,
                values
              );
            }
          };

          // Sort subcategories by depth ASC so parents are inserted before children
          const sortedSubcategories = [...(pkg.data.subcategories || [])].sort(
            (a, b) => (Number(a.depth) || 1) - (Number(b.depth) || 1)
          );

          // Insert restored tables in logical dependency order
          await insertRows('stores', pkg.data.stores);
          await insertRows('categories', pkg.data.categories);
          await insertRows('subcategories', sortedSubcategories);
          await insertRows('custom_field_definitions', pkg.data.custom_field_definitions);
          await insertRows('products', pkg.data.products);
          await insertRows('product_variants', pkg.data.product_variants);
          if (pkg.data.pipe_segments && pkg.data.pipe_segments.length > 0) {
            await insertRows('pipe_segments', pkg.data.pipe_segments);
          }
          await insertRows('stock_movements', pkg.data.stock_movements);
          await insertRows('suppliers', pkg.data.suppliers);
          await insertRows('customers', pkg.data.customers);
          await insertRows('purchases', pkg.data.purchases);
          await insertRows('purchase_items', pkg.data.purchase_items);
          await insertRows('sales', pkg.data.sales);
          await insertRows('sale_items', pkg.data.sale_items);
          await insertRows('expenses', pkg.data.expenses);
        });
      } finally {
        // Always re-enable foreign keys after transaction commits/rolls back
        await db.execAsync('PRAGMA foreign_keys = ON;');
      }

      console.log(
        `[BackupService] Successfully restored ${pkg.data.categories?.length || 0} categories, ${
          pkg.data.products?.length || 0
        } products (${pkg.data.product_variants?.length || 0} variants).`
      );

      return { success: true };
    } catch (err: any) {
      console.error('restoreBackup transaction failed:', err);
      return { success: false, error: err?.message || 'Restore transaction failed. Database rolled back.' };
    }
  }

  /**
   * Creates a silent local snapshot in the backups directory
   */
  static async createLocalAutoBackup(storeId: string = 'store-1', prefix: string = 'auto'): Promise<string | null> {
    const dir = await this.getBackupsDirectory();
    if (!dir) return null;

    try {
      const FileSystem = getFileSystem();
      const backupPackage = await this.createBackupData(storeId);
      const jsonContent = JSON.stringify(backupPackage);
      const timestamp = Date.now();
      const filename = `${prefix}_backup_${timestamp}.json`;
      const fileUri = `${dir}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Cleanup oldest auto backups to respect MAX_AUTO_BACKUPS
      await this.pruneAutoBackups(dir);

      return fileUri;
    } catch (e) {
      console.warn('createLocalAutoBackup error:', e);
      return null;
    }
  }

  /**
   * Retrieves list of saved local backups on the device
   */
  static async getLocalBackups(): Promise<LocalBackupInfo[]> {
    const dir = await this.getBackupsDirectory();
    if (!dir) return [];

    try {
      const FileSystem = getFileSystem();
      const files: string[] = await FileSystem.readDirectoryAsync(dir);
      const backupList: LocalBackupInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const uri = `${dir}${file}`;
        const info = await FileSystem.getInfoAsync(uri);
        const matchTime = file.match(/_(\d+)\.json$/);
        const timeNum = matchTime ? parseInt(matchTime[1], 10) : (info.modificationTime ? info.modificationTime * 1000 : Date.now());
        const d = new Date(timeNum);

        backupList.push({
          filename: file,
          uri,
          sizeBytes: info.size || 0,
          createdAt: d.toISOString(),
          formattedDate: d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          isAutoBackup: file.startsWith('auto_') || file.startsWith('pre_restore_'),
        });
      }

      // Sort newest first
      backupList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return backupList;
    } catch (e) {
      console.warn('getLocalBackups error:', e);
      return [];
    }
  }

  /**
   * Keeps only the newest MAX_AUTO_BACKUPS files
   */
  private static async pruneAutoBackups(dir: string): Promise<void> {
    try {
      const FileSystem = getFileSystem();
      const files: string[] = await FileSystem.readDirectoryAsync(dir);
      const autoFiles = files.filter((f) => f.startsWith('auto_backup_'));

      if (autoFiles.length > this.MAX_AUTO_BACKUPS) {
        autoFiles.sort(); // Lexicographical sort works because timestamps are fixed length
        const deleteCount = autoFiles.length - this.MAX_AUTO_BACKUPS;
        for (let i = 0; i < deleteCount; i++) {
          await FileSystem.deleteAsync(`${dir}${autoFiles[i]}`, { idempotent: true });
        }
      }
    } catch (e) {
      console.warn('pruneAutoBackups error:', e);
    }
  }

  /**
   * Triggers daily auto-backup if not already taken today
   */
  static async checkAndPerformDailyBackup(storeId: string = 'store-1'): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM sync_metadata WHERE key = 'last_daily_backup_date';"
      );
      const today = new Date().toISOString().slice(0, 10);

      if (row?.value === today) {
        return; // Already backed up today
      }

      await this.createLocalAutoBackup(storeId, 'auto');
      await db.runAsync(
        "INSERT OR REPLACE INTO sync_metadata (key, value, updatedAt) VALUES ('last_daily_backup_date', ?, ?);",
        [today, new Date().toISOString()]
      );
    } catch (e) {
      console.warn('Daily auto backup check error:', e);
    }
  }
}
