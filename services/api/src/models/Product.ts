import mongoose, { Schema, Document } from 'mongoose';
import {
  Product as IProduct,
  ProductVariant as IProductVariant,
  StockMovement as IStockMovement,
  PipeSegment as IPipeSegment,
} from '@hardware-store/shared';

export interface ProductDocument extends Omit<IProduct, 'id'>, Document {
  id: string;
}

const ProductSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    subcategoryId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    material: { type: String, trim: true },
    description: { type: String },
    modelNumber: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    measurementType: {
      type: String,
      enum: ['count', 'length', 'weight', 'volume', 'pack'],
      required: true,
    },
    baseUnit: { type: String, required: true },
    allowedUnits: [{ type: String, required: true }],
    packMultiplier: { type: Number, default: 1 },
    pipeDiameterMm: { type: Number },
    standardLengthMm: { type: Number },
    pipeTrackingMethod: { type: String, enum: ['aggregate', 'segment'] },
    customValues: { type: Schema.Types.Mixed },
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

ProductSchema.index({ storeId: 1, name: 1 });
ProductSchema.index({ storeId: 1, brand: 1 });

export const ProductModel = mongoose.model<ProductDocument>('Product', ProductSchema);

export interface ProductVariantDocument extends Omit<IProductVariant, 'id'>, Document {
  id: string;
}

const ProductVariantSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    size: { type: String },
    color: { type: String },
    purchasePricePaise: { type: Number, required: true, default: 0 },
    sellingPricePaise: { type: Number, required: true, default: 0 },
    mrpPaise: { type: Number },
    taxRatePercent: { type: Number, default: 18 },
    minStockLevel: { type: Number, default: 5 },
    openingStock: { type: Number, default: 0 },
    currentStock: { type: Number, default: 0 },
    rackLocation: { type: String },
    preferredSupplierId: { type: String },
    customValues: { type: Schema.Types.Mixed },
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

ProductVariantSchema.index({ storeId: 1, sku: 1 }, { unique: true });
ProductVariantSchema.index({ storeId: 1, barcode: 1 }, { sparse: true });
ProductVariantSchema.index({ storeId: 1, currentStock: 1 });

export const ProductVariantModel = mongoose.model<ProductVariantDocument>(
  'ProductVariant',
  ProductVariantSchema
);

export interface StockMovementDocument extends Omit<IStockMovement, 'id'>, Document {
  id: string;
}

const StockMovementSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    variantId: { type: String, required: true, index: true },
    movementType: {
      type: String,
      enum: [
        'opening_stock',
        'purchase_received',
        'sale',
        'sale_return',
        'purchase_return',
        'adjustment_increase',
        'adjustment_decrease',
        'damaged_goods',
        'stock_loss',
        'reconciliation',
        'reversal',
      ],
      required: true,
    },
    quantityChangeBase: { type: Number, required: true },
    balanceBeforeBase: { type: Number, required: true },
    balanceAfterBase: { type: Number, required: true },
    referenceType: { type: String, enum: ['sale', 'purchase', 'adjustment', 'return', 'manual'] },
    referenceId: { type: String },
    reason: { type: String },
    notes: { type: String },
    deviceId: { type: String },
    userId: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

StockMovementSchema.index({ storeId: 1, variantId: 1, createdAt: -1 });

export const StockMovementModel = mongoose.model<StockMovementDocument>(
  'StockMovement',
  StockMovementSchema
);

export interface PipeSegmentDocument extends Omit<IPipeSegment, 'id'>, Document {
  id: string;
}

const PipeSegmentSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    variantId: { type: String, required: true, index: true },
    originalLengthMm: { type: Number, required: true },
    currentLengthMm: { type: Number, required: true },
    batchNumber: { type: String },
    purchaseId: { type: String },
    status: {
      type: String,
      enum: ['available', 'consumed', 'damaged', 'discarded'],
      default: 'available',
      index: true,
    },
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

PipeSegmentSchema.index({ storeId: 1, variantId: 1, status: 1 });

export const PipeSegmentModel = mongoose.model<PipeSegmentDocument>(
  'PipeSegment',
  PipeSegmentSchema
);
