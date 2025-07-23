#!/bin/bash
# Find files that import specific types from specific packages
# Usage: ./find-files-importing.sh <type_name> <package_name>
# Example: ./find-files-importing.sh "IEntityInteractor" "sdk-client"
# Example: ./find-files-importing.sh "Nullable" "framework-shared-utils"

cd "$(dirname "$0")/../.." || exit 1

TYPE_NAME="$1"
PACKAGE_NAME="$2"

if [ -z "$TYPE_NAME" ] || [ -z "$PACKAGE_NAME" ]; then
    echo "Usage: $0 <type_name> <package_name>"
    echo "Example: $0 'IEntityInteractor' 'sdk-client'"
    echo "Example: $0 'Nullable' 'framework-shared-utils'"
    exit 1
fi

echo "Files importing $TYPE_NAME from @tektonux/$PACKAGE_NAME:"
grep -r "import.*$TYPE_NAME.*@tektonux/$PACKAGE_NAME" client/libs/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq