import { v4 as uuidv4 } from 'uuid';
import { CustomFieldDefinition, CustomFieldTargetLevel } from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export class CustomFieldRepository {
  static async getCustomFields(
    storeId: string,
    targetLevel?: CustomFieldTargetLevel,
    targetId?: string,
    includeArchived = false
  ): Promise<CustomFieldDefinition[]> {
    const db = await getDatabase();
    let sql = `SELECT * FROM custom_field_definitions WHERE storeId = ?`;
    const params: any[] = [storeId];

    if (!includeArchived) {
      sql += ` AND deletedAt IS NULL AND active = 1`;
    }
    if (targetLevel) {
      sql += ` AND targetLevel = ?`;
      params.push(targetLevel);
    }
    if (targetId) {
      sql += ` AND (targetId = ? OR targetId IS NULL)`;
      params.push(targetId);
    }
    sql += ` ORDER BY displayOrder ASC, label ASC;`;

    const rows = await db.getAllAsync<any>(sql, params);
    return rows.map((r) => ({
      ...r,
      required: Boolean(r.required),
      active: Boolean(r.active),
      options: r.options ? JSON.parse(r.options) : undefined,
      displayOrder: r.displayOrder ?? 0,
    }));
  }

  static async createCustomField(
    data: Partial<CustomFieldDefinition>,
    storeId: string,
    deviceId: string
  ): Promise<CustomFieldDefinition> {
    const db = await getDatabase();
    const id = data.id || uuidv4();
    const now = new Date().toISOString();

    const record: CustomFieldDefinition = {
      id,
      storeId,
      targetLevel: data.targetLevel!,
      targetId: data.targetId,
      name: data.name!,
      label: data.label!,
      fieldType: data.fieldType!,
      unit: data.unit,
      required: data.required || false,
      options: data.options,
      defaultValue: data.defaultValue,
      displayOrder: data.displayOrder ?? 0,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO custom_field_definitions (id, storeId, targetLevel, targetId, name, label, fieldType, unit, required, options, defaultValue, displayOrder, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        id,
        storeId,
        record.targetLevel,
        record.targetId ?? null,
        record.name,
        record.label,
        record.fieldType,
        record.unit ?? null,
        record.required ? 1 : 0,
        record.options ? JSON.stringify(record.options) : null,
        record.defaultValue ?? null,
        record.displayOrder,
        now,
        now,
      ]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'custom_field',
      id,
      'create',
      record as unknown as Record<string, unknown>
    );

    return record;
  }

  static async updateCustomField(
    id: string,
    updates: Partial<CustomFieldDefinition>,
    storeId: string,
    deviceId: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const existing = await db.getFirstAsync<any>(
      `SELECT * FROM custom_field_definitions WHERE id = ? AND storeId = ?;`,
      [id, storeId]
    );
    if (!existing) throw new Error('Custom field definition not found');

    const label = updates.label !== undefined ? updates.label : existing.label;
    const unit = updates.unit !== undefined ? updates.unit : existing.unit;
    const required = updates.required !== undefined ? (updates.required ? 1 : 0) : existing.required;
    const options = updates.options !== undefined ? JSON.stringify(updates.options) : existing.options;
    const defaultValue = updates.defaultValue !== undefined ? updates.defaultValue : existing.defaultValue;
    const displayOrder = updates.displayOrder !== undefined ? updates.displayOrder : existing.displayOrder;
    const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active;

    await db.runAsync(
      `UPDATE custom_field_definitions SET label = ?, unit = ?, required = ?, options = ?, defaultValue = ?, displayOrder = ?, active = ?, updatedAt = ? WHERE id = ?;`,
      [label, unit ?? null, required, options ?? null, defaultValue ?? null, displayOrder, active, now, id]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'custom_field',
      id,
      'update',
      { label, unit, required: Boolean(required), options: updates.options, defaultValue, displayOrder, active: Boolean(active), updatedAt: now }
    );
  }

  static async archiveCustomField(id: string, storeId: string, deviceId: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE custom_field_definitions SET deletedAt = ?, active = 0, updatedAt = ? WHERE id = ? AND storeId = ?;`,
      [now, now, id, storeId]
    );

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'custom_field',
      id,
      'delete',
      { deletedAt: now, active: false }
    );
  }
}
