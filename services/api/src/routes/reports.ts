import { Router, Response } from 'express';
import { ProductVariantModel, ProductModel } from '../models/Product.js';
import { CategoryModel } from '../models/Category.js';
import { SaleModel, PurchaseModel, ExpenseModel } from '../models/Transactions.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.get('/dashboard-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      categoriesCount,
      variants,
      todaySales,
      todayPurchases,
      todayExpenses,
    ] = await Promise.all([
      CategoryModel.countDocuments({ storeId, deletedAt: { $exists: false } }),
      ProductVariantModel.find({ storeId, deletedAt: { $exists: false } }),
      SaleModel.find({
        storeId,
        saleDate: { $gte: startOfToday, $lte: endOfToday },
        status: 'completed',
      }),
      PurchaseModel.find({
        storeId,
        purchaseDate: { $gte: startOfToday, $lte: endOfToday },
        status: 'received',
      }),
      ExpenseModel.find({
        storeId,
        date: { $gte: startOfToday, $lte: endOfToday },
      }),
    ]);

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValuePaise = 0;

    for (const v of variants) {
      if (v.currentStock <= 0) {
        outOfStockCount++;
      } else if (v.currentStock <= v.minStockLevel) {
        lowStockCount++;
      }
      totalInventoryValuePaise += Math.max(0, v.currentStock * v.purchasePricePaise);
    }

    const todaySalesPaise = todaySales.reduce((sum, s) => sum + s.grandTotalPaise, 0);
    const todayPurchasesPaise = todayPurchases.reduce((sum, p) => sum + p.grandTotalPaise, 0);
    const todayExpensesPaise = todayExpenses.reduce((sum, e) => sum + e.amountPaise, 0);

    // Approximate gross profit: Selling total minus cost basis of sold items
    let todayEstimatedCostPaise = 0;
    const variantCostMap = new Map<string, number>();
    for (const v of variants) {
      variantCostMap.set(v.id, v.purchasePricePaise);
    }

    for (const s of todaySales) {
      for (const item of s.items || []) {
        const costPerUnit = variantCostMap.get(item.variantId) || 0;
        todayEstimatedCostPaise += Math.round(item.quantity * costPerUnit);
      }
    }

    const todayEstimatedGrossProfitPaise = todaySalesPaise - todayEstimatedCostPaise;

    return res.json({
      success: true,
      data: {
        totalCategories: categoriesCount,
        totalActiveVariants: variants.length,
        lowStockCount,
        outOfStockCount,
        totalInventoryValuePaise,
        todaySalesPaise,
        todayPurchasesPaise,
        todayExpensesPaise,
        todayEstimatedGrossProfitPaise,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching dashboard summary';
    return res.status(500).json({ success: false, error: msg });
  }
});
