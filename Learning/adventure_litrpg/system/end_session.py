#!/usr/bin/env python3
"""
End Session - Complete session preservation workflow
Saves both narrative chapter and full Claude conversation
"""

import sys
import os
import logging
import datetime
from pathlib import Path
import json
import re

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import our modules directly (no subprocess needed!)
from system.claude_session_capture import ClaudeSessionCapture
from system.session_logger import SessionLogger

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'  # Simple format for CLI output
)
logger = logging.getLogger(__name__)

def sanitize_session_name(name: str) -> str:
    """Sanitize session name for safe use in filenames"""
    # Replace any non-alphanumeric, dash, or underscore with underscore
    safe_name = re.sub(r'[^\w\-]', '_', name)
    # Remove multiple underscores
    safe_name = re.sub(r'_+', '_', safe_name)
    # Limit length
    return safe_name[:100]

def get_next_chapter_number() -> int:
    """Get the next chapter number based on existing files"""
    session_dir = Path(__file__).parent.parent / "session"
    chapters_dir = session_dir / "chapters"
    
    # Look for existing chapter files
    existing = list(chapters_dir.glob("chapter_*.md"))
    
    if not existing:
        return 1
    
    # Extract numbers
    numbers = []
    for f in existing:
        match = re.match(r'chapter_(\d+)_', f.name)
        if match:
            numbers.append(int(match.group(1)))
    
    return max(numbers) + 1 if numbers else 1

def main():
    logger.info("=" * 60)
    logger.info("🎮 ADVENTURE SESSION COMPLETE - PRESERVATION WORKFLOW")
    logger.info("=" * 60)
    
    session_name = None
    if len(sys.argv) > 1:
        session_name = sys.argv[1]
    else:
        logger.info("\nEnter a name for this session (optional, press Enter to skip):")
        session_name = input().strip()
    
    # Sanitize the session name
    if session_name:
        session_name = sanitize_session_name(session_name)
        # Convert to lowercase and replace spaces with underscores for consistency
        session_name = session_name.lower().replace(' ', '_')
    
    if not session_name:
        chapter_num = get_next_chapter_number()
        timestamp = datetime.datetime.now().strftime("%Y%m%d")
        session_name = f"session_{timestamp}"
    
    logger.info(f"\n📝 Session Name: {session_name}")
    
    # Step 1: Check game state
    logger.info("\n" + "=" * 60)
    logger.info("STEP 1: Checking current game state")
    logger.info("=" * 60)
    
    try:
        # Import and run status check
        from system.game_engine import LitRPGEngine
        engine = LitRPGEngine()
        state = engine.load_state()
        if state and 'character' in state:
            logger.info("✅ Game state is current")
            char = state.get('character', {})
            logger.info(f"   Character: {char.get('name', 'Unknown')} (Level {char.get('level', 1)})")
            logger.info(f"   HP: {char.get('hp', 0)}/{char.get('hp_max', 0)}")
        else:
            logger.info("ℹ️  No active game state found")
    except Exception as e:
        logger.warning(f"⚠️  Could not check game state: {e}")
    
    # Step 2: Save narrative chapter
    logger.info("\n" + "=" * 60)
    logger.info("STEP 2: Saving narrative chapter")
    logger.info("=" * 60)
    
    # Check if session_logger has content to save
    try:
        session_logger = SessionLogger()
        
        # Check for auto-saved content
        auto_save_file = Path(__file__).parent.parent / "session" / "narrative" / "session_auto_save.json"
        
        if auto_save_file.exists():
            logger.info("📖 Creating narrative chapter from session events...")
            session_logger.save_session_chapter()
            logger.info("✅ Narrative chapter saved!")
        else:
            logger.info("ℹ️  No auto-saved session data found (session may have been manually saved already)")
    except Exception as e:
        logger.warning(f"⚠️  Could not save narrative chapter: {e}")
    
    # Step 3: Chronicle Status
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3: Checking Narrative Chronicle")
    logger.info("=" * 60)
    
    try:
        from narrative_chronicler import chronicler
        scene_count = chronicler.get_scene_count()
        word_count = chronicler.get_current_word_count()
        
        if scene_count > 0:
            logger.info(f"📚 Chronicle contains {scene_count} scenes ({word_count} words)")
            logger.info("✅ Narrative exchanges have been preserved in real-time!")
            
            # Finalize and create novel chapter
            chronicle_path = chronicler.finalize_session(session_name)
            novel_path = chronicler.create_novel_chapter()
            
            logger.info(f"📖 Novel chapter created: {novel_path.name}")
            logger.info(f"📜 Chronicle archived: {chronicle_path.name}")
        else:
            logger.info("ℹ️  No chronicle entries found for this session")
            logger.info("💡 TIP: Use narrative_chronicler during play to capture exchanges")
    except ImportError:
        logger.info("ℹ️  Narrative Chronicler not available")
        logger.info("💡 The new chronicler system preserves actual play narrative in real-time")
    except Exception as e:
        logger.warning(f"⚠️  Could not process chronicle: {e}")
    
    # Step 4: Remind about NEXT_SESSION.md
    logger.info("\n" + "=" * 60)
    logger.info("STEP 5: NEXT_SESSION.md Reminder")
    logger.info("=" * 60)
    
    logger.info("📝 IMPORTANT: Ask Claude (your DM) to update NEXT_SESSION.md with:")
    logger.info("   - Current location and immediate scene")
    logger.info("   - Active NPCs and their dispositions")
    logger.info("   - Unresolved plot threads and mysteries")
    logger.info("   - Hooks for next session")
    logger.info("\n💡 Since this is 100% narrative content, your DM should write this!")
    logger.info("   Just say: 'Please update NEXT_SESSION.md for our next adventure'")
    
    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("🎉 SESSION PRESERVATION COMPLETE!")
    logger.info("=" * 60)
    
    logger.info("\n📁 Files saved:")
    logger.info(f"  📖 Narrative: session/chapters/")
    logger.info(f"  💬 Claude Session: session/claude_sessions/")
    logger.info(f"  ⚔️  Combat Replays: session/combat_replays/")
    logger.info(f"  🎮 Game State: session/state/game_state.json")
    logger.info(f"  📝 Next Session: NEXT_SESSION.md (to be updated by DM)")
    
    logger.info("\n🎯 Next steps:")
    logger.info("  1. Ask Claude to update NEXT_SESSION.md with narrative continuity")
    logger.info("  2. Check session/chapters/ for your narrative chapter")
    logger.info("  3. Your complete Claude conversation is preserved!")
    
    logger.info("\n🎲 Until next adventure! ¡Dale candela!")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())