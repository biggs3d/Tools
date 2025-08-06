#!/bin/bash

# Focused test runner for validation refactor work
# Runs only the relevant tests to save time

MODE=$1

show_usage() {
    echo "Usage: $0 [mode]"
    echo
    echo "Modes:"
    echo "  all        - Run all grid-related tests"
    echo "  validation - Run only validation utility tests"
    echo "  boundary   - Run boundary resize tests"
    echo "  center     - Run center gap tests"
    echo "  move       - Run panel movement tests"
    echo "  quick      - Run a quick subset of critical tests"
    echo "  failed     - Re-run only previously failed tests"
    echo
    echo "Example: $0 validation"
}

if [ -z "$MODE" ]; then
    show_usage
    exit 1
fi

echo "=== Grid Validation Test Runner ==="
echo "Mode: $MODE"
echo

case $MODE in
    "all")
        echo "Running all grid-related tests..."
        npm test -- --run libs/alpha/alpha.core/src/lib/services/grid
        ;;
        
    "validation")
        echo "Running validation utility tests..."
        npm test -- --run libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.test.ts
        ;;
        
    "boundary")
        echo "Running boundary resize tests..."
        npm test -- --run \
            libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.centerBoundaryResize.test.ts \
            libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.resizeMultiStack.test.ts
        ;;
        
    "center")
        echo "Running center gap tests..."
        npm test -- --run libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.centerGap.test.ts
        ;;
        
    "move")
        echo "Running movement tests..."
        npm test -- --run libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.test.ts -t "Move"
        ;;
        
    "quick")
        echo "Running quick test subset..."
        npm test -- --run \
            libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.test.ts \
            libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.unit.test.ts
        ;;
        
    "failed")
        echo "Re-running failed tests..."
        # This would ideally read from a cache of failed tests
        # For now, run the known problematic tests
        npm test -- --run \
            libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.unit.test.ts \
            libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.test.ts \
            -t "cascading|boundary resize|insufficient"
        ;;
        
    *)
        echo "Unknown mode: $MODE"
        show_usage
        exit 1
        ;;
esac

echo
echo "=== Test Summary ==="
echo "Check the output above for test results."
echo "To debug a specific test, use:"
echo "  npm test -- --run <test-file> -t '<test-name>'"