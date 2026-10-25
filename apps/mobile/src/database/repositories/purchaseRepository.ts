import { v4 as uuidv4 } from 'uuid';
import {
  Purchase,
  PurchaseItem,
  toCanonicalBaseQuantity,
  StandardUnit,
} from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export interface CreatePurchaseInput {
  invoiceNumber: string;
  supplierId?: string;
  purchaseDate?: string;
  status: 'draft' | 'received';
  paymentMethod: 'cash' | 'upi' | 'bank_transfer' | 'credit' | 'cheque';
  paidAmountPaise: number;
  notes?: string;
  items: Array<{
    variantId: string;
    quantity: number;
    unit: StandardUnit;
    unitCostPaise: number;
    taxRatePercent?: number;
    pipeLengthPerPieceMm?: number;
    numberOfPieces?: number;
  }>;
}

export class PurchaseRepository {
  static async getPurchases(storeId: string, limit = 50): Promise<Purchase[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM purchases WHERE storeId = ? ORDER BY purchaseDate DESC LIMIT ?;`,
      [storeId, limit]
    );

    const purchases: Purchase[] = [];
    for (const r of rows) {
      const items = await db.getAllAsync<any>(
        `SELECT * FROM purchase_items WHERE purchaseId = ?;`,
        [r.id]
      );
      purchases.push({ ...r, items });
    }
    return purchases;
  }

  static async createPurchase(
    input: CreatePurchaseInput,
    storeId: string,
    deviceId: string,
    userId?: string
  ): Promise<Purchase> {
    const db = await getDatabase();
    const purchaseId = uuidv4();
    const now = input.purchaseDate || new Date().toISOString();

    let totalTaxablePaise = 0;
    let totalTaxPaise = 0;
    let grandTotalPaise = 0;

    const processedItems: PurchaseItem[] = [];
    const stockPlans: Array<{
      variantRow: any;
      baseQuantity: number;
      item: (typeof input.items)[0];
    }> = [];

    for (const item of input.items) {
      const variantRow = await db.getFirstAsync<any>(
        `SELECT v.*, p.measurementType, p.packMultiplier, p.pipeTrackingMethod FROM product_variants v JOIN products p ON v.productId = p.id WHERE v.id = ?;`,
        [item.variantId]
      );
      if (!variantRow) {
        throw new Error(`Variant ${item.variantId} not found`);
      }

      const baseQuantity = toCanonicalBaseQuantity(
        item.quantity,
        item.unit,
        variantRow.measurementType,
        variantRow.packMultiplier
      );

      const lineTotal = Math.round(item.quantity * item.unitCostPaise);
      const taxRate = item.taxRatePercent || 0;
      const lineTax = Math.round((lineTotal * taxRate) / 100);

      totalTaxablePaise += lineTotal;
      totalTaxPaise += lineTax;
      grandTotalPaise += lineTotal + lineTax;

      processedItems.push({
        id: uuidv4(),
        purchaseId,
        variantId: item.variantId,
        quantity: item.quantity,
        unit: item.unit,
        quantityBase: baseQuantity,
        unitCostPaise: item.unitCostPaise,
        taxRatePercent: taxRate,
        totalPaise: lineTotal + lineTax,
        pipeLengthPerPieceMm: item.pipeLengthPerPieceMm,
        numberOfPieces: item.numberOfPieces,
      });

      stockPlans.push({
        variantRow,
        baseQuantity,
        item,
      });
    }

    const outstandingPaise = Math.max(0, grandTotalPaise - input.paidAmountPaise);

    const purchase: Purchase = {
      id: purchaseId,
      storeId,
      invoiceNumber: input.invoiceNumber,
      supplierId: input.supplierId,
      purchaseDate: now,
      status: input.status,
      totalTaxablePaise,
      totalTaxPaise,
      grandTotalPaise,
      paidAmountPaise: input.paidAmountPaise,
      outstandingPaise,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      deviceId,
      items: processedItems,
      createdAt: now,
      updatedAt: now,
    };

    await db.withTransactionAsync(async () => {
      // 1. Insert purchase
      await db.runAsync(
        `INSERT INTO purchases (id, storeId, invoiceNumber, supplierId, purchaseDate, status, totalTaxablePaise, totalTaxPaise, grandTotalPaise, paidAmountPaise, outstandingPaise, paymentMethod, notes, deviceId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          purchase.id,
          purchase.storeId,
          purchase.invoiceNumber,
          purchase.supplierId ?? null,
          purchase.purchaseDate,
          purchase.status,
          purchase.totalTaxablePaise,
          purchase.totalTaxPaise,
          purchase.grandTotalPaise,
          purchase.paidAmountPaise,
          purchase.outstandingPaise,
          purchase.paymentMethod,
          purchase.notes ?? null,
          purchase.deviceId,
          now,
          now,
        ]
      );

      // 2. Insert items
      for (const pi of processedItems) {
        await db.runAsync(
          `INSERT INTO purchase_items (id, purchaseId, variantId, quantity, unit, quantityBase, unitCostPaise, taxRatePercent, totalPaise, pipeLengthPerPieceMm, numberOfPieces)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            pi.id,
            pi.purchaseId,
            pi.variantId,
            pi.quantity,
            pi.unit,
            pi.quantityBase,
            pi.unitCostPaise,
            pi.taxRatePercent,
            pi.totalPaise,
            pi.pipeLengthPerPieceMm ?? null,
            pi.numberOfPieces ?? null,
          ]
        );
      }

      // 3. If received, update stock & create movements exactly once
      if (input.status === 'received') {
        for (const sp of stockPlans) {
          const balanceBefore = sp.variantRow.currentStock;
          const balanceAfter = balanceBefore + sp.baseQuantity;

          await db.runAsync(
            `UPDATE product_variants SET currentStock = ?, purchasePricePaise = ?, updatedAt = ? WHERE id = ?;`,
            [balanceAfter, sp.item.unitCostPaise, now, sp.variantRow.id]
          );

          const movementId = uuidv4();
          await db.runAsync(
            `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, referenceId, reason, deviceId, userId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              movementId,
              storeId,
              sp.variantRow.id,
              'purchase_received',
              sp.baseQuantity,
              balanceBefore,
              balanceAfter,
              'purchase',
              purchaseId,
              `Goods receipt Bill ${input.invoiceNumber}`,
              deviceId,
              userId ?? null,
              now,
            ]
          );

          // Pipe segment creation if length product with segment tracking
          if (
            sp.variantRow.measurementType === 'length' &&
            sp.variantRow.pipeTrackingMethod === 'segment' &&
            sp.item.pipeLengthPerPieceMm &&
            sp.item.numberOfPieces
          ) {
            for (let i = 0; i < sp.item.numberOfPieces; i++) {
              const segId = uuidv4();
              await db.runAsync(
                `INSERT INTO pipe_segments (id, storeId, variantId, originalLengthMm, currentLengthMm, batchNumber, purchaseId, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?);`,
                [
                  segId,
                  storeId,
                  sp.variantRow.id,
                  sp.item.pipeLengthPerPieceMm,
                  sp.item.pipeLengthPerPieceMm,
                  input.invoiceNumber,
                  purchaseId,
                  now,
                  now,
                ]
              );
            }
          }
        }
      }
    });

    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'purchase',
      purchaseId,
      'create',
      purchase as unknown as Record<string, unknown>
    );

    return purchase;
  }
}
