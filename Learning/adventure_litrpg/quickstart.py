#!/usr/bin/env python3
"""
Quick Start Script for LitRPG Adventures
Handles initialization and common session tasks
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

def print_banner():
    print("""
    ╔══════════════════════════════════════════════════════╗
    ║        LitRPG ADVENTURE SYSTEM v1.0                   ║
    ║    Narrative First, Numbers That Matter               ║
    ║                                                        ║
    ║    "Live your own progression fantasy"                ║
    ╚══════════════════════════════════════════════════════╝
    """)

def check_existing_game():
    """Check if there's an existing game state"""
    state_file = Path("state/game_state.json")
    if state_file.exists():
        try:
            with open(state_file, 'r') as f:
                state = json.load(f)
                if 'character' in state:
                    return state['character']['name']
        except:
            pass
    return None

def main_menu():
    """Display main menu options"""
    existing = check_existing_game()
    
    print("\n" + "="*56)
    if existing:
        print(f"    Active Character: {existing}")
        print("="*56)
        print("\n1. Continue Adventure")
        print("2. Character Status")
        print("3. Create New Character (overwrites current)")
        print("4. Create Session Checkpoint")
        print("5. View Session Notes")
        print("6. Exit")
    else:
        print("\n1. Create New Character")
        print("2. Load from Archive")
        print("3. Exit")
    
    return input("\nChoice: ").strip()

def create_character():
    """Interactive character creation"""
    print("\n" + "="*56)
    print("           CHARACTER CREATION")
    print("="*56)
    
    name = input("\nCharacter Name: ").strip()
    if not name:
        name = "Wanderer"
    
    print("\nChoose your class:")
    print("1. Warrior - Tank and damage dealer (120 HP, 30 MP)")
    print("2. Rogue - Stealth and precision (80 HP, 50 MP)")
    print("3. Mage - Glass cannon spellcaster (60 HP, 120 MP)")
    
    class_choice = input("\nClass (1-3): ").strip()
    classes = {"1": "warrior", "2": "rogue", "3": "mage"}
    char_class = classes.get(class_choice, "warrior")
    
    print("\nDescribe your character's background (optional):")
    print("(This helps Claude craft a personalized opening)")
    background = input("> ").strip()
    
    # Save background for narrative use
    if background:
        Path("session/narrative").mkdir(parents=True, exist_ok=True)
        with open("session/narrative/character_background.md", 'w') as f:
            f.write(f"# {name}'s Background\n\n{background}\n")
    
    return {
        "name": name,
        "class": char_class,
        "background": background if background else None
    }

def create_checkpoint():
    """Create a session checkpoint"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    checkpoint_dir = Path(f"archives/checkpoint_{timestamp}")
    
    print(f"\nCreating checkpoint: {timestamp}")
    
    # Copy session directory
    import shutil
    if Path("session").exists():
        shutil.copytree("session", checkpoint_dir, dirs_exist_ok=True)
        print(f"✓ Checkpoint saved to: {checkpoint_dir}")
        
        # Add checkpoint note
        note = input("Add a note for this checkpoint (optional): ").strip()
        if note:
            with open(checkpoint_dir / "checkpoint_note.txt", 'w') as f:
                f.write(f"{timestamp}: {note}\n")
    else:
        print("No active session to checkpoint")

def view_status():
    """Display current character status"""
    state_file = Path("state/game_state.json")
    if not state_file.exists():
        print("\nNo active character found!")
        return
    
    with open(state_file, 'r') as f:
        state = json.load(f)
    
    if 'character' not in state:
        print("\nNo character data found!")
        return
    
    char = state['character']
    print("\n" + "="*56)
    print(f"    {char['name']} - Level {char['level']} {char['class'].title()}")
    print("="*56)
    print(f"\n HP: {char['hp']}/{char['hp_max']} ████████░░ {int(char['hp']/char['hp_max']*100)}%")
    print(f" MP: {char['mp']}/{char['mp_max']} ██████░░░░ {int(char['mp']/char['mp_max']*100)}%")
    print(f" ST: {char['stamina']}/{char['stamina_max']} █████████░ {int(char['stamina']/char['stamina_max']*100)}%")
    print(f"\n XP: {char['xp']}/{char['xp_next']} (Level {char['level']})")
    print(f" Gold: {char['gold']} coins")
    print(f"\n Attributes:")
    print(f"  STR: {char['strength']:2d}  DEX: {char['dexterity']:2d}  INT: {char['intelligence']:2d}")
    print(f"  CON: {char['constitution']:2d}  WIS: {char['wisdom']:2d}  CHA: {char['charisma']:2d}")

def generate_session_prompt(char_data=None):
    """Generate a prompt for Claude to start/continue the session"""
    if char_data and char_data.get('background'):
        prompt = f"""
