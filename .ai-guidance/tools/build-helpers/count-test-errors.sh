#!/bin/bash

# Script to count test failures from npm test output
# Usage: ./count-test-errors.sh [pattern]

cd "$(dirname "$0")/../../client" || exit 1

echo "Running alpha tests and counting failures..."

# Run tests and capture output
TEST_OUTPUT=$(npm run alpha-test 2>&1)

# Count different types of failures
FAILED_FILES=$(echo "$TEST_OUTPUT" | grep -E "Test Files.*failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo "0")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -E "Tests.*failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo "0")

# If pattern provided, filter for it
if [ -n "$1" ]; then
    echo "Filtering for pattern: $1"
    FILTERED=$(echo "$TEST_OUTPUT" | grep -i "$1")
    if [ -n "$FILTERED" ]; then
        echo "$FILTERED"
    fi
fi

# Summary
echo ""
echo "Test Summary:"
echo "Failed test files: ${FAILED_FILES:-0}"
echo "Failed tests: ${FAILED_TESTS:-0}"

# Show passed/failed summary line
echo "$TEST_OUTPUT" | grep -E "(Test Files|Tests)" | grep -E "(passed|failed)"