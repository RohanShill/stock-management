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
      const normalized = s.trim().toLowerCase();
      // Match mixed fraction: e.g. "1 1/2", "2 1/4", "1-1/4"
      const mixedMatch = normalized.match(/(\d+)\s*[\s-]\s*(\d+)\/(\d+)/);
      if (mixedMatch) {
        const whole = parseFloat(mixedMatch[1]) || 0;
        const num = parseFloat(mixedMatch[2]) || 0;
        const den = parseFloat(mixedMatch[3]) || 1;
        return whole + num / den;
      }
      // Match simple fraction: e.g. "1/2", "3/4"
      const fracMatch = normalized.match(/(\d+)\/(\d+)/);
      if (fracMatch) {
        const num = parseFloat(fracMatch[1]) || 0;
        const den = parseFloat(fracMatch[2]) || 1;
        return num / den;
      }
      // Match decimal or integer: e.g. "25mm", "2.5", "10"
      const numMatch = normalized.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        return parseFloat(numMatch[1]);
      }
      return 999999;
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

    const isPipeCategory = categoryName.toLowerCase().includes('pipe');
    const isBathCategory = categoryName.toLowerCase().includes('bath');

    // 1. Store-wide cleanup of old dummy paint demo subcategories
    await db.runAsync(
      `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE storeId = ? AND (
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%' OR 
        LOWER(name) LIKE '%angles%' OR
        LOWER(name) LIKE '%emulsion%' OR
        LOWER(name) LIKE '%distemper%' OR
        LOWER(name) LIKE '%primer%' OR
        LOWER(name) LIKE '%solvent%' OR
        LOWER(name) LIKE '%waterproof%' OR
        LOWER(name) LIKE '%putty%' OR
        LOWER(name) = 'general' OR
        id LIKE 'demo-sub-%'
      );`,
      [now, storeId]
    );

    // 2. Store-wide cleanup of old dummy paint products & variants
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND (
        LOWER(size) LIKE '%albow%' OR 
        LOWER(size) LIKE '%elbow%' OR 
        LOWER(name) LIKE '%albow%' OR 
        LOWER(name) LIKE '%elbow%' OR
        id LIKE 'demo-var-%'
      );`,
      [now, storeId]
    );

    await db.runAsync(
      `UPDATE products SET deletedAt = ?, active = 0 WHERE storeId = ? AND (
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
        LOWER(brand) = 'general' OR
        id LIKE 'demo-%' OR
        id LIKE 'prod-demo%'
      );`,
      [now, storeId]
    );

    // 3. Category isolation: If NOT pipe category (e.g. Bath fittings), remove any mistakenly attached pipe subcategories or products
    if (!isPipeCategory) {
      await db.runAsync(
        `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE storeId = ? AND categoryId = ? AND (
          LOWER(name) = 'pipes' OR 
          LOWER(name) = 'pipe fittings' OR 
          (LOWER(name) LIKE '%pipe%' AND LOWER(name) NOT LIKE '%bath%')
        );`,
        [now, storeId, categoryId]
      );

      await db.runAsync(
        `UPDATE products SET deletedAt = ?, active = 0 WHERE storeId = ? AND categoryId = ? AND (
          LOWER(name) LIKE '%pipe%' OR 
          LOWER(brand) = 'supreme' OR
          LOWER(brand) = 'akg' OR
          LOWER(brand) = 'plast'
        );`,
        [now, storeId, categoryId]
      );
    }

    // 4. If pipe category, remove any bath fittings subcategories that might be under it
    if (isPipeCategory) {
      await db.runAsync(
        `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE storeId = ? AND categoryId = ? AND (
          LOWER(name) LIKE '%bath%' OR 
          LOWER(name) LIKE '%tap%' OR 
          LOWER(name) LIKE '%shower%'
        );`,
        [now, storeId, categoryId]
      );
    }

    // 5. Query active subcategories belonging strictly to this category
    let rows = await db.getAllAsync<any>(
      `SELECT * FROM subcategories 
       WHERE categoryId = ? 
         AND storeId = ? 
         AND deletedAt IS NULL 
         AND active = 1
         AND LOWER(name) NOT LIKE '%albow%' 
         AND LOWER(name) NOT LIKE '%elbow%' 
         AND LOWER(name) NOT LIKE '%angles%'
         AND LOWER(name) NOT LIKE '%emulsion%'
         AND LOWER(name) NOT LIKE '%distemper%'
         AND LOWER(name) NOT LIKE '%primer%'
         AND LOWER(name) NOT LIKE '%solvent%'
         AND LOWER(name) NOT LIKE '%waterproof%'
         AND LOWER(name) NOT LIKE '%putty%'
         AND LOWER(name) != 'general'
         AND id NOT LIKE 'demo-sub-%'
       ORDER BY displayOrder ASC, createdAt ASC;`,
      [categoryId, storeId]
    );

    // Query all subcategories that ever existed for this category (active or deleted)
    const allEverSubcats = await db.getAllAsync<any>(
      `SELECT LOWER(name) as name, deletedAt FROM subcategories WHERE categoryId = ? AND storeId = ?;`,
      [categoryId, storeId]
    );

    // If it's a Pipe category, make sure default tabs exist ONLY IF they were never created before
    if (isPipeCategory) {
      const everHadPipes = allEverSubcats && allEverSubcats.some((r) => r.name === 'pipes');
      const everHadFittings = allEverSubcats && allEverSubcats.some((r) => r.name.includes('fitting'));
      const everHadOthers = allEverSubcats && allEverSubcats.some((r) => r.name.includes('other'));

      if (!everHadPipes) {
        const id = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          [id, storeId, categoryId, 'Pipes', 'Pipes section', 1, now, now]
        );
      }
      if (!everHadFittings) {
        const id = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          [id, storeId, categoryId, 'Pipe Fittings', 'Pipe Fittings section', 2, now, now]
        );
      }
      if (!everHadOthers) {
        const id = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          [id, storeId, categoryId, 'Others', 'Other accessories section', 3, now, now]
        );
      }

      // Re-query rows
      rows = await db.getAllAsync<any>(
        `SELECT * FROM subcategories 
         WHERE categoryId = ? 
           AND storeId = ? 
           AND deletedAt IS NULL 
           AND active = 1
           AND LOWER(name) NOT LIKE '%albow%' 
           AND LOWER(name) NOT LIKE '%elbow%' 
           AND LOWER(name) NOT LIKE '%angles%'
           AND LOWER(name) NOT LIKE '%emulsion%'
           AND LOWER(name) NOT LIKE '%distemper%'
           AND LOWER(name) NOT LIKE '%primer%'
           AND LOWER(name) NOT LIKE '%solvent%'
           AND LOWER(name) NOT LIKE '%waterproof%'
           AND LOWER(name) NOT LIKE '%putty%'
           AND LOWER(name) != 'general'
           AND id NOT LIKE 'demo-sub-%'
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

    // Only auto-create defaults if category has NEVER had any subcategories at all (brand new category)
    if (!allEverSubcats || allEverSubcats.length === 0) {
      const defaultTabs = isPipeCategory
        ? ['Pipes', 'Pipe Fittings', 'Others']
        : isBathCategory
        ? ['Bath Fittings', 'Taps & Showers', 'Others']
        : [categoryName, 'Accessories', 'Others'];

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

      // Seed sketch items for "Pipes" tab ONLY if the entire category has no products at all yet
      if (isPipeCategory && createdTabs.length > 0) {
        const existingProds = await db.getAllAsync<any>(
          `SELECT id FROM products WHERE categoryId = ? AND storeId = ? AND deletedAt IS NULL;`,
          [categoryId, storeId]
        );
        if (!existingProds || existingProds.length === 0) {
          const pipesTab = createdTabs[0];
          await this.seedSketchPipesData(storeId, categoryId, pipesTab.id, deviceId);
        }
      }

      return createdTabs;
    }

    return [];
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
        // Unique SKU with short UUID component so it NEVER violates SQLite unique constraint
        const sku = `PIPE-${b.name.toUpperCase().slice(0, 3)}-${row.size.replace(/[^0-9]/g, '')}-${uuidv4().slice(0, 6).toUpperCase()}`;
        await db.runAsync(
          `INSERT OR REPLACE INTO product_variants (id, storeId, productId, name, sku, size, purchasePricePaise, sellingPricePaise, minStockLevel, openingStock, currentStock, active, createdAt, updatedAt)
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

    let sql = `SELECT * FROM products WHERE storeId = ? AND categoryId = ? AND deletedAt IS NULL AND active = 1
      AND LOWER(name) NOT LIKE '%albow%'
      AND LOWER(name) NOT LIKE '%elbow%'
      AND LOWER(name) NOT LIKE '%emulsion%'
      AND LOWER(name) NOT LIKE '%distemper%'
      AND LOWER(name) NOT LIKE '%primer%'
      AND LOWER(name) NOT LIKE '%solvent%'
      AND LOWER(name) NOT LIKE '%waterproof%'
      AND LOWER(name) NOT LIKE '%putty%'
      AND LOWER(brand) NOT LIKE '%asian paint%'
      AND LOWER(brand) NOT LIKE '%berger%'
      AND LOWER(brand) NOT LIKE '%dr. fixit%'
      AND LOWER(brand) NOT LIKE '%birla white%'
      AND LOWER(brand) != 'general'
      AND id NOT LIKE 'demo-%'`;
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

    // 1. First collect all existing brands from active products in this section
    for (const p of productRows) {
      const rawBrand = (p.brand || '').trim();
      const lowerBrand = rawBrand.toLowerCase();
      if (
        rawBrand &&
        lowerBrand !== 'general' &&
        !lowerBrand.includes('asian paint') &&
        !lowerBrand.includes('berger') &&
        !lowerBrand.includes('dr. fixit') &&
        !lowerBrand.includes('birla white')
      ) {
        brandSet.add(rawBrand);
      }
    }

    // 2. Map cells and sizes from active variants
    for (const v of variantRows) {
      const prod = prodMap.get(v.productId);
      const rawBrand = (prod?.brand || '').trim();
      const lowerBrand = rawBrand.toLowerCase();

      // User requirement: "general ho hta do bas jo brand client chahega wo add krega"
      if (
        !rawBrand ||
        lowerBrand === 'general' ||
        lowerBrand.includes('asian paint') ||
        lowerBrand.includes('berger') ||
        lowerBrand.includes('dr. fixit') ||
        lowerBrand.includes('birla white')
      ) {
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

    // Check if subcategory has custom sizeOrder
    let customSizeOrder: string[] | null = null;
    if (subcategoryId) {
      try {
        const subRow = await db.getFirstAsync<{ customValues?: string }>(
          `SELECT customValues FROM subcategories WHERE id = ? AND storeId = ?;`,
          [subcategoryId, storeId]
        );
        if (subRow?.customValues) {
          const parsed = JSON.parse(subRow.customValues);
          if (Array.isArray(parsed?.sizeOrder)) {
            customSizeOrder = parsed.sizeOrder;
          }
        }
      } catch {
        // ignore
      }
    }

    let sizes: string[];
    if (customSizeOrder && customSizeOrder.length > 0) {
      const orderMap = new Map<string, number>();
      customSizeOrder.forEach((s, idx) => orderMap.set(s.trim().toLowerCase(), idx));
      const allSizes = Array.from(sizeSet);
      sizes = allSizes.sort((a, b) => {
        const idxA = orderMap.has(a.trim().toLowerCase()) ? orderMap.get(a.trim().toLowerCase())! : 999999;
        const idxB = orderMap.has(b.trim().toLowerCase()) ? orderMap.get(b.trim().toLowerCase())! : 999999;
        if (idxA !== idxB) return idxA - idxB;
        return a.localeCompare(b);
      });
    } else {
      sizes = this.sortSizes(Array.from(sizeSet));
    }

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
    if (!cleanBrand || cleanBrand.toLowerCase() === 'general') return;

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

    let sizesToApply = [...existingSizes];
    // If UI passed empty sizes, check if sizes already exist in this subcategory in DB
    if (sizesToApply.length === 0) {
      const dbSizes = await db.getAllAsync<any>(
        `SELECT DISTINCT pv.size 
         FROM product_variants pv 
         JOIN products p ON pv.productId = p.id 
         WHERE p.storeId = ? AND p.categoryId = ? AND p.subcategoryId = ? AND pv.deletedAt IS NULL AND p.deletedAt IS NULL;`,
        [storeId, categoryId, subcategoryId]
      );
      if (dbSizes && dbSizes.length > 0) {
        sizesToApply = dbSizes.map((s) => s.size).filter(Boolean);
      }
    }

    // Create variants for all sizes with 0 initial stock
    for (const size of sizesToApply) {
      const cleanSize = size.trim();
      if (!cleanSize) continue;
      const existingVar = await db.getFirstAsync<any>(
        `SELECT id FROM product_variants WHERE productId = ? AND size = ? AND deletedAt IS NULL;`,
        [prodId, cleanSize]
      );

      if (!existingVar) {
        const varId = uuidv4();
        const sku = `${cleanBrand.toUpperCase().slice(0, 3)}-${cleanSize.replace(/[^a-zA-Z0-9]/g, '')}-${uuidv4().slice(0, 8).toUpperCase()}`;
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
    if (!cleanSize) return;

    let brandsToApply = existingBrands.filter(
      (b) => b && b.trim().toLowerCase() !== 'general' && b.trim() !== ''
    );

    // 1. If not passed from UI, check if any brands already exist in this subcategory in DB
    if (brandsToApply.length === 0) {
      const subProds = await db.getAllAsync<any>(
        `SELECT DISTINCT brand FROM products WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND deletedAt IS NULL AND LOWER(brand) != 'general' AND brand IS NOT NULL AND TRIM(brand) != '';`,
        [storeId, categoryId, subcategoryId]
      );
      if (subProds && subProds.length > 0) {
        brandsToApply = subProds.map((p) => p.brand.trim());
      }
    }

    // 2. If still empty, check brands in the parent category (e.g. from Pipes tab like Supreme, AKG, Plast)
    if (brandsToApply.length === 0) {
      const catProds = await db.getAllAsync<any>(
        `SELECT DISTINCT brand FROM products WHERE storeId = ? AND categoryId = ? AND deletedAt IS NULL AND LOWER(brand) != 'general' AND brand IS NOT NULL AND TRIM(brand) != '';`,
        [storeId, categoryId]
      );
      if (catProds && catProds.length > 0) {
        brandsToApply = catProds.map((p) => p.brand.trim());
      }
    }

    // 3. If completely new store with 0 brands anywhere in category, fallback to 'Supreme'
    if (brandsToApply.length === 0) {
      brandsToApply = ['Supreme'];
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
        const sku = `${cleanBrand.toUpperCase().slice(0, 3)}-${cleanSize.replace(/[^a-zA-Z0-9]/g, '')}-${uuidv4().slice(0, 8).toUpperCase()}`;
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
    const cleanBrand = brandName.trim().toLowerCase();

    // 1. Cascade soft-delete variants
    if (typeof db.getAllAsync === 'function') {
      try {
        const prods = await db.getAllAsync<any>(
          `SELECT id FROM products WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ?;`,
          [storeId, categoryId, subcategoryId, cleanBrand]
        );
        if (prods && prods.length > 0) {
          for (const p of prods) {
            await db.runAsync(
              `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND productId = ?;`,
              [now, storeId, p.id]
            );
          }
        }
      } catch {
        // Fallback to direct subquery
      }
    }
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND productId IN (SELECT id FROM products WHERE categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ?);`,
      [now, storeId, categoryId, subcategoryId, cleanBrand]
    );

    // 2. Soft-delete products
    await db.runAsync(
      `UPDATE products SET deletedAt = ?, active = 0 WHERE storeId = ? AND categoryId = ? AND subcategoryId = ? AND LOWER(brand) = ?;`,
      [now, storeId, categoryId, subcategoryId, cleanBrand]
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
    const cleanSize = sizeName.trim();

    if (typeof db.getAllAsync === 'function') {
      try {
        const prods = await db.getAllAsync<any>(
          `SELECT id FROM products WHERE storeId = ? AND categoryId = ? AND subcategoryId = ?;`,
          [storeId, categoryId, subcategoryId]
        );
        if (prods && prods.length > 0) {
          for (const p of prods) {
            await db.runAsync(
              `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND productId = ? AND size = ?;`,
              [now, storeId, p.id, cleanSize]
            );
          }
        }
      } catch {
        // Fallback
      }
    }
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND size = ? AND productId IN (SELECT id FROM products WHERE categoryId = ? AND subcategoryId = ?);`,
      [now, storeId, cleanSize, categoryId, subcategoryId]
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
   * Deletes a sub-tab (subcategory) from database and cascades to its products
   */
  static async deleteSubTab(
    storeId: string,
    subcategoryId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // 1. Cascade soft-delete variants
    if (typeof db.getAllAsync === 'function') {
      try {
        const prods = await db.getAllAsync<any>(
          `SELECT id FROM products WHERE storeId = ? AND subcategoryId = ?;`,
          [storeId, subcategoryId]
        );
        if (prods && prods.length > 0) {
          for (const p of prods) {
            await db.runAsync(
              `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND productId = ?;`,
              [now, storeId, p.id]
            );
          }
        }
      } catch {
        // Fallback
      }
    }
    await db.runAsync(
      `UPDATE product_variants SET deletedAt = ?, active = 0 WHERE storeId = ? AND productId IN (SELECT id FROM products WHERE subcategoryId = ?);`,
      [now, storeId, subcategoryId]
    );

    // 2. Soft-delete products
    await db.runAsync(
      `UPDATE products SET deletedAt = ?, active = 0 WHERE storeId = ? AND subcategoryId = ?;`,
      [now, storeId, subcategoryId]
    );

    // 3. Soft-delete subcategory
    await db.runAsync(
      `UPDATE subcategories SET deletedAt = ?, active = 0 WHERE id = ? AND storeId = ?;`,
      [now, subcategoryId, storeId]
    );

    // 4. Enqueue sync
    await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', subcategoryId, 'delete', { deletedAt: now, active: false });
  }

  /**
   * Saves custom size order for a category/subcategory
   */
  static async saveSizeOrder(
    storeId: string,
    categoryId: string,
    subcategoryId: string,
    newSizes: string[]
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // 1. Update subcategories customValues with sizeOrder JSON
    const customJson = JSON.stringify({ sizeOrder: newSizes });
    await db.runAsync(
      `UPDATE subcategories SET customValues = ?, updatedAt = ? WHERE id = ? AND storeId = ?;`,
      [customJson, now, subcategoryId, storeId]
    );

    // 2. Update displayOrder on product_variants for each size
    for (let i = 0; i < newSizes.length; i++) {
      const sizeName = newSizes[i];
      await db.runAsync(
        `UPDATE product_variants 
         SET displayOrder = ?, updatedAt = ?
         WHERE storeId = ? 
           AND size = ? 
           AND productId IN (SELECT id FROM products WHERE categoryId = ? AND subcategoryId = ?);`,
        [i + 1, now, storeId, sizeName, categoryId, subcategoryId]
      );
    }
  }
}
