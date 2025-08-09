#!/usr/bin/env python3
"""
Centralized configuration for Adventure LitRPG system
Single source of truth for paths, constants, and shared settings
"""

from pathlib import Path
import json
from typing import Dict, Any, Optional

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent  # Goes from system/ to adventure_litrpg/
SYSTEM_DIR = PROJECT_ROOT / "system"
CONTENT_DIR = PROJECT_ROOT / "content"
SESSION_DIR = PROJECT_ROOT / "session"

# Session subdirectories
STATE_DIR = SESSION_DIR / "state"
NARRATIVE_DIR = SESSION_DIR / "narrative"
CHAPTERS_DIR = SESSION_DIR / "chapters"  # Polished novel chapters
CHRONICLES_DIR = SESSION_DIR / "chronicles"  # Real-time narrative capture
COMBAT_REPLAYS_DIR = SESSION_DIR / "combat_replays"
WORLD_DIR = SESSION_DIR / "world"
META_DIR = SESSION_DIR / "meta"

# State files
GAME_STATE_FILE = STATE_DIR / "game_state.json"
PROGRESSION_HISTORY_FILE = STATE_DIR / "progression_history.json"
SKILLS_TRACKING_FILE = STATE_DIR / "skills_tracking.json"
NPC_RELATIONSHIPS_FILE = WORLD_DIR / "npc_relationships.json"

# Content files
BESTIARY_FILE = CONTENT_DIR / "bestiary.json"
ITEMS_FILE = CONTENT_DIR / "items.json"
SPELLS_FILE = CONTENT_DIR / "spells.json"

# Game constants
DEFAULT_HP = 100
DEFAULT_MP = 50
DEFAULT_STAMINA = 100

# Stat limits for visualization
STAT_SOFT_CAP = 20  # For progress bars
STAT_HARD_CAP = 30  # Absolute maximum expected

# NPC disposition thresholds
DISPOSITION_THRESHOLDS = {
    "devoted_ally": 90,
    "close_friend": 70,
    "friend": 50,
    "friendly": 30,
    "acquaintance": 10,
    "neutral": -10,
    "wary": -30,
    "hostile": -50,
    "enemy": -70,
    "nemesis": -100
}

# Combat narrative thresholds
DAMAGE_THRESHOLDS = {
    "devastating": 50,
    "critical": 30,
    "heavy": 20,
    "solid": 10,
    "light": 5,
    "graze": 0
}

# Session settings
AUTO_SAVE_INTERVAL = 10  # Events before auto-save
MAX_SESSION_EVENTS = 1000  # Maximum events to keep in memory

class GameConfig:
    """Centralized configuration manager"""
    
    _instance = None
    _config_data = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.load_config()
        return cls._instance
    
    def load_config(self):
        """Load configuration from file if it exists"""
        config_file = SYSTEM_DIR / "config.json"
        if config_file.exists():
            with open(config_file) as f:
                self._config_data = json.load(f)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value"""
        return self._config_data.get(key, default)
    
    def set(self, key: str, value: Any):
        """Set configuration value"""
        self._config_data[key] = value
        self.save_config()
    
    def save_config(self):
        """Save configuration to file"""
        config_file = SYSTEM_DIR / "config.json"
        config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(config_file, 'w') as f:
            json.dump(self._config_data, f, indent=2)

def ensure_directories():
    """Create all required directories if they don't exist"""
    directories = [
        STATE_DIR,
        NARRATIVE_DIR,
        CHAPTERS_DIR,
        CHRONICLES_DIR,
        COMBAT_REPLAYS_DIR,
        WORLD_DIR,
        META_DIR
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

# Singleton instance
config = GameConfig()

# Ensure all directories exist on import
ensure_directories()