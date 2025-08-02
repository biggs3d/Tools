import { AuthPlugin, AuthType } from '../types/plugin.js';
import { pino } from 'pino';

export class PluginRegistry {
  private plugins = new Map<string, AuthPlugin>();
  private logger = pino({ name: 'plugin-registry' });
  private sharedServices: any = {};

  setSharedServices(services: any): void {
    this.sharedServices = services;
  }

  async register(plugin: AuthPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    try {
      await plugin.initialize({ sharedServices: this.sharedServices });
      this.plugins.set(plugin.id, plugin);
      this.logger.info({ pluginId: plugin.id }, 'Plugin registered successfully');
    } catch (error) {
      this.logger.error({ pluginId: plugin.id, error }, 'Failed to initialize plugin');
      throw new Error(`Failed to initialize plugin ${plugin.id}: ${error}`);
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    try {
      await plugin.shutdown();
      this.plugins.delete(pluginId);
      this.logger.info({ pluginId }, 'Plugin unregistered successfully');
    } catch (error) {
      this.logger.error({ pluginId, error }, 'Error during plugin shutdown');
    }
  }

  getPlugin(pluginId: string): AuthPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginByAuthType(authType: AuthType): AuthPlugin | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.id === authType) {
        return plugin;
      }
    }
    return undefined;
  }

  getAllPlugins(): AuthPlugin[] {
    return Array.from(this.plugins.values());
  }

  async detectAuthType(endpoint: URL): Promise<{ plugin: AuthPlugin; requirements: any } | null> {
    for (const plugin of this.plugins.values()) {
      try {
        const requirements = await plugin.detectAuthRequirements(endpoint);
        if (requirements) {
          return { plugin, requirements };
        }
      } catch (error) {
        this.logger.debug({ pluginId: plugin.id, endpoint: endpoint.href, error }, 
          'Plugin failed to detect auth requirements');
      }
    }
    return null;
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.plugins.keys()).map(id => 
      this.unregister(id)
    );
    await Promise.all(shutdownPromises);
  }
}