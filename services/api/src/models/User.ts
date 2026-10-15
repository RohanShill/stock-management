import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@hardware-store/shared';

export interface UserDocument extends Document {
  id: string;
  storeId: string;
  username: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  pinHash?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    username: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    passwordHash: { type: String, required: true },
    pinHash: { type: String },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret.passwordHash;
        delete ret.pinHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

UserSchema.index({ storeId: 1, username: 1 }, { unique: true });

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);

export interface DeviceDocument extends Document {
  id: string;
  storeId: string;
  deviceName: string;
  deviceIdentifier: string;
  registeredAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'revoked';
}

const DeviceSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    deviceName: { type: String, required: true },
    deviceIdentifier: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
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

DeviceSchema.index({ storeId: 1, deviceIdentifier: 1 }, { unique: true });

export const DeviceModel = mongoose.model<DeviceDocument>('Device', DeviceSchema);
