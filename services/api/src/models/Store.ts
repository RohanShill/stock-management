import mongoose, { Schema, Document } from 'mongoose';
import { Store as IStore } from '@hardware-store/shared';

export interface StoreDocument extends Omit<IStore, 'id'>, Document {
  id: string;
}

const StoreSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    address: { type: String, required: true },
    gstin: { type: String, trim: true },
    currency: { type: String, default: 'INR' },
    defaultTaxRatePercent: { type: Number, default: 18 },
    invoicePrefix: { type: String, default: 'INV' },
    invoiceSequence: { type: Number, default: 1000 },
    negativeStockAllowed: { type: Boolean, default: false },
    pipeTrackingMethod: { type: String, enum: ['aggregate', 'segment'], default: 'aggregate' },
    costingMethod: { type: String, enum: ['weighted_average', 'fifo'], default: 'weighted_average' },
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

export const StoreModel = mongoose.model<StoreDocument>('Store', StoreSchema);
