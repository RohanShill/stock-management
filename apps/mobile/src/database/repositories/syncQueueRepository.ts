import { v4 as uuidv4 } from '../../utils/uuid.js';
import { SyncOperation, SyncEntityType, SyncOperationType } from '@hardware-store/shared';
import { getDatabase } from '../db.js';

export class SyncQueueRepository {
  static async enqueue(
    storeId: string,
    deviceId: string,
    entityType: SyncEntityType,
    entityId: string,
    operationType: SyncOperationType,
    payload: Record<string, unknown>
  ): Promise<string> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_queue (id, storeId, deviceId, entityType, entityId, operationType, payload, status, retryCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?);`,
      [
        id,
        storeId,
        deviceId,
        entityType,
        entityId,
        operationType,
        JSON.stringify(payload),
        now,
        now,
      ]
    );

    return id;
  }

  static async getPending(limit = 50): Promise<SyncOperation[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM sync_queue WHERE status = 'pending' OR status = 'failed' ORDER BY createdAt ASC LIMIT ?;`,
      [limit]
    );

    return rows.map((r) => {
      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(r.payload || '{}');
      } catch {
        parsedPayload = {};
      }

      return {
        id: r.id,
        storeId: r.storeId,
        deviceId: r.deviceId,
        entityType: r.entityType as SyncEntityType,
        entityId: r.entityId,
        operationType: r.operationType as SyncOperationType,
        payload: parsedPayload,
        status: r.status,
        retryCount: r.retryCount,
        lastError: r.lastError,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  static async markSynced(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'synced', updatedAt = ? WHERE id = ?;`,
      [new Date().toISOString(), id]
    );
  }

  static async markFailed(id: string, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'failed', retryCount = retryCount + 1, lastError = ?, updatedAt = ? WHERE id = ?;`,
      [error, new Date().toISOString(), id]
    );
  }

  static async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status != 'synced';`
    );
    return row?.count ?? 0;
  }

  static async getMetadata(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?;`,
      [key]
    );
    return row?.value ?? null;
  }

  static async setMetadata(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updatedAt) VALUES (?, ?, ?);`,
      [key, value, new Date().toISOString()]
    );
  }
}
