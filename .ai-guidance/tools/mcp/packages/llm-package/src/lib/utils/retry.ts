/**
 * Utility for retrying failed operations
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Initial delay in milliseconds */
    initialDelayMs: number;
    /** Whether to use exponential backoff */
    useExponentialBackoff?: boolean;
    /** Maximum delay in milliseconds */
    maxDelayMs?: number;
    /** Jitter factor (0-1) to randomize delay */
    jitter?: number;
    /** Predicate to determine if an error is retryable */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isRetryable: (error: any) => boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    useExponentialBackoff: true,
    maxDelayMs: 30000,
    jitter: 0.3,
    isRetryable: () => true // By default, retry all errors
};

/**
 * Sleep for the specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate the delay for the next retry attempt
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
    let delay = options.initialDelayMs;

    // Apply exponential backoff if enabled
    if (options.useExponentialBackoff) {
        delay = options.initialDelayMs * Math.pow(2, attempt);
    }

    // Cap at maximum delay
    if (options.maxDelayMs) {
        delay = Math.min(delay, options.maxDelayMs);
    }

    // Add jitter if specified
    if (options.jitter && options.jitter > 0) {
        const jitterAmount = delay * options.jitter;
        delay = delay - (jitterAmount / 2) + (Math.random() * jitterAmount);
    }

    return delay;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    // Merge provided options with defaults
    const retryOptions: RetryOptions = {
        ...DEFAULT_RETRY_OPTIONS,
        ...options
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastError: any;

    for (let attempt = 0; attempt < retryOptions.maxAttempts; attempt++) {
        try {
            // Attempt the operation
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if the error is retryable
            if (typeof retryOptions.isRetryable === 'function' && !retryOptions.isRetryable(error)) {
                throw error;
            }

            // Last attempt, don't wait
            if (attempt >= retryOptions.maxAttempts - 1) {
                break;
            }

            // Calculate delay for next attempt
            const delay = calculateDelay(attempt, retryOptions);

            // Log the retry
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(
                `Attempt ${attempt + 1}/${retryOptions.maxAttempts} failed: ${errorMessage}. Retrying in ${Math.round(delay)}ms...`
            );

            // Wait before next attempt
            await sleep(delay);
        }
    }

    // All attempts failed
    throw lastError;
}