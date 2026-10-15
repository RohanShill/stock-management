import { z } from 'zod';

export const measurementTypeSchema = z.enum(['count', 'length', 'weight', 'volume', 'pack']);

export const standardUnitSchema = z.enum([
  'piece',
  'set',
  'box',
  'pack',
  'mm',
  'cm',
  'm',
  'ft',
  'inch',
  'g',
  'kg',
  'ml',
  'l',
]);

export const registerStoreSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(3, 'Address is required'),
  gstin: z.string().optional().or(z.literal('')),
  deviceName: z.string().default('Main Terminal'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().optional(),
});

export const pinUnlockSchema = z.object({
  pin: z.string().length(4, 'PIN must be 4 digits'),
  userId: z.string(),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  displayOrder: z.number().default(0),
});

export const updateCategorySchema = categorySchema.partial().extend({
  active: z.boolean().optional(),
});

export const subcategorySchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(1, 'Subcategory name is required'),
  description: z.string().optional(),
  displayOrder: z.number().default(0),
});

export const updateSubcategorySchema = subcategorySchema.partial().extend({
  active: z.boolean().optional(),
});

export const reorderItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      displayOrder: z.number(),
    })
  ).min(1),
});

export const moveSubcategorySchema = z.object({
  targetCategoryId: z.string().min(1, 'Target Category ID is required'),
});

export const customFieldSchema = z.object({
  name: z.string().min(1, 'Field name/key is required'),
  label: z.string().min(1, 'Field label is required'),
  targetLevel: z.enum(['category', 'subcategory', 'product', 'variant']),
  targetId: z.string().optional(),
  fieldType: z.enum(['text', 'number', 'decimal', 'dropdown', 'boolean', 'multiselect']),
  unit: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  defaultValue: z.string().optional(),
  displayOrder: z.number().default(0),
});

export const updateCustomFieldSchema = customFieldSchema.partial().extend({
  active: z.boolean().optional(),
});

export const productVariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  purchasePricePaise: z.number().nonnegative(),
  sellingPricePaise: z.number().nonnegative(),
  mrpPaise: z.number().nonnegative().optional(),
  taxRatePercent: z.number().nonnegative().default(18),
  minStockLevel: z.number().nonnegative().default(5),
  openingStock: z.number().default(0),
  rackLocation: z.string().optional(),
  preferredSupplierId: z.string().optional(),
  customValues: z.record(z.any()).optional(),
});

export const productSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  subcategoryId: z.string().min(1, 'Subcategory is required'),
  name: z.string().min(1, 'Product name is required'),
  brand: z.string().optional(),
  material: z.string().optional(),
  description: z.string().optional(),
  modelNumber: z.string().optional(),
  imageUrl: z.string().optional(),
  measurementType: measurementTypeSchema,
  baseUnit: standardUnitSchema,
  allowedUnits: z.array(standardUnitSchema).min(1),
  packMultiplier: z.number().positive().optional(),
  pipeDiameterMm: z.number().positive().optional(),
  standardLengthMm: z.number().positive().optional(),
  pipeTrackingMethod: z.enum(['aggregate', 'segment']).optional(),
  customValues: z.record(z.any()).optional(),
  variants: z.array(productVariantSchema).min(1, 'At least one variant is required'),
});

export const bulkImportProductRowSchema = z.object({
  categoryName: z.string().min(1, 'Category name is required'),
  subcategoryName: z.string().min(1, 'Subcategory name is required'),
  productName: z.string().min(1, 'Product name is required'),
  brand: z.string().optional(),
  measurementType: measurementTypeSchema.default('count'),
  baseUnit: standardUnitSchema.default('piece'),
  variantName: z.string().min(1, 'Variant name is required'),
  sku: z.string().min(1, 'SKU is required'),
  size: z.string().optional(),
  purchasePriceRs: z.number().nonnegative().default(0),
  sellingPriceRs: z.number().nonnegative().default(0),
  taxRatePercent: z.number().nonnegative().default(18),
  openingStock: z.number().nonnegative().default(0),
  minStockLevel: z.number().nonnegative().default(5),
  rackLocation: z.string().optional(),
  barcode: z.string().optional(),
});

export const stockAdjustmentSchema = z.object({
  variantId: z.string().min(1, 'Product variant is required'),
  adjustmentType: z.enum(['increase', 'decrease', 'damaged', 'loss', 'reconciliation']),
  quantityChange: z.number().positive('Quantity must be greater than 0'),
  unit: standardUnitSchema,
  reason: z.string().min(2, 'Reason is mandatory for stock adjustments'),
  notes: z.string().optional(),
});

export const saleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive(),
  unit: standardUnitSchema,
  unitPricePaise: z.number().nonnegative(),
  discountPaise: z.number().nonnegative().default(0),
  taxRatePercent: z.number().nonnegative().default(0),
  pipeCutSummary: z.string().optional(),
});

export const saleSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  saleDate: z.string(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required in a sale'),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'credit', 'bank_transfer']),
  paidAmountPaise: z.number().nonnegative(),
  invoiceDiscountPaise: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const purchaseItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive(),
  unit: standardUnitSchema,
  unitCostPaise: z.number().nonnegative(),
  taxRatePercent: z.number().nonnegative().default(0),
  pipeLengthPerPieceMm: z.number().positive().optional(),
  numberOfPieces: z.number().positive().optional(),
});

export const purchaseSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, 'Supplier bill/invoice number is required'),
  supplierId: z.string().optional(),
  purchaseDate: z.string(),
  status: z.enum(['draft', 'received']),
  items: z.array(purchaseItemSchema).min(1, 'At least one purchase item is required'),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'credit', 'cheque']),
  paidAmountPaise: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  businessName: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier contact person is required'),
  businessName: z.string().optional(),
  phone: z.string().min(5, 'Valid phone number is required'),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  category: z.enum(['transport', 'rent', 'electricity', 'salary', 'packaging', 'maintenance', 'miscellaneous']),
  amountPaise: z.number().positive('Amount must be positive'),
  date: z.string(),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'card']),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
});
