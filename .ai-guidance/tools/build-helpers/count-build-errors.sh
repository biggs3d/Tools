#!/bin/bash
#
# Count TypeScript build errors
# Usage: ./count-build-errors.sh [pattern]
# Example: ./count-build-errors.sh  (count all errors)
# Example: ./count-build-errors.sh "sdk-client"  (count errors matching pattern)
#

# Navigate to project root
cd "$(dirname "$0")/../.." || exit 1

# Check if pattern argument was provided
if [ -z "$1" ]; then
    # Count all errors when no pattern specified
    echo "Counting all TypeScript errors..."
    npm run build-hmi-client 2>&1 | grep -E "error" | wc -l
else
    # Count errors matching the specified pattern
    echo "Counting TypeScript errors matching '$1'..."
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "$1" | wc -l
fi