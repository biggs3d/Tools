#!/usr/bin/env python3
"""
Claude Session Capture - Save full Claude Code conversations to markdown
Preserves the complete conversation including all commands, outputs, and narrative
"""

import datetime
import logging
import re
import sys
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'  # Simple format for CLI output
)
logger = logging.getLogger(__name__)

class ClaudeSessionCapture:
    """Captures and formats full Claude Code sessions for archival"""
    
    def __init__(self, base_dir: Optional[Path] = None):
        """Initialize with optional base directory override"""
        if base_dir is None:
            base_dir = Path(__file__).parent.parent
        self.session_dir = base_dir / "session"
        self.chapters_dir = self.session_dir / "chapters"
        self.claude_sessions_dir = self.session_dir / "claude_sessions"
        
        # Create directories
        try:
            self.chapters_dir.mkdir(parents=True, exist_ok=True)
            self.claude_sessions_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"❌ Failed to create directories: {e}")
            raise
    
    @staticmethod
    def sanitize_filename(name: str) -> str:
        """Sanitize filename to be filesystem-safe"""
        # Replace any non-alphanumeric, dash, or underscore with underscore
        safe_name = re.sub(r'[^\w\-]', '_', name)
        # Remove multiple underscores
        safe_name = re.sub(r'_+', '_', safe_name)
        # Limit length
        return safe_name[:100]
    
    def save_conversation_markdown(self, conversation_text: str, 
                                  session_name: Optional[str] = None,
                                  include_metadata: bool = True) -> Path:
        """
        Save a Claude Code conversation as markdown
        
        Args:
            conversation_text: The full conversation text to save
            session_name: Optional custom name for the session
            include_metadata: Whether to add metadata header
        
        Returns:
            Path to the saved file
        """
        # Validate input
        if not conversation_text:
            raise ValueError("Conversation text cannot be empty")
            
        # Generate filename matching chapter structure
        timestamp = datetime.datetime.now()
        
        # Get next chapter number
        existing_chapters = list(self.chapters_dir.glob("chapter_*.md"))
        existing_claude = list(self.claude_sessions_dir.glob("chapter_*.md"))
        all_chapters = existing_chapters + existing_claude
        
        if all_chapters:
            # Extract numbers from filenames
            numbers = []
            for f in all_chapters:
                match = re.match(r'chapter_(\d+)_', f.name)
                if match:
                    numbers.append(int(match.group(1)))
            next_num = max(numbers) + 1 if numbers else 1
        else:
            next_num = 1
        
        # Create filename like: chapter_03_epic_battle_claude.md
        if session_name:
            safe_name = self.sanitize_filename(session_name)
            filename = f"chapter_{next_num:02d}_{safe_name}_claude.md"
        else:
            date_str = timestamp.strftime("%Y%m%d")
            filename = f"chapter_{next_num:02d}_session_{date_str}_claude.md"
        
        filepath = self.claude_sessions_dir / filename
        
        # Format content
        content = []
        
        if include_metadata:
            content.append(f"# Claude Code Session Archive")
            content.append(f"**Date**: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            content.append(f"**Chapter**: {next_num:02d}")
            content.append(f"**Session**: {session_name or 'Adventure Session'}")
            content.append("")
            content.append("---")
            content.append("")
        
        # Add the conversation
        content.append(conversation_text)
        
        # Write to file with error handling
        try:
            filepath.write_text('\n'.join(content), encoding='utf-8')
            logger.info(f"💾 Claude session saved: {filepath.name}")
            return filepath
        except OSError as e:
            logger.error(f"❌ Failed to save session: {e}")
            raise
    
    def save_from_clipboard(self, session_name: Optional[str] = None) -> Optional[Path]:
        """
        Save conversation from clipboard (for manual copy/paste)
        
        Instructions for user:
        1. Select all text in Claude Code conversation
        2. Copy to clipboard (Ctrl+C / Cmd+C)
        3. Run this script with --clipboard flag
        """
        try:
            import pyperclip
            conversation_text = pyperclip.paste()
        except ImportError:
            logger.error("❌ pyperclip not installed. Install with: pip install pyperclip")
            logger.error("   Or save conversation text to a file and use --file option")
            return None
        except Exception as e:
            logger.error(f"❌ Could not read clipboard: {e}")
            return None
        
        MIN_CONTENT_LENGTH = 100
        if not conversation_text or len(conversation_text) < MIN_CONTENT_LENGTH:
            logger.error(f"❌ Clipboard content too short (< {MIN_CONTENT_LENGTH} chars). Make sure you've copied the conversation.")
            return None
        
        # Check for excessive size (> 10MB)
        MAX_SIZE = 10 * 1024 * 1024  # 10MB
        if len(conversation_text.encode('utf-8')) > MAX_SIZE:
            logger.warning(f"⚠️  Clipboard content very large (> 10MB). This may take a moment...")
        
        return self.save_conversation_markdown(conversation_text, session_name)
    
    def save_from_file(self, input_file: Path, session_name: Optional[str] = None) -> Path:
        """
        Save conversation from a text file
        
        Args:
            input_file: Path to file containing conversation text
            session_name: Optional custom name for the session
        """
        if not input_file.exists():
            logger.error(f"❌ File not found: {input_file}")
            return None
        
        try:
            conversation_text = input_file.read_text(encoding='utf-8')
        except OSError as e:
            logger.error(f"❌ Failed to read file: {e}")
            return None
        
        return self.save_conversation_markdown(conversation_text, session_name)
    
    def merge_with_narrative(self, claude_session_file: Path, 
                           narrative_file: Optional[Path] = None) -> Optional[Path]:
        """
        Merge Claude session with narrative chapter for complete record
        
        Args:
            claude_session_file: Path to Claude session markdown
            narrative_file: Optional narrative chapter to merge with
        
        Returns:
            Path to merged file
        """
        # Read Claude session
        try:
            claude_content = claude_session_file.read_text(encoding='utf-8')
        except OSError as e:
            logger.error(f"❌ Failed to read Claude session: {e}")
            return None
        
        # Find corresponding narrative if not specified
        if not narrative_file:
            # Look for most recent chapter by modification time
            chapters = list(self.chapters_dir.glob("*.md"))
            if chapters:
                narrative_file = max(chapters, key=lambda p: p.stat().st_mtime)
        
        # Create merged content with chapter numbering
        timestamp = datetime.datetime.now()
        
        # Extract chapter number from claude session filename
        match = re.match(r'chapter_(\d+)_', claude_session_file.name)
        if match:
            chapter_num = match.group(1)
            merged_filename = f"chapter_{chapter_num}_complete.md"
        else:
            merged_filename = f"complete_session_{timestamp.strftime('%Y%m%d_%H%M%S')}.md"
        
        merged_path = self.chapters_dir / merged_filename
        
        content = []
        content.append(f"# Complete Adventure Session")
        content.append(f"**Archived**: {timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        content.append("")
        
        # Add narrative if available
        if narrative_file and narrative_file.exists():
            content.append("## 📖 Narrative Chapter")
            content.append("")
            try:
                narrative_content = narrative_file.read_text(encoding='utf-8')
                content.append(narrative_content)
                content.append("")
                content.append("---")
                content.append("")
            except OSError as e:
                logger.warning(f"⚠️  Could not read narrative file: {e}")
        
        # Add Claude conversation
        content.append("## 💬 Claude Code Session")
        content.append("")
        content.append(claude_content)
        
        # Write merged file
        try:
            merged_path.write_text('\n'.join(content), encoding='utf-8')
            logger.info(f"📚 Complete session saved: {merged_path.name}")
            return merged_path
        except OSError as e:
            logger.error(f"❌ Failed to save merged file: {e}")
            return None
    
    def list_sessions(self):
        """List all saved Claude sessions"""
        sessions = sorted(self.claude_sessions_dir.glob("*.md"))
        
        if not sessions:
            logger.info("No Claude sessions found.")
            return
        
        logger.info("\n📁 Saved Claude Sessions:")
        logger.info("-" * 50)
        for session in sessions:
            # Get file stats
            try:
                stats = session.stat()
                size_kb = stats.st_size / 1024
                modified = datetime.datetime.fromtimestamp(stats.st_mtime)
                
                logger.info(f"  📄 {session.name}")
                logger.info(f"     Size: {size_kb:.1f} KB")
                logger.info(f"     Modified: {modified.strftime('%Y-%m-%d %H:%M')}")
                logger.info("")
            except OSError as e:
                logger.warning(f"  ⚠️  Could not read {session.name}: {e}")

def main():
    """Command line interface for session capture"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Capture and save Claude Code conversation sessions",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Save from clipboard (after copying conversation)
  python claude_session_capture.py --clipboard
  
  # Save from file with custom name
  python claude_session_capture.py --file conversation.txt --name "boss_battle"
  
  # Merge with narrative chapter
  python claude_session_capture.py --merge claude_session_20240115.md
  
  # List all saved sessions
  python claude_session_capture.py --list

Instructions for capturing from Claude Code:
  1. In Claude Code, select all conversation text (Ctrl+A / Cmd+A)
  2. Copy to clipboard (Ctrl+C / Cmd+C)
  3. Run: python claude_session_capture.py --clipboard --name "your_session_name"
        """
    )
    
    parser.add_argument('--clipboard', action='store_true',
                      help='Save conversation from clipboard')
    parser.add_argument('--file', type=Path,
                      help='Save conversation from text file')
    parser.add_argument('--name', type=str,
                      help='Custom name for the session')
    parser.add_argument('--merge', type=Path,
                      help='Merge Claude session with narrative chapter')
    parser.add_argument('--list', action='store_true',
                      help='List all saved Claude sessions')
    
    args = parser.parse_args()
    
    try:
        capture = ClaudeSessionCapture()
    except OSError:
        return 1
    
    # Handle different modes
    if args.list:
        capture.list_sessions()
        return 0
    elif args.clipboard:
        session_file = capture.save_from_clipboard(args.name)
        if session_file:
            logger.info(f"✅ Session saved to: {session_file}")
            logger.info("\nTip: To merge with narrative, run:")
            logger.info(f"  python {__file__} --merge {session_file.name}")
            return 0
        return 1
    elif args.file:
        session_file = capture.save_from_file(args.file, args.name)
        if session_file:
            logger.info(f"✅ Session saved to: {session_file}")
            return 0
        return 1
    elif args.merge:
        merged_file = capture.merge_with_narrative(args.merge)
        if merged_file:
            logger.info(f"✅ Merged session saved to: {merged_file}")
            return 0
        return 1
    else:
        parser.print_help()
        logger.warning("\n⚠️  No action specified. Use --help for usage information.")
        return 1

if __name__ == "__main__":
    sys.exit(main())