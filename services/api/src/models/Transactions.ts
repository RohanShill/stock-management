import mongoose, { Schema, Document } from 'mongoose';
import {
  Supplier as ISupplier,
  Customer as ICustomer,
  Purchase as IPurchase,
  Sale as ISale,
  Expense as IExpense,
} from '@hardware-store/shared';

// Supplier
export interface SupplierDocument extends Omit<ISupplier, 'id'>, Document {
  id: string;
}

const SupplierSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String },
    gstin: { type: String, trim: true },
    notes: { type: String },
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

SupplierSchema.index({ storeId: 1, name: 1 });
export const SupplierModel = mongoose.model<SupplierDocument>('Supplier', SupplierSchema);

// Customer
export interface CustomerDocument extends Omit<ICustomer, 'id'>, Document {
  id: string;
}

const CustomerSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String },
    businessName: { type: String, trim: true },
    gstin: { type: String, trim: true },
    notes: { type: String },
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

CustomerSchema.index({ storeId: 1, name: 1 });
CustomerSchema.index({ storeId: 1, phone: 1 });
export const CustomerModel = mongoose.model<CustomerDocument>('Customer', CustomerSchema);

// Purchase
export interface PurchaseDocument extends Omit<IPurchase, 'id'>, Document {
  id: string;
}

const PurchaseItemSubSchema = new Schema(
  {
    _id: { type: String, required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    quantityBase: { type: Number, required: true },
    unitCostPaise: { type: Number, required: true },
    taxRatePercent: { type: Number, default: 0 },
    totalPaise: { type: Number, required: true },
    pipeLengthPerPieceMm: { type: Number },
    numberOfPieces: { type: Number },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    supplierId: { type: String, index: true },
    purchaseDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'received', 'cancelled'], default: 'received' },
    totalTaxablePaise: { type: Number, required: true },
    totalTaxPaise: { type: Number, required: true },
    grandTotalPaise: { type: Number, required: true },
    paidAmountPaise: { type: Number, required: true },
    outstandingPaise: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    notes: { type: String },
    deviceId: { type: String, required: true },
    items: [PurchaseItemSubSchema],
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

PurchaseSchema.index({ storeId: 1, purchaseDate: -1 });
export const PurchaseModel = mongoose.model<PurchaseDocument>('Purchase', PurchaseSchema);

// Sale
export interface SaleDocument extends Omit<ISale, 'id'>, Document {
  id: string;
}

const SaleItemSubSchema = new Schema(
  {
    _id: { type: String, required: true },
    variantId: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    quantityBase: { type: Number, required: true },
    unitPricePaise: { type: Number, required: true },
    discountPaise: { type: Number, default: 0 },
    taxRatePercent: { type: Number, default: 0 },
    totalPaise: { type: Number, required: true },
    pipeCutSummary: { type: String },
  },
  { _id: false }
);

const SaleSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: String, index: true },
    customerName: { type: String },
    customerPhone: { type: String },
    saleDate: { type: Date, required: true },
    status: { type: String, enum: ['draft', 'completed', 'reversed'], default: 'completed' },
    subtotalGrossPaise: { type: Number, required: true },
    totalDiscountPaise: { type: Number, default: 0 },
    totalTaxablePaise: { type: Number, required: true },
    totalTaxPaise: { type: Number, default: 0 },
    roundOffPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, required: true },
    paidAmountPaise: { type: Number, required: true },
    outstandingPaise: { type: Number, default: 0 },
    paymentMethod: { type: String, required: true },
    notes: { type: String },
    deviceId: { type: String, required: true },
    userId: { type: String },
    items: [SaleItemSubSchema],
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

SaleSchema.index({ storeId: 1, invoiceNumber: 1 });
SaleSchema.index({ storeId: 1, saleDate: -1 });
export const SaleModel = mongoose.model<SaleDocument>('Sale', SaleSchema);

// Expense
export interface ExpenseDocument extends Omit<IExpense, 'id'>, Document {
  id: string;
}

const ExpenseSchema = new Schema<any>(
  {
    _id: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['transport', 'rent', 'electricity', 'salary', 'packaging', 'maintenance', 'miscellaneous'],
      required: true,
    },
    amountPaise: { type: Number, required: true },
    date: { type: Date, required: true },
    paymentMethod: { type: String, required: true },
    description: { type: String, required: true },
    reference: { type: String },
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

ExpenseSchema.index({ storeId: 1, date: -1 });
export const ExpenseModel = mongoose.model<ExpenseDocument>('Expense', ExpenseSchema);
