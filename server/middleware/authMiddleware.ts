import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getEffectivePermissions, hasPermission } from '../auth/permissions';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    permissions: bigint;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'vietcrm_super_secret_jwt_key_2026_change_in_production';

interface CachedAuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  status: string;
  permissions: bigint;
  cachedAt: number;
}

const AUTH_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const authUserCache = new Map<string, CachedAuthUser>();

export function invalidateAuthCache(userId?: string): void {
  if (userId) {
    authUserCache.delete(userId);
  } else {
    authUserCache.clear();
  }
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Truy cập bị từ chối. Token xác thực không tồn tại.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const now = Date.now();
    const cached = authUserCache.get(decoded.id);

    if (cached && now - cached.cachedAt < AUTH_CACHE_TTL_MS) {
      if (cached.status !== 'active') {
        authUserCache.delete(decoded.id);
        return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' });
      }

      req.user = {
        id: cached.id,
        email: cached.email,
        role: cached.role,
        name: cached.name,
        permissions: cached.permissions,
      };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        status: true,
        permissionAllow: true,
        permissionDeny: true,
      },
    });

    if (!user || user.status !== 'active') {
      authUserCache.delete(decoded.id);
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.' });
    }

    const permissions = await getEffectivePermissions(user.role, user.permissionAllow, user.permissionDeny);
    authUserCache.set(user.id, {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status,
      permissions,
      cachedAt: now,
    });

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      permissions,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    console.error('[Auth] Không thể xác thực quyền người dùng:', error);
    return res.status(500).json({ error: 'Không thể xác thực quyền truy cập.' });
  }
}

export function requirePermission(requiredPermission: bigint) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
    }
    if (!hasPermission(req.user.permissions, requiredPermission)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

/** @deprecated Use requirePermission for authorization. */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Quyền truy cập bị từ chối. Vai trò '${req.user.role}' không có quyền thực hiện thao tác này.`
      });
    }

    next();
  };
}
