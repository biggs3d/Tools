import { IDatabaseProvider } from './database-provider.interface.js';
import { IDatabaseConfig, loadDatabaseConfig, DatabaseType } from './config.js';
import { DatabaseProviderFactory } from './factory.js';
import { ConnectionError } from './utils/error.utils.js';
import { logDebug, logError, logInfo, logWarn } from './utils/logging.utils.js';

/**
 * Main service for accessing database functionality.
 * Acts as a facade for the underlying database provider.
 */
export class DatabaseService {
    private provider: IDatabaseProvider | null = null;
    private config: IDatabaseConfig;
    private connectionPromise: Promise<void> | null = null;

    /**
     * Initialize the DatabaseService
     * @param config Optional: Database configuration. If not provided, it will be loaded from environment variables.
     */
    constructor(config?: IDatabaseConfig) {
        this.config = config || loadDatabaseConfig();
        if (this.config) {
            logDebug('DatabaseService initialized', { type: this.config.type });
            
            // Auto-connect if configured
            if (this.config.autoConnect) {
                this.autoConnect();
            }
        } else {
            // Fallback to a sensible default config if none provided
            this.config = { type: DatabaseType.InMemory };
            logDebug('DatabaseService initialized with default config', { type: this.config.type });
        }
    }

    /**
     * Auto-connect if configured
     */
    private autoConnect(): void {
        logDebug('Auto-connecting database provider');
        
        this.getProvider()
            .then(() => {
                logInfo('Auto-connect successful');
            })
            .catch(error => {
                logError('Auto-connect failed', error);
            });
    }

    /**
     * Get the database provider.
     * If not already connected, this will create and connect the provider.
     * @returns The database provider
     */
    public async getProvider(): Promise<IDatabaseProvider> {
        // If already connected, return the provider
        if (this.provider && this.provider.isConnected()) {
            return this.provider;
        }
        
        // If a connection is already in progress, wait for it
        if (this.connectionPromise) {
            try {
                await this.connectionPromise;
                if (this.provider && this.provider.isConnected()) {
                    return this.provider;
                }
            } catch (error) {
                logError('Previous connection attempt failed', error);
                // Continue with a new connection attempt
            }
        }
        
        // Start a new connection
        this.connectionPromise = this.connectProviderInternal();
        
        try {
            await this.connectionPromise;
            return this.provider!;
        } finally {
            this.connectionPromise = null;
        }
    }

    /**
     * Internal method to create and connect the provider
     */
    private async connectProviderInternal(): Promise<void> {
        logInfo('Creating and connecting database provider', { type: this.config.type });
        
        try {
            // Create provider
            this.provider = DatabaseProviderFactory.createProvider(this.config);
            
            // Connect provider
            const providerConfig = this.getProviderConfigForConnect();
            await this.provider.connect(providerConfig);
            
            logInfo('Database provider connected successfully');
        } catch (error) {
            logError('Failed to connect database provider', error);
            this.provider = null;
            throw new ConnectionError(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract the provider-specific configuration slice for connect()
     */
    private getProviderConfigForConnect(): any {
        if (!this.config.providerConfig) {
            return undefined;
        }
        
        return this.config.providerConfig[this.config.type as keyof IDatabaseConfig['providerConfig']];
    }

    /**
     * Disconnect the database provider
     */
    public async disconnectProvider(): Promise<void> {
        logInfo('Disconnecting database provider');
        
        // If connection is in progress, wait for it to complete before disconnecting
        if (this.connectionPromise) {
            try {
                await this.connectionPromise;
            } catch (error) {
                // Ignore connection errors when disconnecting
                logWarn('Connection in progress failed during disconnect', error);
            } finally {
                this.connectionPromise = null;
            }
        }
        
        if (this.provider && this.provider.isConnected()) {
            try {
                await this.provider.disconnect();
                logInfo('Database provider disconnected successfully');
            } catch (error) {
                logError('Failed to disconnect database provider', error);
                throw new ConnectionError(`Failed to disconnect from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                this.provider = null;
            }
        } else {
            logInfo('Database provider is already disconnected');
        }
    }

    /**
     * Get the current configuration
     * @returns The current database configuration
     */
    public getCurrentConfig(): IDatabaseConfig {
        return { ...this.config };
    }
}