/**
 * Custom error types for the LLM package
 */

/**
 * Base error class for LLM-related errors
 */
export class LLMError extends Error {
    constructor(message: string, public cause?: Error) {
        super(message);
        this.name = 'LLMError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMError.prototype);
    }
}

/**
 * Error for configuration issues
 */
export class LLMConfigurationError extends LLMError {
    constructor(message: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMConfigurationError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMConfigurationError.prototype);
    }
}

/**
 * Error for API rate limiting
 */
export class LLMRateLimitError extends LLMError {
    constructor(
        message: string,
        public retryAfterMs?: number,
        public cause?: Error
    ) {
        super(message, cause);
        this.name = 'LLMRateLimitError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMRateLimitError.prototype);
    }
}

/**
 * Error for network or connection issues
 */
export class LLMNetworkError extends LLMError {
    constructor(message: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMNetworkError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMNetworkError.prototype);
    }
}

/**
 * Error for request timeouts
 */
export class LLMTimeoutError extends LLMError {
    constructor(message: string, public timeoutMs: number, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMTimeoutError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMTimeoutError.prototype);
    }
}

/**
 * Error for authentication issues
 */
export class LLMAuthenticationError extends LLMError {
    constructor(message: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMAuthenticationError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMAuthenticationError.prototype);
    }
}

/**
 * Error for model-specific issues
 */
export class LLMModelError extends LLMError {
    constructor(message: string, public modelName: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMModelError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMModelError.prototype);
    }
}

/**
 * Error for input content issues (unsafe content, token limits)
 */
export class LLMContentError extends LLMError {
    constructor(message: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMContentError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMContentError.prototype);
    }
}

/**
 * Error for parsing issues with LLM responses
 */
export class LLMParsingError extends LLMError {
    constructor(message: string, public rawResponse: string, public cause?: Error) {
        super(message, cause);
        this.name = 'LLMParsingError';

        // Set the prototype explicitly
        Object.setPrototypeOf(this, LLMParsingError.prototype);
    }
}

/**
 * Determine if an error is a transient error that can be retried
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRetryableError(error: any): boolean {
    // Network errors are generally retryable
    if (error instanceof LLMNetworkError) {
        return true;
    }

    // Rate limit errors are retryable
    if (error instanceof LLMRateLimitError) {
        return true;
    }

    // Timeout errors are retryable
    if (error instanceof LLMTimeoutError) {
        return true;
    }

    // For other error types, check the message for common retryable patterns
    const errorMessage = error?.message?.toLowerCase() || '';

    return (
        errorMessage.includes('timeout') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('capacity') ||
        errorMessage.includes('retry') ||
        errorMessage.includes('overloaded') ||
        errorMessage.includes('temporarily unavailable')
    );
}