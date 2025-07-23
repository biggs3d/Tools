#!/bin/bash
# Count TypeScript build errors
# Usage: ./count-build-errors.sh [pattern]
# Example: ./count-build-errors.sh  (count all errors)
# Example: ./count-build-errors.sh "sdk-client"  (count errors matching pattern)

cd "$(dirname "$0")/../.." || exit 1

if [ -z "$1" ]; then
    # Count all errors
    npm run build-hmi-client 2>&1 | grep -E "error" | wc -l
else
    # Count errors matching pattern
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "$1" | wc -l
fi