Start a new LitRPG adventure!

Character: {char_data['name']}, a {char_data['class']}
Background: {char_data['background']}

Please:
1. Initialize the character using the game engine
2. Create an immersive opening scene that hooks immediately
3. Incorporate the background into the narrative
4. End with a clear choice or action prompt

Remember: You're the DM of a living LitRPG world. Make it feel like the player 
is living inside their favorite progression fantasy novel!
"""
    elif char_data:
        prompt = f"""
Start a new LitRPG adventure!

Character: {char_data['name']}, a {char_data['class']}

Please:
1. Initialize the character using the game engine
2. Create an immersive opening scene that hooks immediately
3. Drop them into immediate intrigue or danger
4. End with a clear choice or action prompt

Make this feel cinematic and visceral!
"""
    else:
        prompt = """
Continue the LitRPG adventure from where we left off.

Please:
1. Load the current game state and check session files
2. Provide a brief "Previously on..." recap
3. Continue from the last scene
4. Maintain narrative continuity

Let's dive back into the adventure!
"""
    
    print("\n" + "="*56)
    print("    PROMPT FOR CLAUDE CODE")
    print("="*56)
    print(prompt)
    print("="*56)
    print("\nCopy the above prompt to start your adventure!")

if __name__ == "__main__":
    print_banner()
    
    while True:
        choice = main_menu()
        
        if choice == "1" and check_existing_game():
            # Continue adventure
            generate_session_prompt()
            break
        elif choice == "1" and not check_existing_game():
            # New character
            char_data = create_character()
            generate_session_prompt(char_data)
            break
        elif choice == "2" and check_existing_game():
            # View status
            view_status()
        elif choice == "2" and not check_existing_game():
            # Load from archive
            print("\nAvailable checkpoints:")
            archives = Path("archives").glob("checkpoint_*")
            for arch in sorted(archives):
                note_file = arch / "checkpoint_note.txt"
                if note_file.exists():
                    with open(note_file, 'r') as f:
                        print(f"  - {arch.name}: {f.read().strip()}")
                else:
                    print(f"  - {arch.name}")
            print("\nManually copy checkpoint to session/ to restore")
        elif choice == "3" and check_existing_game():
            # New character (overwrite)
            char_data = create_character()
            generate_session_prompt(char_data)
            break
        elif choice == "3" and not check_existing_game():
            # Exit
            print("\nMay your adventures be epic!")
            sys.exit(0)
        elif choice == "4" and check_existing_game():
            # Create checkpoint
            create_checkpoint()
        elif choice == "5" and check_existing_game():
            # View notes
            notes_file = Path("session/narrative/session_log.md")
            if notes_file.exists():
                with open(notes_file, 'r') as f:
                    content = f.read()
                    print("\nRecent Session Notes:")
                    print("-" * 40)
                    # Show last 500 chars
                    print(content[-500:] if len(content) > 500 else content)
            else:
                print("\nNo session notes found yet")
        elif choice == "6":
            print("\nMay your adventures be epic!")
            sys.exit(0)
        else:
            print("\nInvalid choice, try again")