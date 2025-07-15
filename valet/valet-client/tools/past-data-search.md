# Past Data Search Script

This script searches through historical daily files to find relevant information, solutions, and context.

## Purpose

Use this script to:
- Find similar past experiences or solutions
- Retrieve context for ongoing projects
- Locate specific information from previous days
- Support decision-making with historical data

## When to Use

- **User asks about past events** ("What did we do about X before?")
- **Ongoing task needs context** that wasn't carried forward day-to-day
- **Personal growth discussions** need historical progress context
- **Problem-solving** where past solutions might be relevant

## Configuration

Uses settings from `settings.json`:
- `embeddings.similarity_threshold` - Minimum similarity score for results
- `embeddings.max_results` - Maximum number of results to return
- `file_paths.days_directory` - Where to search for daily files

## Script Location

```bash
node tools/past-data-search.mjs "search query"
```

## What It Does

1. **Semantic search:**
   - Generates embedding for search query
   - Searches FAISS index for similar embeddings
   - Returns ranked results above similarity threshold

2. **Keyword search:**
   - Supplements semantic search with grep/rg
   - Finds exact matches in file content
   - Useful for names, dates, specific terms

3. **Context retrieval:**
   - Returns relevant file sections with metadata
   - Provides date, source file, and section references
   - Includes surrounding context for better understanding

## Search Types

**Semantic search examples:**
- "debugging network issues"
- "personal productivity insights"
- "project planning approaches"

**Keyword search examples:**
- "italki session"
- "client meeting"
- "bug #123"

## Output Format

Returns structured results with:
- **Similarity score** (for semantic matches)
- **Date and source** (file and section)
- **Context snippet** (relevant content)
- **Keywords** (for categorization)

## Error Handling

- Handles missing FAISS index gracefully
- Falls back to keyword search if embeddings fail
- Logs errors to `ERRORS.md`
- Returns empty results rather than crashing

## Agent Usage

Call this script when:
- User references past events or solutions
- Current task would benefit from historical context
- Personal growth discussions need progress tracking
- Problem-solving requires past experience

Don't call if:
- Current context is sufficient
- User asking about very recent events (check today/yesterday first)
- Speed is more important than comprehensiveness