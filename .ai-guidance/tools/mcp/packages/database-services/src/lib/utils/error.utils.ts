/**
 * Represents a generic error originating from the database-services package.
 */
export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * Error thrown when a database connection fails or is lost.
 */
export class ConnectionError extends DatabaseError {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

/**
 * Error thrown during query execution (CRUD, custom queries).
 */
export class QueryError extends DatabaseError {
    constructor(message: string) {
        super(message);
        this.name = 'QueryError';
    }
}

/**
 * Error thrown when a specific item or resource is not found.
 * Note: While this error exists, the interface methods for read/update/delete
 * often return null/false for "not found" for consistency.
 * This error might be used internally or for specific provider operations
 * that deviate from that pattern by design.
 */
export class NotFoundError extends QueryError {
    constructor(message: string = 'Item not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

/**
 * Error thrown due to invalid or missing configuration.
 */
export class ConfigurationError extends DatabaseError {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Error thrown when a database operation is not supported by the provider.
 */
export class UnsupportedOperationError extends DatabaseError {
    constructor(message: string = 'Operation not supported by this provider') {
        super(message);
        this.name = 'UnsupportedOperationError';
    }
}

/**
 * Error thrown when a transaction operation fails.
 */
export class TransactionError extends DatabaseError {
    constructor(message: string) {
        super(message);
        this.name = 'TransactionError';
    }
}