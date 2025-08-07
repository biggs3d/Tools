import { QueryOptions } from '../database-provider.interface.js';

/**
 * Apply filters to an array of items based on QueryOptions.filters
 * @param items The array of items to filter
 * @param queryOptions The query options containing filters
 * @returns Filtered array of items
 */
export function applyFilters<T>(items: T[], queryOptions: QueryOptions): T[] {
    if (!queryOptions.filters || Object.keys(queryOptions.filters).length === 0) {
        return [...items]; // Return a copy of the original array
    }

    return items.filter(item => {
        // Check if the item matches all filters
        return Object.entries(queryOptions.filters || {}).every(([field, condition]) => {
            // Get the value from the item, supporting nested paths (e.g., 'metadata.importance')
            const value = getNestedValue(item, field);

            // If condition is a basic value, do a simple equality check
            if (typeof condition !== 'object' || condition === null) {
                return value === condition;
            }

            // Otherwise, apply the operator-based condition
            const { operator, value: conditionValue } = condition as { operator: string; value: any };
            
            switch (operator) {
            case 'eq':
                return value === conditionValue;
            case 'ne':
                return value !== conditionValue;
            case 'gt':
                return value > conditionValue;
            case 'gte':
                return value >= conditionValue;
            case 'lt':
                return value < conditionValue;
            case 'lte':
                return value <= conditionValue;
            case 'in':
                return Array.isArray(conditionValue) && conditionValue.includes(value);
            case 'nin':
                return Array.isArray(conditionValue) && !conditionValue.includes(value);
            case 'regex':
                if (typeof value !== 'string') return false;
                const regex = new RegExp(conditionValue);
                return regex.test(value);
            default:
                return false;
            }
        });
    });
}

/**
 * Apply sorting to an array of items based on QueryOptions.sortBy
 * @param items The array of items to sort
 * @param queryOptions The query options containing sortBy
 * @returns Sorted array of items
 */
export function applySorting<T>(items: T[], queryOptions: QueryOptions): T[] {
    if (!queryOptions.sortBy || queryOptions.sortBy.length === 0) {
        return [...items]; // Return a copy of the original array
    }

    return [...items].sort((a, b) => {
        for (const sort of queryOptions.sortBy || []) {
            const { field, order } = sort;
            const valueA = getNestedValue(a, field);
            const valueB = getNestedValue(b, field);

            if (valueA === valueB) {
                continue; // Try the next sort field
            }

            // Apply the sort order
            if (order === 'asc') {
                return valueA < valueB ? -1 : 1;
            } else {
                return valueA > valueB ? -1 : 1;
            }
        }
        
        return 0; // If all sort fields are equal
    });
}

/**
 * Apply pagination to an array of items based on QueryOptions.limit and QueryOptions.offset
 * @param items The array of items to paginate
 * @param queryOptions The query options containing limit and offset
 * @returns Paginated array of items
 */
export function applyPagination<T>(items: T[], queryOptions: QueryOptions): T[] {
    const { offset = 0, limit } = queryOptions;
    
    let result = items;
    
    // Apply offset
    if (offset > 0) {
        result = result.slice(offset);
    }
    
    // Apply limit
    if (limit !== undefined && limit > 0) {
        result = result.slice(0, limit);
    }
    
    return result;
}

/**
 * Get a value from an object using a dot-notation path
 * @param obj The object to extract the value from
 * @param path The path to the value (e.g., 'metadata.importance')
 * @returns The value at the specified path or undefined if not found
 */
export function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
        return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
}

/**
 * Deep clone an object
 * @param obj The object to clone
 * @returns A deep clone of the object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    // Handle Date
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }
    
    // Handle Array
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as any;
    }
    
    // Handle Object
    const result: Record<string, any> = {};
    Object.keys(obj).forEach(key => {
        result[key] = deepClone((obj as Record<string, any>)[key]);
    });
    
    return result as T;
}