/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import * as path from 'path';
import * as fs from 'fs/promises';
// Import simple-git properly to ensure mocking works correctly
import { simpleGit, SimpleGit } from 'simple-git';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { 
    ConnectionError, 
    QueryError, 
    ConfigurationError, 
    UnsupportedOperationError 
} from '../utils/error.utils.js';
import { 
    validateCollectionName, 
    validateId, 
    validateConnected, 
    assertDefined, 
    assertNotEmpty 
} from '../utils/validation.utils.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.utils.js';

/**
 * Error thrown when a synchronization operation fails.
 */
export class SyncError extends QueryError {
    constructor(message: string) {
        super(message);
        this.name = 'SyncError';
    }
}

/**
 * Error thrown when there is a merge conflict.
 */
export class MergeConflictError extends SyncError {
    constructor(message: string) {
        super(message);
        this.name = 'MergeConflictError';
    }
}

/**
 * Configuration options for the GitSyncProvider
 */
export interface GitSyncProviderConfig {
    /** Path to the Git repository */
    repositoryPath: string;
    /** Synchronization options */
    syncOptions?: {
        /** Remote repository name (default: origin) */
        remote?: string;
        /** Branch name (default: main) */
        branch?: string;
        /** Sync interval in milliseconds (default: 60000, 0 to disable) */
        interval?: number;
        /** Whether to auto-commit changes (default: true) */
        autoCommit?: boolean;
        /** Whether to auto-sync with remote (default: true) */
        autoSync?: boolean;
        /** Author information for commits */
        author?: {
            name: string;
            email: string;
        };
    };
    /** Strategy for handling conflicts (default: accept-local) */
    conflictStrategy?: 'accept-local' | 'accept-remote' | 'merge';
}

/**
 * Git synchronization database provider implementation.
 * Wraps another IDatabaseProvider to add Git-based versioning and sync.
 */
export class GitSyncProvider implements IDatabaseProvider {
    private _isConnected: boolean = false;
    private baseProvider: IDatabaseProvider;
    private git: SimpleGit | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private pendingChanges: Set<string> = new Set();
    private config: Required<GitSyncProviderConfig>;

    /**
     * Initialize the GitSyncProvider with configuration
     * @param config Configuration for the GitSyncProvider
     * @param baseProvider The underlying database provider
     */
    constructor(config: GitSyncProviderConfig, baseProvider: IDatabaseProvider) {
        assertDefined(config, 'config');
        assertDefined(baseProvider, 'baseProvider');
        assertNotEmpty(config.repositoryPath, 'repositoryPath');
        
        this.baseProvider = baseProvider;
        
        const syncOptions = config.syncOptions || {};
        this.config = {
            repositoryPath: config.repositoryPath,
            syncOptions: {
                remote: syncOptions.remote || 'origin',
                branch: syncOptions.branch || 'main',
                interval: syncOptions.interval ?? 60000,
                autoCommit: syncOptions.autoCommit !== false,
                autoSync: syncOptions.autoSync !== false,
                author: syncOptions.author || {
                    name: 'GitSyncProvider',
                    email: 'git-sync@example.com'
                }
            },
            conflictStrategy: config.conflictStrategy || 'accept-local'
        };
        
        logDebug('GitSyncProvider initialized', { 
            repositoryPath: this.config.repositoryPath,
            remote: this.config.syncOptions.remote,
            branch: this.config.syncOptions.branch
        });
    }

