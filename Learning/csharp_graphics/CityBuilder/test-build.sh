#!/bin/bash

# Build and count errors
echo "Building City Builder..."
ERROR_COUNT=$(dotnet build 2>&1 | grep -c "error")

if [ $ERROR_COUNT -eq 0 ]; then
    echo "✅ Build successful! No errors found."
    exit 0
else
    echo "❌ Build failed with $ERROR_COUNT error(s)"
    # Show just the errors
    dotnet build 2>&1 | grep "error"
    exit $ERROR_COUNT
fi