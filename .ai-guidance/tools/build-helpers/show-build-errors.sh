#!/bin/bash
#
# Show TypeScript build errors in clean format
# Usage: ./show-build-errors.sh [limit] [pattern]
# Example: ./show-build-errors.sh  (show first 20 errors)
# Example: ./show-build-errors.sh 10  (show first 10 errors)
# Example: ./show-build-errors.sh 15 "sdk-client"  (show first 15 errors matching pattern)
#

# Navigate to project root
cd "$(dirname "$0")/../.." || exit 1

# Set default limit to 20 if not provided
LIMIT=${1:-20}
PATTERN=${2:-""}

# Display header
echo "=== TypeScript Build Errors ==="
echo

if [ -z "$PATTERN" ]; then
    # Show errors without pattern filtering
    echo "Showing first $LIMIT errors:"
    npm run build-hmi-client 2>&1 | grep -E "error" | sed 's/Did you mean.*//' | head -"$LIMIT"
else
    # Show errors matching pattern
    echo "Showing first $LIMIT errors matching '$PATTERN':"
    npm run build-hmi-client 2>&1 | grep -E "error" | grep "$PATTERN" | sed 's/Did you mean.*//' | head -"$LIMIT"
fi

# Display footer
echo
echo "=== End of errors ==="