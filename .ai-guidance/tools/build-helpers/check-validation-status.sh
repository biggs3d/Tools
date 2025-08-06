#!/bin/bash

# Script to check the status of the validation refactor
# Shows which methods have been refactored and test status

echo "=== Grid Validation Refactor Status ==="
echo

# Check if validation utils exists
if [ -f "client/libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.ts" ]; then
    echo "✅ Validation utilities created"
    echo "   Lines: $(wc -l < client/libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.ts)"
else
    echo "❌ Validation utilities not found"
fi

echo
echo "=== Integration Status in gridPassManager.ts ==="

# Check which methods are using validators
METHODS=("tryResizeStackRightEdge" "tryResizeStackBoundary" "tryMovePanel" "tryOpenPanel" "tryResizePanelHeight")
VALIDATORS=("GridBoundaryValidator" "GridValidator" "StackCompatibilityValidator" "RailConstraintValidator" "SpaceValidator")

for method in "${METHODS[@]}"; do
    echo -n "Checking $method... "
    
    # Check if method exists and uses any validator
    uses_validator=false
    for validator in "${VALIDATORS[@]}"; do
        if grep -A 20 "$method" client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts 2>/dev/null | grep -q "$validator"; then
            uses_validator=true
            break
        fi
    done
    
    if [ "$uses_validator" = true ]; then
        echo "✅ Using validators"
    else
        echo "⏳ Not yet refactored"
    fi
done

echo
echo "=== Test Status ==="

# Run validation utils tests only
echo "Running validation utils tests..."
npm test -- --run libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.test.ts 2>&1 | grep -E "(Test Files|Tests)" | tail -2

echo
echo "=== Grid PassManager Test Summary ==="

# Count test results for grid tests
echo "Checking grid-related test files..."
test_files=(
    "gridPassManager.test.ts"
    "gridPassManager.centerGap.test.ts"
    "gridPassManager.centerBoundaryResize.test.ts"
    "gridPassManager.resizeMultiStack.test.ts"
    "gridPassManager.unit.test.ts"
)

for file in "${test_files[@]}"; do
    if [ -f "client/libs/alpha/alpha.core/src/lib/services/grid/$file" ]; then
        echo "  - $file ✓"
    fi
done

echo
echo "=== Quick Commands ==="
echo "Run all grid tests: npm test -- --run libs/alpha/alpha.core/src/lib/services/grid"
echo "Run validation tests: npm test -- --run libs/alpha/alpha.core/src/lib/utils/gridValidation.utils.test.ts"
echo "Check for TODOs: grep -n 'TODO' client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts"