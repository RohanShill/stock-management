import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supplierSchema, customerSchema } from '@hardware-store/shared';
import { SupplierModel, CustomerModel } from '../models/Transactions.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const partiesRouter = Router();

partiesRouter.use(requireAuth);

// Suppliers
partiesRouter.get('/suppliers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const suppliers = await SupplierModel.find({
      storeId: req.user!.storeId,
      deletedAt: { $exists: false },
    }).sort({ name: 1 });
    return res.json({ success: true, data: suppliers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching suppliers';
    return res.status(500).json({ success: false, error: msg });
  }
});

partiesRouter.post('/suppliers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = supplierSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const supplier = await SupplierModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      name: parse.data.name,
      businessName: parse.data.businessName,
      phone: parse.data.phone,
      alternatePhone: parse.data.alternatePhone,
      email: parse.data.email,
      address: parse.data.address,
      gstin: parse.data.gstin,
      notes: parse.data.notes,
      active: true,
    });

    return res.status(201).json({ success: true, data: supplier.toJSON() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating supplier';
    return res.status(500).json({ success: false, error: msg });
  }
});

// Customers
partiesRouter.get('/customers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customers = await CustomerModel.find({
      storeId: req.user!.storeId,
      deletedAt: { $exists: false },
    }).sort({ name: 1 });
    return res.json({ success: true, data: customers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching customers';
    return res.status(500).json({ success: false, error: msg });
  }
});

partiesRouter.post('/customers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = customerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const customer = await CustomerModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      name: parse.data.name,
      phone: parse.data.phone,
      address: parse.data.address,
      businessName: parse.data.businessName,
      gstin: parse.data.gstin,
      notes: parse.data.notes,
      active: true,
    });

    return res.status(201).json({ success: true, data: customer.toJSON() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating customer';
    return res.status(500).json({ success: false, error: msg });
  }
});
