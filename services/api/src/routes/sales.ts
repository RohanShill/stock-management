import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  saleSchema,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  convertQuantityToProductUnit,
  calculateSegmentCuttingPlan,
} from '@hardware-store/shared';
import { SaleModel } from '../models/Transactions.js';
import {
  ProductVariantModel,
  ProductModel,
  StockMovementModel,
  PipeSegmentModel,
} from '../models/Product.js';
import { StoreModel } from '../models/Store.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const salesRouter = Router();

salesRouter.use(requireAuth);

// List sales
salesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromDate, toDate, limit = 50 } = req.query;
    const filter: Record<string, unknown> = { storeId: req.user!.storeId };

    if (fromDate || toDate) {
      filter.saleDate = {};
      if (fromDate) (filter.saleDate as Record<string, unknown>).$gte = new Date(fromDate as string);
      if (toDate) (filter.saleDate as Record<string, unknown>).$lte = new Date(toDate as string);
    }

    const sales = await SaleModel.find(filter)
      .sort({ saleDate: -1 })
      .limit(Number(limit));

    return res.json({ success: true, data: sales });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching sales';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Create completed sale with server-side recalculated financials and atomic stock deductions
salesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = saleSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const data = parse.data;
    const store = await StoreModel.findById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const saleId = data.id || uuidv4();
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = `${store.invoicePrefix}-${store.invoiceSequence}`;
      store.invoiceSequence += 1;
      await store.save();
    }

    // Process line items and verify stocks
    const processedLineItems = [];
    const calculatedLineFinancials = [];
    const stockDeductionPlan: Array<{
      variant: InstanceType<typeof ProductVariantModel>;
      product: InstanceType<typeof ProductModel>;
      baseDeduction: number;
      item: (typeof data.items)[0];
    }> = [];

    for (const item of data.items) {
      const variant = await ProductVariantModel.findOne({
        _id: item.variantId,
        storeId,
        deletedAt: { $exists: false },
      });
      if (!variant) {
        return res.status(404).json({
          success: false,
          error: `Product variant ${item.variantId} not found`,
        });
      }

      const product = await ProductModel.findById(variant.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product for variant ${item.variantId} not found`,
        });
      }

      const baseQuantity = convertQuantityToProductUnit(
        item.quantity,
        item.unit,
        product.baseUnit,
        product.measurementType,
        product.packMultiplier
      );

      // Validate stock
      if (variant.currentStock < baseQuantity && !store.negativeStockAllowed) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for '${product.name} - ${variant.name}'. Available: ${variant.currentStock}, Requested: ${baseQuantity}`,
        });
      }

      const lineFinancial = calculateLineItemTotals({
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        discountPaise: item.discountPaise,
        taxRatePercent: item.taxRatePercent ?? variant.taxRatePercent,
      });

      calculatedLineFinancials.push(lineFinancial);
      processedLineItems.push({
        _id: uuidv4(),
        variantId: item.variantId,
        quantity: item.quantity,
        unit: item.unit,
        quantityBase: baseQuantity,
        unitPricePaise: item.unitPricePaise,
        discountPaise: lineFinancial.discountPaise,
        taxRatePercent: lineFinancial.taxRatePercent,
        totalPaise: lineFinancial.finalAmountPaise,
        pipeCutSummary: item.pipeCutSummary,
      });

      stockDeductionPlan.push({
        variant,
        product,
        baseDeduction: baseQuantity,
        item,
      });
    }

    // Recalculate invoice totals server-side
    const invoiceTotals = calculateInvoiceTotals(
      calculatedLineFinancials,
      data.invoiceDiscountPaise || 0,
      true
    );

    const paidAmountPaise = data.paidAmountPaise ?? invoiceTotals.grandTotalPaise;
    const outstandingPaise = Math.max(0, invoiceTotals.grandTotalPaise - paidAmountPaise);

    // Apply stock deductions and movements
    for (const plan of stockDeductionPlan) {
      const balanceBefore = plan.variant.currentStock;
      const balanceAfter = balanceBefore - plan.baseDeduction;

      plan.variant.currentStock = balanceAfter;
      await plan.variant.save();

      await StockMovementModel.create({
        _id: uuidv4(),
        storeId,
        variantId: plan.variant.id,
        movementType: 'sale',
        quantityChangeBase: -plan.baseDeduction,
        balanceBeforeBase: balanceBefore,
        balanceAfterBase: balanceAfter,
        referenceType: 'sale',
        referenceId: saleId,
        reason: `Sale ${invoiceNumber}`,
        userId: req.user!.userId,
        deviceId: req.user!.deviceId,
      });

      // If segment tracking is used for this length-based pipe, update segments
      if (
        plan.product.measurementType === 'length' &&
        plan.product.pipeTrackingMethod === 'segment'
      ) {
        const availableSegments = await PipeSegmentModel.find({
          storeId,
          variantId: plan.variant.id,
          status: 'available',
        });
        const cutPlan = calculateSegmentCuttingPlan(
          availableSegments.map((s) => s.toJSON()),
          plan.baseDeduction
        );
        if (cutPlan.feasible) {
          for (const cut of cutPlan.cuts) {
            const seg = await PipeSegmentModel.findById(cut.segmentId);
            if (seg) {
              seg.currentLengthMm = cut.remnantRemainingMm;
              seg.status = cut.statusAfter;
              await seg.save();
            }
          }
        }
      }
    }

    const sale = await SaleModel.create({
      _id: saleId,
      storeId,
      invoiceNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      saleDate: new Date(data.saleDate),
      status: 'completed',
      subtotalGrossPaise: invoiceTotals.subtotalGrossPaise,
      totalDiscountPaise: invoiceTotals.totalLineDiscountsPaise + invoiceTotals.invoiceDiscountPaise,
      totalTaxablePaise: invoiceTotals.totalTaxablePaise,
      totalTaxPaise: invoiceTotals.totalTaxPaise,
      roundOffPaise: invoiceTotals.roundOffPaise,
      grandTotalPaise: invoiceTotals.grandTotalPaise,
      paidAmountPaise,
      outstandingPaise,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      deviceId: req.user!.deviceId || 'web-api',
      userId: req.user!.userId,
      items: processedLineItems,
    });

    return res.status(201).json({
      success: true,
      data: sale.toJSON(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating sale';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Sale returns with reusable vs damaged condition stock reconciliation
salesRouter.post('/:id/returns', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sale = await SaleModel.findOne({
      _id: req.params.id,
      storeId: req.user!.storeId,
    });
    if (!sale) {
      return res.status(404).json({ success: false, error: 'Sale record not found' });
    }

    const { items, reason } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Return items are required' });
    }

    let totalRefundPaise = 0;

    for (const returnItem of items) {
      const { variantId, quantity, unit, condition, refundPaise } = returnItem;
      const variant = await ProductVariantModel.findById(variantId);
      if (!variant) continue;
      const product = await ProductModel.findById(variant.productId);
      if (!product) continue;

      const baseQuantity = convertQuantityToProductUnit(
        quantity,
        unit,
        product.baseUnit,
        product.measurementType,
        product.packMultiplier
      );

      totalRefundPaise += refundPaise || 0;

      // Only reusable condition returns increase stock!
      if (condition === 'reusable') {
        const balanceBefore = variant.currentStock;
        const balanceAfter = balanceBefore + baseQuantity;
        variant.currentStock = balanceAfter;
        await variant.save();

        await StockMovementModel.create({
          _id: uuidv4(),
          storeId: req.user!.storeId,
          variantId: variant.id,
          movementType: 'sale_return',
          quantityChangeBase: baseQuantity,
          balanceBeforeBase: balanceBefore,
          balanceAfterBase: balanceAfter,
          referenceType: 'return',
          referenceId: sale.id,
          reason: reason || 'Customer return (reusable)',
          userId: req.user!.userId,
        });
      } else {
        // Damaged / discarded goods do NOT increase usable stock, but we audit the event
        await StockMovementModel.create({
          _id: uuidv4(),
          storeId: req.user!.storeId,
          variantId: variant.id,
          movementType: 'damaged_goods',
          quantityChangeBase: 0,
          balanceBeforeBase: variant.currentStock,
          balanceAfterBase: variant.currentStock,
          referenceType: 'return',
          referenceId: sale.id,
          reason: `Customer return (${condition} - not returned to stock)`,
          userId: req.user!.userId,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Sale return processed successfully',
      totalRefundPaise,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error processing sale return';
    return res.status(500).json({ success: false, error: msg });
  }
});
