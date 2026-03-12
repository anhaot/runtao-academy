import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../config/index.js';

const rateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

const authRateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

const aiRateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
});

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || 'unknown';
    await rateLimiter.consume(ip);
    next();
  } catch {
    res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
};

export const authRateLimitMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || 'unknown';
    await authRateLimiter.consume(ip);
    next();
  } catch {
    res.status(429).json({ error: '认证请求过于频繁，请稍后再试' });
  }
};

export const aiRateLimitMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || 'unknown';
    await aiRateLimiter.consume(ip);
    next();
  } catch {
    res.status(429).json({ error: 'AI请求过于频繁，请稍后再试' });
  }
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
};

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({ error: config.nodeEnv === 'development' ? err.message : '服务器内部错误' });
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: '资源未找到' });
};
