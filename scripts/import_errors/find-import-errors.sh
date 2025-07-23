#!/bin/bash
# Find import-related build errors for specific types or packages
# Usage: ./find-import-errors.sh <search_term> [limit]
# Example: ./find-import-errors.sh "sdk-client" 10
# Example: ./find-import-errors.sh "IEntityInteractor"
# Example: ./find-import-errors.sh "has no exported member" 15

cd "$(dirname "$0")/../.." || exit 1

SEARCH_TERM="$1"
LIMIT=${2:-10}

if [ -z "$SEARCH_TERM" ]; then
    echo "Usage: $0 <search_term> [limit]"
    echo "Example: $0 'sdk-client' 10"
    echo "Example: $0 'IEntityInteractor'"
    exit 1
fi

npm run build-hmi-client 2>&1 | grep -E "error" | grep "$SEARCH_TERM" | sed 's/Did you mean.*//' | head -"$LIMIT"