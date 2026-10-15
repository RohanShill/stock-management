import { Router, Response } from 'express';
import {
  SyncPushRequest,
  SyncPushResponse,
  SyncOperationAck,
  SyncPullResponse,
  EntityChange,
} from '@hardware-store/shared';
import { SyncOperationModel, SyncConflictModel } from '../models/SyncModels.js';
import { CategoryModel, SubcategoryModel } from '../models/Category.js';
import {
  ProductModel,
  ProductVariantModel,
  StockMovementModel,
  PipeSegmentModel,
} from '../models/Product.js';
import {
  SaleModel,
  PurchaseModel,
  SupplierModel,
  CustomerModel,
  ExpenseModel,
} from '../models/Transactions.js';
import { CustomFieldModel } from '../models/CustomField.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const syncRouter = Router();

syncRouter.use(requireAuth);

/**
 * Push offline outbox operations idempotently.
 */
syncRouter.post('/push', async (req: AuthenticatedRequest, res: Response) => {
  const storeId = req.user!.storeId;
  const { operations = [] } = req.body as SyncPushRequest;

  const acks: SyncOperationAck[] = [];
  let processedCount = 0;

  for (const op of operations) {
    try {
      // 1. Idempotency Check: Was this operation ID already executed?
      const existingOp = await SyncOperationModel.findOne({
        _id: op.id,
        storeId,
      });

      if (existingOp && existingOp.status === 'synced') {
        // Idempotent success: already applied without duplicating!
        acks.push({
          operationId: op.id,
          entityType: op.entityType,
          entityId: op.entityId,
          status: 'acknowledged',
        });
        processedCount++;
        continue;
      }

      // 2. Process based on entity type and operation type
      const payload = op.payload || {};

      switch (op.entityType) {
        case 'category': {
          if (op.operationType === 'delete') {
            await CategoryModel.updateOne(
              { _id: op.entityId, storeId },
              { deletedAt: new Date(), active: false }
            );
          } else {
            await CategoryModel.updateOne(
              { _id: op.entityId, storeId },
              { ...payload, _id: op.entityId, storeId },
              { upsert: true }
            );
          }
          break;
        }

        case 'subcategory': {
          if (op.operationType === 'delete') {
            await SubcategoryModel.updateOne(
              { _id: op.entityId, storeId },
              { deletedAt: new Date(), active: false }
            );
          } else {
            await SubcategoryModel.updateOne(
              { _id: op.entityId, storeId },
              { ...payload, _id: op.entityId, storeId },
              { upsert: true }
            );
          }
          break;
        }

        case 'product': {
          if (op.operationType === 'delete') {
            await ProductModel.updateOne(
              { _id: op.entityId, storeId },
              { deletedAt: new Date(), active: false }
            );
          } else {
            await ProductModel.updateOne(
              { _id: op.entityId, storeId },
              { ...payload, _id: op.entityId, storeId },
              { upsert: true }
            );
          }
          break;
        }

        case 'variant': {
          if (op.operationType === 'delete') {
            await ProductVariantModel.updateOne(
              { _id: op.entityId, storeId },
              { deletedAt: new Date(), active: false }
            );
          } else {
            await ProductVariantModel.updateOne(
              { _id: op.entityId, storeId },
              { ...payload, _id: op.entityId, storeId },
              { upsert: true }
            );
          }
          break;
        }

        case 'stock_movement': {
          // Stock movements are immutable events
          const existingMovement = await StockMovementModel.findById(op.entityId);
          if (!existingMovement) {
            await StockMovementModel.create({
              ...payload,
              _id: op.entityId,
              storeId,
            });
            // Update the variant balance
            if (payload.variantId && payload.quantityChangeBase) {
              await ProductVariantModel.updateOne(
                { _id: payload.variantId, storeId },
                { $inc: { currentStock: payload.quantityChangeBase as number } }
              );
            }
          }
          break;
        }

        case 'sale': {
          const existingSale = await SaleModel.findById(op.entityId);
          if (!existingSale) {
            await SaleModel.create({
              ...payload,
              _id: op.entityId,
              storeId,
            });
          }
          break;
        }

        case 'purchase': {
          const existingPurchase = await PurchaseModel.findById(op.entityId);
          if (!existingPurchase) {
            await PurchaseModel.create({
              ...payload,
              _id: op.entityId,
              storeId,
            });
          }
          break;
        }

        case 'supplier': {
          await SupplierModel.updateOne(
            { _id: op.entityId, storeId },
            { ...payload, _id: op.entityId, storeId },
            { upsert: true }
          );
          break;
        }

        case 'customer': {
          await CustomerModel.updateOne(
            { _id: op.entityId, storeId },
            { ...payload, _id: op.entityId, storeId },
            { upsert: true }
          );
          break;
        }

        case 'expense': {
          await ExpenseModel.updateOne(
            { _id: op.entityId, storeId },
            { ...payload, _id: op.entityId, storeId },
            { upsert: true }
          );
          break;
        }

        case 'pipe_segment': {
          await PipeSegmentModel.updateOne(
            { _id: op.entityId, storeId },
            { ...payload, _id: op.entityId, storeId },
            { upsert: true }
          );
          break;
        }

        case 'custom_field': {
          if (op.operationType === 'delete') {
            await CustomFieldModel.updateOne(
              { _id: op.entityId, storeId },
              { deletedAt: new Date(), active: false }
            );
          } else {
            await CustomFieldModel.updateOne(
              { _id: op.entityId, storeId },
              { ...payload, _id: op.entityId, storeId },
              { upsert: true }
            );
          }
          break;
        }

        default:
          break;
      }

      // Record successful sync operation
      await SyncOperationModel.updateOne(
        { _id: op.id, storeId },
        {
          _id: op.id,
          storeId,
          deviceId: op.deviceId || req.user!.deviceId || 'unknown',
          entityType: op.entityType,
          entityId: op.entityId,
          operationType: op.operationType,
          payload: op.payload,
          status: 'synced',
          retryCount: op.retryCount || 0,
        },
        { upsert: true }
      );

      acks.push({
        operationId: op.id,
        entityType: op.entityType,
        entityId: op.entityId,
        status: 'acknowledged',
      });
      processedCount++;
    } catch (opErr: unknown) {
      const errorMsg = opErr instanceof Error ? opErr.message : 'Processing error';
      acks.push({
        operationId: op.id,
        entityType: op.entityType,
        entityId: op.entityId,
        status: 'rejected',
        error: errorMsg,
      });

      // Audit failed op
      await SyncOperationModel.updateOne(
        { _id: op.id, storeId },
        {
          _id: op.id,
          storeId,
          deviceId: op.deviceId || req.user!.deviceId || 'unknown',
          entityType: op.entityType,
          entityId: op.entityId,
          operationType: op.operationType,
          payload: op.payload,
          status: 'failed',
          lastError: errorMsg,
        },
        { upsert: true }
      );
    }
  }

  const response: SyncPushResponse = {
    success: true,
    processedCount,
    acknowledgements: acks,
    serverTimestamp: new Date().toISOString(),
  };

  return res.json(response);
});

