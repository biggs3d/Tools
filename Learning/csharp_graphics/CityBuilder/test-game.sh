#!/bin/bash

echo "Building City Builder..."
dotnet build

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Starting game (press Ctrl+C to stop)..."
    dotnet run
else
    echo "Build failed!"
    exit 1
fi