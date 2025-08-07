/**
 * Utilities for rate limiting and throttling API calls
 */

/**
 * Options for the throttle controller
 */
export interface ThrottleOptions {
    /** Maximum number of concurrent requests */
    maxConcurrent: number;
    /** Maximum requests per minute (0 for no limit) */
    requestsPerMinute: number;
    /** Timeout for requests in milliseconds */
    timeoutMs: number;
}

/**
 * Default throttle options
 */
const DEFAULT_THROTTLE_OPTIONS: ThrottleOptions = {
    maxConcurrent: 5,
    requestsPerMinute: 0, // No rate limit by default
    timeoutMs: 30000
};

/**
 * A controller for throttling API calls
 */
export class ThrottleController {
    private options: ThrottleOptions;
    private activeRequests: number = 0;
    private requestTimes: number[] = [];
    private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

    constructor(options: Partial<ThrottleOptions> = {}) {
        this.options = {
            ...DEFAULT_THROTTLE_OPTIONS,
            ...options
        };
    }

    /**
     * Run a function with throttling applied
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        // Wait for permission to run
        await this.acquirePermission();

        try {
            // Execute the function
            return await Promise.race([
                fn(),
                new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Request timed out after ${this.options.timeoutMs}ms`));
                    }, this.options.timeoutMs);
                })
            ]);
        } finally {
            // Release the permission
            this.releasePermission();
        }
    }

    /**
     * Acquire permission to run a request
     */
    private async acquirePermission(): Promise<void> {
        // Check if we can run immediately
        if (this.canRunNow()) {
            this.activeRequests++;
            this.recordRequest();
            return;
        }

        // Otherwise, queue the request
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                // Remove from queue on timeout
                this.queue = this.queue.filter(item => item.reject !== reject);
                reject(new Error(`Throttle timeout after ${this.options.timeoutMs}ms while waiting in queue`));
            }, this.options.timeoutMs);

            this.queue.push({
                resolve: () => {
                    clearTimeout(timeoutId);
                    this.activeRequests++;
                    this.recordRequest();
                    resolve();
                },
                reject
            });
        });
    }

    /**
     * Check if a request can run immediately
     */
    private canRunNow(): boolean {
        // Check concurrent limit
        if (this.activeRequests >= this.options.maxConcurrent) {
            return false;
        }

        // Check rate limit
        if (this.options.requestsPerMinute > 0) {
            const now = Date.now();
            // Remove request times older than 1 minute
            this.requestTimes = this.requestTimes.filter(time => now - time < 60000);
            // Check if we've hit the rate limit
            if (this.requestTimes.length >= this.options.requestsPerMinute) {
                return false;
            }
        }

        return true;
    }

    /**
     * Record a request time for rate limiting
     */
    private recordRequest(): void {
        if (this.options.requestsPerMinute > 0) {
            this.requestTimes.push(Date.now());
        }
    }

    /**
     * Release permission after a request completes
     */
    private releasePermission(): void {
        this.activeRequests--;

        // Process the next queued request if any
        if (this.queue.length > 0 && this.canRunNow()) {
            const next = this.queue.shift();
            if (next) {
                next.resolve();
            }
        }
    }

    /**
     * Get the current number of active requests
     */
    getActiveRequestCount(): number {
        return this.activeRequests;
    }

    /**
     * Get the current queue length
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * Update throttle options
     */
    updateOptions(options: Partial<ThrottleOptions>): void {
        this.options = {
            ...this.options,
            ...options
        };
    }
}