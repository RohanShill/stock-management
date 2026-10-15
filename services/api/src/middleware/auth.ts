import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@hardware-store/shared';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_super_secure_key_12345';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_super_secure_key_67890';

export interface AuthenticatedUserPayload {
  userId: string;
  storeId: string;
  username: string;
  role: UserRole;
  deviceId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
}

export function generateTokens(payload: AuthenticatedUserPayload) {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): AuthenticatedUserPayload {
  return jwt.verify(token, ACCESS_SECRET) as AuthenticatedUserPayload;
}

export function verifyRefreshToken(token: string): AuthenticatedUserPayload {
  return jwt.verify(token, REFRESH_SECRET) as AuthenticatedUserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permission for this action' });
    }
    next();
  };
}
