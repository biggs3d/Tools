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
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║ REMEMBER: You're writing a LIVING LitRPG NOVEL, not running a    ║"
echo "║ video game! Every scene should feel visceral, immediate, alive.   ║"
echo "║ Make them SMELL the blood, HEAR the crack of bone, FEEL the rain.║"
echo "║ The mechanics serve the story - NEVER the reverse.                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
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
echo "Remember the NARRATIVE core loop:"
echo "1. SET THE SCENE - Two senses minimum (smell the rot, hear the creak)"
echo "2. NARRATE FIRST - Make them feel it BEFORE showing numbers"
echo "3. LISTEN - Let creative solutions override standard rules"
echo "4. ROLL - dice.py for mechanics (wrapped in story, not interrupting)"
echo "5. DESCRIBE IMPACT - Visceral consequences, THEN **[brackets]**"
echo ""
echo "Every response should feel like a page from Dungeon Crawler Carl."
echo "Would you want to read this scene in a novel? If not, rewrite it!"
echo ""
echo "¡Dale candela, DM! Make them FEEL the story! 🔥"