#!/bin/bash

# Script to show only test failures from npm test output
# Usage: ./show-test-errors.sh [limit] [pattern]
# Example: ./show-test-errors.sh          # Show all failures
# Example: ./show-test-errors.sh 10       # Show first 10 failures
# Example: ./show-test-errors.sh 10 grid  # Show first 10 failures containing "grid"

cd "$(dirname "$0")/../../client" || exit 1

# Default limit
LIMIT=${1:-999999}
PATTERN=$2

# Check if first arg is a number
if ! [[ "$1" =~ ^[0-9]+$ ]]; then
    PATTERN=$1
    LIMIT=999999
fi

echo "Running alpha tests and capturing failures..."
echo ""

# Run tests and capture output with colors stripped
TEST_OUTPUT=$(npm run alpha-test 2>&1 | sed -r "s/\x1B\[[0-9;]*[mK]//g")

# Extract test failures
# Vitest shows failures after the FAIL marker and before the test summary
FAILURES=$(echo "$TEST_OUTPUT" | awk '
    /FAIL.*\.test\.ts/ { capture=1; next }
    /Test Files.*passed|failed/ { capture=0 }
    /Tests.*passed|failed/ { capture=0 }
    capture && /^$/ { next }  # Skip empty lines
    capture { print }
')

# Also capture any assertion errors or error stacks
ERRORS=$(echo "$TEST_OUTPUT" | grep -A 10 -E "(AssertionError:|Error:|Expected:|Received:|Test failed:|✗|❌)" | grep -v "Test Files" | grep -v "Tests.*passed")

# Combine and deduplicate
ALL_ERRORS=$(echo -e "$FAILURES\n$ERRORS" | awk '!seen[$0]++' | grep -v "^$")

# Apply pattern filter if provided
if [ -n "$PATTERN" ]; then
    ALL_ERRORS=$(echo "$ALL_ERRORS" | grep -i "$PATTERN")
    echo "Showing failures matching pattern: $PATTERN"
    echo ""
fi

# Apply limit and display
if [ -n "$ALL_ERRORS" ]; then
    echo "$ALL_ERRORS" | head -n "$LIMIT"
    
    # Count total failures
    TOTAL=$(echo "$ALL_ERRORS" | grep -c "^")
    if [ "$TOTAL" -gt "$LIMIT" ]; then
        echo ""
        echo "... showing first $LIMIT of $TOTAL error lines ..."
    fi
else
    echo "No test failures found!"
fi

# Show summary
echo ""
echo "Test Summary:"
echo "$TEST_OUTPUT" | grep -E "(Test Files|Tests)" | grep -E "(passed|failed)" | tail -2