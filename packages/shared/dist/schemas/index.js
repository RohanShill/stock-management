"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseSchema = exports.supplierSchema = exports.customerSchema = exports.purchaseSchema = exports.purchaseItemSchema = exports.saleSchema = exports.saleItemSchema = exports.stockAdjustmentSchema = exports.bulkImportProductRowSchema = exports.productSchema = exports.productVariantSchema = exports.updateCustomFieldSchema = exports.customFieldSchema = exports.moveSubcategorySchema = exports.reorderItemsSchema = exports.updateSubcategorySchema = exports.subcategorySchema = exports.updateCategorySchema = exports.categorySchema = exports.pinUnlockSchema = exports.loginSchema = exports.registerStoreSchema = exports.standardUnitSchema = exports.measurementTypeSchema = void 0;
const zod_1 = require("zod");
exports.measurementTypeSchema = zod_1.z.enum(['count', 'length', 'weight', 'volume', 'pack']);
exports.standardUnitSchema = zod_1.z.enum([
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
exports.registerStoreSchema = zod_1.z.object({
    storeName: zod_1.z.string().min(2, 'Store name must be at least 2 characters'),
    ownerName: zod_1.z.string().min(2, 'Owner name must be at least 2 characters'),
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    phone: zod_1.z.string().min(10, 'Valid 10-digit phone number is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().min(3, 'Address is required'),
    gstin: zod_1.z.string().optional().or(zod_1.z.literal('')),
    deviceName: zod_1.z.string().default('Main Terminal'),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
    deviceId: zod_1.z.string().optional(),
});
exports.pinUnlockSchema = zod_1.z.object({
    pin: zod_1.z.string().length(4, 'PIN must be 4 digits'),
    userId: zod_1.z.string(),
});
exports.categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required'),
    description: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
    displayOrder: zod_1.z.number().default(0),
});
exports.updateCategorySchema = exports.categorySchema.partial().extend({
    active: zod_1.z.boolean().optional(),
});
exports.subcategorySchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1, 'Category is required'),
    name: zod_1.z.string().min(1, 'Subcategory name is required'),
    description: zod_1.z.string().optional(),
    displayOrder: zod_1.z.number().default(0),
});
exports.updateSubcategorySchema = exports.subcategorySchema.partial().extend({
    active: zod_1.z.boolean().optional(),
});
exports.reorderItemsSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        displayOrder: zod_1.z.number(),
    })).min(1),
});
exports.moveSubcategorySchema = zod_1.z.object({
    targetCategoryId: zod_1.z.string().min(1, 'Target Category ID is required'),
});
exports.customFieldSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Field name/key is required'),
    label: zod_1.z.string().min(1, 'Field label is required'),
    targetLevel: zod_1.z.enum(['category', 'subcategory', 'product', 'variant']),
    targetId: zod_1.z.string().optional(),
    fieldType: zod_1.z.enum(['text', 'number', 'decimal', 'dropdown', 'boolean', 'multiselect']),
    unit: zod_1.z.string().optional(),
    required: zod_1.z.boolean().default(false),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    defaultValue: zod_1.z.string().optional(),
    displayOrder: zod_1.z.number().default(0),
});
exports.updateCustomFieldSchema = exports.customFieldSchema.partial().extend({
    active: zod_1.z.boolean().optional(),
});
exports.productVariantSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    name: zod_1.z.string().min(1, 'Variant name is required'),
    sku: zod_1.z.string().min(1, 'SKU is required'),
    barcode: zod_1.z.string().optional(),
    size: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    purchasePricePaise: zod_1.z.number().nonnegative(),
    sellingPricePaise: zod_1.z.number().nonnegative(),
    mrpPaise: zod_1.z.number().nonnegative().optional(),
    taxRatePercent: zod_1.z.number().nonnegative().default(18),
    minStockLevel: zod_1.z.number().nonnegative().default(5),
    openingStock: zod_1.z.number().default(0),
    rackLocation: zod_1.z.string().optional(),
    preferredSupplierId: zod_1.z.string().optional(),
    customValues: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.productSchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1, 'Category is required'),
    subcategoryId: zod_1.z.string().min(1, 'Subcategory is required'),
    name: zod_1.z.string().min(1, 'Product name is required'),
    brand: zod_1.z.string().optional(),
    material: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    modelNumber: zod_1.z.string().optional(),
    imageUrl: zod_1.z.string().optional(),
    measurementType: exports.measurementTypeSchema,
    baseUnit: exports.standardUnitSchema,
    allowedUnits: zod_1.z.array(exports.standardUnitSchema).min(1),
    packMultiplier: zod_1.z.number().positive().optional(),
    pipeDiameterMm: zod_1.z.number().positive().optional(),
    standardLengthMm: zod_1.z.number().positive().optional(),
    pipeTrackingMethod: zod_1.z.enum(['aggregate', 'segment']).optional(),
    customValues: zod_1.z.record(zod_1.z.any()).optional(),
    variants: zod_1.z.array(exports.productVariantSchema).min(1, 'At least one variant is required'),
});
exports.bulkImportProductRowSchema = zod_1.z.object({
    categoryName: zod_1.z.string().min(1, 'Category name is required'),
    subcategoryName: zod_1.z.string().min(1, 'Subcategory name is required'),
    productName: zod_1.z.string().min(1, 'Product name is required'),
    brand: zod_1.z.string().optional(),
    measurementType: exports.measurementTypeSchema.default('count'),
    baseUnit: exports.standardUnitSchema.default('piece'),
    variantName: zod_1.z.string().min(1, 'Variant name is required'),
    sku: zod_1.z.string().min(1, 'SKU is required'),
    size: zod_1.z.string().optional(),
    purchasePriceRs: zod_1.z.number().nonnegative().default(0),
    sellingPriceRs: zod_1.z.number().nonnegative().default(0),
    taxRatePercent: zod_1.z.number().nonnegative().default(18),
    openingStock: zod_1.z.number().nonnegative().default(0),
    minStockLevel: zod_1.z.number().nonnegative().default(5),
    rackLocation: zod_1.z.string().optional(),
    barcode: zod_1.z.string().optional(),
});
exports.stockAdjustmentSchema = zod_1.z.object({
    variantId: zod_1.z.string().min(1, 'Product variant is required'),
    adjustmentType: zod_1.z.enum(['increase', 'decrease', 'damaged', 'loss', 'reconciliation']),
    quantityChange: zod_1.z.number().positive('Quantity must be greater than 0'),
    unit: exports.standardUnitSchema,
    reason: zod_1.z.string().min(2, 'Reason is mandatory for stock adjustments'),
    notes: zod_1.z.string().optional(),
});
exports.saleItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unit: exports.standardUnitSchema,
    unitPricePaise: zod_1.z.number().nonnegative(),
    discountPaise: zod_1.z.number().nonnegative().default(0),
    taxRatePercent: zod_1.z.number().nonnegative().default(0),
    pipeCutSummary: zod_1.z.string().optional(),
});
exports.saleSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    invoiceNumber: zod_1.z.string().optional(),
    customerId: zod_1.z.string().optional(),
    customerName: zod_1.z.string().optional(),
    customerPhone: zod_1.z.string().optional(),
    saleDate: zod_1.z.string(),
    items: zod_1.z.array(exports.saleItemSchema).min(1, 'At least one item is required in a sale'),
    paymentMethod: zod_1.z.enum(['cash', 'upi', 'card', 'credit', 'bank_transfer']),
    paidAmountPaise: zod_1.z.number().nonnegative(),
    invoiceDiscountPaise: zod_1.z.number().nonnegative().default(0),
    notes: zod_1.z.string().optional(),
});
exports.purchaseItemSchema = zod_1.z.object({
    variantId: zod_1.z.string().min(1),
    quantity: zod_1.z.number().positive(),
    unit: exports.standardUnitSchema,
    unitCostPaise: zod_1.z.number().nonnegative(),
    taxRatePercent: zod_1.z.number().nonnegative().default(0),
    pipeLengthPerPieceMm: zod_1.z.number().positive().optional(),
    numberOfPieces: zod_1.z.number().positive().optional(),
});
exports.purchaseSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    invoiceNumber: zod_1.z.string().min(1, 'Supplier bill/invoice number is required'),
    supplierId: zod_1.z.string().optional(),
    purchaseDate: zod_1.z.string(),
    status: zod_1.z.enum(['draft', 'received']),
    items: zod_1.z.array(exports.purchaseItemSchema).min(1, 'At least one purchase item is required'),
    paymentMethod: zod_1.z.enum(['cash', 'upi', 'bank_transfer', 'credit', 'cheque']),
    paidAmountPaise: zod_1.z.number().nonnegative(),
    notes: zod_1.z.string().optional(),
});
exports.customerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Customer name is required'),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    businessName: zod_1.z.string().optional(),
    gstin: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Supplier contact person is required'),
    businessName: zod_1.z.string().optional(),
    phone: zod_1.z.string().min(5, 'Valid phone number is required'),
    alternatePhone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional(),
    gstin: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.expenseSchema = zod_1.z.object({
    category: zod_1.z.enum(['transport', 'rent', 'electricity', 'salary', 'packaging', 'maintenance', 'miscellaneous']),
    amountPaise: zod_1.z.number().positive('Amount must be positive'),
    date: zod_1.z.string(),
    paymentMethod: zod_1.z.enum(['cash', 'upi', 'bank_transfer', 'card']),
    description: zod_1.z.string().min(1, 'Description is required'),
    reference: zod_1.z.string().optional(),
});
//# sourceMappingURL=index.js.map