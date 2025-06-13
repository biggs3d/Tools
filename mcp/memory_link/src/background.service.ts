import { MemoryService } from './memory.service.js';

export interface BackgroundTask {
    id: string;
    name: string;
    priority: number; // Higher number = higher priority
    execute: () => Promise<void>;
}

export interface BackgroundProcessingConfig {
    maxOperationsPerRun: number;
    maxTimePerRun: number; // milliseconds
    enableEmbeddingBackfill: boolean;
    enableImportanceDecay: boolean;
}

/**
 * Background processing service for automatic memory maintenance
 * Runs between tool calls to handle maintenance tasks without blocking user operations
 * Thread-safe design prevents concurrent runs
 */
export class BackgroundProcessingService {
    private memoryService: MemoryService;
    private config: BackgroundProcessingConfig;
    private isRunning: boolean = false;
    private taskQueue: BackgroundTask[] = [];
    private operationCount: number = 0;
    private startTime: number = 0;

    constructor(memoryService: MemoryService, config: BackgroundProcessingConfig) {
        this.memoryService = memoryService;
        this.config = config;
    }

    /**
     * Schedule background processing to run after current operation completes
     * Uses setImmediate to run between tool calls
     */
    scheduleBackgroundRun(): void {
        if (this.isRunning) {
            return; // Already running, skip
        }

        setImmediate(() => {
            this.runBackgroundTasks().catch(error => {
                console.error('Background processing error:', error);
            });
        });
    }

