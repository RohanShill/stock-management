import { v4 as uuidv4 } from '../../utils/uuid.js';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';
import { Subcategory, rupeeToPaise } from '@hardware-store/shared';

export interface MatrixCellData {
  variantId: string;
  productId: string;
  brand: string;
  size: string;
  currentStock: number;
  sellingPricePaise: number;
  purchasePricePaise: number;
}

export interface MatrixGridData {
  brands: string[];
  sizes: string[];
  cells: Record<string, MatrixCellData>; // key: `${size.trim()}___${brand.trim().toLowerCase()}`
}

export class MatrixRepository {
  /**
   * Sort sizes naturally (e.g. 1/2", 3/4", 1", 1 1/4", 1 1/2", 2")
   */
  static sortSizes(sizes: string[]): string[] {
    const parseSizeValue = (s: string): number => {
      const clean = s.replace(/"/g, '').trim();
      // Handle mixed fractions like "1 1/4" or "1-1/2"
      if (clean.includes(' ') || clean.includes('-')) {
        const parts = clean.split(/[\s-]+/);
        const whole = parseFloat(parts[0]) || 0;
        if (parts[1] && parts[1].includes('/')) {
          const [num, den] = parts[1].split('/').map(Number);
          return whole + (den ? num / den : 0);
        }
        return whole;
      }
      // Handle simple fractions like "1/2" or "3/4"
      if (clean.includes('/')) {
        const [num, den] = clean.split('/').map(Number);
        return den ? num / den : 0;
      }
      const num = parseFloat(clean);
      return isNaN(num) ? 999999 : num;
    };

    return [...sizes].sort((a, b) => {
      const valA = parseSizeValue(a);
      const valB = parseSizeValue(b);
      if (valA !== valB) return valA - valB;
      return a.localeCompare(b);
    });
  }

  /**
   * Ensures default sub-tabs (Pipes, Pipe Fittings, Others) exist for a category.
   * If it's a Pipe category and empty, seeds initial data matching client's sketch.
   */
  static async ensureDefaultSubTabs(
    storeId: string,
    categoryId: string,
    categoryName: string,
    deviceId: string
  ): Promise<Subcategory[]> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Clean up any old dummy subcategories like 'Albow', 'Elbow', 'Angles', 'Angles & Elbows'
    await db.runAsync(
      `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE storeId = ? AND (
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%' OR 
        LOWER(name) LIKE '%angles%'
      );`,
      [now, storeId]
    );

    // Clean up any products or variants with 'elbow' / 'albow'
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ? WHERE storeId = ? AND (
        LOWER(size) LIKE '%albow%' OR 
        LOWER(size) LIKE '%elbow%' OR 
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%'
      );`,
      [now, storeId]
    );

    await db.runAsync(
      `UPDATE products SET deletedAt = ? WHERE storeId = ? AND (
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%'
      );`,
      [now, storeId]
    );

    let rows = await db.getAllAsync<any>(
      `SELECT * FROM subcategories 
       WHERE categoryId = ? 
         AND storeId = ? 
         AND deletedAt IS NULL 
         AND LOWER(name) NOT LIKE '%albow%' 
         AND LOWER(name) NOT LIKE '%elbow%' 
         AND LOWER(name) NOT LIKE '%angles%'
       ORDER BY displayOrder ASC, createdAt ASC;`,
      [categoryId, storeId]
    );

    const isPipeCategory = categoryName.toLowerCase().includes('pipe');

    // If it's a Pipe category, make sure 'Pipe Fittings' and 'Others' exist alongside 'Pipes'
    if (isPipeCategory && rows && rows.length > 0) {
      const hasFittings = rows.some((r) => r.name.toLowerCase().includes('fitting'));
      const hasOthers = rows.some((r) => r.name.toLowerCase().includes('other'));

      if (!hasFittings) {
        const id = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
           VALUES (?, ?, ?, 'Pipe Fittings', 'Pipe Fittings section', 2, 1, ?, ?);`,
          [id, storeId, categoryId, now, now]
        );
      }
      if (!hasOthers) {
        const id = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
           VALUES (?, ?, ?, 'Others', 'Other accessories section', 3, 1, ?, ?);`,
          [id, storeId, categoryId, now, now]
        );
      }

      // Re-query rows
      rows = await db.getAllAsync<any>(
        `SELECT * FROM subcategories 
         WHERE categoryId = ? 
           AND storeId = ? 
           AND deletedAt IS NULL 
           AND LOWER(name) NOT LIKE '%albow%' 
           AND LOWER(name) NOT LIKE '%elbow%' 
           AND LOWER(name) NOT LIKE '%angles%'
         ORDER BY displayOrder ASC, createdAt ASC;`,
        [categoryId, storeId]
      );
    }

    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        active: Boolean(r.active),
        displayOrder: r.displayOrder ?? 0,
      }));
    }

    // No subcategories exist yet, auto-create defaults
    const defaultTabs = isPipeCategory
      ? ['Pipes', 'Pipe Fittings', 'Others']
      : ['General', 'Fittings & Accessories', 'Others'];

    const createdTabs: Subcategory[] = [];

    for (let i = 0; i < defaultTabs.length; i++) {
      const tabName = defaultTabs[i];
      const id = uuidv4();
      const record: Subcategory = {
        id,
        storeId,
        categoryId,
        name: tabName,
        description: `${tabName} section under ${categoryName}`,
        displayOrder: i + 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.runAsync(
        `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
        [id, storeId, categoryId, record.name, record.description ?? null, record.displayOrder, now, now]
      );

      await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', id, 'create', record as unknown as Record<string, unknown>);
      createdTabs.push(record);
    }

    // Seed sketch items for "Pipes" tab if it was just created
    if (isPipeCategory && createdTabs.length > 0) {
      const pipesTab = createdTabs[0];
      await this.seedSketchPipesData(storeId, categoryId, pipesTab.id, deviceId);
      // Pipe Fittings and Others start clean so client can add their own items
    }

    return createdTabs;
  }

  /**
   * Seed exact sample data from client's sketch:
   * Sizes: 1/2", 3/4", 1", 1 1/4", 1 1/2", 2"
   * Brands: Supreme, AKG, Plast
   */
  static async seedSketchPipesData(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const sketchGrid: { size: string; supreme: number; akg: number; plast: number }[] = [
      { size: '1/2"', supreme: 30, akg: 13, plast: 43 },
      { size: '3/4"', supreme: 32, akg: 13, plast: 21 },
      { size: '1"', supreme: 12, akg: 11, plast: 11 },
      { size: '1 1/4"', supreme: 42, akg: 23, plast: 32 },
      { size: '1 1/2"', supreme: 2, akg: 42, plast: 21 },
      { size: '2"', supreme: 6, akg: 5, plast: 12 },
    ];

    const brands = [
      { name: 'Supreme', key: 'supreme' as const },
      { name: 'AKG', key: 'akg' as const },
      { name: 'Plast', key: 'plast' as const },
    ];

    for (const b of brands) {
      const prodId = uuidv4();
      const prodName = `${b.name} Pipe`;
      await db.runAsync(
        `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, measurementType, baseUnit, allowedUnits, packMultiplier, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'count', 'piece', '["piece"]', 1, 1, ?, ?);`,
        [prodId, storeId, categoryId, subcategoryId, prodName, b.name, now, now]
      );

      for (const row of sketchGrid) {
        const stockQty = row[b.key];
        const varId = uuidv4();
        const sku = `PIPE-${b.name.toUpperCase().slice(0, 3)}-${row.size.replace(/[^0-9]/g, '')}`;
        await db.runAsync(
          `INSERT INTO product_variants (id, storeId, productId, name, sku, size, purchasePricePaise, sellingPricePaise, minStockLevel, openingStock, currentStock, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 15000, 22000, 5, ?, ?, 1, ?, ?);`,
          [varId, storeId, prodId, `${prodName} ${row.size}`, sku, row.size, stockQty, stockQty, now, now]
        );

        if (stockQty > 0) {
          const moveId = uuidv4();
          await db.runAsync(
            `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, reason, deviceId, createdAt)
             VALUES (?, ?, ?, 'opening_stock', ?, 0, ?, 'manual', 'Initial Stock Setup', ?, ?);`,
            [moveId, storeId, varId, stockQty, stockQty, deviceId, now]
          );
        }
      }
    }
  }

  /**
   * Seed sample Pipe Fittings items so the fittings tab is immediately usable
   */
  static async seedSampleFittingsData(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const fittings = [
      { size: 'Elbow 1/2"', supreme: 45, plast: 20 },
      { size: 'Tee 1/2"', supreme: 30, plast: 15 },
      { size: 'Socket 3/4"', supreme: 60, plast: 40 },
      { size: 'Union 1"', supreme: 12, plast: 8 },
    ];

    const brands = ['Supreme', 'Plast'];

    for (const b of brands) {
      const prodId = uuidv4();
      const prodName = `${b} Pipe Fittings`;
      await db.runAsync(
        `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, measurementType, baseUnit, allowedUnits, packMultiplier, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'count', 'piece', '["piece"]', 1, 1, ?, ?);`,
        [prodId, storeId, categoryId, subcategoryId, prodName, b, now, now]
      );

      for (const item of fittings) {
        const stockQty = b === 'Supreme' ? item.supreme : item.plast;
        const varId = uuidv4();
        const sku = `FIT-${b.toUpperCase().slice(0, 3)}-${item.size.replace(/[^a-zA-Z0-9]/g, '')}`;
        await db.runAsync(
          `INSERT INTO product_variants (id, storeId, productId, name, sku, size, purchasePricePaise, sellingPricePaise, minStockLevel, openingStock, currentStock, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 3500, 5000, 5, ?, ?, 1, ?, ?);`,
          [varId, storeId, prodId, `${b} ${item.size}`, sku, item.size, stockQty, stockQty, now, now]
        );
      }
    }
  }

  /**
   * Retrieves full matrix data for a specific category and subcategory
   */
  static async getMatrixData(
    storeId: string,
    categoryId: string,
    subcategoryId?: string
  ): Promise<MatrixGridData> {
    const db = await getDatabase();

    let sql = `SELECT * FROM products WHERE storeId = ? AND categoryId = ? AND deletedAt IS NULL`;
    const params: any[] = [storeId, categoryId];

    if (subcategoryId) {
      sql += ` AND subcategoryId = ?`;
      params.push(subcategoryId);
    }

    sql += ` ORDER BY name ASC;`;

    const productRows = await db.getAllAsync<any>(sql, params);
    if (!productRows || productRows.length === 0) {
      return { brands: [], sizes: [], cells: {} };
    }

    const productIds = productRows.map((p) => p.id);
    const placeholders = productIds.map(() => '?').join(',');

    const variantRows = await db.getAllAsync<any>(
      `SELECT * FROM product_variants WHERE productId IN (${placeholders}) AND deletedAt IS NULL;`,
      productIds
    );

    const prodMap = new Map<string, any>();
    productRows.forEach((p) => prodMap.set(p.id, p));

    // Clean up any old 'general' products from DB so they never appear
    await db.runAsync(
      `UPDATE products SET deletedAt = ? WHERE storeId = ? AND (LOWER(brand) = 'general' OR brand IS NULL OR TRIM(brand) = '');`,
      [new Date().toISOString(), storeId]
    );

    // Clean up any old dummy 'elbow' or 'albow' items from DB
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ? WHERE storeId = ? AND (
        LOWER(size) LIKE '%albow%' OR 
        LOWER(size) LIKE '%elbow%' OR 
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%'
      );`,
      [new Date().toISOString(), storeId]
    );

    await db.runAsync(
      `UPDATE products SET deletedAt = ? WHERE storeId = ? AND (
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%'
      );`,
      [new Date().toISOString(), storeId]
    );

    const brandSet = new Set<string>();
    const sizeSet = new Set<string>();
    const cells: Record<string, MatrixCellData> = {};

    for (const v of variantRows) {
      const prod = prodMap.get(v.productId);
      const rawBrand = (prod?.brand || '').trim();
      // User requirement: "general ho hta do bas jo brand client chahega wo add krega"
      if (!rawBrand || rawBrand.toLowerCase() === 'general') {
        continue;
      }

      // User requirement: "albow ho v hta do hard coded ha"
      const rawSize = (v.size || v.name || 'Standard').trim();
      if (
        rawSize.toLowerCase().includes('albow') ||
        rawSize.toLowerCase().includes('elbow') ||
        (prod?.name && (prod.name.toLowerCase().includes('albow') || prod.name.toLowerCase().includes('elbow')))
      ) {
        continue;
      }

      const brand = rawBrand;
      const size = rawSize;

      brandSet.add(brand);
      sizeSet.add(size);

      const cellKey = `${size}___${brand.toLowerCase()}`;
      cells[cellKey] = {
        variantId: v.id,
        productId: prod.id,
        brand: brand,
        size: size,
        currentStock: Number(v.currentStock) || 0,
        sellingPricePaise: Number(v.sellingPricePaise) || 0,
        purchasePricePaise: Number(v.purchasePricePaise) || 0,
      };
    }

    // Brands preserved in unique array (strictly non-general)
    const brands = Array.from(brandSet).filter((b) => b.toLowerCase() !== 'general');
    // Sort sizes naturally
    const sizes = this.sortSizes(Array.from(sizeSet));

    return { brands, sizes, cells };
  }

  /**
   * Adds a brand column to the matrix
   */
  static async addBrand(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    brandName: string,
    existingSizes: string[],
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const cleanBrand = brandName.trim();

    // Check if product already exists for this brand under this category/subcat
    let prod = await db.getFirstAsync<any>(
      `SELECT * FROM products WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ? AND deletedAt IS NULL;`,
      [storeId, categoryId, subcategoryId, cleanBrand.toLowerCase()]
    );

    let prodId: string;
    if (!prod) {
      prodId = uuidv4();
      await db.runAsync(
        `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, measurementType, baseUnit, allowedUnits, packMultiplier, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'count', 'piece', '["piece"]', 1, 1, ?, ?);`,
        [prodId, storeId, categoryId, subcategoryId, `${cleanBrand} Items`, cleanBrand, now, now]
      );
    } else {
      prodId = prod.id;
    }

    // Create variants for all existing sizes with 0 initial stock
    for (const size of existingSizes) {
      const cleanSize = size.trim();
      const existingVar = await db.getFirstAsync<any>(
        `SELECT id FROM product_variants WHERE productId = ? AND size = ? AND deletedAt IS NULL;`,
        [prodId, cleanSize]
      );

      if (!existingVar) {
        const varId = uuidv4();
        const sku = `${cleanBrand.toUpperCase().slice(0, 3)}-${cleanSize.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
        await db.runAsync(
          `INSERT INTO product_variants (id, storeId, productId, name, sku, size, purchasePricePaise, sellingPricePaise, minStockLevel, openingStock, currentStock, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 5, 0, 0, 1, ?, ?);`,
          [varId, storeId, prodId, `${cleanBrand} ${cleanSize}`, sku, cleanSize, now, now]
        );
      }
    }
  }

  /**
   * Adds a size row to the matrix
   */
  static async addSize(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    sizeName: string,
    existingBrands: string[],
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const cleanSize = sizeName.trim();

    const brandsToApply = existingBrands.filter(
      (b) => b && b.trim().toLowerCase() !== 'general' && b.trim() !== ''
    );

    if (brandsToApply.length === 0) {
      return;
    }

    for (const brand of brandsToApply) {
      const cleanBrand = brand.trim();
      let prod = await db.getFirstAsync<any>(
        `SELECT * FROM products WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ? AND deletedAt IS NULL;`,
        [storeId, categoryId, subcategoryId, cleanBrand.toLowerCase()]
      );

      let prodId: string;
      if (!prod) {
        prodId = uuidv4();
        await db.runAsync(
          `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, measurementType, baseUnit, allowedUnits, packMultiplier, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 'count', 'piece', '["piece"]', 1, 1, ?, ?);`,
          [prodId, storeId, categoryId, subcategoryId, `${cleanBrand} Items`, cleanBrand, now, now]
        );
      } else {
        prodId = prod.id;
      }

      const existingVar = await db.getFirstAsync<any>(
        `SELECT id FROM product_variants WHERE productId = ? AND size = ? AND deletedAt IS NULL;`,
        [prodId, cleanSize]
      );

      if (!existingVar) {
        const varId = uuidv4();
        const sku = `${cleanBrand.toUpperCase().slice(0, 3)}-${cleanSize.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
        await db.runAsync(
          `INSERT INTO product_variants (id, storeId, productId, name, sku, size, purchasePricePaise, sellingPricePaise, minStockLevel, openingStock, currentStock, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 5, 0, 0, 1, ?, ?);`,
          [varId, storeId, prodId, `${cleanBrand} ${cleanSize}`, sku, cleanSize, now, now]
        );
      }
    }
  }

  /**
   * Deletes a brand from matrix
   */
  static async deleteBrand(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    brandName: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE products SET deletedAt = ?, active = 0 WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ?;`,
      [now, storeId, categoryId, subcategoryId, brandName.trim().toLowerCase()]
    );
  }

  /**
   * Deletes a size from matrix
   */
  static async deleteSize(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    sizeName: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND size = ? AND productId IN (SELECT id FROM products WHERE categoryId = ? AND subcategoryId = ?);`,
      [now, sizeName.trim(), categoryId, subcategoryId]
    );
  }

  /**
   * Adds a brand new sub-tab (e.g. "Solvents", "Brass Valves", etc.)
   */
  static async addSubTab(
    storeId: string,
    categoryId: string,
    tabName: string,
    deviceId: string
  ): Promise<Subcategory> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    // Get highest displayOrder
    const lastRow = await db.getFirstAsync<{ maxOrder: number }>(
      `SELECT MAX(displayOrder) as maxOrder FROM subcategories WHERE categoryId = ? AND storeId = ?;`,
      [categoryId, storeId]
    );
    const displayOrder = (lastRow?.maxOrder || 0) + 1;

    const record: Subcategory = {
      id,
      storeId,
      categoryId,
      name: tabName.trim(),
      description: `${tabName.trim()} section`,
      displayOrder,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [id, storeId, categoryId, record.name, record.description ?? null, record.displayOrder, now, now]
    );

    await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', id, 'create', record as unknown as Record<string, unknown>);
    return record;
  }

  /**
   * Deletes a sub-tab (subcategory) from database
   */
  static async deleteSubTab(
    storeId: string,
    subcategoryId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE id = ? AND storeId = ?;`,
      [now, subcategoryId, storeId]
    );
    await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', subcategoryId, 'delete', { deletedAt: now, active: false });
  }
}
