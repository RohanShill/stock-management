import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { registerStoreSchema, loginSchema } from '@hardware-store/shared';
import { StoreModel } from '../models/Store.js';
import { UserModel, DeviceModel } from '../models/User.js';
import {
  generateTokens,
  verifyRefreshToken,
  requireAuth,
  AuthenticatedRequest,
} from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register-store', async (req, res: Response) => {
  try {
    const parse = registerStoreSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const {
      storeName,
      ownerName,
      username,
      password,
      phone,
      email,
      address,
      gstin,
      deviceName,
    } = parse.data;

    const storeId = uuidv4();
    const userId = uuidv4();
    const deviceId = uuidv4();

    // Check if user exists
    const existing = await UserModel.findOne({ username });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const store = await StoreModel.create({
      _id: storeId,
      name: storeName,
      ownerName,
      phone,
      email: email || undefined,
      address,
      gstin: gstin || undefined,
      currency: 'INR',
      defaultTaxRatePercent: 18,
      invoicePrefix: 'INV',
      invoiceSequence: 1001,
      negativeStockAllowed: false,
      pipeTrackingMethod: 'aggregate',
      costingMethod: 'weighted_average',
    });

    const user = await UserModel.create({
      _id: userId,
      storeId,
      username,
      fullName: ownerName,
      role: 'admin',
      passwordHash,
      active: true,
    });

    await DeviceModel.create({
      _id: deviceId,
      storeId,
      deviceName: deviceName || 'Main Terminal',
      deviceIdentifier: uuidv4(),
      status: 'active',
    });

    const tokens = generateTokens({
      userId,
      storeId,
      username,
      role: 'admin',
      deviceId,
    });

    return res.status(201).json({
      success: true,
      data: {
        store: store.toJSON(),
        user: user.toJSON(),
        deviceId,
        tokens,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown server error';
    return res.status(500).json({ success: false, error: msg });
  }
});

authRouter.post('/login', async (req, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten() });
    }

    const { username, password, deviceId } = parse.data;
    const user = await UserModel.findOne({ username });
    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    const store = await StoreModel.findById(user.storeId);
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const effectiveDeviceId = deviceId || uuidv4();
    const tokens = generateTokens({
      userId: user.id,
      storeId: user.storeId,
      username: user.username,
      role: user.role,
      deviceId: effectiveDeviceId,
    });

    return res.json({
      success: true,
      data: {
        store: store.toJSON(),
        user: user.toJSON(),
        deviceId: effectiveDeviceId,
        tokens,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return res.status(500).json({ success: false, error: msg });
  }
});

authRouter.post('/refresh', async (req, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.userId);
    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: 'User is inactive or not found' });
    }

    const tokens = generateTokens({
      userId: user.id,
      storeId: user.storeId,
      username: user.username,
      role: user.role,
      deviceId: payload.deviceId,
    });

    return res.json({ success: true, data: { tokens } });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user!.userId);
    const store = await StoreModel.findById(req.user!.storeId);
    if (!user || !store) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    return res.json({
      success: true,
      data: { user: user.toJSON(), store: store.toJSON() },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching profile';
    return res.status(500).json({ success: false, error: msg });
  }
});
