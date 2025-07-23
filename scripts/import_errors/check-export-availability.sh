#!/bin/bash
# Check if types are exported from framework packages
# Usage: ./check-export-availability.sh <type_name> [package_name]
# Example: ./check-export-availability.sh "IEntityInteractor"
# Example: ./check-export-availability.sh "ComponentVMCollection" "framework-visual-react-components"

cd "$(dirname "$0")/../.." || exit 1

TYPE_NAME="$1"
PACKAGE_NAME="$2"

if [ -z "$TYPE_NAME" ]; then
    echo "Usage: $0 <type_name> [package_name]"
    echo "Example: $0 'IEntityInteractor'"
    echo "Example: $0 'ComponentVMCollection' 'framework-visual-react-components'"
    exit 1
fi

echo "Searching for $TYPE_NAME in framework packages..."

if [ -n "$PACKAGE_NAME" ]; then
    # Search specific package
    echo "Checking @tektonux/$PACKAGE_NAME:"
    if [ -f "client/node_modules/@tektonux/$PACKAGE_NAME/dist/index.d.ts" ]; then
        grep -n "$TYPE_NAME" "client/node_modules/@tektonux/$PACKAGE_NAME/dist/index.d.ts" || echo "  Not found"
    else
        echo "  Package not found"
    fi
else
    # Search all framework packages
    for pkg in client/node_modules/@tektonux/framework-*/dist/index.d.ts; do
        if [ -f "$pkg" ]; then
            PKG_NAME=$(basename "$(dirname "$(dirname "$pkg")")")
            RESULT=$(grep -n "$TYPE_NAME" "$pkg" 2>/dev/null)
            if [ -n "$RESULT" ]; then
                echo "$PKG_NAME:"
                echo "$RESULT" | head -3
                echo ""
            fi
        fi
    done
fi