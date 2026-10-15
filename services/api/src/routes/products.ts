import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  productSchema,
  bulkImportProductRowSchema,
  rupeeToPaise,
} from '@hardware-store/shared';
import {
  ProductModel,
  ProductVariantModel,
  StockMovementModel,
  PipeSegmentModel,
} from '../models/Product.js';
import { CategoryModel, SubcategoryModel } from '../models/Category.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);

// List products with optional search and filters
productsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, subcategoryId, search, stockStatus, includeArchived } = req.query;
    const filter: Record<string, unknown> = {
      storeId: req.user!.storeId,
    };
    if (includeArchived !== 'true') {
      filter.deletedAt = { $exists: false };
      filter.active = true;
    }

    if (categoryId) filter.categoryId = categoryId;
    if (subcategoryId) filter.subcategoryId = subcategoryId;
    if (search && typeof search === 'string') {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { modelNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await ProductModel.find(filter).sort({ name: 1 });
    const productIds = products.map((p) => p.id);

    const variantFilter: Record<string, unknown> = {
      storeId: req.user!.storeId,
      productId: { $in: productIds },
    };
    if (includeArchived !== 'true') {
      variantFilter.deletedAt = { $exists: false };
      variantFilter.active = true;
    }

    const variants = await ProductVariantModel.find(variantFilter);

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.productId) || [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    let results = products.map((p) => ({
      ...p.toJSON(),
      variants: variantsByProduct.get(p.id) || [],
    }));

    if (stockStatus) {
      results = results.filter((p) => {
        const totalStock = p.variants.reduce((sum, v) => sum + v.currentStock, 0);
        if (stockStatus === 'out') return totalStock <= 0;
        if (stockStatus === 'low') {
          return p.variants.some((v) => v.currentStock > 0 && v.currentStock <= v.minStockLevel);
        }
        if (stockStatus === 'in') return totalStock > 0;
        return true;
      });
    }

    return res.json({ success: true, data: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching products';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Create product with variants and auditable opening stock
productsRouter.post('/', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = productSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const productId = req.body.id || uuidv4();
    const data = parse.data;

    // Verify SKUs are unique within store
    const skus = data.variants.map((v) => v.sku);
    const existingVariant = await ProductVariantModel.findOne({
      storeId,
      sku: { $in: skus },
      deletedAt: { $exists: false },
    });
    if (existingVariant) {
      return res.status(409).json({
        success: false,
        error: `SKU '${existingVariant.sku}' already exists in this store`,
      });
    }

    const product = await ProductModel.create({
      _id: productId,
      storeId,
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      name: data.name,
      brand: data.brand,
      material: data.material,
      description: data.description,
      modelNumber: data.modelNumber,
      imageUrl: data.imageUrl,
      measurementType: data.measurementType,
      baseUnit: data.baseUnit,
      allowedUnits: data.allowedUnits,
      packMultiplier: data.packMultiplier || 1,
      pipeDiameterMm: data.pipeDiameterMm,
      standardLengthMm: data.standardLengthMm,
      pipeTrackingMethod: data.pipeTrackingMethod,
      customValues: data.customValues,
      active: true,
    });

    const createdVariants = [];
    for (const v of data.variants) {
      const variantId = v.id || uuidv4();
      const currentStock = v.openingStock || 0;

      const variant = await ProductVariantModel.create({
        _id: variantId,
        storeId,
        productId,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        size: v.size,
        color: v.color,
        purchasePricePaise: v.purchasePricePaise,
        sellingPricePaise: v.sellingPricePaise,
        mrpPaise: v.mrpPaise,
        taxRatePercent: v.taxRatePercent,
        minStockLevel: v.minStockLevel,
        openingStock: v.openingStock,
        currentStock,
        rackLocation: v.rackLocation,
        preferredSupplierId: v.preferredSupplierId,
        customValues: v.customValues,
        active: true,
      });

      // Record immutable opening stock movement if initial stock > 0
      if (currentStock > 0) {
        await StockMovementModel.create({
          _id: uuidv4(),
          storeId,
          variantId,
          movementType: 'opening_stock',
          quantityChangeBase: currentStock,
          balanceBeforeBase: 0,
          balanceAfterBase: currentStock,
          referenceType: 'manual',
          reason: 'Initial opening stock setup',
          userId: req.user!.userId,
        });

        // If pipe product with segment tracking, generate initial segment pieces
        if (
          data.measurementType === 'length' &&
          data.pipeTrackingMethod === 'segment' &&
          data.standardLengthMm
        ) {
          const numPieces = Math.floor(currentStock / data.standardLengthMm);
          for (let i = 0; i < numPieces; i++) {
            await PipeSegmentModel.create({
              _id: uuidv4(),
              storeId,
              variantId,
              originalLengthMm: data.standardLengthMm,
              currentLengthMm: data.standardLengthMm,
              status: 'available',
            });
          }
        }
      }

      createdVariants.push(variant.toJSON());
    }

    return res.status(201).json({
      success: true,
      data: {
        ...product.toJSON(),
        variants: createdVariants,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating product';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Update product & variants
productsRouter.patch('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const productId = req.params.id;

    const existing = await ProductModel.findOne({ _id: productId, storeId });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { variants, ...productUpdates } = req.body;

    const updatedProduct = await ProductModel.findOneAndUpdate(
      { _id: productId, storeId },
      { $set: productUpdates },
      { new: true }
    );

    // Update variants if provided
    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        if (v.id) {
          await ProductVariantModel.updateOne(
            { _id: v.id, storeId, productId },
            { $set: v }
          );
        } else {
          // New variant added to existing product
          await ProductVariantModel.create({
            _id: uuidv4(),
            storeId,
            productId,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            size: v.size,
            color: v.color,
            purchasePricePaise: v.purchasePricePaise || 0,
            sellingPricePaise: v.sellingPricePaise || 0,
            mrpPaise: v.mrpPaise,
            taxRatePercent: v.taxRatePercent || 18,
            minStockLevel: v.minStockLevel || 5,
            openingStock: v.openingStock || 0,
            currentStock: v.openingStock || 0,
            rackLocation: v.rackLocation,
            preferredSupplierId: v.preferredSupplierId,
            customValues: v.customValues,
            active: true,
          });
        }
      }
    }

    const currentVariants = await ProductVariantModel.find({
      storeId,
      productId,
      deletedAt: { $exists: false },
    });

    return res.json({
      success: true,
      data: {
        ...updatedProduct!.toJSON(),
        variants: currentVariants,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating product';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Archive product and its variants safely
productsRouter.delete('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const productId = req.params.id;

    const product = await ProductModel.findOne({ _id: productId, storeId });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    product.deletedAt = new Date().toISOString();
    product.active = false;
    await product.save();

    await ProductVariantModel.updateMany(
      { productId, storeId },
      { deletedAt: new Date().toISOString(), active: false }
    );

    return res.json({
      success: true,
      message: 'Product and variants archived safely. Historical transaction ledger preserved.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error archiving product';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Bulk CSV Import endpoint
productsRouter.post('/bulk-import', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const { rows = [] } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No rows provided for import' });
    }

    let importedProductsCount = 0;
    let importedVariantsCount = 0;
    const errors: Array<{ rowNumber: number; sku: string; error: string }> = [];

    // Group rows by Category -> Subcategory -> Product
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const parse = bulkImportProductRowSchema.safeParse(row);
      if (!parse.success) {
        errors.push({
          rowNumber: i + 1,
          sku: row.sku || 'N/A',
          error: parse.error.issues.map((iss) => iss.message).join(', '),
        });
        continue;
      }

      const item = parse.data;

      // Check if SKU exists
      const existingSku = await ProductVariantModel.findOne({
        storeId,
        sku: item.sku,
        deletedAt: { $exists: false },
      });
      if (existingSku) {
        errors.push({
          rowNumber: i + 1,
          sku: item.sku,
          error: `SKU '${item.sku}' already exists in store`,
        });
        continue;
      }

      // Find or create Category
      let cat = await CategoryModel.findOne({ storeId, name: item.categoryName });
      if (!cat) {
        cat = await CategoryModel.create({
          _id: uuidv4(),
          storeId,
          name: item.categoryName,
          displayOrder: 0,
          active: true,
        });
      }

      // Find or create Subcategory
      let subcat = await SubcategoryModel.findOne({
        storeId,
        categoryId: cat.id,
        name: item.subcategoryName,
      });
      if (!subcat) {
        subcat = await SubcategoryModel.create({
          _id: uuidv4(),
          storeId,
          categoryId: cat.id,
          name: item.subcategoryName,
          displayOrder: 0,
          active: true,
        });
      }

      // Find or create Product
      let product = await ProductModel.findOne({
        storeId,
        categoryId: cat.id,
        subcategoryId: subcat.id,
        name: item.productName,
      });

      if (!product) {
        product = await ProductModel.create({
          _id: uuidv4(),
          storeId,
          categoryId: cat.id,
          subcategoryId: subcat.id,
          name: item.productName,
          brand: item.brand,
          measurementType: item.measurementType,
          baseUnit: item.baseUnit,
          allowedUnits: [item.baseUnit],
          active: true,
        });
        importedProductsCount++;
      }

      // Create Variant
      const variantId = uuidv4();
      const variant = await ProductVariantModel.create({
        _id: variantId,
        storeId,
        productId: product.id,
        name: item.variantName,
        sku: item.sku,
        barcode: item.barcode,
        size: item.size,
        purchasePricePaise: rupeeToPaise(item.purchasePriceRs),
        sellingPricePaise: rupeeToPaise(item.sellingPriceRs),
        taxRatePercent: item.taxRatePercent,
        minStockLevel: item.minStockLevel,
        openingStock: item.openingStock,
        currentStock: item.openingStock,
        rackLocation: item.rackLocation,
        active: true,
      });

      if (item.openingStock > 0) {
        await StockMovementModel.create({
          _id: uuidv4(),
          storeId,
          variantId,
          movementType: 'opening_stock',
          quantityChangeBase: item.openingStock,
          balanceBeforeBase: 0,
          balanceAfterBase: item.openingStock,
          referenceType: 'manual',
          reason: 'Bulk CSV Catalogue Import',
          userId: req.user!.userId,
        });
      }

      importedVariantsCount++;
    }

    return res.status(201).json({
      success: true,
      data: {
        importedProductsCount,
        importedVariantsCount,
        errors,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error during bulk import';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Get single product details
productsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = await ProductModel.findOne({
      _id: req.params.id,
      storeId: req.user!.storeId,
      deletedAt: { $exists: false },
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const variants = await ProductVariantModel.find({
      storeId: req.user!.storeId,
      productId: product.id,
      deletedAt: { $exists: false },
    });

    return res.json({
      success: true,
      data: {
        ...product.toJSON(),
        variants,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching product';
    return res.status(500).json({ success: false, error: msg });
  }
});
