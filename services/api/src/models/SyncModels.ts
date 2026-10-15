import mongoose, { Schema, Document } from 'mongoose';
import { SyncOperation as ISyncOperation, SyncConflict as ISyncConflict } from '@hardware-store/shared';

export interface SyncOperationRecord extends Omit<ISyncOperation, 'id'>, Document {
  id: string;
}

const SyncOperationSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    operationType: { type: String, enum: ['create', 'update', 'delete'], required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'synced', 'failed'],
      default: 'synced',
    },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

SyncOperationSchema.index({ storeId: 1, _id: 1 }, { unique: true }); // Idempotency key per operation
SyncOperationSchema.index({ storeId: 1, entityType: 1, entityId: 1 });

export const SyncOperationModel = mongoose.model<SyncOperationRecord>(
  'SyncOperation',
  SyncOperationSchema
);

export interface SyncConflictRecord extends Omit<ISyncConflict, 'id'>, Document {
  id: string;
}

const SyncConflictSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    localVersion: { type: Number, required: true },
    serverVersion: { type: Number, required: true },
    localPayload: { type: Schema.Types.Mixed, required: true },
    serverPayload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolutionType: { type: String, enum: ['server_wins', 'client_wins', 'manual'] },
    resolvedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

SyncConflictSchema.index({ storeId: 1, status: 1 });

export const SyncConflictModel = mongoose.model<SyncConflictRecord>(
  'SyncConflict',
  SyncConflictSchema
);
