import { v4 as uuidv4 } from 'uuid';
import {
  Product,
  ProductVariant,
  Category,
  Subcategory,
  BulkImportProductRow,
  rupeeToPaise,
} from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class ProductRepository {
  static async getCategories(storeId: string): Promise<Category[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM categories WHERE storeId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, name ASC;`,
      [storeId]
    );
    return rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
      displayOrder: r.displayOrder ?? 0,
    }));
  }

  static async createCategory(category: Partial<Category>, storeId: string, deviceId: string): Promise<Category> {
    const db = await getDatabase();
    const id = category.id || uuidv4();
    const now = new Date().toISOString();

    const record: Category = {
      id,
      storeId,
      name: category.name!,
      description: category.description,
      icon: category.icon,
      displayOrder: category.displayOrder ?? 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO categories (id, storeId, name, description, icon, displayOrder, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [id, storeId, record.name, record.description ?? null, record.icon ?? null, record.displayOrder, now, now]
    );

    await SyncQueueRepository.enqueue(storeId, deviceId, 'category', id, 'create', record as unknown as Record<string, unknown>);
    return record;
  }

  static async getSubcategories(categoryId: string, storeId: string): Promise<Subcategory[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM subcategories WHERE categoryId = ? AND storeId = ? AND deletedAt IS NULL ORDER BY displayOrder ASC, name ASC;`,
      [categoryId, storeId]
    );
    return rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
      displayOrder: r.displayOrder ?? 0,
    }));
  }

  static async createSubcategory(
    subcat: Partial<Subcategory>,
    storeId: string,
    deviceId: string
  ): Promise<Subcategory> {
    const db = await getDatabase();
    const id = subcat.id || uuidv4();
    const now = new Date().toISOString();

    const record: Subcategory = {
      id,
      storeId,
      categoryId: subcat.categoryId!,
      name: subcat.name!,
      description: subcat.description,
      displayOrder: subcat.displayOrder ?? 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO subcategories (id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [id, storeId, record.categoryId, record.name, record.description ?? null, record.displayOrder, now, now]
    );

    await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', id, 'create', record as unknown as Record<string, unknown>);
    return record;
  }

  static async getProductsWithVariants(
    storeId: string,
    query?: string,
    categoryId?: string,
    subcategoryId?: string
  ): Promise<Array<Product & { variants: ProductVariant[] }>> {
    const db = await getDatabase();
    let sql = `SELECT * FROM products WHERE storeId = ? AND deletedAt IS NULL`;
    const params: any[] = [storeId];

    if (categoryId) {
      sql += ` AND categoryId = ?`;
      params.push(categoryId);
    }
    if (subcategoryId) {
      sql += ` AND subcategoryId = ?`;
      params.push(subcategoryId);
    }

    if (query && query.trim()) {
      sql += ` AND (name LIKE ? OR brand LIKE ? OR modelNumber LIKE ?)`;
      const term = `%${query.trim()}%`;
      params.push(term, term, term);
    }
    sql += ` ORDER BY name ASC;`;

    const productRows = await db.getAllAsync<any>(sql, params);
    if (productRows.length === 0) return [];

    const productIds = productRows.map((p) => p.id);
    const placeholders = productIds.map(() => '?').join(',');

    const variantRows = await db.getAllAsync<any>(
      `SELECT * FROM product_variants WHERE productId IN (${placeholders}) AND deletedAt IS NULL ORDER BY name ASC;`,
      productIds
    );

    const variantsByProd = new Map<string, ProductVariant[]>();
    for (const vr of variantRows) {
      const v: ProductVariant = {
        ...vr,
        active: Boolean(vr.active),
        customValues: vr.customValues ? JSON.parse(vr.customValues) : undefined,
      };
      const list = variantsByProd.get(vr.productId) || [];
      list.push(v);
      variantsByProd.set(vr.productId, list);
    }

    return productRows.map((p) => ({
      ...p,
      active: Boolean(p.active),
      allowedUnits: JSON.parse(p.allowedUnits || '[]'),
      customValues: p.customValues ? JSON.parse(p.customValues) : undefined,
      variants: variantsByProd.get(p.id) || [],
    }));
  }

  static async createProduct(
    productData: Partial<Product>,
    variantsData: Array<Partial<ProductVariant>>,
    storeId: string,
    deviceId: string,
    userId?: string
  ): Promise<{ product: Product; variants: ProductVariant[] }> {
    const db = await getDatabase();
    const productId = productData.id || uuidv4();
    const now = new Date().toISOString();

    const product: Product = {
      id: productId,
      storeId,
      categoryId: productData.categoryId!,
      subcategoryId: productData.subcategoryId!,
      name: productData.name!,
      brand: productData.brand,
      material: productData.material,
      description: productData.description,
      modelNumber: productData.modelNumber,
      imageUrl: productData.imageUrl,
      measurementType: productData.measurementType!,
      baseUnit: productData.baseUnit!,
      allowedUnits: productData.allowedUnits || [productData.baseUnit!],
      packMultiplier: productData.packMultiplier || 1,
      pipeDiameterMm: productData.pipeDiameterMm,
      standardLengthMm: productData.standardLengthMm,
      pipeTrackingMethod: productData.pipeTrackingMethod,
      customValues: productData.customValues,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, material, description, modelNumber, imageUrl, measurementType, baseUnit, allowedUnits, packMultiplier, pipeDiameterMm, standardLengthMm, pipeTrackingMethod, customValues, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
        [
          product.id,
          product.storeId,
          product.categoryId,
          product.subcategoryId,
          product.name,
          product.brand ?? null,
          product.material ?? null,
          product.description ?? null,
          product.modelNumber ?? null,
          product.imageUrl ?? null,
          product.measurementType,
          product.baseUnit,
          JSON.stringify(product.allowedUnits),
          product.packMultiplier ?? 1,
          product.pipeDiameterMm ?? null,
          product.standardLengthMm ?? null,
          product.pipeTrackingMethod ?? null,
          product.customValues ? JSON.stringify(product.customValues) : null,
          now,
          now,
        ]
      );

      for (const vData of variantsData) {
        const variantId = vData.id || uuidv4();
        const openingStock = vData.openingStock || 0;
        const currentStock = openingStock;

        await db.runAsync(
          `INSERT INTO product_variants (id, storeId, productId, name, sku, barcode, size, color, purchasePricePaise, sellingPricePaise, mrpPaise, taxRatePercent, minStockLevel, openingStock, currentStock, rackLocation, preferredSupplierId, customValues, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          [
            variantId,
            storeId,
            productId,
            vData.name || '',
            vData.sku || '',
            vData.barcode ?? null,
            vData.size ?? null,
            vData.color ?? null,
            vData.purchasePricePaise ?? 0,
            vData.sellingPricePaise ?? 0,
            vData.mrpPaise ?? null,
            vData.taxRatePercent ?? 18,
            vData.minStockLevel ?? 5,
            openingStock,
            currentStock,
            vData.rackLocation ?? null,
            vData.preferredSupplierId ?? null,
            vData.customValues ? JSON.stringify(vData.customValues) : null,
            now,
            now,
          ]
        );

        if (openingStock > 0) {
          const movementId = uuidv4();
          await db.runAsync(
            `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, reason, deviceId, userId, createdAt)
             VALUES (?, ?, ?, 'opening_stock', ?, 0, ?, 'manual', 'Initial opening stock setup', ?, ?, ?);`,
            [movementId, storeId, variantId, openingStock, openingStock, deviceId, userId ?? null, now]
          );

          if (
            product.measurementType === 'length' &&
            product.pipeTrackingMethod === 'segment' &&
            product.standardLengthMm
          ) {
            const numPieces = Math.floor(openingStock / product.standardLengthMm);
            for (let i = 0; i < numPieces; i++) {
              const segId = uuidv4();
              await db.runAsync(
                `INSERT INTO pipe_segments (id, storeId, variantId, originalLengthMm, currentLengthMm, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, 'available', ?, ?);`,
                [segId, storeId, variantId, product.standardLengthMm, product.standardLengthMm, now, now]
              );
            }
          }
        }
      }
    });

    await SyncQueueRepository.enqueue(storeId, deviceId, 'product', productId, 'create', product as unknown as Record<string, unknown>);

    const created = await this.getProductsWithVariants(storeId);
    const p = created.find((item) => item.id === productId)!;
    return { product: p, variants: p.variants };
  }

  static async updateProduct(
    productId: string,
    productUpdates: Partial<Product>,
    variantsData: Array<Partial<ProductVariant>>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE products SET name = ?, brand = ?, material = ?, description = ?, modelNumber = ?, imageUrl = ?, customValues = ?, updatedAt = ?
         WHERE id = ? AND storeId = ?;`,
        [
          productUpdates.name || '',
          productUpdates.brand ?? null,
          productUpdates.material ?? null,
          productUpdates.description ?? null,
          productUpdates.modelNumber ?? null,
          productUpdates.imageUrl ?? null,
          productUpdates.customValues ? JSON.stringify(productUpdates.customValues) : null,
          now,
          productId,
          storeId,
        ]
      );

      for (const vData of variantsData) {
        if (vData.id) {
          await db.runAsync(
            `UPDATE product_variants SET name = ?, sku = ?, barcode = ?, size = ?, color = ?, purchasePricePaise = ?, sellingPricePaise = ?, taxRatePercent = ?, minStockLevel = ?, rackLocation = ?, preferredSupplierId = ?, customValues = ?, updatedAt = ?
             WHERE id = ? AND storeId = ?;`,
            [
              vData.name || '',
              vData.sku || '',
              vData.barcode ?? null,
              vData.size ?? null,
              vData.color ?? null,
              vData.purchasePricePaise ?? 0,
              vData.sellingPricePaise ?? 0,
              vData.taxRatePercent ?? 18,
              vData.minStockLevel ?? 5,
              vData.rackLocation ?? null,
              vData.preferredSupplierId ?? null,
              vData.customValues ? JSON.stringify(vData.customValues) : null,
              now,
              vData.id,
              storeId,
            ]
          );
        } else {
          const newVarId = uuidv4();
          await db.runAsync(
            `INSERT INTO product_variants (id, storeId, productId, name, sku, barcode, size, color, purchasePricePaise, sellingPricePaise, mrpPaise, taxRatePercent, minStockLevel, openingStock, currentStock, rackLocation, preferredSupplierId, customValues, active, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
            [
              newVarId,
              storeId,
              productId,
              vData.name || '',
              vData.sku || '',
              vData.barcode ?? null,
              vData.size ?? null,
              vData.color ?? null,
              vData.purchasePricePaise ?? 0,
              vData.sellingPricePaise ?? 0,
              vData.mrpPaise ?? null,
              vData.taxRatePercent ?? 18,
              vData.minStockLevel ?? 5,
              vData.openingStock ?? 0,
              vData.openingStock ?? 0,
              vData.rackLocation ?? null,
              vData.preferredSupplierId ?? null,
              vData.customValues ? JSON.stringify(vData.customValues) : null,
              now,
              now,
            ]
          );
        }
      }
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'product',
      productId,
      'update',
      { ...productUpdates, updatedAt: now }
    );
  }

  static async archiveProduct(productId: string, storeId: string, deviceId: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE products SET deletedAt = ?, active = 0, updatedAt = ? WHERE id = ? AND storeId = ?;`,
        [now, now, productId, storeId]
      );
      await db.runAsync(
        `UPDATE product_variants SET deletedAt = ?, active = 0, updatedAt = ? WHERE productId = ? AND storeId = ?;`,
        [now, now, productId, storeId]
      );
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'product',
      productId,
      'delete',
      { deletedAt: now, active: false }
    );
  }

  static async bulkImportProducts(
    rows: BulkImportProductRow[],
    storeId: string,
    deviceId: string,
    userId?: string
  ): Promise<{ importedProducts: number; importedVariants: number; skippedCount: number; errors: string[] }> {
    const db = await getDatabase();
    let importedProducts = 0;
    let importedVariants = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Check for SKU conflict in local SQLite
      const existingSku = await db.getFirstAsync<any>(
        `SELECT id FROM product_variants WHERE sku = ? AND storeId = ? AND deletedAt IS NULL;`,
        [row.sku, storeId]
      );

      if (existingSku) {
        errors.push(`Row ${i + 1}: SKU '${row.sku}' already exists. Skipped.`);
        skippedCount++;
        continue;
      }

      // Find or create Category
      let cat = await db.getFirstAsync<any>(
        `SELECT id FROM categories WHERE name = ? AND storeId = ?;`,
        [row.categoryName, storeId]
      );
      if (!cat) {
        const catId = uuidv4();
        await db.runAsync(
          `INSERT INTO categories (id, storeId, name, displayOrder, active, createdAt, updatedAt) VALUES (?, ?, ?, 0, 1, ?, ?);`,
          [catId, storeId, row.categoryName, now, now]
        );
        cat = { id: catId };
        await SyncQueueRepository.enqueue(storeId, deviceId, 'category', catId, 'create', {
          id: catId,
          storeId,
          name: row.categoryName,
        });
      }

      // Find or create Subcategory
      let subcat = await db.getFirstAsync<any>(
        `SELECT id FROM subcategories WHERE name = ? AND categoryId = ? AND storeId = ?;`,
        [row.subcategoryName, cat.id, storeId]
      );
      if (!subcat) {
        const subId = uuidv4();
        await db.runAsync(
          `INSERT INTO subcategories (id, storeId, categoryId, name, displayOrder, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, 1, ?, ?);`,
          [subId, storeId, cat.id, row.subcategoryName, now, now]
        );
        subcat = { id: subId };
        await SyncQueueRepository.enqueue(storeId, deviceId, 'subcategory', subId, 'create', {
          id: subId,
          storeId,
          categoryId: cat.id,
          name: row.subcategoryName,
        });
      }

      // Find or create Product
      let prod = await db.getFirstAsync<any>(
        `SELECT id FROM products WHERE name = ? AND categoryId = ? AND subcategoryId = ? AND storeId = ?;`,
        [row.productName, cat.id, subcat.id, storeId]
      );
      if (!prod) {
        const prodId = uuidv4();
        await db.runAsync(
          `INSERT INTO products (id, storeId, categoryId, subcategoryId, name, brand, measurementType, baseUnit, allowedUnits, active, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
          [
            prodId,
            storeId,
            cat.id,
            subcat.id,
            row.productName,
            row.brand ?? null,
            row.measurementType,
            row.baseUnit,
            JSON.stringify([row.baseUnit]),
            now,
            now,
          ]
        );
        prod = { id: prodId };
        importedProducts++;
      }

      // Create Variant
      const varId = uuidv4();
      const purchasePricePaise = rupeeToPaise(row.purchasePriceRs);
      const sellingPricePaise = rupeeToPaise(row.sellingPriceRs);

      await db.runAsync(
        `INSERT INTO product_variants (id, storeId, productId, name, sku, barcode, size, purchasePricePaise, sellingPricePaise, taxRatePercent, minStockLevel, openingStock, currentStock, rackLocation, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
        [
          varId,
          storeId,
          prod.id,
          row.variantName,
          row.sku,
          row.barcode ?? null,
          row.size ?? null,
          purchasePricePaise,
          sellingPricePaise,
          row.taxRatePercent,
          row.minStockLevel,
          row.openingStock,
          row.openingStock,
          row.rackLocation ?? null,
          now,
          now,
        ]
      );

      if (row.openingStock > 0) {
        const movementId = uuidv4();
        await db.runAsync(
          `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, reason, deviceId, userId, createdAt)
           VALUES (?, ?, ?, 'opening_stock', ?, 0, ?, 'manual', 'Bulk CSV Catalogue Import', ?, ?, ?);`,
          [movementId, storeId, varId, row.openingStock, row.openingStock, deviceId, userId ?? null, now]
        );
      }

      importedVariants++;
    }

    return { importedProducts, importedVariants, skippedCount, errors };
  }
}
