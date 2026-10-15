import {
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
} from '@hardware-store/shared';
import { SyncQueueRepository } from '../database/repositories/syncQueueRepository.js';
import { getDatabase } from '../database/db.js';
import { isDemoMode } from '../demo/demoConfig.js';

export interface SyncEngineStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  lastError: string | null;
}

export class SyncEngine {
  private static isSyncing = false;
  private static listeners: Array<(status: SyncEngineStatus) => void> = [];

  static subscribe(listener: (status: SyncEngineStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static async notify(error: string | null = null) {
    const pendingCount = await SyncQueueRepository.getPendingCount();
    const lastSyncTime = await SyncQueueRepository.getMetadata('last_sync_time');
    const status: SyncEngineStatus = {
      isSyncing: this.isSyncing,
      lastSyncTime,
      pendingCount,
      lastError: error,
    };
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /**
   * Primary synchronization workflow.
   * Runs push and pull passes with exponential retry handling.
   */
  static async synchronize(
    apiBaseUrl: string,
    authToken: string,
    storeId: string,
    deviceId: string
  ): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
    if (isDemoMode()) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        error: 'Demo Mode: Synchronization to production database is strictly disabled for security & data isolation.',
      };
    }

    if (this.isSyncing) {
      return { success: false, pushed: 0, pulled: 0, error: 'Sync already in progress' };
    }

    this.isSyncing = true;
    await this.notify();

    let pushedCount = 0;
    let pulledCount = 0;

    try {
      // 1. PUSH PASS: Read pending outbox operations
      const pendingOps = await SyncQueueRepository.getPending(50);

      if (pendingOps.length > 0) {
        const pushPayload: SyncPushRequest = {
          storeId,
          deviceId,
          operations: pendingOps,
        };

        const pushRes = await fetch(`${apiBaseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(pushPayload),
        });

        if (!pushRes.ok) {
          throw new Error(`Push failed with status ${pushRes.status}`);
        }

        const pushData = (await pushRes.json()) as SyncPushResponse;

        // Process individual acks to support partial failures safely
        for (const ack of pushData.acknowledgements) {
          if (ack.status === 'acknowledged') {
            await SyncQueueRepository.markSynced(ack.operationId);
            pushedCount++;
          } else {
            await SyncQueueRepository.markFailed(
              ack.operationId,
              ack.error || 'Server rejected operation'
            );
          }
        }
      }

      // 2. PULL PASS: Incremental changes using cursor
      const lastCursor = await SyncQueueRepository.getMetadata('server_cursor');
      const pullUrl = new URL(`${apiBaseUrl}/api/v1/sync/pull`);
      if (lastCursor) {
        pullUrl.searchParams.set('sinceCursor', lastCursor);
      }

      const pullRes = await fetch(pullUrl.toString(), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!pullRes.ok) {
        throw new Error(`Pull failed with status ${pullRes.status}`);
      }

      const pullData = (await pullRes.json()) as SyncPullResponse;
      const db = await getDatabase();

      // Apply incoming server changes to local SQLite database
      if (pullData.changes && pullData.changes.length > 0) {
        await db.withTransactionAsync(async () => {
          for (const ch of pullData.changes) {
            const data = ch.data as any;

            if (ch.entityType === 'category') {
              if (ch.operationType === 'delete') {
                await db.runAsync(`UPDATE categories SET deletedAt = ? WHERE id = ?;`, [
                  new Date().toISOString(),
                  ch.entityId,
                ]);
              } else {
                await db.runAsync(
                  `INSERT OR REPLACE INTO categories (id, storeId, name, description, active, createdAt, updatedAt, deletedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
                  [
                    data.id,
                    data.storeId,
                    data.name,
                    data.description ?? null,
                    data.active ? 1 : 0,
                    data.createdAt,
                    data.updatedAt,
                    data.deletedAt ?? null,
                  ]
                );
              }
            } else if (ch.entityType === 'product') {
              if (ch.operationType === 'delete') {
                await db.runAsync(`UPDATE products SET deletedAt = ? WHERE id = ?;`, [
                  new Date().toISOString(),
                  ch.entityId,
                ]);
              } else {
                await db.runAsync(
                  `INSERT OR REPLACE INTO products (id, storeId, categoryId, subcategoryId, name, brand, material, description, measurementType, baseUnit, allowedUnits, packMultiplier, pipeDiameterMm, standardLengthMm, pipeTrackingMethod, active, createdAt, updatedAt, deletedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                  [
                    data.id,
                    data.storeId,
                    data.categoryId,
                    data.subcategoryId,
                    data.name,
                    data.brand ?? null,
                    data.material ?? null,
                    data.description ?? null,
                    data.measurementType,
                    data.baseUnit,
                    JSON.stringify(data.allowedUnits || []),
                    data.packMultiplier ?? 1,
                    data.pipeDiameterMm ?? null,
                    data.standardLengthMm ?? null,
                    data.pipeTrackingMethod ?? null,
                    data.active ? 1 : 0,
                    data.createdAt,
                    data.updatedAt,
                    data.deletedAt ?? null,
                  ]
                );
              }
            } else if (ch.entityType === 'variant') {
              if (ch.operationType === 'delete') {
                await db.runAsync(`UPDATE product_variants SET deletedAt = ? WHERE id = ?;`, [
                  new Date().toISOString(),
                  ch.entityId,
                ]);
              } else {
                await db.runAsync(
                  `INSERT OR REPLACE INTO product_variants (id, storeId, productId, name, sku, barcode, size, color, purchasePricePaise, sellingPricePaise, mrpPaise, taxRatePercent, minStockLevel, openingStock, currentStock, rackLocation, preferredSupplierId, active, createdAt, updatedAt, deletedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                  [
                    data.id,
                    data.storeId,
                    data.productId,
                    data.name,
                    data.sku,
                    data.barcode ?? null,
                    data.size ?? null,
                    data.color ?? null,
                    data.purchasePricePaise ?? 0,
                    data.sellingPricePaise ?? 0,
                    data.mrpPaise ?? null,
                    data.taxRatePercent ?? 18,
                    data.minStockLevel ?? 5,
                    data.openingStock ?? 0,
                    data.currentStock ?? 0,
                    data.rackLocation ?? null,
                    data.preferredSupplierId ?? null,
                    data.active ? 1 : 0,
                    data.createdAt,
                    data.updatedAt,
                    data.deletedAt ?? null,
                  ]
                );
              }
            } else if (ch.entityType === 'custom_field') {
              if (ch.operationType === 'delete') {
                await db.runAsync(`UPDATE custom_field_definitions SET deletedAt = ? WHERE id = ?;`, [
                  new Date().toISOString(),
                  ch.entityId,
                ]);
              } else {
                await db.runAsync(
                  `INSERT OR REPLACE INTO custom_field_definitions (id, storeId, targetLevel, targetId, name, label, fieldType, unit, required, options, defaultValue, displayOrder, active, createdAt, updatedAt, deletedAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                  [
                    data.id,
                    data.storeId,
                    data.targetLevel,
                    data.targetId ?? null,
                    data.name,
                    data.label,
                    data.fieldType,
                    data.unit ?? null,
                    data.required ? 1 : 0,
                    data.options ? JSON.stringify(data.options) : null,
                    data.defaultValue ?? null,
                    data.displayOrder ?? 0,
                    data.active ? 1 : 0,
                    data.createdAt,
                    data.updatedAt,
                    data.deletedAt ?? null,
                  ]
                );
              }
            }
            pulledCount++;
          }
        });

        // Update high-water mark cursor
        await SyncQueueRepository.setMetadata('server_cursor', pullData.newCursor);
      }

      const now = new Date().toISOString();
      await SyncQueueRepository.setMetadata('last_sync_time', now);

      this.isSyncing = false;
      await this.notify(null);

      return { success: true, pushed: pushedCount, pulled: pulledCount };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failure';
      this.isSyncing = false;
      await this.notify(errorMsg);
      return { success: false, pushed: pushedCount, pulled: pulledCount, error: errorMsg };
    }
  }
}
