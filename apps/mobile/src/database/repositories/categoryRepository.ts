import { v4 as uuidv4 } from '../../utils/uuid.js';
import { Category, Subcategory } from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class CategoryRepository {
  static async getCategories(storeId: string, includeArchived = false): Promise<Category[]> {
    const db = await getDatabase();
    let sql = `SELECT * FROM categories WHERE storeId = ?`;
    if (!includeArchived) {
      sql += ` AND deletedAt IS NULL AND active = 1`;
    }
    sql += ` ORDER BY displayOrder ASC, name ASC;`;

    const rows = await db.getAllAsync<any>(sql, [storeId]);
    return rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
      displayOrder: r.displayOrder ?? 0,
    }));
  }

  static async createCategory(
    category: Partial<Category>,
    storeId: string,
    deviceId: string
  ): Promise<Category> {
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
      [
        id,
        storeId,
        record.name,
        record.description ?? null,
        record.icon ?? null,
        record.displayOrder,
        now,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'category',
      id,
      'create',
      record as unknown as Record<string, unknown>
    );

    return record;
  }

  static async updateCategory(
    id: string,
    updates: Partial<Category>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync<any>(
      `SELECT * FROM categories WHERE id = ? AND storeId = ?;`,
      [id, storeId]
    );
    if (!existing) throw new Error('Category not found');

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const icon = updates.icon !== undefined ? updates.icon : existing.icon;
    const displayOrder = updates.displayOrder !== undefined ? updates.displayOrder : existing.displayOrder;
    const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active;

    await db.runAsync(
      `UPDATE categories SET name = ?, description = ?, icon = ?, displayOrder = ?, active = ?, updatedAt = ? WHERE id = ?;`,
      [name, description ?? null, icon ?? null, displayOrder, active, now, id]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'category',
      id,
      'update',
      { name, description, icon, displayOrder, active: Boolean(active), updatedAt: now }
    );
  }

  static async reorderCategories(
    items: Array<{ id: string; displayOrder: number }>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          `UPDATE categories SET displayOrder = ? WHERE id = ? AND storeId = ?;`,
          [item.displayOrder, item.id, storeId]
        );
      }
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'category',
      'reorder',
      'update',
      { items }
    );
  }

  static async getAffectedCounts(categoryId: string, storeId: string): Promise<{ subcategoriesCount: number; productsCount: number }> {
    const db = await getDatabase();
    const subcats = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM subcategories WHERE categoryId = ? AND storeId = ? AND deletedAt IS NULL;`,
      [categoryId, storeId]
    );
    const prods = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE categoryId = ? AND storeId = ? AND deletedAt IS NULL;`,
      [categoryId, storeId]
    );
    return {
      subcategoriesCount: subcats?.count || 0,
      productsCount: prods?.count || 0,
    };
  }

  static async archiveCategory(id: string, storeId: string, deviceId: string): Promise<{ subcategoriesCount: number; productsCount: number }> {
    const db = await getDatabase();
    const counts = await this.getAffectedCounts(id, storeId);
    const now = new Date().toISOString();

    // 1. Soft-delete category
    await db.runAsync(
      `UPDATE categories SET deletedAt = ?, active = 0, updatedAt = ? WHERE id = ? AND storeId = ?;`,
      [now, now, id, storeId]
    );

    // 2. Soft-delete subcategories
    await db.runAsync(
      `UPDATE subcategories SET deletedAt = ?, active = 0, updatedAt = ? WHERE categoryId = ? AND storeId = ?;`,
      [now, now, id, storeId]
    );

    // 3. Find products under this category to cascade soft-delete variants
    const prods = await db.getAllAsync<any>(
      `SELECT id FROM products WHERE categoryId = ? AND storeId = ?;`,
      [id, storeId]
    );
    if (prods && prods.length > 0) {
      for (const p of prods) {
        await db.runAsync(
          `UPDATE product_variants SET deletedAt = ?, active = 0, updatedAt = ? WHERE storeId = ? AND productId = ?;`,
          [now, now, storeId, p.id]
        );
      }
    }

    // 4. Soft-delete products
    await db.runAsync(
      `UPDATE products SET deletedAt = ?, active = 0, updatedAt = ? WHERE categoryId = ? AND storeId = ?;`,
      [now, now, id, storeId]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'category',
      id,
      'delete',
      { deletedAt: now, active: false }
    );

    return counts;
  }

  // ----------------------------------------------------
  // Subcategories
  // ----------------------------------------------------

  static async getSubcategories(
    categoryId?: string,
    storeId?: string,
    includeArchived = false
  ): Promise<Subcategory[]> {
    const db = await getDatabase();
    let sql = `SELECT * FROM subcategories WHERE 1=1`;
    const params: any[] = [];

    if (storeId) {
      sql += ` AND storeId = ?`;
      params.push(storeId);
    }
    if (categoryId) {
      sql += ` AND categoryId = ?`;
      params.push(categoryId);
    }
    if (!includeArchived) {
      sql += ` AND deletedAt IS NULL AND active = 1`;
    }
    sql += ` ORDER BY displayOrder ASC, name ASC;`;

    const rows = await db.getAllAsync<any>(sql, params);
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
      [
        id,
        storeId,
        record.categoryId,
        record.name,
        record.description ?? null,
        record.displayOrder,
        now,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'subcategory',
      id,
      'create',
      record as unknown as Record<string, unknown>
    );

    return record;
  }

  static async updateSubcategory(
    id: string,
    updates: Partial<Subcategory>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync<any>(
      `SELECT * FROM subcategories WHERE id = ? AND storeId = ?;`,
      [id, storeId]
    );
    if (!existing) throw new Error('Subcategory not found');

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const categoryId = updates.categoryId !== undefined ? updates.categoryId : existing.categoryId;
    const displayOrder = updates.displayOrder !== undefined ? updates.displayOrder : existing.displayOrder;
    const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE subcategories SET categoryId = ?, name = ?, description = ?, displayOrder = ?, active = ?, updatedAt = ? WHERE id = ?;`,
        [categoryId, name, description ?? null, displayOrder, active, now, id]
      );

      // If parent categoryId changed, update associated products parent categoryId
      if (categoryId !== existing.categoryId) {
        await db.runAsync(
          `UPDATE products SET categoryId = ? WHERE subcategoryId = ? AND storeId = ?;`,
          [categoryId, id, storeId]
        );
      }
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'subcategory',
      id,
      'update',
      { categoryId, name, description, displayOrder, active: Boolean(active), updatedAt: now }
    );
  }

  static async moveSubcategory(
    id: string,
    targetCategoryId: string,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    await this.updateSubcategory(id, { categoryId: targetCategoryId }, storeId, deviceId);
  }

  static async reorderSubcategories(
    items: Array<{ id: string; displayOrder: number }>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          `UPDATE subcategories SET displayOrder = ? WHERE id = ? AND storeId = ?;`,
          [item.displayOrder, item.id, storeId]
        );
      }
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'subcategory',
      'reorder',
      'update',
      { items }
    );
  }

  static async archiveSubcategory(id: string, storeId: string, deviceId: string): Promise<number> {
    const db = await getDatabase();
    const prods = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM products WHERE subcategoryId = ? AND storeId = ? AND deletedAt IS NULL;`,
      [id, storeId]
    );
    const count = prods?.count || 0;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Cascade soft-delete variants under products of this subcategory
      await db.runAsync(
        `UPDATE product_variants SET deletedAt = ?, active = 0, updatedAt = ? 
         WHERE storeId = ? AND productId IN (SELECT id FROM products WHERE subcategoryId = ? AND storeId = ?);`,
        [now, now, storeId, id, storeId]
      );

      // 2. Cascade soft-delete products under this subcategory
      await db.runAsync(
        `UPDATE products SET deletedAt = ?, active = 0, updatedAt = ? WHERE subcategoryId = ? AND storeId = ?;`,
        [now, now, id, storeId]
      );

      // 3. Soft-delete subcategory
      await db.runAsync(
        `UPDATE subcategories SET deletedAt = ?, active = 0, updatedAt = ? WHERE id = ? AND storeId = ?;`,
        [now, now, id, storeId]
      );
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'subcategory',
      id,
      'delete',
      { deletedAt: now, active: false }
    );

    return count;
  }
}
