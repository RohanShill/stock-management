import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  stockAdjustmentSchema,
  convertQuantityToProductUnit,
  StockMovementType,
} from '@hardware-store/shared';
import {
  ProductVariantModel,
  ProductModel,
  StockMovementModel,
  PipeSegmentModel,
} from '../models/Product.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

// Stock adjustment endpoint
inventoryRouter.post('/adjustments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = stockAdjustmentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const { variantId, adjustmentType, quantityChange, unit, reason, notes } = parse.data;
    const storeId = req.user!.storeId;

    const variant = await ProductVariantModel.findOne({
      _id: variantId,
      storeId,
      deletedAt: { $exists: false },
    });
    if (!variant) {
      return res.status(404).json({ success: false, error: 'Product variant not found' });
    }

    const product = await ProductModel.findById(variant.productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Parent product not found' });
    }

    // Convert requested adjustment to product base unit
    const baseQuantity = convertQuantityToProductUnit(
      quantityChange,
      unit,
      product.baseUnit,
      product.measurementType,
      product.packMultiplier
    );

    let movementType: StockMovementType = 'adjustment_increase';
    let delta = baseQuantity;

    if (adjustmentType === 'decrease') {
      movementType = 'adjustment_decrease';
      delta = -baseQuantity;
    } else if (adjustmentType === 'damaged') {
      movementType = 'damaged_goods';
      delta = -baseQuantity;
    } else if (adjustmentType === 'loss') {
      movementType = 'stock_loss';
      delta = -baseQuantity;
    } else if (adjustmentType === 'reconciliation') {
      movementType = 'reconciliation';
      // in reconciliation, delta adjusts to target
    }

    const balanceBefore = variant.currentStock;
    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock for adjustment (Current: ${balanceBefore}, Requested deduction: ${Math.abs(delta)})`,
      });
    }

    // Atomic update
    variant.currentStock = balanceAfter;
    await variant.save();

    const movement = await StockMovementModel.create({
      _id: uuidv4(),
      storeId,
      variantId,
      movementType,
      quantityChangeBase: delta,
      balanceBeforeBase: balanceBefore,
      balanceAfterBase: balanceAfter,
      referenceType: 'adjustment',
      reason,
      notes,
      userId: req.user!.userId,
      deviceId: req.user!.deviceId,
    });

    return res.status(201).json({
      success: true,
      data: {
        variant: variant.toJSON(),
        movement: movement.toJSON(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error adjusting stock';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Stock movement ledger
inventoryRouter.get('/:variantId/ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { variantId } = req.params;
    const movements = await StockMovementModel.find({
      storeId: req.user!.storeId,
      variantId,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, data: movements });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching stock ledger';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Pipe segments for a variant (Method B)
inventoryRouter.get('/:variantId/segments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { variantId } = req.params;
    const segments = await PipeSegmentModel.find({
      storeId: req.user!.storeId,
      variantId,
    }).sort({ currentLengthMm: 1 });

    return res.json({ success: true, data: segments });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching pipe segments';
    return res.status(500).json({ success: false, error: msg });
  }
});
