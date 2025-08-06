#!/bin/bash

# Script to quickly check if all alpha tests are passing
# Usage: ./check-test-success.sh
# Returns: 0 if all tests pass, 1 if any tests fail

cd "$(dirname "$0")/../../client" || exit 1

echo "Running alpha tests..."

# Run tests and capture output
TEST_OUTPUT=$(npm run alpha-test 2>&1)
EXIT_CODE=$?

# Extract test summary
SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "(Test Files|Tests)" | grep -E "(passed|failed)" | tail -2)

# Check for failures
FAILED_FILES=$(echo "$TEST_OUTPUT" | grep -E "Test Files.*failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo "0")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep -E "Tests.*failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo "0")

echo ""
echo "Test Summary:"
echo "$SUMMARY"

if [ "$FAILED_FILES" = "0" ] && [ "$FAILED_TESTS" = "0" ] && [ "$EXIT_CODE" = "0" ]; then
    echo ""
    echo "✅ All tests passed!"
    exit 0
else
    echo ""
    echo "❌ Some tests failed!"
    echo "Failed test files: $FAILED_FILES"
    echo "Failed tests: $FAILED_TESTS"
    echo ""
    echo "Run ./show-test-errors.sh to see details"
    exit 1
fi