import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { customFieldSchema, updateCustomFieldSchema } from '@hardware-store/shared';
import { CustomFieldModel } from '../models/CustomField.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const customFieldsRouter = Router();

customFieldsRouter.use(requireAuth);

customFieldsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetLevel, targetId, includeArchived } = req.query;
    const filter: Record<string, unknown> = {
      storeId: req.user!.storeId,
    };
    if (includeArchived !== 'true') {
      filter.deletedAt = { $exists: false };
      filter.active = true;
    }
    if (targetLevel) filter.targetLevel = targetLevel;
    if (targetId) filter.targetId = targetId;

    const fields = await CustomFieldModel.find(filter).sort({ displayOrder: 1, label: 1 });
    return res.json({ success: true, data: fields });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching custom fields';
    return res.status(500).json({ success: false, error: msg });
  }
});

customFieldsRouter.post('/', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = customFieldSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const field = await CustomFieldModel.create({
      _id: req.body.id || uuidv4(),
      storeId: req.user!.storeId,
      ...parse.data,
      active: true,
    });

    return res.status(201).json({ success: true, data: field });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating custom field';
    return res.status(500).json({ success: false, error: msg });
  }
});

customFieldsRouter.patch('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = updateCustomFieldSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const field = await CustomFieldModel.findOneAndUpdate(
      { _id: req.params.id, storeId: req.user!.storeId },
      { $set: parse.data },
      { new: true }
    );

    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    return res.json({ success: true, data: field });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating custom field';
    return res.status(500).json({ success: false, error: msg });
  }
});

customFieldsRouter.delete('/:id', requireRole(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const field = await CustomFieldModel.findOneAndUpdate(
      { _id: req.params.id, storeId: req.user!.storeId },
      { deletedAt: new Date(), active: false },
      { new: true }
    );

    if (!field) {
      return res.status(404).json({ success: false, error: 'Custom field definition not found' });
    }

    return res.json({ success: true, message: 'Custom field definition archived successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error archiving custom field';
    return res.status(500).json({ success: false, error: msg });
  }
});
