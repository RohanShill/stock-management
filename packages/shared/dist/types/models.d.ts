import { MeasurementType, StandardUnit } from './units.js';
import { PipeTrackingMethod } from './pipe.js';
export type UserRole = 'admin' | 'staff';
export interface Store {
    id: string;
    name: string;
    ownerName: string;
    phone: string;
    email?: string;
    address: string;
    gstin?: string;
    currency: string;
    defaultTaxRatePercent: number;
    invoicePrefix: string;
    invoiceSequence: number;
    negativeStockAllowed: boolean;
    pipeTrackingMethod: PipeTrackingMethod;
    costingMethod: 'weighted_average' | 'fifo';
    createdAt: string;
    updatedAt: string;
}
export interface User {
    id: string;
    storeId: string;
    username: string;
    fullName: string;
    role: UserRole;
    pin?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Device {
    id: string;
    storeId: string;
    deviceName: string;
    deviceIdentifier: string;
    registeredAt: string;
    lastActiveAt: string;
    status: 'active' | 'revoked';
}
export interface Category {
    id: string;
    storeId: string;
    name: string;
    description?: string;
    icon?: string;
    displayOrder: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export interface Subcategory {
    id: string;
    storeId: string;
    categoryId: string;
    name: string;
    description?: string;
    displayOrder: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export type CustomFieldType = 'text' | 'number' | 'decimal' | 'dropdown' | 'boolean' | 'multiselect';
export type CustomFieldTargetLevel = 'category' | 'subcategory' | 'product' | 'variant';
export interface CustomFieldDefinition {
    id: string;
    storeId: string;
    targetLevel: CustomFieldTargetLevel;
    targetId?: string;
    name: string;
    label: string;
    fieldType: CustomFieldType;
    unit?: string;
    required: boolean;
    options?: string[];
    defaultValue?: string;
    displayOrder: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export interface Product {
    id: string;
    storeId: string;
    categoryId: string;
    subcategoryId: string;
    name: string;
    brand?: string;
    material?: string;
    description?: string;
    modelNumber?: string;
    imageUrl?: string;
    measurementType: MeasurementType;
    baseUnit: StandardUnit;
    allowedUnits: StandardUnit[];
    packMultiplier?: number;
    pipeDiameterMm?: number;
    standardLengthMm?: number;
    pipeTrackingMethod?: PipeTrackingMethod;
    customValues?: Record<string, any>;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export interface ProductVariant {
    id: string;
    storeId: string;
    productId: string;
    name: string;
    sku: string;
    barcode?: string;
    size?: string;
    color?: string;
    purchasePricePaise: number;
    sellingPricePaise: number;
    mrpPaise?: number;
    taxRatePercent: number;
    minStockLevel: number;
    openingStock: number;
    currentStock: number;
    rackLocation?: string;
    preferredSupplierId?: string;
    customValues?: Record<string, any>;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export type StockMovementType = 'opening_stock' | 'purchase_received' | 'sale' | 'sale_return' | 'purchase_return' | 'adjustment_increase' | 'adjustment_decrease' | 'damaged_goods' | 'stock_loss' | 'reconciliation' | 'reversal';
export interface StockMovement {
    id: string;
    storeId: string;
    variantId: string;
    movementType: StockMovementType;
    quantityChangeBase: number;
    balanceBeforeBase: number;
    balanceAfterBase: number;
    referenceType?: 'sale' | 'purchase' | 'adjustment' | 'return' | 'manual';
    referenceId?: string;
    reason?: string;
    notes?: string;
    deviceId?: string;
    userId?: string;
    createdAt: string;
}
export interface Supplier {
    id: string;
    storeId: string;
    name: string;
    businessName?: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    address?: string;
    gstin?: string;
    notes?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export interface Customer {
    id: string;
    storeId: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    businessName?: string;
    gstin?: string;
    notes?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
export type PurchaseStatus = 'draft' | 'received' | 'cancelled';
export interface PurchaseItem {
    id: string;
    purchaseId: string;
    variantId: string;
    quantity: number;
    unit: StandardUnit;
    quantityBase: number;
    unitCostPaise: number;
    taxRatePercent: number;
    totalPaise: number;
    pipeLengthPerPieceMm?: number;
    numberOfPieces?: number;
}
export interface Purchase {
    id: string;
    storeId: string;
    invoiceNumber: string;
    supplierId?: string;
    purchaseDate: string;
    status: PurchaseStatus;
    totalTaxablePaise: number;
    totalTaxPaise: number;
    grandTotalPaise: number;
    paidAmountPaise: number;
    outstandingPaise: number;
    paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'credit' | 'cheque';
    notes?: string;
    deviceId: string;
    items?: PurchaseItem[];
    createdAt: string;
    updatedAt: string;
}
export type SaleStatus = 'draft' | 'completed' | 'reversed';
export interface SaleItem {
    id: string;
    saleId: string;
    variantId: string;
    quantity: number;
    unit: StandardUnit;
    quantityBase: number;
    unitPricePaise: number;
    discountPaise: number;
    taxRatePercent: number;
    totalPaise: number;
    pipeCutSummary?: string;
}
export interface Sale {
    id: string;
    storeId: string;
    invoiceNumber: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    saleDate: string;
    status: SaleStatus;
    subtotalGrossPaise: number;
    totalDiscountPaise: number;
    totalTaxablePaise: number;
    totalTaxPaise: number;
    roundOffPaise: number;
    grandTotalPaise: number;
    paidAmountPaise: number;
    outstandingPaise: number;
    paymentMethod: 'cash' | 'upi' | 'card' | 'credit' | 'bank_transfer';
    notes?: string;
    deviceId: string;
    userId?: string;
    items?: SaleItem[];
    createdAt: string;
    updatedAt: string;
}
export interface SaleReturnItem {
    variantId: string;
    quantity: number;
    unit: StandardUnit;
    quantityBase: number;
    condition: 'reusable' | 'damaged' | 'discarded';
    refundPaise: number;
}
export interface SaleReturn {
    id: string;
    storeId: string;
    saleId: string;
    returnDate: string;
    reason: string;
    totalRefundPaise: number;
    items: SaleReturnItem[];
    deviceId: string;
    createdAt: string;
}
export interface Expense {
    id: string;
    storeId: string;
    category: 'transport' | 'rent' | 'electricity' | 'salary' | 'packaging' | 'maintenance' | 'miscellaneous';
    amountPaise: number;
    date: string;
    paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'card';
    description: string;
    reference?: string;
    createdAt: string;
}
export type SyncEntityType = 'category' | 'subcategory' | 'product' | 'variant' | 'supplier' | 'customer' | 'purchase' | 'sale' | 'stock_movement' | 'expense' | 'pipe_segment' | 'store' | 'custom_field';
export type SyncOperationType = 'create' | 'update' | 'delete';
export interface SyncOperation {
    id: string;
    storeId: string;
    deviceId: string;
    entityType: SyncEntityType;
    entityId: string;
    operationType: SyncOperationType;
    payload: Record<string, unknown>;
    status: 'pending' | 'processing' | 'synced' | 'failed';
    retryCount: number;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}
export interface SyncConflict {
    id: string;
    storeId: string;
    entityType: SyncEntityType;
    entityId: string;
    localVersion: number;
    serverVersion: number;
    localPayload: Record<string, unknown>;
    serverPayload: Record<string, unknown>;
    status: 'open' | 'resolved';
    resolutionType?: 'server_wins' | 'client_wins' | 'manual';
    resolvedAt?: string;
    createdAt: string;
}
//# sourceMappingURL=models.d.ts.map