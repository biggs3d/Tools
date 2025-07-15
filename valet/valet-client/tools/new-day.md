# New Day Script

This script handles the transition from one day to the next, creating new daily files and processing the previous day's data.

## Purpose

Run this script to:
- Create new daily planner and journal files for today
- Process previous day's summaries for embedding generation
- Update FAISS index with new embeddings
- Initialize today's files with proper templates

## When to Use

- **Every morning** after daily reflection/review
- **At the start of VALET session** if daily files don't exist
- **After completing end-of-day summaries** to prepare for tomorrow

## Configuration

Uses settings from `settings.json`:
- `file_paths.days_directory` - Where daily files are stored
- `embeddings` - Embedding generation settings
- `daily_routine` - Morning briefing preferences

## Script Location

```bash
node tools/new-day.mjs
```

## What It Does

1. **Creates daily files:**
   - `YYYY-MM-DD-planner.md` - Work tasks and technical notes
   - `YYYY-MM-DD-journal.md` - Personal reflections and growth

2. **Processes previous day:**
   - Extracts summary sections from yesterday's files
   - Generates embeddings using Gemini bridge
   - Updates FAISS index with new vectors
   - Updates metadata JSON with keywords and references

3. **Initializes structure:**
   - Creates directories if they don't exist
   - Applies templates from `config/templates.json`
   - Sets up proper file permissions

## Error Handling

- Logs errors to `ERRORS.md`
- Continues with available functionality if some steps fail
- Creates backup timestamps for recovery

## Agent Usage

Call this script when:
- User greets you to start a new day
- Daily files for today don't exist
- User explicitly asks to "start new day"
- Previous day's reflection is complete

Don't call if:
- Today's files already exist (unless user requests refresh)
- Previous day's summaries are incomplete
- User is mid-conversation about ongoing work