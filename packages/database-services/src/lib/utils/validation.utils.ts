import { ConfigurationError, QueryError, ConnectionError } from './error.utils.js';

/**
 * Asserts that a value is not null or undefined.
 * @param value The value to check
 * @param fieldName The name of the field for the error message
 * @throws {ConfigurationError} if the value is null or undefined
 */
export function assertDefined(value: any, fieldName: string): void {
    if (value === undefined || value === null) {
        throw new ConfigurationError(`${fieldName} is required and cannot be null or undefined`);
    }
}

/**
 * Asserts that a string value is not empty.
 * @param value The string to check
 * @param fieldName The name of the field for the error message
 * @throws {ConfigurationError} if the string is empty, null, or undefined
 */
export function assertNotEmpty(value: string, fieldName: string): void {
    assertDefined(value, fieldName);
    if (value.trim() === '') {
        throw new ConfigurationError(`${fieldName} cannot be empty`);
    }
}

/**
 * Asserts that a collection name is valid.
 * @param collectionName The collection name to validate
 * @throws {QueryError} if the collection name is invalid
 */
export function validateCollectionName(collectionName: string): void {
    if (!collectionName || typeof collectionName !== 'string' || collectionName.trim() === '') {
        throw new QueryError('Collection name must be a non-empty string');
    }
    
    // Optional: Add any additional collection name validation rules
    // For example, only allowing alphanumeric and underscore characters
    // if (!/^[a-zA-Z0-9_]+$/.test(collectionName)) {
    //     throw new QueryError('Collection name can only contain alphanumeric characters and underscores');
    // }
}

/**
 * Asserts that an ID is valid.
 * @param id The ID to validate
 * @throws {QueryError} if the ID is invalid
 */
export function validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new QueryError('ID must be a non-empty string');
    }
}

/**
 * Validates that the provider is connected.
 * @param isConnected The connection state
 * @throws {ConnectionError} if the provider is not connected
 */
export function validateConnected(isConnected: boolean): void {
    if (!isConnected) {
        throw new ConnectionError('Database provider is not connected');
    }
}