import {
  DEMO_STORE,
  DEMO_CATEGORIES,
  DEMO_SUBCATEGORIES,
  DEMO_SUPPLIERS,
  DEMO_CUSTOMERS,
  DEMO_PRODUCTS,
  DEMO_PURCHASES,
  DEMO_SALES,
  DEMO_STOCK_MOVEMENTS,
  DEMO_EXPENSES,
} from './demoData.js';

/**
 * Deterministic Seeder for Demo Mode
 * Safely inserts fictional sample dataset into the target database.
 */
export async function seedDemoData(db: any): Promise<{
  storeCount: number;
  categoryCount: number;
  productCount: number;
  variantCount: number;
  supplierCount: number;
  customerCount: number;
  purchaseCount: number;
  saleCount: number;
}> {
  // 1. Store
  await db.runAsync?.(
    `INSERT OR REPLACE INTO stores (
      id, name, ownerName, phone, email, address, gstin, currency,
      defaultTaxRatePercent, invoicePrefix, invoiceSequence, negativeStockAllowed,
      pipeTrackingMethod, costingMethod, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEMO_STORE.id,
      DEMO_STORE.name,
      DEMO_STORE.ownerName,
      DEMO_STORE.phone,
      DEMO_STORE.email,
      DEMO_STORE.address,
      DEMO_STORE.gstin,
      DEMO_STORE.currency,
      DEMO_STORE.defaultTaxRatePercent,
      DEMO_STORE.invoicePrefix,
      DEMO_STORE.invoiceSequence,
      DEMO_STORE.negativeStockAllowed,
      DEMO_STORE.pipeTrackingMethod,
      DEMO_STORE.costingMethod,
      DEMO_STORE.createdAt,
      DEMO_STORE.updatedAt,
    ]
  );

  // 2. Categories
  for (const cat of DEMO_CATEGORIES) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO categories (
        id, storeId, name, description, icon, displayOrder, active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cat.id,
        cat.storeId,
        cat.name,
        cat.description,
        cat.icon,
        cat.displayOrder,
        cat.active,
        cat.createdAt,
        cat.updatedAt,
      ]
    );
  }

  // 3. Subcategories
  for (const sub of DEMO_SUBCATEGORIES) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO subcategories (
        id, storeId, categoryId, name, description, displayOrder, active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sub.id,
        sub.storeId,
        sub.categoryId,
        sub.name,
        sub.description,
        sub.displayOrder,
        sub.active,
        sub.createdAt,
        sub.updatedAt,
      ]
    );
  }

  // 4. Suppliers
  for (const sup of DEMO_SUPPLIERS) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO suppliers (
        id, storeId, name, phone, email, address, gstin, active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sup.id,
        sup.storeId,
        sup.name,
        sup.phone,
        sup.email,
        sup.address,
        sup.gstin,
        sup.active,
        sup.createdAt,
        sup.updatedAt,
      ]
    );
  }

  // 5. Customers
  for (const cust of DEMO_CUSTOMERS) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO customers (
        id, storeId, name, phone, email, address, active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cust.id,
        cust.storeId,
        cust.name,
        cust.phone,
        cust.email,
        cust.address,
        cust.active,
        cust.createdAt,
        cust.updatedAt,
      ]
    );
  }

  // 6. Products & Variants
  let totalVariants = 0;
  for (const prod of DEMO_PRODUCTS) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO products (
        id, storeId, categoryId, subcategoryId, name, brand, modelNumber,
        material, description, measurementType, baseUnit, allowedUnits,
        pipeDiameterMm, standardLengthMm, pipeTrackingMethod, preferredSupplierId,
        active, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prod.id,
        prod.storeId,
        prod.categoryId,
        prod.subcategoryId,
        prod.name,
        prod.brand,
        prod.modelNumber || null,
        prod.material || null,
        prod.description,
        prod.measurementType,
        prod.baseUnit,
        JSON.stringify([prod.baseUnit]),
        prod.pipeDiameterMm || null,
        prod.standardLengthM ? prod.standardLengthM * 1000 : null,
        prod.pipeTrackingMethod || 'aggregate',
        prod.preferredSupplierId || null,
        prod.active,
        prod.createdAt,
        prod.updatedAt,
      ]
    );

    for (const v of prod.variants) {
      totalVariants++;
      await db.runAsync?.(
        `INSERT OR REPLACE INTO product_variants (
          id, storeId, productId, name, sku, size, color,
          purchasePricePaise, sellingPricePaise, taxRatePercent,
          minStockLevel, openingStock, currentStock, rackLocation,
          active, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          prod.storeId,
          v.productId,
          v.name,
          v.sku,
          v.size || null,
          v.color || null,
          v.purchasePricePaise,
          v.sellingPricePaise,
          v.taxRatePercent,
          v.minStockLevel,
          v.currentStock,
          v.currentStock,
          v.rackLocation || null,
          v.active,
          prod.createdAt,
          prod.updatedAt,
        ]
      );
    }
  }

  // 7. Purchases & Line Items
  for (const po of DEMO_PURCHASES) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO purchases (
        id, storeId, invoiceNumber, supplierId, purchaseDate, status,
        totalTaxablePaise, totalTaxPaise, grandTotalPaise, paidAmountPaise,
        outstandingPaise, paymentMethod, notes, deviceId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        po.id,
        po.storeId,
        po.invoiceNumber,
        po.supplierId,
        po.purchaseDate,
        po.status,
        po.totalAmountPaise,
        0,
        po.totalAmountPaise,
        po.paidAmountPaise,
        po.totalAmountPaise - po.paidAmountPaise,
        'bank_transfer',
        po.notes,
        'demo-device',
        po.createdAt,
        po.updatedAt,
      ]
    );

    for (const item of po.items) {
      await db.runAsync?.(
        `INSERT OR REPLACE INTO purchase_items (
          id, purchaseId, variantId, quantity, unit, quantityBase,
          unitCostPaise, taxRatePercent, totalPaise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.purchaseId,
          item.variantId,
          item.orderedQuantity,
          item.unit,
          item.orderedQuantity,
          item.unitPricePaise,
          0,
          item.totalPaise,
        ]
      );
    }
  }

  // 8. Sales & Line Items
  for (const sale of DEMO_SALES) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO sales (
        id, storeId, invoiceNumber, customerId, saleDate, status,
        subtotalGrossPaise, totalTaxablePaise, grandTotalPaise, paidAmountPaise,
        outstandingPaise, paymentMethod, notes, deviceId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sale.id,
        sale.storeId,
        sale.invoiceNumber,
        sale.customerId,
        sale.saleDate,
        sale.status,
        sale.totalAmountPaise,
        sale.totalAmountPaise,
        sale.totalAmountPaise,
        sale.totalAmountPaise,
        0,
        sale.paymentMethod,
        sale.notes,
        'demo-device',
        sale.createdAt,
        sale.updatedAt,
      ]
    );

    for (const si of sale.items) {
      await db.runAsync?.(
        `INSERT OR REPLACE INTO sale_items (
          id, saleId, variantId, quantity, unit, quantityBase,
          unitPricePaise, discountPaise, taxRatePercent, totalPaise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          si.id,
          si.saleId,
          si.variantId,
          si.quantity,
          si.unit,
          si.quantity,
          si.unitPricePaise,
          0,
          0,
          si.totalPaise,
        ]
      );
    }
  }

  // 9. Stock Movements
  for (const m of DEMO_STOCK_MOVEMENTS) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO stock_movements (
        id, storeId, variantId, movementType, quantityChangeBase,
        balanceBeforeBase, balanceAfterBase, referenceType, referenceId,
        reason, deviceId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.storeId,
        m.variantId,
        m.type,
        m.quantityChange,
        m.balanceAfter - m.quantityChange,
        m.balanceAfter,
        m.referenceType,
        m.referenceId,
        m.reason,
        'demo-device',
        m.createdAt,
      ]
    );
  }

  // 10. Expenses
  for (const exp of DEMO_EXPENSES) {
    await db.runAsync?.(
      `INSERT OR REPLACE INTO expenses (
        id, storeId, category, amountPaise, date, paymentMethod, description, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exp.id,
        exp.storeId,
        exp.category,
        exp.amountPaise,
        exp.date,
        'cash',
        exp.description,
        exp.createdAt,
      ]
    );
  }

  return {
    storeCount: 1,
    categoryCount: DEMO_CATEGORIES.length,
    productCount: DEMO_PRODUCTS.length,
    variantCount: totalVariants,
    supplierCount: DEMO_SUPPLIERS.length,
    customerCount: DEMO_CUSTOMERS.length,
    purchaseCount: DEMO_PURCHASES.length,
    saleCount: DEMO_SALES.length,
  };
}

/**
 * Check if the demo database needs initial seeding
 */
export async function seedDemoDataIfEmpty(db: any): Promise<boolean> {
  try {
    const existingProducts = await db.getAllAsync?.('SELECT id FROM products LIMIT 1;');
    if (!existingProducts || existingProducts.length === 0) {
      await seedDemoData(db);
      return true;
    }
  } catch (err) {
    // If table doesn't exist yet or query fails, safe ignore
    console.warn('[DemoSeed] Could not check existing demo products:', err);
  }
  return false;
}
