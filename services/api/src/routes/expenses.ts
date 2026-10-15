import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { expenseSchema } from '@hardware-store/shared';
import { ExpenseModel } from '../models/Transactions.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

expensesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const expenses = await ExpenseModel.find({ storeId: req.user!.storeId })
      .sort({ date: -1 })
      .limit(100);
    return res.json({ success: true, data: expenses });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching expenses';
    return res.status(500).json({ success: false, error: msg });
  }
});

expensesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = expenseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const expense = await ExpenseModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      category: parse.data.category,
      amountPaise: parse.data.amountPaise,
      date: new Date(parse.data.date),
      paymentMethod: parse.data.paymentMethod,
      description: parse.data.description,
      reference: parse.data.reference,
    });

    return res.status(201).json({ success: true, data: expense.toJSON() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error recording expense';
    return res.status(500).json({ success: false, error: msg });
  }
});
