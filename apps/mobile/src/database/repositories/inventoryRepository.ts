import { v4 as uuidv4 } from 'uuid';
import {
  StockMovement,
  StockMovementType,
  PipeSegment,
  toCanonicalBaseQuantity,
  StandardUnit,
} from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class InventoryRepository {
  static async adjustStock(
    variantId: string,
    quantityChange: number,
    unit: StandardUnit,
    type: 'increase' | 'decrease' | 'damaged' | 'loss' | 'reconciliation',
    reason: string,
    storeId: string,
    deviceId: string,
    userId?: string,
    notes?: string
  ): Promise<{ balanceAfter: number; movement: StockMovement }> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const variantRow = await db.getFirstAsync<any>(
      `SELECT v.*, p.measurementType, p.packMultiplier FROM product_variants v JOIN products p ON v.productId = p.id WHERE v.id = ? AND v.storeId = ?;`,
      [variantId, storeId]
    );

    if (!variantRow) {
      throw new Error('Product variant not found');
    }

    const baseQuantity = toCanonicalBaseQuantity(
      quantityChange,
      unit,
      variantRow.measurementType,
      variantRow.packMultiplier
    );

    let movementType: StockMovementType = 'adjustment_increase';
    let delta = baseQuantity;

    if (type === 'decrease') {
      movementType = 'adjustment_decrease';
      delta = -baseQuantity;
    } else if (type === 'damaged') {
      movementType = 'damaged_goods';
      delta = -baseQuantity;
    } else if (type === 'loss') {
      movementType = 'stock_loss';
      delta = -baseQuantity;
    }

    const balanceBefore = variantRow.currentStock;
    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {
      throw new Error(`Insufficient stock for adjustment (Current: ${balanceBefore}, Requested reduction: ${Math.abs(delta)})`);
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
      referenceType: 'adjustment',
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
          'adjustment',
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

  static async getPipeSegments(variantId: string): Promise<PipeSegment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM pipe_segments WHERE variantId = ? ORDER BY currentLengthMm ASC;`,
      [variantId]
    );
    return rows;
  }
}
