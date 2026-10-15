import mongoose, { Schema, Document } from 'mongoose';
import { Category as ICategory, Subcategory as ISubcategory } from '@hardware-store/shared';

export interface CategoryDocument extends Omit<ICategory, 'id'>, Document {
  id: string;
}

const CategorySchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    icon: { type: String },
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

CategorySchema.index({ storeId: 1, name: 1 });
CategorySchema.index({ storeId: 1, displayOrder: 1 });

export const CategoryModel = mongoose.model<CategoryDocument>('Category', CategorySchema);

export interface SubcategoryDocument extends Omit<ISubcategory, 'id'>, Document {
  id: string;
}

const SubcategorySchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
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

SubcategorySchema.index({ storeId: 1, categoryId: 1, name: 1 });
SubcategorySchema.index({ storeId: 1, categoryId: 1, displayOrder: 1 });

export const SubcategoryModel = mongoose.model<SubcategoryDocument>('Subcategory', SubcategorySchema);
