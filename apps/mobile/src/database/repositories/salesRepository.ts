import { v4 as uuidv4 } from '../../utils/uuid.js';
import {
  Sale,
  SaleItem,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  convertQuantityToProductUnit,
  toCanonicalBaseQuantity,
  calculateSegmentCuttingPlan,
  PipeSegment,
} from '@hardware-store/shared';
import { getDatabase } from '../db.js';
import { SyncQueueRepository } from './syncQueueRepository.js';

export interface CreateSaleInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  saleDate?: string;
  items: Array<{
    variantId: string;
    quantity: number;
    unit: any;
    unitPricePaise: number;
    discountPaise?: number;
    taxRatePercent?: number;
    pipeCutSummary?: string;
  }>;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit' | 'bank_transfer';
  paidAmountPaise?: number;
  invoiceDiscountPaise?: number;
  notes?: string;
}

export class SalesRepository {
  static async getSales(storeId: string, limit = 50): Promise<Sale[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM sales WHERE storeId = ? ORDER BY saleDate DESC LIMIT ?;`,
      [storeId, limit]
    );

    if (!rows || rows.length === 0) return [];

    const saleIds = rows.map((r) => r.id);
    const placeholders = saleIds.map(() => '?').join(',');
    const allItems = await db.getAllAsync<any>(
      `SELECT * FROM sale_items WHERE saleId IN (${placeholders});`,
      saleIds
    );

    const itemsBySaleId = new Map<string, any[]>();
    for (const item of allItems) {
      if (!itemsBySaleId.has(item.saleId)) {
        itemsBySaleId.set(item.saleId, []);
      }
      itemsBySaleId.get(item.saleId)!.push(item);
    }

    return rows.map((r) => ({
      ...r,
      items: itemsBySaleId.get(r.id) || [],
    }));
  }

  static async getSale(saleId: string): Promise<Sale | null> {
    const db = await getDatabase();
    const r = await db.getFirstAsync<any>(
      `SELECT * FROM sales WHERE id = ?;`,
      [saleId]
    );
    if (!r) return null;

    const items = await db.getAllAsync<any>(
      `SELECT * FROM sale_items WHERE saleId = ?;`,
      [saleId]
    );
    return { ...r, items };
  }

  static async createSale(
    input: CreateSaleInput,
    storeId: string,
    deviceId: string,
    userId?: string
  ): Promise<Sale> {
    const db = await getDatabase();
    const saleId = uuidv4();
    const now = input.saleDate || new Date().toISOString();

    // Fetch store config for invoice numbering & negative stock
    const store = await db.getFirstAsync<any>(
      `SELECT * FROM stores WHERE id = ?;`,
      [storeId]
    );
    const prefix = store?.invoicePrefix || 'INV';
    const seq = (store?.invoiceSequence || 1000) + 1;
    const invoiceNumber = `${prefix}-${seq}`;

    // Process line items
    const calculatedLines = [];
    const processedItems: SaleItem[] = [];
    const stockPlans: Array<{
      variantRow: any;
      baseDeduction: number;
      item: (typeof input.items)[0];
    }> = [];

    for (const item of input.items) {
      const variantRow = await db.getFirstAsync<any>(
        `SELECT * FROM product_variants WHERE id = ?;`,
        [item.variantId]
      );
      if (!variantRow) {
        throw new Error(`Variant ${item.variantId} not found`);
      }
      const productRow = await db.getFirstAsync<any>(
        `SELECT * FROM products WHERE id = ?;`,
        [variantRow.productId]
      );
      variantRow.measurementType = productRow?.measurementType || 'count';
      variantRow.packMultiplier = productRow?.packMultiplier || 1;
      variantRow.baseUnit = productRow?.baseUnit || 'piece';
      variantRow.pipeTrackingMethod = productRow?.pipeTrackingMethod;

      const baseQuantity = convertQuantityToProductUnit(
        item.quantity,
        item.unit,
        variantRow.baseUnit,
        variantRow.measurementType,
        variantRow.packMultiplier
      );

      if (variantRow.currentStock < baseQuantity && !store?.negativeStockAllowed) {
        throw new Error(`Insufficient stock for '${variantRow.name}'. Available: ${variantRow.currentStock} ${variantRow.baseUnit}, Requested: ${baseQuantity} ${variantRow.baseUnit}`);
      }

      const lineTotal = calculateLineItemTotals({
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        discountPaise: item.discountPaise || 0,
        taxRatePercent: item.taxRatePercent ?? variantRow.taxRatePercent,
      });

      calculatedLines.push(lineTotal);

      processedItems.push({
        id: uuidv4(),
        saleId,
        variantId: item.variantId,
        quantity: item.quantity,
        unit: item.unit,
        quantityBase: baseQuantity,
        unitPricePaise: item.unitPricePaise,
        discountPaise: lineTotal.discountPaise,
        taxRatePercent: lineTotal.taxRatePercent,
        totalPaise: lineTotal.finalAmountPaise,
        pipeCutSummary: item.pipeCutSummary,
      });

      stockPlans.push({
        variantRow,
        baseDeduction: baseQuantity,
        item,
      });
    }

    const invTotals = calculateInvoiceTotals(
      calculatedLines,
      input.invoiceDiscountPaise || 0,
      true
    );

    const paidAmountPaise = input.paidAmountPaise ?? invTotals.grandTotalPaise;
    const outstandingPaise = Math.max(0, invTotals.grandTotalPaise - paidAmountPaise);

    const sale: Sale = {
      id: saleId,
      storeId,
      invoiceNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      saleDate: now,
      status: 'completed',
      subtotalGrossPaise: invTotals.subtotalGrossPaise,
      totalDiscountPaise: invTotals.totalLineDiscountsPaise + invTotals.invoiceDiscountPaise,
      totalTaxablePaise: invTotals.totalTaxablePaise,
      totalTaxPaise: invTotals.totalTaxPaise,
      roundOffPaise: invTotals.roundOffPaise,
      grandTotalPaise: invTotals.grandTotalPaise,
      paidAmountPaise,
      outstandingPaise,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      deviceId,
      userId,
      items: processedItems,
      createdAt: now,
      updatedAt: now,
    };

    // Atomic SQLite Transaction
    await db.withTransactionAsync(async () => {
      // 1. Update store invoice sequence
      if (store) {
        await db.runAsync(`UPDATE stores SET invoiceSequence = ? WHERE id = ?;`, [seq, storeId]);
      }

      // 2. Insert sale
      await db.runAsync(
        `INSERT INTO sales (id, storeId, invoiceNumber, customerId, customerName, customerPhone, saleDate, status, subtotalGrossPaise, totalDiscountPaise, totalTaxablePaise, totalTaxPaise, roundOffPaise, grandTotalPaise, paidAmountPaise, outstandingPaise, paymentMethod, notes, deviceId, userId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          sale.id,
          sale.storeId,
          sale.invoiceNumber,
          sale.customerId ?? null,
          sale.customerName ?? null,
          sale.customerPhone ?? null,
          sale.saleDate,
          sale.subtotalGrossPaise,
          sale.totalDiscountPaise,
          sale.totalTaxablePaise,
          sale.totalTaxPaise,
          sale.roundOffPaise,
          sale.grandTotalPaise,
          sale.paidAmountPaise,
          sale.outstandingPaise,
          sale.paymentMethod,
          sale.notes ?? null,
          sale.deviceId,
          sale.userId ?? null,
          now,
          now,
        ]
      );

