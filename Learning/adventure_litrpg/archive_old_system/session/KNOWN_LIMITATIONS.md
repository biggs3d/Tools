# Known Limitations & Workarounds

## Claude Code Session Capture

### The Issue
Claude Code sessions are stored in an internal database that's not accessible via the filesystem. The `claude_session_capture.py` script expects manual copy-paste, which doesn't work for long conversations that exceed terminal buffer.

### Current Workarounds

1. **Use Session Continuity Features**:
   - Sessions persist automatically in Claude Code
   - Use `claude --continue` to resume last session
   - Use `claude --resume` to pick from recent sessions

2. **Capture Key Information**:
   - Focus on saving game state (automated via game_engine.py)
   - Save narrative chapters (automated via session_logger.py)
   - Update NEXT_SESSION.md with plot continuity (manual)

3. **For Full Conversation Archival**:
   - Could potentially use browser automation to export from Claude.ai if using web interface
   - Wait for official Claude Code export feature
   - Focus on capturing the narrative output rather than full conversation

### What We DO Capture Automatically

✅ **Game State** - `session/state/game_state.json`
✅ **Narrative Chapters** - `session/chapters/`
✅ **Combat Replays** - `session/combat_replays/`
✅ **NPC Relationships** - `session/world/npc_relationships.json`
✅ **Progression History** - `session/state/progression_history.json`

### Recommended Session End Process

Since we can't easily export the full conversation:

1. Run the retrospective (as we did)
2. Save game state (automatic)
3. Save narrative chapter (via session_logger)
4. Update NEXT_SESSION.md (manual)
5. Note the session can be continued with `claude --continue`

The narrative content is what matters most for your LitRPG adventure, and that IS being captured!