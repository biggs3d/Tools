#!/bin/bash

# Script to help compare original validation logic with new validator logic
# Useful for debugging test failures

METHOD=$1

if [ -z "$METHOD" ]; then
    echo "Usage: $0 <method_name>"
    echo "Example: $0 tryResizeStackBoundary"
    echo
    echo "Available methods:"
    echo "  - tryResizeStackRightEdge"
    echo "  - tryResizeStackBoundary"
    echo "  - tryMovePanel"
    echo "  - tryOpenPanel"
    echo "  - tryResizePanelHeight"
    exit 1
fi

echo "=== Analyzing validation logic for: $METHOD ==="
echo

# Check git history for the method
echo "1. Current implementation:"
echo "========================="
grep -A 50 "$METHOD" client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts | head -60
echo

echo "2. Validators used in this method:"
echo "================================="
grep -A 50 "$METHOD" client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts | grep -E "(Validator\.|validation)" | head -20
echo

echo "3. Test files that test this method:"
echo "===================================="
grep -l "$METHOD" client/libs/alpha/alpha.core/src/lib/services/grid/*.test.ts 2>/dev/null || echo "No test files found"
echo

echo "4. Recent failures related to this method:"
echo "========================================="
npm test -- --run libs/alpha/alpha.core/src/lib/services/grid --reporter=verbose 2>&1 | grep -B 2 -A 2 "$METHOD" | head -20

echo
echo "=== Debugging Tips ==="
echo "1. Add console.log to see validation results:"
echo "   console.log('---- Validation result:', validation);"
echo
echo "2. Compare with original logic in git:"
echo "   git log -p --follow client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts | grep -A 20 '$METHOD'"
echo
echo "3. Run specific test:"
echo "   npm test -- --run <test-file> -t '<test-name>'"