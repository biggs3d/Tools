import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { pino } from 'pino';
import { PluginRegistry } from './core/plugin-registry.js';
import { registerRoutes } from './api/routes.js';
import { OAuth2Plugin } from './plugins/oauth2/index.js';
import { JWTPlugin } from './plugins/jwt/index.js';
import { DistributedStateStore } from './services/state-store.js';

const loggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
};

const logger = pino(loggerOptions);

async function buildServer() {
  const fastify = Fastify({
    logger: loggerOptions,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId'
  });

  // Security plugins
  await fastify.register(helmet, {
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
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true
  });

  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-this-secret'
  });

  // Initialize shared services
  const stateStore = new DistributedStateStore({
    redisUrl: process.env.REDIS_URL,
    fallbackToMemory: process.env.NODE_ENV === 'development'
  });

  // Initialize plugin registry with shared services
  const pluginRegistry = new PluginRegistry();
  const sharedServices = { stateStore };
  pluginRegistry.setSharedServices(sharedServices);
  
  // Register built-in plugins
  await pluginRegistry.register(new OAuth2Plugin());
  await pluginRegistry.register(new JWTPlugin());

  // Decorate fastify instance with services
  fastify.decorate('pluginRegistry', pluginRegistry);

  // Register API routes
  await registerRoutes(fastify);

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    checks: {
      plugins: pluginRegistry.getAllPlugins().length
    }
  }));

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');
    await pluginRegistry.shutdown();
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    logger.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };