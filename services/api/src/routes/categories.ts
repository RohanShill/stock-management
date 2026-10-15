import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  categorySchema,
  updateCategorySchema,
  subcategorySchema,
  updateSubcategorySchema,
  reorderItemsSchema,
  moveSubcategorySchema,
} from '@hardware-store/shared';
import { CategoryModel, SubcategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

// ----------------------------------------------------
// Categories CRUD & Reordering
// ----------------------------------------------------

categoriesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { includeArchived } = req.query;
    const filter: Record<string, unknown> = {
      storeId: req.user!.storeId,
    };
    if (includeArchived !== 'true') {
      filter.deletedAt = { $exists: false };
      filter.active = true;
    }

    const categories = await CategoryModel.find(filter).sort({ displayOrder: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching categories';
    return res.status(500).json({ success: false, error: msg });
  }
});

categoriesRouter.post('/', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = categorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const category = await CategoryModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      name: parse.data.name,
      description: parse.data.description,
      icon: parse.data.icon,
      displayOrder: parse.data.displayOrder ?? 0,
      active: true,
    });

    return res.status(201).json({ success: true, data: category });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating category';
    return res.status(500).json({ success: false, error: msg });
  }
});

categoriesRouter.patch('/reorder', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = reorderItemsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const updates = parse.data.items.map((item) =>
      CategoryModel.updateOne({ _id: item.id, storeId }, { displayOrder: item.displayOrder })
    );
    await Promise.all(updates);

    return res.json({ success: true, message: 'Categories reordered successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error reordering categories';
    return res.status(500).json({ success: false, error: msg });
  }
});

categoriesRouter.patch('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = updateCategorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const category = await CategoryModel.findOneAndUpdate(
      { _id: req.params.id, storeId: req.user!.storeId },
      { $set: parse.data },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    return res.json({ success: true, data: category });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating category';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Safe Archive Category: reports affected count and marks deletedAt without breaking references
categoriesRouter.delete('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const categoryId = req.params.id;

    const category = await CategoryModel.findOne({ _id: categoryId, storeId });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }

    // Check affected subcategories and products
    const [subcatCount, productCount] = await Promise.all([
      SubcategoryModel.countDocuments({ categoryId, storeId, deletedAt: { $exists: false } }),
      ProductModel.countDocuments({ categoryId, storeId, deletedAt: { $exists: false } }),
    ]);

    category.deletedAt = new Date().toISOString();
    category.active = false;
    await category.save();

    return res.json({
      success: true,
      message: 'Category archived safely. Historical references preserved.',
      affectedSubcategories: subcatCount,
      affectedProducts: productCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error archiving category';
    return res.status(500).json({ success: false, error: msg });
  }
});

// ----------------------------------------------------
// Subcategories CRUD, Reordering, and Move Parent Category
// ----------------------------------------------------

categoriesRouter.get('/subcategories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryId, includeArchived } = req.query;
    const filter: Record<string, unknown> = {
      storeId: req.user!.storeId,
    };
    if (includeArchived !== 'true') {
      filter.deletedAt = { $exists: false };
      filter.active = true;
    }
    if (categoryId) filter.categoryId = categoryId;

    const subcategories = await SubcategoryModel.find(filter).sort({ displayOrder: 1, name: 1 });
    return res.json({ success: true, data: subcategories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching subcategories';
    return res.status(500).json({ success: false, error: msg });
  }
});

categoriesRouter.post('/subcategories', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = subcategorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const subcategory = await SubcategoryModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      categoryId: parse.data.categoryId,
      name: parse.data.name,
      description: parse.data.description,
      displayOrder: parse.data.displayOrder ?? 0,
      active: true,
    });

    return res.status(201).json({ success: true, data: subcategory });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating subcategory';
    return res.status(500).json({ success: false, error: msg });
  }
});

categoriesRouter.patch('/subcategories/reorder', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = reorderItemsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const updates = parse.data.items.map((item) =>
      SubcategoryModel.updateOne({ _id: item.id, storeId }, { displayOrder: item.displayOrder })
    );
    await Promise.all(updates);

    return res.json({ success: true, message: 'Subcategories reordered successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error reordering subcategories';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Update subcategory or move to another parent category
categoriesRouter.patch('/subcategories/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = updateSubcategorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const storeId = req.user!.storeId;
    const subcat = await SubcategoryModel.findOneAndUpdate(
      { _id: req.params.id, storeId },
      { $set: parse.data },
      { new: true }
    );

    if (!subcat) {
      return res.status(404).json({ success: false, error: 'Subcategory not found' });
    }

    // If parent categoryId was changed, update associated products parent categoryId for consistency
    if (parse.data.categoryId) {
      await ProductModel.updateMany(
        { subcategoryId: subcat.id, storeId },
        { categoryId: parse.data.categoryId }
      );
    }

    return res.json({ success: true, data: subcat });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating subcategory';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Safe Archive Subcategory
categoriesRouter.delete('/subcategories/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const subcategoryId = req.params.id;

    const subcat = await SubcategoryModel.findOne({ _id: subcategoryId, storeId });
    if (!subcat) {
      return res.status(404).json({ success: false, error: 'Subcategory not found' });
    }

    const productCount = await ProductModel.countDocuments({
      subcategoryId,
      storeId,
      deletedAt: { $exists: false },
    });

    subcat.deletedAt = new Date().toISOString();
    subcat.active = false;
    await subcat.save();

    return res.json({
      success: true,
      message: 'Subcategory archived safely',
      affectedProducts: productCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error archiving subcategory';
    return res.status(500).json({ success: false, error: msg });
  }
});
