import { FastifyInstance } from 'fastify';
import { connectionRoutes } from './connections.js';
import { pluginRoutes } from './plugins.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // API v1 prefix
  await fastify.register(async function apiV1(fastify) {
    // Connection management routes
    await fastify.register(connectionRoutes, { prefix: '/connections' });
    
    // Plugin management routes
    await fastify.register(pluginRoutes, { prefix: '/plugins' });
    
    // Health and metrics are registered at root level
  }, { prefix: '/v1' });
}