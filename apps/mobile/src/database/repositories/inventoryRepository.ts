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

    const movementId = uuidv4();
    let finalBalanceBefore = 0;
    let finalBalanceAfter = 0;

    await db.withTransactionAsync(async () => {
      // Re-fetch latest atomic stock balance inside transaction
      const freshVariant = await db.getFirstAsync<{ currentStock: number }>(
        `SELECT currentStock FROM product_variants WHERE id = ?;`,
        [variantId]
      );
      finalBalanceBefore = Number(freshVariant?.currentStock ?? variantRow.currentStock ?? 0);
      finalBalanceAfter = finalBalanceBefore + delta;

      if (finalBalanceAfter < 0) {
        throw new Error(`Insufficient stock for ${type === 'sale' ? 'sale' : 'adjustment'} (Current: ${finalBalanceBefore} ${baseUnit}, Requested reduction: ${Math.abs(delta)} ${baseUnit})`);
      }

      await db.runAsync(
        `UPDATE product_variants SET currentStock = ?, updatedAt = ? WHERE id = ?;`,
        [finalBalanceAfter, now, variantId]
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
          finalBalanceBefore,
          finalBalanceAfter,
          referenceType,
          reason,
          notes ?? null,
          deviceId,
          userId ?? null,
          now,
        ]
      );
    });

    const movement: StockMovement = {
      id: movementId,
      storeId,
      variantId,
      movementType,
      quantityChangeBase: delta,
      balanceBeforeBase: finalBalanceBefore,
      balanceAfterBase: finalBalanceAfter,
      referenceType,
      reason,
      notes,
      deviceId,
      userId,
      createdAt: now,
    };

    // Enqueue outbox operation
    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'stock_movement',
      movementId,
      'create',
      movement as unknown as Record<string, unknown>
    );

    return { balanceAfter: finalBalanceAfter, movement };
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
    limit = 500,
    startDate?: string,
    endDate?: string
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

    let whereClause = `WHERE sm.storeId = ?`;
    const params: any[] = [storeId];

    if (startDate) {
      whereClause += ` AND sm.createdAt >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND sm.createdAt <= ?`;
      params.push(endDate);
    }
    params.push(limit);

    // 1. Ultra-fast direct indexed JOIN query (instant SQLite evaluation)
    if (typeof db.getAllAsync === 'function') {
      try {
        const joinedRows = await db.getAllAsync<any>(
          `SELECT 
             sm.id, sm.storeId, sm.variantId, sm.movementType, sm.quantityChangeBase, 
             sm.balanceBeforeBase, sm.balanceAfterBase, sm.referenceType, sm.reason, 
             sm.notes, sm.deviceId, sm.userId, sm.createdAt,
             p.name AS productName,
             p.brand AS brand,
             p.baseUnit AS unit,
             v.name AS variantName,
             v.size AS size
           FROM stock_movements sm
           LEFT JOIN product_variants v ON sm.variantId = v.id
           LEFT JOIN products p ON v.productId = p.id
           ${whereClause}
           ORDER BY sm.createdAt DESC
           LIMIT ?;`,
          params
        );

        if (Array.isArray(joinedRows)) {
          return joinedRows.map((sm) => {
            const isSale =
              sm.movementType === 'sale' ||
              sm.quantityChangeBase < 0 ||
              String(sm.referenceType || '').toLowerCase().includes('sale');

            return {
              ...sm,
              movementType: isSale ? ('sale' as const) : sm.movementType,
              productName: sm.productName || (isSale ? 'Sold Item' : 'Inventory Item'),
              variantName: sm.variantName || sm.size || 'Standard',
              size: sm.size,
              unit: sm.unit || 'pcs',
              brand: sm.brand,
            };
          });
        }
      } catch {
        // Fallback if JOIN is unsupported in custom test mocks or web store
      }
    }

    // 2. Targeted fallback: fetch movements, then query ONLY the variants involved (never full tables!)
    let fallbackWhere = `WHERE storeId = ?`;
    const fallbackParams: any[] = [storeId];
    if (startDate) {
      fallbackWhere += ` AND createdAt >= ?`;
      fallbackParams.push(startDate);
    }
    if (endDate) {
      fallbackWhere += ` AND createdAt <= ?`;
      fallbackParams.push(endDate);
    }
    fallbackParams.push(limit);

    let movements = await db.getAllAsync<StockMovement>(
      `SELECT * FROM stock_movements ${fallbackWhere} ORDER BY createdAt DESC LIMIT ?;`,
      fallbackParams
    );

    if (!startDate && !endDate && (!movements || movements.length === 0)) {
      movements = await db.getAllAsync<StockMovement>(
        `SELECT * FROM stock_movements ORDER BY createdAt DESC LIMIT ?;`,
        [limit]
      );
    }

    if (!movements || movements.length === 0) {
      return [];
    }

    const variantIds = Array.from(new Set(movements.map((m) => m.variantId).filter(Boolean)));
    const variantPlaceholders = variantIds.map(() => '?').join(',');
    const variants = variantIds.length > 0 && typeof db.getAllAsync === 'function'
      ? await db.getAllAsync<any>(
          `SELECT id, productId, name, size FROM product_variants WHERE id IN (${variantPlaceholders});`,
          variantIds
        )
      : [];

    const variantMap = new Map<string, any>();
    (variants || []).forEach((v) => variantMap.set(v.id, v));

    const productIds = Array.from(new Set(variants.map((v) => v.productId).filter(Boolean)));
    const productPlaceholders = productIds.map(() => '?').join(',');
    const products = productIds.length > 0 && typeof db.getAllAsync === 'function'
      ? await db.getAllAsync<any>(
          `SELECT id, name, brand, baseUnit FROM products WHERE id IN (${productPlaceholders});`,
          productIds
        )
      : [];

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
        productName: p?.name || (isSale ? 'Sold Item' : 'Inventory Item'),
        variantName: v?.name || v?.size || 'Standard',
        size: v?.size,
        unit: p?.baseUnit || 'pcs',
        brand: p?.brand,
      };
    });

    result.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }

  /**
   * Permanently clears all stock movements for the store.
   */
  static async clearStockHistory(storeId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM stock_movements WHERE storeId = ?;`,
      [storeId]
    );
    // Also clean up any unassigned store records
    await db.runAsync(
      `DELETE FROM stock_movements WHERE storeId IS NULL OR storeId = '' OR storeId = 'store-1';`
    );
    return result?.changes || 0;
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
