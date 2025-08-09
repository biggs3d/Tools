#!/bin/bash

# Usage: ./start_session.sh [story_name]
# Default: speedrun_berserker

STORY=${1:-speedrun_berserker}
STORY_DIR="../story/$STORY"

if [ ! -d "$STORY_DIR" ]; then
    echo "ERROR: Story directory not found: $STORY_DIR"
    echo "Available stories:"
    ls -d ../story/*/ 2>/dev/null | xargs -n 1 basename
    exit 1
fi

echo "==============================================="
echo "LOADING $(echo $STORY | tr '[:lower:]' '[:upper:]' | tr '_' ' ') - DM SESSION"
echo "==============================================="
echo ""
echo "CRITICAL: You are the Dungeon Master. Read ALL this context before responding!"
echo ""
echo "==============================================="
echo "1. ALL GUIDE FILES"
echo "==============================================="
# Load all .md files in the story directory
for file in "$STORY_DIR"/*.md; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "--- $filename ---"
        cat "$file"
        echo ""
    fi
done
echo ""
echo "==============================================="
echo "2. CURRENT GAME STATE (session.json)"
echo "==============================================="
cat "$STORY_DIR/session.json"
echo ""
echo "==============================================="
echo "3. LATEST SESSION NARRATIVE (for voice/style)"
echo "==============================================="
# Get the latest session file
latest_session=$(ls -t "$STORY_DIR"/raw/session_*.md 2>/dev/null | head -1)
if [ -n "$latest_session" ]; then
    echo "From: $(basename $latest_session)"
    echo "---"
    # Show last 100 lines for voice calibration
    tail -100 "$latest_session"
else
    echo "[No previous sessions found]"
fi
echo ""
echo "==============================================="
echo "4. TOOLS TEST"
echo "==============================================="
echo "Testing dice.py:"
python3 dice.py "1d20+4" 2>/dev/null || echo "WARNING: dice.py not working!"
echo ""
echo "Testing xp.py:"
echo "import xp; print(f'Level 4 needs {xp.xp_for_level(4)} XP')" | python3 2>/dev/null || echo "WARNING: xp.py not working!"
echo ""
echo "==============================================="
echo "READY TO DM!"
echo "==============================================="
echo ""
echo "Remember the core loop:"
echo "1. Narrate (with HP bars, rage meter when relevant)"
echo "2. Listen to player intent"
echo "3. Roll dice with dice.py for ALL mechanics"
echo "4. Update session.json as needed"
echo "5. Show results in **[brackets]**"
echo ""
echo "¡Dale candela, DM! 🔥"