/**
 * Incremental cursor-based pull of server changes.
 */
syncRouter.get('/pull', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const { sinceCursor, limit = 200 } = req.query;

    const cursorDate = sinceCursor ? new Date(sinceCursor as string) : new Date(0);
    const filter = {
      storeId,
      updatedAt: { $gt: cursorDate },
    };

    const changes: EntityChange[] = [];

    // Query categories
    const categories = await CategoryModel.find(filter).limit(Number(limit));
    for (const c of categories) {
      changes.push({
        entityType: 'category',
        entityId: c.id,
        operationType: c.deletedAt ? 'delete' : 'update',
        data: c.toJSON(),
        updatedAt: (c as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    // Query subcategories
    const subcats = await SubcategoryModel.find(filter).limit(Number(limit));
    for (const sc of subcats) {
      changes.push({
        entityType: 'subcategory',
        entityId: sc.id,
        operationType: sc.deletedAt ? 'delete' : 'update',
        data: sc.toJSON(),
        updatedAt: (sc as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    // Query products
    const products = await ProductModel.find(filter).limit(Number(limit));
    for (const p of products) {
      changes.push({
        entityType: 'product',
        entityId: p.id,
        operationType: p.deletedAt ? 'delete' : 'update',
        data: p.toJSON(),
        updatedAt: (p as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    // Query product variants
    const variants = await ProductVariantModel.find(filter).limit(Number(limit));
    for (const v of variants) {
      changes.push({
        entityType: 'variant',
        entityId: v.id,
        operationType: v.deletedAt ? 'delete' : 'update',
        data: v.toJSON(),
        updatedAt: (v as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    // Query pipe segments
    const pipeSegments = await PipeSegmentModel.find(filter).limit(Number(limit));
    for (const ps of pipeSegments) {
      changes.push({
        entityType: 'pipe_segment',
        entityId: ps.id,
        operationType: 'update',
        data: ps.toJSON(),
        updatedAt: (ps as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    // Query parties
    const suppliers = await SupplierModel.find(filter).limit(Number(limit));
    for (const sup of suppliers) {
      changes.push({
        entityType: 'supplier',
        entityId: sup.id,
        operationType: sup.deletedAt ? 'delete' : 'update',
        data: sup.toJSON(),
        updatedAt: (sup as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    const customers = await CustomerModel.find(filter).limit(Number(limit));
    for (const cust of customers) {
      changes.push({
        entityType: 'customer',
        entityId: cust.id,
        operationType: cust.deletedAt ? 'delete' : 'update',
        data: cust.toJSON(),
        updatedAt: (cust as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    const customFields = await CustomFieldModel.find(filter).limit(Number(limit));
    for (const cf of customFields) {
      changes.push({
        entityType: 'custom_field',
        entityId: cf.id,
        operationType: cf.deletedAt ? 'delete' : 'update',
        data: cf.toJSON(),
        updatedAt: (cf as unknown as { updatedAt: Date }).updatedAt?.toISOString() || new Date().toISOString(),
        version: 1,
      });
    }

    const newCursor = new Date().toISOString();

    const response: SyncPullResponse = {
      changes,
      newCursor,
      hasMore: false,
      serverTimestamp: newCursor,
    };

    return res.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error pulling changes';
    return res.status(500).json({ success: false, error: msg });
  }
});

syncRouter.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const [openConflicts, totalOperations] = await Promise.all([
      SyncConflictModel.countDocuments({ storeId, status: 'open' }),
      SyncOperationModel.countDocuments({ storeId, status: 'synced' }),
    ]);

    return res.json({
      success: true,
      data: {
        storeId,
        openConflicts,
        totalOperations,
        lastServerActivity: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching sync status';
    return res.status(500).json({ success: false, error: msg });
  }
});
