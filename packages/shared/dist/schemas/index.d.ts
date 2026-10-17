import { z } from 'zod';
export declare const measurementTypeSchema: z.ZodEnum<["count", "length", "weight", "volume", "pack"]>;
export declare const standardUnitSchema: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
export declare const registerStoreSchema: z.ZodObject<{
    storeName: z.ZodString;
    ownerName: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    phone: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    address: z.ZodString;
    gstin: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    deviceName: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    storeName: string;
    ownerName: string;
    username: string;
    password: string;
    phone: string;
    address: string;
    deviceName: string;
    email?: string | undefined;
    gstin?: string | undefined;
}, {
    storeName: string;
    ownerName: string;
    username: string;
    password: string;
    phone: string;
    address: string;
    email?: string | undefined;
    gstin?: string | undefined;
    deviceName?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    deviceId?: string | undefined;
}, {
    username: string;
    password: string;
    deviceId?: string | undefined;
}>;
export declare const pinUnlockSchema: z.ZodObject<{
    pin: z.ZodString;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
    userId: string;
}, {
    pin: string;
    userId: string;
}>;
export declare const categorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    displayOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    displayOrder: number;
    description?: string | undefined;
    icon?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    icon?: string | undefined;
    displayOrder?: number | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    icon: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    displayOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
} & {
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | undefined;
    icon?: string | undefined;
    displayOrder?: number | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | undefined;
    icon?: string | undefined;
    displayOrder?: number | undefined;
}>;
export declare const subcategorySchema: z.ZodObject<{
    categoryId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    displayOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    displayOrder: number;
    categoryId: string;
    description?: string | undefined;
}, {
    name: string;
    categoryId: string;
    description?: string | undefined;
    displayOrder?: number | undefined;
}>;
export declare const updateSubcategorySchema: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    displayOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
} & {
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | undefined;
    displayOrder?: number | undefined;
    categoryId?: string | undefined;
}, {
    active?: boolean | undefined;
    name?: string | undefined;
    description?: string | undefined;
    displayOrder?: number | undefined;
    categoryId?: string | undefined;
}>;
export declare const reorderItemsSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        displayOrder: number;
        id: string;
    }, {
        displayOrder: number;
        id: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        displayOrder: number;
        id: string;
    }[];
}, {
    items: {
        displayOrder: number;
        id: string;
    }[];
}>;
export declare const moveSubcategorySchema: z.ZodObject<{
    targetCategoryId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    targetCategoryId: string;
}, {
    targetCategoryId: string;
}>;
export declare const customFieldSchema: z.ZodObject<{
    name: z.ZodString;
    label: z.ZodString;
    targetLevel: z.ZodEnum<["category", "subcategory", "product", "variant"]>;
    targetId: z.ZodOptional<z.ZodString>;
    fieldType: z.ZodEnum<["text", "number", "decimal", "dropdown", "boolean", "multiselect"]>;
    unit: z.ZodOptional<z.ZodString>;
    required: z.ZodDefault<z.ZodBoolean>;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    defaultValue: z.ZodOptional<z.ZodString>;
    displayOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    displayOrder: number;
    label: string;
    targetLevel: "category" | "subcategory" | "product" | "variant";
    fieldType: "number" | "boolean" | "decimal" | "text" | "dropdown" | "multiselect";
    required: boolean;
    unit?: string | undefined;
    options?: string[] | undefined;
    targetId?: string | undefined;
    defaultValue?: string | undefined;
}, {
    name: string;
    label: string;
    targetLevel: "category" | "subcategory" | "product" | "variant";
    fieldType: "number" | "boolean" | "decimal" | "text" | "dropdown" | "multiselect";
    unit?: string | undefined;
    options?: string[] | undefined;
    displayOrder?: number | undefined;
    targetId?: string | undefined;
    required?: boolean | undefined;
    defaultValue?: string | undefined;
}>;
export declare const updateCustomFieldSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    targetLevel: z.ZodOptional<z.ZodEnum<["category", "subcategory", "product", "variant"]>>;
    targetId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    fieldType: z.ZodOptional<z.ZodEnum<["text", "number", "decimal", "dropdown", "boolean", "multiselect"]>>;
    unit: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    required: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    defaultValue: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    displayOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
} & {
    active: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    unit?: string | undefined;
    active?: boolean | undefined;
    options?: string[] | undefined;
    name?: string | undefined;
    displayOrder?: number | undefined;
    label?: string | undefined;
    targetLevel?: "category" | "subcategory" | "product" | "variant" | undefined;
    targetId?: string | undefined;
    fieldType?: "number" | "boolean" | "decimal" | "text" | "dropdown" | "multiselect" | undefined;
    required?: boolean | undefined;
    defaultValue?: string | undefined;
}, {
    unit?: string | undefined;
    active?: boolean | undefined;
    options?: string[] | undefined;
    name?: string | undefined;
    displayOrder?: number | undefined;
    label?: string | undefined;
    targetLevel?: "category" | "subcategory" | "product" | "variant" | undefined;
    targetId?: string | undefined;
    fieldType?: "number" | "boolean" | "decimal" | "text" | "dropdown" | "multiselect" | undefined;
    required?: boolean | undefined;
    defaultValue?: string | undefined;
}>;
export declare const productVariantSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    sku: z.ZodString;
    barcode: z.ZodOptional<z.ZodString>;
    size: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    purchasePricePaise: z.ZodNumber;
    sellingPricePaise: z.ZodNumber;
    mrpPaise: z.ZodOptional<z.ZodNumber>;
    taxRatePercent: z.ZodDefault<z.ZodNumber>;
    minStockLevel: z.ZodDefault<z.ZodNumber>;
    openingStock: z.ZodDefault<z.ZodNumber>;
    rackLocation: z.ZodOptional<z.ZodString>;
    preferredSupplierId: z.ZodOptional<z.ZodString>;
    customValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    taxRatePercent: number;
    name: string;
    sku: string;
    purchasePricePaise: number;
    sellingPricePaise: number;
    minStockLevel: number;
    openingStock: number;
    id?: string | undefined;
    barcode?: string | undefined;
    size?: string | undefined;
    color?: string | undefined;
    mrpPaise?: number | undefined;
    rackLocation?: string | undefined;
    preferredSupplierId?: string | undefined;
    customValues?: Record<string, any> | undefined;
}, {
    name: string;
    sku: string;
    purchasePricePaise: number;
    sellingPricePaise: number;
    taxRatePercent?: number | undefined;
    id?: string | undefined;
    barcode?: string | undefined;
    size?: string | undefined;
    color?: string | undefined;
    mrpPaise?: number | undefined;
    minStockLevel?: number | undefined;
    openingStock?: number | undefined;
    rackLocation?: string | undefined;
    preferredSupplierId?: string | undefined;
    customValues?: Record<string, any> | undefined;
}>;
export declare const productSchema: z.ZodObject<{
    categoryId: z.ZodString;
    subcategoryId: z.ZodString;
    name: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    material: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    modelNumber: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    measurementType: z.ZodEnum<["count", "length", "weight", "volume", "pack"]>;
    baseUnit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
    allowedUnits: z.ZodArray<z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>, "many">;
    packMultiplier: z.ZodOptional<z.ZodNumber>;
    pipeDiameterMm: z.ZodOptional<z.ZodNumber>;
    standardLengthMm: z.ZodOptional<z.ZodNumber>;
    pipeTrackingMethod: z.ZodOptional<z.ZodEnum<["aggregate", "segment"]>>;
    customValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    variants: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        sku: z.ZodString;
        barcode: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        purchasePricePaise: z.ZodNumber;
        sellingPricePaise: z.ZodNumber;
        mrpPaise: z.ZodOptional<z.ZodNumber>;
        taxRatePercent: z.ZodDefault<z.ZodNumber>;
        minStockLevel: z.ZodDefault<z.ZodNumber>;
        openingStock: z.ZodDefault<z.ZodNumber>;
        rackLocation: z.ZodOptional<z.ZodString>;
        preferredSupplierId: z.ZodOptional<z.ZodString>;
        customValues: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        taxRatePercent: number;
        name: string;
        sku: string;
        purchasePricePaise: number;
        sellingPricePaise: number;
        minStockLevel: number;
        openingStock: number;
        id?: string | undefined;
        barcode?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        mrpPaise?: number | undefined;
        rackLocation?: string | undefined;
        preferredSupplierId?: string | undefined;
        customValues?: Record<string, any> | undefined;
    }, {
        name: string;
        sku: string;
        purchasePricePaise: number;
        sellingPricePaise: number;
        taxRatePercent?: number | undefined;
        id?: string | undefined;
        barcode?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        mrpPaise?: number | undefined;
        minStockLevel?: number | undefined;
        openingStock?: number | undefined;
        rackLocation?: string | undefined;
        preferredSupplierId?: string | undefined;
        customValues?: Record<string, any> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    categoryId: string;
    subcategoryId: string;
    measurementType: "count" | "length" | "weight" | "volume" | "pack";
    baseUnit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    allowedUnits: ("pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l")[];
    variants: {
        taxRatePercent: number;
        name: string;
        sku: string;
        purchasePricePaise: number;
        sellingPricePaise: number;
        minStockLevel: number;
        openingStock: number;
        id?: string | undefined;
        barcode?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        mrpPaise?: number | undefined;
        rackLocation?: string | undefined;
        preferredSupplierId?: string | undefined;
        customValues?: Record<string, any> | undefined;
    }[];
    description?: string | undefined;
    customValues?: Record<string, any> | undefined;
    brand?: string | undefined;
    material?: string | undefined;
    modelNumber?: string | undefined;
    imageUrl?: string | undefined;
    packMultiplier?: number | undefined;
    pipeDiameterMm?: number | undefined;
    standardLengthMm?: number | undefined;
    pipeTrackingMethod?: "aggregate" | "segment" | undefined;
}, {
    name: string;
    categoryId: string;
    subcategoryId: string;
    measurementType: "count" | "length" | "weight" | "volume" | "pack";
    baseUnit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    allowedUnits: ("pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l")[];
    variants: {
        name: string;
        sku: string;
        purchasePricePaise: number;
        sellingPricePaise: number;
        taxRatePercent?: number | undefined;
        id?: string | undefined;
        barcode?: string | undefined;
        size?: string | undefined;
        color?: string | undefined;
        mrpPaise?: number | undefined;
        minStockLevel?: number | undefined;
        openingStock?: number | undefined;
        rackLocation?: string | undefined;
        preferredSupplierId?: string | undefined;
        customValues?: Record<string, any> | undefined;
    }[];
    description?: string | undefined;
    customValues?: Record<string, any> | undefined;
    brand?: string | undefined;
    material?: string | undefined;
    modelNumber?: string | undefined;
    imageUrl?: string | undefined;
    packMultiplier?: number | undefined;
    pipeDiameterMm?: number | undefined;
    standardLengthMm?: number | undefined;
    pipeTrackingMethod?: "aggregate" | "segment" | undefined;
}>;
export declare const bulkImportProductRowSchema: z.ZodObject<{
    categoryName: z.ZodString;
    subcategoryName: z.ZodString;
    productName: z.ZodString;
    brand: z.ZodOptional<z.ZodString>;
    measurementType: z.ZodDefault<z.ZodEnum<["count", "length", "weight", "volume", "pack"]>>;
    baseUnit: z.ZodDefault<z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>>;
    variantName: z.ZodString;
    sku: z.ZodString;
    size: z.ZodOptional<z.ZodString>;
    purchasePriceRs: z.ZodDefault<z.ZodNumber>;
    sellingPriceRs: z.ZodDefault<z.ZodNumber>;
    taxRatePercent: z.ZodDefault<z.ZodNumber>;
    openingStock: z.ZodDefault<z.ZodNumber>;
    minStockLevel: z.ZodDefault<z.ZodNumber>;
    rackLocation: z.ZodOptional<z.ZodString>;
    barcode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    taxRatePercent: number;
    sku: string;
    minStockLevel: number;
    openingStock: number;
    measurementType: "count" | "length" | "weight" | "volume" | "pack";
    baseUnit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    categoryName: string;
    subcategoryName: string;
    productName: string;
    variantName: string;
    purchasePriceRs: number;
    sellingPriceRs: number;
    barcode?: string | undefined;
    size?: string | undefined;
    rackLocation?: string | undefined;
    brand?: string | undefined;
}, {
    sku: string;
    categoryName: string;
    subcategoryName: string;
    productName: string;
    variantName: string;
    taxRatePercent?: number | undefined;
    barcode?: string | undefined;
    size?: string | undefined;
    minStockLevel?: number | undefined;
    openingStock?: number | undefined;
    rackLocation?: string | undefined;
    brand?: string | undefined;
    measurementType?: "count" | "length" | "weight" | "volume" | "pack" | undefined;
    baseUnit?: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l" | undefined;
    purchasePriceRs?: number | undefined;
    sellingPriceRs?: number | undefined;
}>;
export declare const stockAdjustmentSchema: z.ZodObject<{
    variantId: z.ZodString;
    adjustmentType: z.ZodEnum<["increase", "decrease", "damaged", "loss", "reconciliation"]>;
    quantityChange: z.ZodNumber;
    unit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
    reason: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    variantId: string;
    adjustmentType: "damaged" | "reconciliation" | "increase" | "decrease" | "loss";
    quantityChange: number;
    reason: string;
    notes?: string | undefined;
}, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    variantId: string;
    adjustmentType: "damaged" | "reconciliation" | "increase" | "decrease" | "loss";
    quantityChange: number;
    reason: string;
    notes?: string | undefined;
}>;
export declare const saleItemSchema: z.ZodObject<{
    variantId: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
    unitPricePaise: z.ZodNumber;
    discountPaise: z.ZodDefault<z.ZodNumber>;
    taxRatePercent: z.ZodDefault<z.ZodNumber>;
    pipeCutSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    quantity: number;
    unitPricePaise: number;
    discountPaise: number;
    taxRatePercent: number;
    variantId: string;
    pipeCutSummary?: string | undefined;
}, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    quantity: number;
    unitPricePaise: number;
    variantId: string;
    discountPaise?: number | undefined;
    taxRatePercent?: number | undefined;
    pipeCutSummary?: string | undefined;
}>;
export declare const saleSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    invoiceNumber: z.ZodOptional<z.ZodString>;
    customerId: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    saleDate: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        variantId: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
        unitPricePaise: z.ZodNumber;
        discountPaise: z.ZodDefault<z.ZodNumber>;
        taxRatePercent: z.ZodDefault<z.ZodNumber>;
        pipeCutSummary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        unitPricePaise: number;
        discountPaise: number;
        taxRatePercent: number;
        variantId: string;
        pipeCutSummary?: string | undefined;
    }, {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        unitPricePaise: number;
        variantId: string;
        discountPaise?: number | undefined;
        taxRatePercent?: number | undefined;
        pipeCutSummary?: string | undefined;
    }>, "many">;
    paymentMethod: z.ZodEnum<["cash", "upi", "card", "credit", "bank_transfer"]>;
    paidAmountPaise: z.ZodNumber;
    invoiceDiscountPaise: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        unitPricePaise: number;
        discountPaise: number;
        taxRatePercent: number;
        variantId: string;
        pipeCutSummary?: string | undefined;
    }[];
    saleDate: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "credit" | "card";
    paidAmountPaise: number;
    invoiceDiscountPaise: number;
    id?: string | undefined;
    notes?: string | undefined;
    invoiceNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
}, {
    items: {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        unitPricePaise: number;
        variantId: string;
        discountPaise?: number | undefined;
        taxRatePercent?: number | undefined;
        pipeCutSummary?: string | undefined;
    }[];
    saleDate: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "credit" | "card";
    paidAmountPaise: number;
    id?: string | undefined;
    notes?: string | undefined;
    invoiceNumber?: string | undefined;
    customerId?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    invoiceDiscountPaise?: number | undefined;
}>;
export declare const purchaseItemSchema: z.ZodObject<{
    variantId: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
    unitCostPaise: z.ZodNumber;
    taxRatePercent: z.ZodDefault<z.ZodNumber>;
    pipeLengthPerPieceMm: z.ZodOptional<z.ZodNumber>;
    numberOfPieces: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    quantity: number;
    taxRatePercent: number;
    variantId: string;
    unitCostPaise: number;
    pipeLengthPerPieceMm?: number | undefined;
    numberOfPieces?: number | undefined;
}, {
    unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
    quantity: number;
    variantId: string;
    unitCostPaise: number;
    taxRatePercent?: number | undefined;
    pipeLengthPerPieceMm?: number | undefined;
    numberOfPieces?: number | undefined;
}>;
export declare const purchaseSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    invoiceNumber: z.ZodString;
    supplierId: z.ZodOptional<z.ZodString>;
    purchaseDate: z.ZodString;
    status: z.ZodEnum<["draft", "received"]>;
    items: z.ZodArray<z.ZodObject<{
        variantId: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodEnum<["piece", "set", "box", "pack", "mm", "cm", "m", "ft", "inch", "g", "kg", "ml", "l"]>;
        unitCostPaise: z.ZodNumber;
        taxRatePercent: z.ZodDefault<z.ZodNumber>;
        pipeLengthPerPieceMm: z.ZodOptional<z.ZodNumber>;
        numberOfPieces: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        taxRatePercent: number;
        variantId: string;
        unitCostPaise: number;
        pipeLengthPerPieceMm?: number | undefined;
        numberOfPieces?: number | undefined;
    }, {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        variantId: string;
        unitCostPaise: number;
        taxRatePercent?: number | undefined;
        pipeLengthPerPieceMm?: number | undefined;
        numberOfPieces?: number | undefined;
    }>, "many">;
    paymentMethod: z.ZodEnum<["cash", "upi", "bank_transfer", "credit", "cheque"]>;
    paidAmountPaise: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "received";
    items: {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        taxRatePercent: number;
        variantId: string;
        unitCostPaise: number;
        pipeLengthPerPieceMm?: number | undefined;
        numberOfPieces?: number | undefined;
    }[];
    invoiceNumber: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "credit" | "cheque";
    paidAmountPaise: number;
    purchaseDate: string;
    id?: string | undefined;
    notes?: string | undefined;
    supplierId?: string | undefined;
}, {
    status: "draft" | "received";
    items: {
        unit: "pack" | "piece" | "set" | "box" | "mm" | "cm" | "m" | "ft" | "inch" | "g" | "kg" | "ml" | "l";
        quantity: number;
        variantId: string;
        unitCostPaise: number;
        taxRatePercent?: number | undefined;
        pipeLengthPerPieceMm?: number | undefined;
        numberOfPieces?: number | undefined;
    }[];
    invoiceNumber: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "credit" | "cheque";
    paidAmountPaise: number;
    purchaseDate: string;
    id?: string | undefined;
    notes?: string | undefined;
    supplierId?: string | undefined;
}>;
export declare const customerSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    businessName: z.ZodOptional<z.ZodString>;
    gstin: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone?: string | undefined;
    address?: string | undefined;
    gstin?: string | undefined;
    notes?: string | undefined;
    businessName?: string | undefined;
}, {
    name: string;
    phone?: string | undefined;
    address?: string | undefined;
    gstin?: string | undefined;
    notes?: string | undefined;
    businessName?: string | undefined;
}>;
export declare const supplierSchema: z.ZodObject<{
    name: z.ZodString;
    businessName: z.ZodOptional<z.ZodString>;
    phone: z.ZodString;
    alternatePhone: z.ZodOptional<z.ZodString>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    address: z.ZodOptional<z.ZodString>;
    gstin: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    name: string;
    email?: string | undefined;
    address?: string | undefined;
    gstin?: string | undefined;
    notes?: string | undefined;
    businessName?: string | undefined;
    alternatePhone?: string | undefined;
}, {
    phone: string;
    name: string;
    email?: string | undefined;
    address?: string | undefined;
    gstin?: string | undefined;
    notes?: string | undefined;
    businessName?: string | undefined;
    alternatePhone?: string | undefined;
}>;
export declare const expenseSchema: z.ZodObject<{
    category: z.ZodEnum<["transport", "rent", "electricity", "salary", "packaging", "maintenance", "miscellaneous"]>;
    amountPaise: z.ZodNumber;
    date: z.ZodString;
    paymentMethod: z.ZodEnum<["cash", "upi", "bank_transfer", "card"]>;
    description: z.ZodString;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    category: "transport" | "rent" | "electricity" | "salary" | "packaging" | "maintenance" | "miscellaneous";
    date: string;
    description: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "card";
    amountPaise: number;
    reference?: string | undefined;
}, {
    category: "transport" | "rent" | "electricity" | "salary" | "packaging" | "maintenance" | "miscellaneous";
    date: string;
    description: string;
    paymentMethod: "cash" | "upi" | "bank_transfer" | "card";
    amountPaise: number;
    reference?: string | undefined;
}>;
//# sourceMappingURL=index.d.ts.map