import { v4 as uuidv4 } from '../../utils/uuid.js';
import {
  StockMovement,
  StockMovementType,
  PipeSegment,
  convertQuantityToProductUnit,
  StandardUnit,
} from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class InventoryRepository {
  static async adjustStock(
    variantId: string,
    quantityChange: number,
    unit: StandardUnit,
    type: 'increase' | 'decrease' | 'sale' | 'damaged' | 'loss' | 'reconciliation',
    reason: string,
    storeId: string,
    deviceId: string,
    userId?: string,
    notes?: string
  ): Promise<{ balanceAfter: number; movement: StockMovement }> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const variantRow = await db.getFirstAsync<any>(
      `SELECT * FROM product_variants WHERE id = ?;`,
      [variantId]
    );

    if (!variantRow) {
      throw new Error('Product variant not found');
    }

    const productRow = await db.getFirstAsync<any>(
      `SELECT * FROM products WHERE id = ?;`,
      [variantRow.productId]
    );

    const measurementType = productRow?.measurementType || 'count';
    const packMultiplier = productRow?.packMultiplier || 1;
    const baseUnit = productRow?.baseUnit || 'piece';

    const deltaQuantity = convertQuantityToProductUnit(
      quantityChange,
      unit,
      baseUnit,
      measurementType,
      packMultiplier
    );

    let movementType: StockMovementType = 'adjustment_increase';
    let delta = deltaQuantity;
    let referenceType: 'sale' | 'purchase' | 'adjustment' | 'return' | 'manual' = 'adjustment';

    if (type === 'sale') {
      movementType = 'sale';
      delta = -deltaQuantity;
      referenceType = 'sale';
    } else if (type === 'decrease') {
      movementType = 'adjustment_decrease';
      delta = -deltaQuantity;
    } else if (type === 'damaged') {
      movementType = 'damaged_goods';
      delta = -deltaQuantity;
    } else if (type === 'loss') {
      movementType = 'stock_loss';
      delta = -deltaQuantity;
    }

    const balanceBefore = variantRow.currentStock;
    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {
      throw new Error(`Insufficient stock for ${type === 'sale' ? 'sale' : 'adjustment'} (Current: ${balanceBefore} ${baseUnit}, Requested reduction: ${Math.abs(delta)} ${baseUnit})`);
    }

    const movementId = uuidv4();
    const movement: StockMovement = {
      id: movementId,
      storeId,
      variantId,
      movementType,
      quantityChangeBase: delta,
      balanceBeforeBase: balanceBefore,
      balanceAfterBase: balanceAfter,
      referenceType,
      reason,
      notes,
      deviceId,
      userId,
      createdAt: now,
    };

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE product_variants SET currentStock = ?, updatedAt = ? WHERE id = ?;`,
        [balanceAfter, now, variantId]
      );

      await db.runAsync(
        `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, reason, notes, deviceId, userId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          movementId,
          storeId,
          variantId,
          movementType,
          delta,
          balanceBefore,
          balanceAfter,
          referenceType,
          reason,
          notes ?? null,
          deviceId,
          userId ?? null,
          now,
        ]
      );
    });

    // Enqueue outbox operation
    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'stock_movement',
      movementId,
      'create',
      movement as unknown as Record<string, unknown>
    );

    return { balanceAfter, movement };
  }

  static async getStockLedger(variantId: string, limit = 50): Promise<StockMovement[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM stock_movements WHERE variantId = ? ORDER BY createdAt DESC LIMIT ?;`,
      [variantId, limit]
    );
    return rows;
  }

  static async getAllStockHistory(
    storeId: string,
    limit = 100
  ): Promise<
    Array<
      StockMovement & {
        productName: string;
        variantName: string;
        size?: string;
        unit: string;
        brand?: string;
      }
    >
  > {
    const db = await getDatabase();
    // 1. Fetch raw stock movements for store
    let movements = await db.getAllAsync<StockMovement>(
      `SELECT * FROM stock_movements WHERE storeId = ? ORDER BY createdAt DESC LIMIT ?;`,
      [storeId, limit]
    );

    // Fallback: If 0 movements found with storeId filter, fetch all stock movements
    if (!movements || movements.length === 0) {
      movements = await db.getAllAsync<StockMovement>(
        `SELECT * FROM stock_movements ORDER BY createdAt DESC LIMIT ?;`,
        [limit]
      );
    }

    if (!movements || movements.length === 0) {
      return [];
    }

    // 2. Fetch variants and products for in-memory resolution (100% cross-platform)
    const [variants, products] = await Promise.all([
      db.getAllAsync<any>(`SELECT * FROM product_variants;`),
      db.getAllAsync<any>(`SELECT * FROM products;`),
    ]);

    const variantMap = new Map<string, any>();
    (variants || []).forEach((v) => variantMap.set(v.id, v));

    const productMap = new Map<string, any>();
    (products || []).forEach((p) => productMap.set(p.id, p));

    const result = movements.map((sm) => {
      const v = variantMap.get(sm.variantId);
      const p = v ? productMap.get(v.productId) : null;
      const isSale =
        sm.movementType === 'sale' ||
        sm.quantityChangeBase < 0 ||
        String(sm.referenceType || '').toLowerCase().includes('sale');

      return {
        ...sm,
        movementType: isSale ? ('sale' as const) : sm.movementType,
        productName: p?.name || (isSale ? 'Sold Hardware Item' : 'Hardware Item'),
        variantName: v?.name || v?.size || 'Standard',
        size: v?.size,
        unit: p?.baseUnit || 'pcs',
        brand: p?.brand,
      };
    });

    // Ensure sorted by createdAt DESC
    result.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }

  static async getPipeSegments(variantId: string): Promise<PipeSegment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM pipe_segments WHERE variantId = ? ORDER BY currentLengthMm ASC;`,
      [variantId]
    );
    return rows;
  }
}
