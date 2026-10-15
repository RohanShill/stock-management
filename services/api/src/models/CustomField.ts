import mongoose, { Schema, Document } from 'mongoose';
import { CustomFieldDefinition } from '@hardware-store/shared';

export interface CustomFieldDocument extends Omit<CustomFieldDefinition, 'id'>, Document {
  id: string;
}

const CustomFieldSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    targetLevel: {
      type: String,
      enum: ['category', 'subcategory', 'product', 'variant'],
      required: true,
      index: true,
    },
    targetId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    fieldType: {
      type: String,
      enum: ['text', 'number', 'decimal', 'dropdown', 'boolean', 'multiselect'],
      required: true,
    },
    unit: { type: String },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    defaultValue: { type: String },
    displayOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date },
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

CustomFieldSchema.index({ storeId: 1, targetLevel: 1, targetId: 1, displayOrder: 1 });

export const CustomFieldModel = mongoose.model<CustomFieldDocument>(
  'CustomField',
  CustomFieldSchema
);
