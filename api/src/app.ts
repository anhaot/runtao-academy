import 'dotenv/config';
import express from 'express';
import { Server } from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { db } from './database/index.js';
import { errorHandler, notFoundHandler, requestLogger, aiRateLimitMiddleware, rateLimitMiddleware } from './middleware/common.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import questionRoutes from './routes/questions.js';
import importRoutes from './routes/import.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';
import { csrfProtectionMiddleware } from './middleware/auth.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }));

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOptions = {
    origin: config.nodeEnv === 'production'
      ? allowedOrigins
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400,
  };
  app.use(cors(corsOptions));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 1000 }));
  app.use(requestLogger);
  app.use('/api', rateLimitMiddleware);
  app.use('/api', csrfProtectionMiddleware);

  app.get(['/api/health', '/api/health/live'], (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/health/ready', async (_req, res) => {
    const ready = await db.ping();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/ai', aiRateLimitMiddleware, aiRoutes);
  app.use('/api/admin', adminRoutes);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API端点不存在' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  const app = createApp();
  await db.connect();
  console.log(`Database connected: ${db.getDbType()}`);

  return app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`AI enabled: ${config.ai.enabled}`);
  });
}

export function registerShutdownHandlers(server: Server) {
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('Shutting down...');
    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      try {
        await db.close();
        clearTimeout(forceTimer);
        process.exit(0);
      } catch (error) {
        console.error('Database shutdown failed:', error);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
