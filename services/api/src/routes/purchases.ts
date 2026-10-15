import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { purchaseSchema, toCanonicalBaseQuantity } from '@hardware-store/shared';
import { PurchaseModel } from '../models/Transactions.js';
import {
  ProductVariantModel,
  ProductModel,
  StockMovementModel,
  PipeSegmentModel,
} from '../models/Product.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const purchasesRouter = Router();

purchasesRouter.use(requireAuth);

purchasesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const purchases = await PurchaseModel.find({ storeId: req.user!.storeId })
      .sort({ purchaseDate: -1 })
      .limit(50);
    return res.json({ success: true, data: purchases });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching purchases';
    return res.status(500).json({ success: false, error: msg });
  }
});

purchasesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = purchaseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const data = parse.data;
    const purchaseId = data.id || uuidv4();

    let totalTaxablePaise = 0;
    let totalTaxPaise = 0;
    let grandTotalPaise = 0;

    const processedItems = [];
    for (const item of data.items) {
      const variant = await ProductVariantModel.findOne({
        _id: item.variantId,
        storeId,
        deletedAt: { $exists: false },
      });
      if (!variant) {
        return res.status(404).json({
          success: false,
          error: `Variant ${item.variantId} not found`,
        });
      }

      const product = await ProductModel.findById(variant.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product for variant ${item.variantId} not found`,
        });
      }

      const baseQuantity = toCanonicalBaseQuantity(
        item.quantity,
        item.unit,
        product.measurementType,
        product.packMultiplier
      );

      const lineTotal = Math.round(item.quantity * item.unitCostPaise);
      const lineTax = Math.round((lineTotal * item.taxRatePercent) / 100);

      totalTaxablePaise += lineTotal;
      totalTaxPaise += lineTax;
      grandTotalPaise += lineTotal + lineTax;

      processedItems.push({
        _id: uuidv4(),
        variantId: item.variantId,
        quantity: item.quantity,
        unit: item.unit,
        quantityBase: baseQuantity,
        unitCostPaise: item.unitCostPaise,
        taxRatePercent: item.taxRatePercent,
        totalPaise: lineTotal + lineTax,
        pipeLengthPerPieceMm: item.pipeLengthPerPieceMm,
        numberOfPieces: item.numberOfPieces,
      });

      // If status is 'received', immediately increase stock and record stock movement
      if (data.status === 'received') {
        const balanceBefore = variant.currentStock;
        const balanceAfter = balanceBefore + baseQuantity;

        variant.currentStock = balanceAfter;
        // Update purchase price on variant
        variant.purchasePricePaise = item.unitCostPaise;
        await variant.save();

        await StockMovementModel.create({
          _id: uuidv4(),
          storeId,
          variantId: variant.id,
          movementType: 'purchase_received',
          quantityChangeBase: baseQuantity,
          balanceBeforeBase: balanceBefore,
          balanceAfterBase: balanceAfter,
          referenceType: 'purchase',
          referenceId: purchaseId,
          reason: `Goods receipt from supplier (Bill: ${data.invoiceNumber})`,
          userId: req.user!.userId,
        });

        // If length-based pipe with segment tracking, create individual segments
        if (
          product.measurementType === 'length' &&
          product.pipeTrackingMethod === 'segment' &&
          item.pipeLengthPerPieceMm &&
          item.numberOfPieces
        ) {
          for (let p = 0; p < item.numberOfPieces; p++) {
            await PipeSegmentModel.create({
              _id: uuidv4(),
              storeId,
              variantId: variant.id,
              originalLengthMm: item.pipeLengthPerPieceMm,
              currentLengthMm: item.pipeLengthPerPieceMm,
              purchaseId,
              batchNumber: data.invoiceNumber,
              status: 'available',
            });
          }
        }
      }
    }

    const outstandingPaise = Math.max(0, grandTotalPaise - data.paidAmountPaise);

    const purchase = await PurchaseModel.create({
      _id: purchaseId,
      storeId,
      invoiceNumber: data.invoiceNumber,
      supplierId: data.supplierId,
      purchaseDate: new Date(data.purchaseDate),
      status: data.status,
      totalTaxablePaise,
      totalTaxPaise,
      grandTotalPaise,
      paidAmountPaise: data.paidAmountPaise,
      outstandingPaise,
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      deviceId: req.user!.deviceId || 'web-api',
      items: processedItems,
    });

    return res.status(201).json({
      success: true,
      data: purchase.toJSON(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error recording purchase';
    return res.status(500).json({ success: false, error: msg });
  }
});