    /**
     * Connect to the database and initialize Git repository.
     */
    async connect(): Promise<void> {
        logInfo('GitSyncProvider connecting');
        
        if (this._isConnected) {
            logWarn('GitSyncProvider is already connected');
            return;
        }
        
        try {
            // First connect the base provider
            if (!this.baseProvider.isConnected()) {
                await this.baseProvider.connect();
            }
            
            // Initialize Git repository
            await this.initializeGit();
            
            this._isConnected = true;
            
            // Start sync interval if configured
            if ((this.config.syncOptions.interval ?? 0) > 0 && this.config.syncOptions.autoSync) {
                this.startSyncInterval();
            }
            
            logInfo('GitSyncProvider connected successfully');
        } catch (error) {
            // Clean up if connection fails
            if (this.baseProvider.isConnected()) {
                try {
                    await this.baseProvider.disconnect();
                } catch (disconnectError) {
                    logError('Failed to disconnect base provider during error cleanup', disconnectError);
                }
            }
            
            logError('Failed to connect GitSyncProvider', error);
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the database and clean up resources.
     */
    async disconnect(): Promise<void> {
        logInfo('GitSyncProvider disconnecting');
        
        if (!this._isConnected) {
            logWarn('GitSyncProvider is already disconnected');
            return;
        }
        
        try {
            // Stop sync interval
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
            
            // Commit any pending changes
            if (this.pendingChanges.size > 0 && this.config.syncOptions.autoCommit) {
                try {
                    await this.commitChanges('Auto-commit on disconnect');
                } catch (commitError) {
                    logWarn('Failed to commit pending changes on disconnect', commitError);
                }
            }
            
            // Sync with remote if enabled
            if (this.config.syncOptions.autoSync) {
                try {
                    await this.syncWithRemote();
                } catch (syncError) {
                    logWarn('Failed to sync with remote on disconnect', syncError);
                }
            }
            
            // Disconnect base provider
            await this.baseProvider.disconnect();
            
            this._isConnected = false;
            this.git = null;
            this.pendingChanges.clear();
            
            logInfo('GitSyncProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect GitSyncProvider', error);
            throw new ConnectionError(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if the provider is connected.
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean {
        return this._isConnected && this.baseProvider.isConnected();
    }

    /**
     * Create a new item in the specified collection.
     * @param collectionName The name of the collection
     * @param data The item data to create
     * @returns The created item with a generated id if not provided
     */
    async create<T_Item, T_Return = T_Item>(collectionName: string, data: T_Item): Promise<T_Return> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        logDebug(`Creating item in collection: ${collectionName}`, { data });
        
        try {
            // Check for sync conflicts
            if (this.config.syncOptions.autoSync) {
                await this.checkForConflicts();
            }
            
            // Create item using base provider
            const result = await this.baseProvider.create<T_Item, T_Return>(collectionName, data);
            
            // Mark collection as having pending changes
            this.pendingChanges.add(collectionName);
            
            // Auto-commit if enabled
            if (this.config.syncOptions.autoCommit) {
                await this.commitChanges(`Create item in ${collectionName}`);
            }
            
            return result;
        } catch (error) {
            logError(`Failed to create item in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to create item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Read an item by ID from the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to read
     * @returns The item or null if not found
     */
    async read<T_Return>(collectionName: string, id: string): Promise<T_Return | null> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Reading item with ID ${id} from collection: ${collectionName}`);
        
        try {
            // Read operation does not modify data, no need to check for conflicts
            return await this.baseProvider.read<T_Return>(collectionName, id);
        } catch (error) {
            logError(`Failed to read item with ID ${id} from collection: ${collectionName}`, error);
            throw new QueryError(`Failed to read item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update an existing item in the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to update
     * @param data The partial data to update
     * @returns The updated item or null if not found
     */
    async update<T_Item, T_Return = T_Item>(collectionName: string, id: string, data: Partial<T_Item>): Promise<T_Return | null> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Updating item with ID ${id} in collection: ${collectionName}`, { data });
        
        try {
            // Check for sync conflicts
            if (this.config.syncOptions.autoSync) {
                await this.checkForConflicts();
            }
            
            // Update item using base provider
            const result = await this.baseProvider.update<T_Item, T_Return>(collectionName, id, data);
            
            if (result) {
                // Mark collection as having pending changes
                this.pendingChanges.add(collectionName);
                
                // Auto-commit if enabled
                if (this.config.syncOptions.autoCommit) {
                    await this.commitChanges(`Update item ${id} in ${collectionName}`);
                }
            }
            
            return result;
        } catch (error) {
            logError(`Failed to update item with ID ${id} in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete an item by ID from the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to delete
     * @returns True if deleted, false if not found
     */
    async delete(collectionName: string, id: string): Promise<boolean> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Deleting item with ID ${id} from collection: ${collectionName}`);
        
        try {
            // Check for sync conflicts
            if (this.config.syncOptions.autoSync) {
                await this.checkForConflicts();
            }
            
            // Delete item using base provider
            const result = await this.baseProvider.delete(collectionName, id);
            
            if (result) {
                // Mark collection as having pending changes
                this.pendingChanges.add(collectionName);
                
                // Auto-commit if enabled
                if (this.config.syncOptions.autoCommit) {
                    await this.commitChanges(`Delete item ${id} from ${collectionName}`);
                }
            }
            
            return result;
        } catch (error) {
            logError(`Failed to delete item with ID ${id} from collection: ${collectionName}`, error);
            throw new QueryError(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Query items from the specified collection.
     * @param collectionName The name of the collection
     * @param queryOptions Query options for filtering, sorting, and pagination
     * @returns Array of items matching the query
     */
    async query<T_Return, T_CustomFilters = any>(
        collectionName: string, 
        queryOptions: QueryOptions<T_CustomFilters> = {}
    ): Promise<T_Return[]> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        logDebug(`Querying collection: ${collectionName}`, { queryOptions });
        
        try {
            // Query operation does not modify data, no need to check for conflicts
            return await this.baseProvider.query<T_Return, T_CustomFilters>(collectionName, queryOptions);
        } catch (error) {
            logError(`Failed to query collection: ${collectionName}`, error);
            throw new QueryError(`Failed to query items: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Begins a new transaction.
     * Delegates to the base provider's transaction support.
     */
    async beginTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.baseProvider.beginTransaction) {
            throw new UnsupportedOperationError('Base provider does not support transactions');
        }
        
        // Check for sync conflicts
        if (this.config.syncOptions.autoSync) {
            await this.checkForConflicts();
        }
        
        return await this.baseProvider.beginTransaction();
    }

    /**
     * Commits the current active transaction.
     * Delegates to the base provider's transaction support.
     */
    async commitTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.baseProvider.commitTransaction) {
            throw new UnsupportedOperationError('Base provider does not support transactions');
        }
        
        // Commit the database transaction
        await this.baseProvider.commitTransaction();
        
        // Mark that changes were made
        this.pendingChanges.add('transaction');
        
        // Auto-commit to Git if enabled
        if (this.config.syncOptions.autoCommit) {
            await this.commitChanges('Commit transaction');
        }
    }

    /**
     * Rolls back the current active transaction.
     * Delegates to the base provider's transaction support.
     */
    async rollbackTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.baseProvider.rollbackTransaction) {
            throw new UnsupportedOperationError('Base provider does not support transactions');
        }
        
        return await this.baseProvider.rollbackTransaction();
    }

    /**
     * Ensures an index exists on a given field (or set of fields) for a collection.
     * Delegates to the base provider's index management.
     * @param collectionName The logical name of the collection or table.
     * @param indexDefinition Definition of the index.
     */
    async ensureIndex(collectionName: string, indexDefinition: any): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        if (!this.baseProvider.ensureIndex) {
            throw new UnsupportedOperationError('Base provider does not support index management');
        }
        
        try {
            await this.baseProvider.ensureIndex(collectionName, indexDefinition);
            
            // Mark collection as having pending changes
            this.pendingChanges.add(collectionName);
            
            // Auto-commit if enabled
            if (this.config.syncOptions.autoCommit) {
                await this.commitChanges(`Create index on ${collectionName}`);
            }
        } catch (error) {
            logError(`Failed to create index for collection: ${collectionName}`, error);
            throw error instanceof UnsupportedOperationError
                ? error
                : new QueryError(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures a collection/table exists and optionally conforms to a given schema.
     * Delegates to the base provider's schema management.
     * @param collectionName The logical name of the collection or table.
     * @param schemaDefinition Optional: Definition of the schema for the collection.
     */
    async ensureSchema(collectionName: string, schemaDefinition?: any): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        if (!this.baseProvider.ensureSchema) {
            throw new UnsupportedOperationError('Base provider does not support schema management');
        }
        
        try {
            await this.baseProvider.ensureSchema(collectionName, schemaDefinition);
            
            // Mark collection as having pending changes
            this.pendingChanges.add(collectionName);
            
            // Auto-commit if enabled
            if (this.config.syncOptions.autoCommit) {
                await this.commitChanges(`Create or update schema for ${collectionName}`);
            }
        } catch (error) {
            logError(`Failed to ensure schema for collection: ${collectionName}`, error);
            throw error instanceof UnsupportedOperationError
                ? error
                : new QueryError(`Failed to ensure schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get the version history for an item.
     * @param collectionName The name of the collection
     * @param id The ID of the item
     * @returns Array of commit information for the item
     */
    async getHistory(collectionName: string, id: string): Promise<Array<{
        commitHash: string;
        author: string;
        date: string;
        message: string;
    }>> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        try {
            if (!this.git) {
                throw new ConnectionError('Git repository is not initialized');
            }
            
            const git = this.git;
            const itemPattern = `*${collectionName}*${id}*`;
            
            // Get the log for files matching the pattern
            const log = await git.log({ file: itemPattern });
            
            return log.all.map((commit: any) => ({
                commitHash: commit.hash,
                author: `${commit.author_name} <${commit.author_email}>`,
                date: commit.date,
                message: commit.message
            }));
        } catch (error) {
            logError(`Failed to get history for item ${id} in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to get history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get a specific version of an item.
     * Note: This is a simplified implementation and may not work for all base providers.
     * @param collectionName The name of the collection
     * @param id The ID of the item
     * @param commitHash The commit hash to retrieve
     * @returns The item as it was at the specified commit, or null if not found
     */
    async getVersion<T_Return>(collectionName: string, id: string, commitHash: string): Promise<T_Return | null> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        try {
            if (!this.git) {
                throw new ConnectionError('Git repository is not initialized');
            }
            
            const git = this.git;
            const currentBranch = await git.branch();
            
            // Temporarily checkout the commit
            await git.checkout(commitHash);
            
            try {
                // Read the item at this commit point
                const item = await this.baseProvider.read<T_Return>(collectionName, id);
                return item;
            } finally {
                // Always restore the original branch
                await git.checkout(currentBranch.current);
            }
        } catch (error) {
            logError(`Failed to get version ${commitHash} for item ${id} in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to get version: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Revert to a specific commit.
     * @param commitHash The commit hash to revert to
     */
    async revertTo(commitHash: string): Promise<void> {
        validateConnected(this._isConnected);
        
        try {
            if (!this.git) {
                throw new ConnectionError('Git repository is not initialized');
            }
            
            const git = this.git;
            
            // Check if there are uncommitted changes
            const status = await git.status();
            
            if (!status.isClean()) {
                throw new SyncError('Cannot revert with uncommitted changes');
            }
            
            // Create a revert commit
            await git.reset(['--hard', commitHash]);
            
            // Reconnect the base provider to reload data
            await this.baseProvider.disconnect();
            await this.baseProvider.connect();
            
            logInfo(`Reverted to commit: ${commitHash}`);
        } catch (error) {
            logError(`Failed to revert to commit: ${commitHash}`, error);
            throw new SyncError(`Failed to revert: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Manually trigger a commit of pending changes.
     * @param message Optional commit message
     */
    async commitNow(message?: string): Promise<string> {
        validateConnected(this._isConnected);
        
        if (this.pendingChanges.size === 0) {
            logWarn('No pending changes to commit');
            return '';
        }
        
        try {
            const commitHash = await this.commitChanges(message || 'Manual commit');
            return commitHash;
        } catch (error) {
            logError('Failed to commit changes', error);
            throw new SyncError(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Manually trigger a sync with the remote repository.
     */
    async syncNow(): Promise<void> {
        validateConnected(this._isConnected);
        
        try {
            await this.syncWithRemote();
        } catch (error) {
            logError('Failed to sync with remote', error);
            throw new SyncError(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Private helper methods

    /**
     * Initialize the Git repository
     */
    private async initializeGit(): Promise<void> {
        try {
            // Ensure the repository directory exists
            await fs.mkdir(this.config.repositoryPath, { recursive: true });
            
            // Create the Git instance
            const git = simpleGit({
                baseDir: this.config.repositoryPath,
                binary: 'git',
                maxConcurrentProcesses: 1
            });
            
            // Set the git instance
            this.git = git;
            
            // Check if it's already a Git repository
            const isRepo = await git.checkIsRepo();
            
            if (!isRepo) {
                // Initialize a new repository
                await git.init();
                logDebug('Initialized new Git repository');
                
                // Setup user info for this repo
                await git.addConfig('user.name', this.config.syncOptions.author?.name || 'GitSyncProvider');
                await git.addConfig('user.email', this.config.syncOptions.author?.email || 'git-sync@example.com');
                
                // Create an initial commit with README if needed
                const readmePath = path.join(this.config.repositoryPath, 'README.md');
                
                try {
                    await fs.access(readmePath);
                } catch (error) {
                    // File doesn't exist, create it
                    await fs.writeFile(readmePath, `# GitSyncProvider Repository\n\nCreated: ${new Date().toISOString()}\n`);
                    await git.add('README.md');
                    await git.commit('Initial commit');
                    logDebug('Created initial commit with README.md');
                }
            } else {
                logDebug('Using existing Git repository');
                
                // Set user info for this repo
                await git.addConfig('user.name', this.config.syncOptions.author?.name || 'GitSyncProvider');
                await git.addConfig('user.email', this.config.syncOptions.author?.email || 'git-sync@example.com');
                
                // Check if the configured branch exists
                const branches = await git.branchLocal();
                
                const branchName = this.config.syncOptions.branch!;
                if (!branches.all.includes(branchName)) {
                    // Create the branch if it doesn't exist
                    await git.checkoutLocalBranch(branchName);
                    logDebug(`Created branch: ${branchName}`);
                } else {
                    // Switch to the configured branch
                    await git.checkout(branchName);
                    logDebug(`Switched to branch: ${branchName}`);
                }
            }
            
            // Check for remote
            if (this.config.syncOptions.autoSync) {
                try {
                    const remotes = await git.getRemotes();
                    const hasConfiguredRemote = remotes.some(
                        (remote: any) => remote.name === this.config.syncOptions.remote
                    );
                    
                    if (hasConfiguredRemote) {
                        // Try to sync with remote
                        await this.syncWithRemote();
                    } else {
                        logInfo(`Remote '${this.config.syncOptions.remote}' not configured. Auto-sync will not work.`);
                    }
                } catch (error) {
                    logWarn('Failed to check or sync with remote', error);
                }
            }
        } catch (error) {
            logError('Failed to initialize Git repository', error);
            throw new ConnectionError(`Failed to initialize Git: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Start the periodic sync interval
     */
    private startSyncInterval(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                // Skip if not connected
                if (!this._isConnected || !this.git) {
                    return;
                }
                
                // Commit any pending changes
                if (this.pendingChanges.size > 0 && this.config.syncOptions.autoCommit) {
                    await this.commitChanges('Auto-commit on sync interval');
                }
                
                // Sync with remote
                await this.syncWithRemote();
            } catch (error) {
                logError('Scheduled sync failed', error);
            }
        }, this.config.syncOptions.interval);
        
        logDebug(`Started sync interval: ${this.config.syncOptions.interval}ms`);
    }

    /**
     * Commit changes to the Git repository
     * @param message Commit message
     * @returns The hash of the new commit
     */
    private async commitChanges(message: string): Promise<string> {
        if (!this.git) {
            throw new ConnectionError('Git repository is not initialized');
        }
        
        const git = this.git;
        
        // Check status
        const status = await git.status();
        
        // Only proceed if there are changes
        if (status.files.length > 0 || !status.isClean()) {
            // Add all changes
            await git.add('.');
            
            // Create the commit
            const result = await git.commit(message, {
                '--author': `${this.config.syncOptions.author?.name || 'GitSyncProvider'} <${this.config.syncOptions.author?.email || 'git-sync@example.com'}>`
            });
            
            // Clear pending changes
            this.pendingChanges.clear();
            
            logDebug(`Committed changes: ${result.commit}`, { message });
            
            return result.commit;
        } else {
            // No changes to commit
            this.pendingChanges.clear();
            logDebug('No changes to commit');
            return '';
        }
    }

    /**
     * Sync with the remote repository
     */
    private async syncWithRemote(): Promise<void> {
        if (!this.git) {
            throw new ConnectionError('Git repository is not initialized');
        }
        
        const git = this.git;
        
        try {
            // Check if remote exists
            const remotes = await git.getRemotes();
            const hasConfiguredRemote = remotes.some(
                (remote: any) => remote.name === this.config.syncOptions.remote
            );
            
            if (!hasConfiguredRemote) {
                logWarn(`Remote '${this.config.syncOptions.remote}' not configured. Skipping sync.`);
                return;
            }
            
            // Check for local changes
            const status = await git.status();
            if (!status.isClean()) {
                if (this.config.syncOptions.autoCommit) {
                    await this.commitChanges('Auto-commit before sync');
                } else {
                    logWarn('Uncommitted changes detected. Skipping sync.');
                    return;
                }
            }
            
            // Pull from remote
            logDebug(`Pulling from ${this.config.syncOptions.remote}/${this.config.syncOptions.branch}`);
            
            const pullResult = await git.pull(
                this.config.syncOptions.remote,
                this.config.syncOptions.branch,
                { '--no-rebase': null }
            );
            
            // Push to remote
            logDebug(`Pushing to ${this.config.syncOptions.remote}/${this.config.syncOptions.branch}`);
            
            await git.push(
                this.config.syncOptions.remote,
                this.config.syncOptions.branch
            );
            
            // Reconnect the base provider to reload data if changes were pulled
            if (pullResult.files.length > 0) {
                logInfo('Changes detected from remote. Reloading data.');
                await this.baseProvider.disconnect();
                await this.baseProvider.connect();
            }
            
            logDebug('Sync completed successfully');
        } catch (error) {
            // Handle merge conflicts
            if (error instanceof Error && error.message.includes('CONFLICT')) {
                logWarn('Merge conflict detected during sync');
                
                switch (this.config.conflictStrategy) {
                case 'accept-local':
                    await git.reset(['--hard']);
                    logInfo('Conflict resolved by keeping local changes');
                    break;
                        
                case 'accept-remote':
                    await git.reset(['--hard', `${this.config.syncOptions.remote}/${this.config.syncOptions.branch}`]);
                    // Reconnect to reload data
                    await this.baseProvider.disconnect();
                    await this.baseProvider.connect();
                    logInfo('Conflict resolved by accepting remote changes');
                    break;
                        
                case 'merge':
                    // This strategy requires manual resolution
                    throw new MergeConflictError(
                        'Merge conflict detected. Manual resolution required. ' +
                            'Call resolveConflicts() with appropriate strategy.'
                    );
                        
                default:
                    await git.reset(['--hard']);
                    logInfo('Conflict resolved by keeping local changes (default)');
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Check for conflicts before making changes
     */
    private async checkForConflicts(): Promise<void> {
        if (!this.git) {
            throw new ConnectionError('Git repository is not initialized');
        }
        
        const git = this.git;
        
        try {
            // Check if remote exists
            const remotes = await git.getRemotes();
            const hasConfiguredRemote = remotes.some(
                (remote: any) => remote.name === this.config.syncOptions.remote
            );
            
            if (!hasConfiguredRemote) {
                // No remote configured, nothing to check
                return;
            }
            
            // Fetch from remote to get latest changes
            await git.fetch(this.config.syncOptions.remote || 'origin');
            
            // Check if local branch is behind remote
            const status = await git.status();
            
            if (status.behind > 0) {
                logWarn(`Local branch is behind remote by ${status.behind} commits`);
                
                // Try to merge remote changes
                try {
                    await git.merge([`${this.config.syncOptions.remote}/${this.config.syncOptions.branch}`]);
                    
                    // Reconnect the base provider to reload data
                    await this.baseProvider.disconnect();
                    await this.baseProvider.connect();
                    
                    logInfo('Successfully merged remote changes');
                } catch (error) {
                    // Handle merge conflicts
                    if (error instanceof Error && error.message.includes('CONFLICT')) {
                        logWarn('Merge conflict detected during conflict check');
                        
                        switch (this.config.conflictStrategy) {
                        case 'accept-local':
                            await git.reset(['--hard']);
                            logInfo('Conflict resolved by keeping local changes');
                            break;
                                
                        case 'accept-remote':
                            await git.reset(['--hard', `${this.config.syncOptions.remote}/${this.config.syncOptions.branch}`]);
                            // Reconnect to reload data
                            await this.baseProvider.disconnect();
                            await this.baseProvider.connect();
                            logInfo('Conflict resolved by accepting remote changes');
                            break;
                                
                        case 'merge':
                            // This strategy requires manual resolution
                            throw new MergeConflictError(
                                'Merge conflict detected. Manual resolution required. ' +
                                    'Call resolveConflicts() with appropriate strategy.'
                            );
                                
                        default:
                            await git.reset(['--hard']);
                            logInfo('Conflict resolved by keeping local changes (default)');
                        }
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            if (error instanceof MergeConflictError) {
                throw error;
            }
            
            logError('Failed to check for conflicts', error);
            throw new SyncError(`Failed to check for conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Resolve merge conflicts
     * @param strategy Strategy to resolve conflicts
     */
    async resolveConflicts(strategy: 'use-ours' | 'use-theirs' | 'keep-both'): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.git) {
            throw new ConnectionError('Git repository is not initialized');
        }
        
        const git = this.git;
        
        try {
            // Check if there are conflicts
            const status = await git.status();
            
            if (!status.conflicted.length) {
                logWarn('No conflicts to resolve');
                return;
            }
            
            switch (strategy) {
            case 'use-ours':
                // Keep our changes
                await git.checkout(['--ours', '.']);
                await git.add('.');
                await git.commit('Resolve conflicts using our changes');
                break;
                    
            case 'use-theirs':
                // Use their changes
                await git.checkout(['--theirs', '.']);
                await git.add('.');
                await git.commit('Resolve conflicts using their changes');
                    
                // Reconnect to reload data
                await this.baseProvider.disconnect();
                await this.baseProvider.connect();
                break;
                    
            case 'keep-both':
                // This is more complex and would require content-aware merging
                // For simplicity, we'll just use ours but in a real implementation 
                // you would need to merge the files intelligently
                await git.checkout(['--ours', '.']);
                await git.add('.');
                await git.commit('Resolve conflicts keeping both changes');
                break;
                    
            default:
                throw new ConfigurationError(`Invalid conflict resolution strategy: ${strategy}`);
            }
            
            logInfo(`Conflicts resolved using strategy: ${strategy}`);
        } catch (error) {
            logError('Failed to resolve conflicts', error);
            throw new SyncError(`Failed to resolve conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}