      // 3. Insert sale items
      for (const item of processedItems) {
        await db.runAsync(
          `INSERT INTO sale_items (id, saleId, variantId, quantity, unit, quantityBase, unitPricePaise, discountPaise, taxRatePercent, totalPaise, pipeCutSummary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            item.id,
            item.saleId,
            item.variantId,
            item.quantity,
            item.unit,
            item.quantityBase,
            item.unitPricePaise,
            item.discountPaise,
            item.taxRatePercent,
            item.totalPaise,
            item.pipeCutSummary ?? null,
          ]
        );
      }

      // 4. Update stocks and insert movements atomically
      for (const sp of stockPlans) {
        const fresh = await db.getFirstAsync<{ currentStock: number }>(
          `SELECT currentStock FROM product_variants WHERE id = ?;`,
          [sp.variantRow.id]
        );
        const balanceBefore = Number(fresh?.currentStock ?? sp.variantRow.currentStock ?? 0);
        const balanceAfter = balanceBefore - sp.baseDeduction;

        await db.runAsync(
          `UPDATE product_variants SET currentStock = ?, updatedAt = ? WHERE id = ?;`,
          [balanceAfter, now, sp.variantRow.id]
        );

        const movementId = uuidv4();
        await db.runAsync(
          `INSERT INTO stock_movements (id, storeId, variantId, movementType, quantityChangeBase, balanceBeforeBase, balanceAfterBase, referenceType, referenceId, reason, deviceId, userId, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            movementId,
            storeId,
            sp.variantRow.id,
            'sale',
            -sp.baseDeduction,
            balanceBefore,
            balanceAfter,
            'sale',
            saleId,
            `Sale ${invoiceNumber}`,
            deviceId,
            userId ?? null,
            now,
          ]
        );

        // 5. Segment cutting tracking if pipe variant has method 'segment'
        if (
          sp.variantRow.measurementType === 'length' &&
          sp.variantRow.pipeTrackingMethod === 'segment'
        ) {
          const segRows = await db.getAllAsync<any>(
            `SELECT * FROM pipe_segments WHERE variantId = ? AND status = 'available';`,
            [sp.variantRow.id]
          );
          const cutPlan = calculateSegmentCuttingPlan(
            segRows as PipeSegment[],
            sp.baseDeduction
          );
          if (cutPlan.feasible) {
            for (const cut of cutPlan.cuts) {
              await db.runAsync(
                `UPDATE pipe_segments SET currentLengthMm = ?, status = ?, updatedAt = ? WHERE id = ?;`,
                [cut.remnantRemainingMm, cut.statusAfter, now, cut.segmentId]
              );
            }
          }
        }
      }
    });

    // Enqueue outbox operation for background sync
    await SyncQueueRepository.enqueue(
      storeId,
      deviceId,
      'sale',
      saleId,
      'create',
      sale as unknown as Record<string, unknown>
    );

    return sale;
  }
}
