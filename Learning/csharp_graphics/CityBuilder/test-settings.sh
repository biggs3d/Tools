#!/bin/bash

echo "Testing Settings System..."
echo ""

# Clean up old settings
rm -f settings.json

echo "1. Starting game (will create default settings)..."
timeout 2s dotnet run > /dev/null 2>&1

if [ -f settings.json ]; then
    echo "✓ Settings file created"
    echo "Contents:"
    cat settings.json
else
    echo "✗ Settings file not created"
fi

echo ""
echo "2. Testing settings persistence..."
echo '{"IsRightHandDriving":false,"SoundVolume":0.3,"MusicVolume":0.8,"ShowFPS":true,"VSync":false}' > settings.json
echo "Modified settings written:"
cat settings.json

echo ""
echo "3. Running game to verify settings load..."
timeout 2s dotnet run 2>&1 | grep -i "settings"

echo ""
echo "✅ Settings test complete"