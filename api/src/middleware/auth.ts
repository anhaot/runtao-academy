import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';
import { db } from '../database/index.js';
import { User, UserPermissions } from '../types/index.js';

export interface AuthRequest extends Request {
  user?: User;
}

const AUTH_COOKIE_NAME = 'tgh_auth';
const CSRF_COOKIE_NAME = 'tgh_csrf';

const permissionCompatibilityMap: Partial<Record<keyof UserPermissions, Array<keyof UserPermissions>>> = {
  question_view: ['question_view', 'question_create', 'question_edit_content', 'question_edit_meta', 'question_delete', 'question_batch_edit'],
  category_view: ['category_view', 'category_manage'],
  ai_use: ['ai_use', 'ai_generate', 'ai_config_manage', 'ai_chat', 'ai_polish'],
  backup_export: ['backup_export', 'backup_restore'],
};

export const hasPermission = (user: User | undefined, permission: keyof UserPermissions): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.permissions?.[permission]) {
    return true;
  }

  return Boolean(permissionCompatibilityMap[permission]?.some((key) => user.permissions?.[key]));
};

export const getLibraryOwnerId = (user: User): string => {
  return user.user_type === 'integrated' && user.library_owner_id ? user.library_owner_id : user.id;
};

export const hasCategoryScopeAccess = (user: User, categoryId: string | null | undefined): boolean => {
  if (!categoryId || user.role === 'admin' || user.user_type !== 'integrated') {
    return true;
  }

  if (!user.category_scopes || user.category_scopes.length === 0) {
    return true;
  }

  return user.category_scopes.includes(categoryId);
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      res.status(401).json({ error: '未提供认证令牌' });
      return;
    }
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: '用户不存在' });
      return;
    }

    req.user = user;
    const passwordChangeAllowed = req.originalUrl.startsWith('/api/auth/profile')
      || req.originalUrl.startsWith('/api/auth/me');
    if (user.must_change_password && !passwordChangeAllowed) {
      res.status(428).json({
        error: '首次登录必须先修改默认密码',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
      return;
    }
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: '无效的认证令牌' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: '认证令牌已过期' });
      return;
    }
    res.status(500).json({ error: '认证失败' });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!hasPermission(req.user, 'system_manage')) {
    res.status(403).json({ error: '需要管理员权限' });
    return;
  }
  next();
};

export const requirePermission = (permission: keyof UserPermissions, errorMessage = '权限不足') =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!hasPermission(req.user, permission)) {
      res.status(403).json({ error: errorMessage });
      return;
    }
    next();
  };

export const generateToken = (userId: string): string => {
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign({ userId }, config.jwt.secret, options);
};

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((acc, pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = '';
      }
    }
    return acc;
  }, {});
}

export const generateCsrfToken = (): string => randomBytes(32).toString('hex');

export const csrfProtectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const usesCookieAuth = Boolean(cookies[AUTH_COOKIE_NAME]);
  const usesBearerAuth = req.headers.authorization?.startsWith('Bearer ');
  if (!usesCookieAuth || usesBearerAuth) {
    next();
    return;
  }

  const cookieToken = cookies[CSRF_COOKIE_NAME] || '';
  const headerToken = String(req.headers['x-csrf-token'] || '');
  const validLength = cookieToken.length > 0 && cookieToken.length === headerToken.length;
  const valid = validLength && timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  if (!valid) {
    res.status(403).json({ error: 'CSRF 校验失败，请刷新页面后重试' });
    return;
  }
  next();
};

function extractAuthToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[AUTH_COOKIE_NAME];
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

export const authCookieName = AUTH_COOKIE_NAME;
export const csrfCookieName = CSRF_COOKIE_NAME;
