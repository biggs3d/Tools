import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PluginRegistry } from '../core/plugin-registry.js';

declare module 'fastify' {
  interface FastifyInstance {
    pluginRegistry: PluginRegistry;
  }
}

const DetectSchema = z.object({
  endpoint: z.string().url()
});

export const pluginRoutes: FastifyPluginAsync = async (fastify) => {
  // List available plugins
  fastify.get('/', async (request, reply) => {
    const plugins = fastify.pluginRegistry.getAllPlugins().map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      configSchema: plugin.getConfigSchema()
    }));

    return {
      plugins
    };
  });

  // Auto-detect auth requirements
  fastify.post('/detect', async (request, reply) => {
    try {
      const { endpoint } = DetectSchema.parse(request.body);
      const url = new URL(endpoint);
      
      const result = await fastify.pluginRegistry.detectAuthType(url);
      
      if (result) {
        return {
          detected: true,
          authType: result.plugin.id,
          requirements: result.requirements
        };
      }

      return {
        detected: false,
        authType: null,
        requirements: null
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors
          }
        });
      }
      throw error;
    }
  });

  // Get specific plugin details
  fastify.get('/:pluginId', async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    const plugin = fastify.pluginRegistry.getPlugin(pluginId);

    if (!plugin) {
      return reply.status(404).send({
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `Plugin ${pluginId} not found`
        }
      });
    }

    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      configSchema: plugin.getConfigSchema()
    };
  });
};