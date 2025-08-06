#!/bin/bash

# Script to find remaining inline validation patterns in gridPassManager
# Helps identify what still needs to be refactored

echo "=== Finding Inline Validation Patterns in gridPassManager.ts ==="
echo

FILE="client/libs/alpha/alpha.core/src/lib/services/grid/gridPassManager.ts"

if [ ! -f "$FILE" ]; then
    echo "Error: gridPassManager.ts not found!"
    exit 1
fi

echo "1. Direct constraint checks (if statements with <, >, minWidth, maxWidth):"
echo "=================================================================="
grep -n -E "if.*\.(minWidth|maxWidth|minHeight|maxHeight)" "$FILE" | head -10
echo

echo "2. Direct bounds checks (< 1, > gridColumns, etc):"
echo "=================================================="
grep -n -E "if.*(<\s*1|>\s*gridColumns|>\s*gridRows)" "$FILE" | head -10
echo

echo "3. Registration lookups without validators:"
echo "=========================================="
grep -n "registrations\.get" "$FILE" | grep -v "Validator" | head -10
echo

echo "4. Center gap checks:"
echo "===================="
grep -n -E "(minCenterGap|center gap)" "$FILE" | head -10
echo

echo "5. Manual width/height validations:"
echo "=================================="
grep -n -E "return false" "$FILE" | grep -B 2 -E "(width|height|Width|Height)" | grep -E "(if|return)" | head -10
echo

echo "6. Complex validation blocks (multiple conditions):"
echo "================================================="
# Find if statements followed by multiple conditions
awk '/if.*\{/{p=NR; next} p && /&&|\|\|/{print NR ": " $0; p=0}' "$FILE" | head -10

echo
echo "=== Summary ==="
echo "Total 'return false' statements: $(grep -c "return false" "$FILE")"
echo "Total 'if' statements: $(grep -c "if (" "$FILE")"
echo "Uses of validators: $(grep -c "Validator\." "$FILE")"
echo

echo "=== Validator Usage ==="
echo "GridBoundaryValidator: $(grep -c "GridBoundaryValidator" "$FILE")"
echo "StackCompatibilityValidator: $(grep -c "StackCompatibilityValidator" "$FILE")"
echo "GridValidator: $(grep -c "GridValidator" "$FILE")"
echo "Other validators: $(grep -c -E "(Rail|Panel|Space)ConstraintValidator" "$FILE")"