    /**
     * Run background maintenance tasks
     * Caps execution time and operation count to prevent blocking
     */
    private async runBackgroundTasks(): Promise<void> {
        if (this.isRunning) {
            return; // Prevent concurrent runs
        }

        this.isRunning = true;
        this.operationCount = 0;
        this.startTime = Date.now();

        try {
            console.error('Starting background maintenance run...');

            // Populate task queue based on configuration
            await this.populateTaskQueue();

            // Execute tasks until limits are reached
            while (this.taskQueue.length > 0 && this.shouldContinueProcessing()) {
                const task = this.taskQueue.shift()!;
                
                try {
                    await task.execute();
                    this.operationCount++;
                    console.error(`Completed background task: ${task.name}`);
                } catch (error) {
                    console.error(`Background task failed: ${task.name}:`, error);
                }
            }

            const duration = Date.now() - this.startTime;
            console.error(`Background processing completed: ${this.operationCount} operations in ${duration}ms`);

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Check if we should continue processing based on limits
     */
    private shouldContinueProcessing(): boolean {
        const timeElapsed = Date.now() - this.startTime;
        return this.operationCount < this.config.maxOperationsPerRun && 
               timeElapsed < this.config.maxTimePerRun;
    }

    /**
     * Populate the task queue with maintenance tasks
     */
    private async populateTaskQueue(): Promise<void> {
        this.taskQueue = [];

        // Task 1: Generate missing embeddings (high priority)
        if (this.config.enableEmbeddingBackfill) {
            this.taskQueue.push({
                id: 'embedding-backfill',
                name: 'Generate missing embeddings',
                priority: 10,
                execute: async () => {
                    await this.generateMissingEmbeddings();
                }
            });
        }

        // Task 2: Recalculate importance based on access patterns (medium priority)
        if (this.config.enableImportanceDecay) {
            this.taskQueue.push({
                id: 'importance-decay',
                name: 'Recalculate memory importance',
                priority: 5,
                execute: async () => {
                    await this.recalculateImportance();
                }
            });
        }

        // Task 3: Identify consolidation candidates (low priority)
        this.taskQueue.push({
            id: 'consolidation-candidates',
            name: 'Identify consolidation candidates',
            priority: 3,
            execute: async () => {
                await this.identifyConsolidationCandidates();
            }
        });

        // Sort by priority (highest first)
        this.taskQueue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Generate embeddings for memories that don't have them
     */
    private async generateMissingEmbeddings(): Promise<void> {
        const batchSize = 3; // Small batch for background processing
        
        try {
            const result = await this.memoryService.generateEmbeddingsForExisting(batchSize);
            if (result.updated > 0) {
                console.error(`Background: Generated embeddings for ${result.updated} memories`);
            }
        } catch (error) {
            console.error('Background embedding generation error:', error);
        }
    }

    /**
     * Recalculate importance scores based on access patterns
     * Phase 3: Importance decay feature
     */
    private async recalculateImportance(): Promise<void> {
        try {
            // Get recently accessed memories for importance recalculation
            const recentMemories = await this.memoryService.listMemories(
                undefined, // no tag filter
                20,        // limit
                'lastAccessed' // sort by recent access
            );

            let updated = 0;
            const now = Date.now();

            for (const memory of recentMemories) {
                // Calculate time since last access
                const lastAccessed = new Date(memory.lastAccessed).getTime();
                const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);

                // Simple decay function: reduce importance based on time and access count
                let newImportance = memory.importance;
                
                // Decay factor based on days since access
                if (daysSinceAccess > 30) {
                    newImportance = Math.max(1, newImportance - 0.5);
                } else if (daysSinceAccess > 7) {
                    newImportance = Math.max(1, newImportance - 0.2);
                }

                // Boost for frequently accessed memories
                if (memory.accessCount > 5) {
                    newImportance = Math.min(10, newImportance + 0.3);
                }

                // Update if importance changed significantly
                if (Math.abs(newImportance - memory.importance) > 0.1) {
                    await this.memoryService.updateMemory(memory.id, undefined, newImportance);
                    updated++;
                }

                // Respect operation limits
                if (updated >= 5) break;
            }

            if (updated > 0) {
                console.error(`Background: Updated importance for ${updated} memories`);
            }
        } catch (error) {
            console.error('Background importance recalculation error:', error);
        }
    }

    /**
     * Identify potential consolidation candidates
     * Phase 3: Consolidation discovery
     */
    private async identifyConsolidationCandidates(): Promise<void> {
        try {
            // Find memories with similar tags that might be candidates for consolidation
            const tagGroups = new Map<string, string[]>();
            
            const allMemories = await this.memoryService.listMemories(undefined, 50, 'importance');
            
            // Group memories by tags
            allMemories.forEach(memory => {
                memory.tags.forEach(tag => {
                    if (!tagGroups.has(tag)) {
                        tagGroups.set(tag, []);
                    }
                    tagGroups.get(tag)!.push(memory.id);
                });
            });

            // Find tags with multiple memories that could be consolidated
            const consolidationCandidates: string[] = [];
            tagGroups.forEach((memoryIds, tag) => {
                if (memoryIds.length >= 3 && tag !== 'consolidated') {
                    consolidationCandidates.push(tag);
                }
            });

            if (consolidationCandidates.length > 0) {
                console.error(`Background: Found consolidation candidates for tags: ${consolidationCandidates.slice(0, 3).join(', ')}`);
                // Note: We identify but don't auto-consolidate - that requires user decision
            }
        } catch (error) {
            console.error('Background consolidation candidate identification error:', error);
        }
    }

    /**
     * Get background processing status
     */
    getStatus(): {
        isRunning: boolean;
        queueLength: number;
        operationCount: number;
        elapsedTime: number;
    } {
        return {
            isRunning: this.isRunning,
            queueLength: this.taskQueue.length,
            operationCount: this.operationCount,
            elapsedTime: this.isRunning ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Clean shutdown of background processing (Phase 4: Proper dispose implementation)
     * Waits for current operations to complete with timeout
     */
    async dispose(timeoutMs: number = 5000): Promise<void> {
        console.error('Background service dispose requested...');
        
        // Clear any pending tasks
        this.taskQueue = [];
        
        // If not running, return immediately
        if (!this.isRunning) {
            console.error('Background service disposed (was not running)');
            return;
        }

        // Wait for current processing to complete with timeout
        const startWait = Date.now();
        while (this.isRunning && (Date.now() - startWait) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.isRunning) {
            console.error(`Background service dispose timed out after ${timeoutMs}ms - forcing shutdown`);
            this.isRunning = false;
        } else {
            console.error('Background service disposed successfully');
        }
    }
}