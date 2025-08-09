#!/usr/bin/env python3
"""
Narrative Chronicler - Real-time scene capture for LitRPG sessions
Preserves the actual play narrative, not summaries
"""

import json
import datetime
from pathlib import Path
from typing import Optional, Dict, List

class NarrativeChronicler:
    """
    Captures narrative exchanges in real-time during play
    Each scene/exchange is saved immediately to prevent loss
    """
    
    def __init__(self):
        self.session_dir = Path(__file__).parent.parent / "session"
        self.chronicles_dir = self.session_dir / "chronicles"
        self.chronicles_dir.mkdir(parents=True, exist_ok=True)
        
        # Load or create current chronicle
        self.current_chronicle_file = self.chronicles_dir / "current_session.json"
        self.load_or_create_chronicle()
    
    def load_or_create_chronicle(self):
        """Load existing chronicle or start new one"""
        if self.current_chronicle_file.exists():
            with open(self.current_chronicle_file) as f:
                self.chronicle = json.load(f)
        else:
            self.chronicle = {
                "session_start": datetime.datetime.now().isoformat(),
                "session_name": f"session_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}",
                "scenes": [],
                "word_count": 0,
                "exchange_count": 0
            }
            self.save_chronicle()
    
    def save_chronicle(self):
        """Save current chronicle to disk"""
        with open(self.current_chronicle_file, 'w') as f:
            json.dump(self.chronicle, f, indent=2)
    
    def add_scene(self, 
                  scene_title: str,
                  dm_narration: str,
                  player_response: Optional[str] = None,
                  game_mechanics: Optional[Dict] = None):
        """
        Add a complete scene/exchange to the chronicle
        This preserves the actual narrative, not a summary
        """
        scene = {
            "timestamp": datetime.datetime.now().isoformat(),
            "scene_number": len(self.chronicle["scenes"]) + 1,
            "title": scene_title,
            "dm_narration": dm_narration,
            "player_response": player_response,
            "game_mechanics": game_mechanics or {},
            "word_count": len(dm_narration.split()) + len((player_response or "").split())
        }
        
        self.chronicle["scenes"].append(scene)
        self.chronicle["word_count"] += scene["word_count"]
        self.chronicle["exchange_count"] += 1
        
        # Auto-save after each scene
        self.save_chronicle()
        
        # Also append to the current chapter file
        self.append_to_chapter(scene)
        
        return scene
    
    def append_to_chapter(self, scene: Dict):
        """
        Append scene to the current chapter markdown file
        This creates a readable narrative flow
        """
        chapter_file = self.chronicles_dir / f"{self.chronicle['session_name']}_narrative.md"
        
        with open(chapter_file, 'a') as f:
            if not chapter_file.exists() or chapter_file.stat().st_size == 0:
                f.write(f"# {self.chronicle['session_name'].replace('_', ' ').title()}\n\n")
                f.write(f"*Started: {self.chronicle['session_start']}*\n\n")
                f.write("---\n\n")
            
            # Write scene header
            f.write(f"## Scene {scene['scene_number']}: {scene['title']}\n\n")
            
            # Write DM narration (preserving formatting)
            f.write(scene['dm_narration'])
            f.write("\n\n")
            
            # Write player response if present
            if scene.get('player_response'):
                f.write(f"**Player**: {scene['player_response']}\n\n")
            
            # Add game mechanics if relevant
            if scene.get('game_mechanics'):
                f.write("```\n")
                for key, value in scene['game_mechanics'].items():
                    f.write(f"{key}: {value}\n")
                f.write("```\n\n")
            
            f.write("---\n\n")
    
    def get_current_word_count(self) -> int:
        """Get total word count for current session"""
        return self.chronicle["word_count"]
    
    def get_scene_count(self) -> int:
        """Get number of scenes in current session"""
        return len(self.chronicle["scenes"])
    
    def finalize_session(self, session_name: Optional[str] = None):
        """
        Finalize current session and prepare for archival
        """
        if session_name:
            self.chronicle["session_name"] = session_name
        
        self.chronicle["session_end"] = datetime.datetime.now().isoformat()
        
        # Calculate session duration
        start = datetime.datetime.fromisoformat(self.chronicle["session_start"])
        end = datetime.datetime.fromisoformat(self.chronicle["session_end"])
        duration = end - start
        self.chronicle["duration"] = str(duration)
        
        # Save final chronicle
        self.save_chronicle()
        
        # Archive the chronicle
        archive_name = f"{self.chronicle['session_name']}_chronicle.json"
        archive_path = self.chronicles_dir / archive_name
        
        # Move current to archive
        import shutil
        shutil.copy(self.current_chronicle_file, archive_path)
        
        # Create new empty chronicle for next session
        self.current_chronicle_file.unlink()
        self.load_or_create_chronicle()
        
        return archive_path
    
    def create_novel_chapter(self) -> Path:
        """
        Convert the chronicle into a polished novel chapter
        """
        chapter_num = len(list((self.session_dir / "chapters").glob("chapter_*.md"))) + 1
        chapter_file = self.session_dir / "chapters" / f"chapter_{chapter_num:02d}_live_play.md"
        
        with open(chapter_file, 'w') as f:
            f.write(f"# Chapter {chapter_num}: {self.chronicle['session_name'].replace('_', ' ').title()}\n\n")
            
            for scene in self.chronicle["scenes"]:
                # Skip scene numbers for novel format
                if scene.get("title"):
                    f.write(f"## {scene['title']}\n\n")
                
                f.write(scene["dm_narration"])
                f.write("\n\n")
                
                if scene.get("player_response"):
                    # Format player response as action/dialogue
                    f.write(f'"{scene["player_response"]}"\n\n')
        
        return chapter_file

# Singleton instance
chronicler = NarrativeChronicler()

# Helper function for DMs to use during play
def chronicle_scene(title: str, narration: str, player_response: str = None, mechanics: dict = None):
    """
    Quick function to chronicle a scene during play
    
    Example:
        chronicle_scene(
            "The Threshold Beast",
            "The beast unfolds from the shadows like a nightmare...",
            "I charge without hesitation!",
            {"damage_dealt": 18, "hp_remaining": 135}
        )
    """
    return chronicler.add_scene(title, narration, player_response, mechanics)

if __name__ == "__main__":
    print("📚 Narrative Chronicler initialized!")
    print(f"📝 Current session has {chronicler.get_scene_count()} scenes")
    print(f"💬 Word count: {chronicler.get_current_word_count()}")
    print("\nUse chronicle_scene() during play to capture narrative exchanges!")