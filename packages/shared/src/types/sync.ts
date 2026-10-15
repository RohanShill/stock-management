import { SyncOperation } from './models.js';

export interface SyncPushRequest {
  storeId: string;
  deviceId: string;
  operations: SyncOperation[];
}

export interface SyncOperationAck {
  operationId: string;
  entityType: string;
  entityId: string;
  status: 'acknowledged' | 'rejected' | 'conflict';
  error?: string;
  serverVersion?: number;
}

export interface SyncPushResponse {
  success: boolean;
  processedCount: number;
  acknowledgements: SyncOperationAck[];
  serverTimestamp: string;
}

export interface SyncPullRequest {
  storeId: string;
  deviceId: string;
  sinceCursor?: string; // ISO UTC timestamp of last successful pull
  limit?: number;
}

export interface EntityChange {
  entityType: string;
  entityId: string;
  operationType: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  updatedAt: string;
  version: number;
}

export interface SyncPullResponse {
  changes: EntityChange[];
  newCursor: string;
  hasMore: boolean;
  serverTimestamp: string;
}

export interface SyncStatusResponse {
  storeId: string;
  lastServerActivity: string;
  activeDevicesCount: number;
  totalSyncedEntities: Record<string, number>;
}
