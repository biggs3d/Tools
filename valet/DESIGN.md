# VALET

> VALET is a personal secretary and butler for your digital life, designed to help you manage tasks, schedule todos, and organize information efficiently.

## Design Overview

Agent-first architecture with a focus on modularity and extensibility. VALET is built around the concept of an agent
working in a digital space using built-in tools and plugins, as well as custom scripts and commands.

## Key Components

### Agent Core

The core of VALET is current Claude Code, which provides the main interface for interacting with the system (a terminal).

**Personality**:
- Friendly, helpful, and efficient.
- Moves between a professional tone, a counselor-like demeanor, and a casual tone depending on the context. 
Mirror the user's tone and style and take into account the topic and task being discussed.
- Casual tone can include the ironic and a touch of sarcasm, but positively.
- Drops the occasional other-language phrase (see settings.json) to add a personal touch since the user may be learning language(s).
- Proactive but not pushy: "Offers gentle reminders and suggestions without        
  being overbearing"
- Learning alongside: "Grows understanding of user's patterns and preferences      
  over time"
- Context-aware humor: "Knows when levity helps and when to be more serious"



### Daily Interaction

- To adapt to the user's preferences and style over time, the CLAUDE.md can be updated with new instructions and examples of the user's preferences.
- Not every day will be the same, and not all the data for the file templates will come up in conversation.
- The agent can ask for details to fill in the blanks, especially with reminders, but it should not be too intrusive or repetitive.

- After starting a new day, while keeping a mix of casual and professional tone, VALET will:
    - Review the previous day's tasks and notes, reminding the user about accomplishments and pending tasks.
    - Discuss any changes or updates to the global todo list, if there's anything new to tackle from it, or add to it.
    - Review the daily planner and journal files, discussing any important notes or reflections from the previous day.
    - Discuss the user's long-term goals and how today's tasks align with them.

### Tooling System

**IMPORTANT: All scripts must handle missing files/directories gracefully for new installations**

- "new day script" (new-day.mjs)
    - Creates directories if they don't exist (days/, archive/, etc.)
    - Generates new daily planner & journal files with the correct filename (YYYY-MM-DD-<Type>.md)
    - Initializes settings.json with defaults if missing
    - Uses gemini bridge mcp to generate embedding vectors for each summary section
    - Saves embeddings to FAISS index for efficient similarity search
    - Creates FAISS index if it doesn't exist
    - Multiple embeddings per date if summaries cover distinct topics
    - Metadata includes keywords, topics, and section references
    - Keywords are maintained by agent when updating summaries
    - Topics for future graph db potential, not full text search
    - Note: Git handles version control for global files, no daily archiving needed
    
- "past data searching script" (past-data-search.mjs)
  - Checks for FAISS index existence before searching
  - Uses FAISS for efficient similarity search across all embeddings
  - Hybrid approach: embedding similarity + keyword matching (grep/rg for keywords)
  - Configurable similarity threshold in settings.json
  - Returns ranked results with date/section references
  - Gracefully handles empty or missing index

- "git repo monitoring" (git-monitoring.mjs script)
  - Script checks configured list of local git repository folders
  - Runs trusted git commands to gather activity data
  - Returns structured summary of commits, merges, and PR descriptions
  - Summarizes changes since last check timestamp: commits, authors, messages
  - Focuses on commit text and PR context, **never file contents**
  - **Security:** Only commit metadata (messages, hashes, authors) processed
  - **Includes merge commits** for understanding feature completion
  - Provides overview of development activity across projects
  - Useful for daily briefings on project progress
  - Generous limits: max 200 commits per repo, up to 50000 chars raw output
  - **Intelligent summarization:** Uses Gemini MCP when output > threshold
  - **Merge prioritization:** Merge commits included before regular commits
  - Configurable in settings.json under `tools.git_monitoring`
  - Updates `last_check_timestamp` after successful runs
  - Includes git-monitoring.md guidance for when agent should call it


# Repository Structure

```
/valet-client/              # VALET operational environment
    /tools/
        ├── new-day.mjs          # Script: Creates new daily files and handles archiving
        ├── new-day.md           # Tool guidance: When and how to use new-day script
        ├── past-data-search.mjs # Script: Searches past data files for relevant information
        ├── past-data-search.md  # Tool guidance: When and how to use search script
        ├── git-monitoring.mjs   # Script: Checks local git repos for activity
        ├── git-monitoring.md    # Tool guidance: When and how to use git monitoring
        ├── lib/
        │   ├── archiver.mjs     # Handles file archiving
        │   ├── generator.mjs    # Creates new daily files
        │   └── embeddings.mjs   # Gemini bridge integration
        └── config/
            └── templates.json   # Daily file templates with metadata fields
    ├── CLAUDE.md           # Operational guidance for VALET agent (run Claude Code from here)
    ├── USER.md            # User profile, background, personality, preferences, long-term goals
    ├── _global_todo.md    # Global todo list (current state)
    ├── settings.json      # Configuration settings for VALET
    ├── ERRORS.md          # Error log maintained by VALET agent
    └── /days/
        ├── YYYY-MM-DD-planner.md  # Daily planner file
        ├── YYYY-MM-DD-journal.md   # Daily journal file
        ├── embeddings.faiss        # FAISS index for all embeddings
        └── embeddings_metadata.json # Metadata for embeddings
├── DESIGN.md           # Project design and architecture
└── CLAUDE.md           # Development guidance for building VALET
```

### Global Todo List

A centralized list for managing tasks, todos, and reminders. It allows flexible categorization and prioritization of tasks
within a single file that constantly updates and evolves over time.

```markdown
# Global Todo List

## Tasks

- [ ] Task 1
```

### Daily Planner & Journal

Each day, VALET interacts with and maintains a daily planner file that includes:
- Tasks from the global todo list that are in-progress or due today
- In-progress notes and thoughts, lessons learned, and solutions to problems.

```markdown
# YYYY-MM-DD Planner

## Tasks Being Worked On Today
- Task 1
    - Note 1
    - Note 2

## Data Stash    
(note: not any personal data, just technical, general work or home tasks or project-related information)
  - Awesome quote about AI 
  - ideas for a different project
  - URL shared from a friend to save as a later technical reference
  - keywords: [auto-generated from content for search/embedding metadata]

## Ongoing Summary
- Summary of the day
- Lessons Learned
- Solutions to Problems


```

Eacy day, VALET maintains a daily journal file that includes more personal thoughts, reflections, and notes on life
and long-term goals. This file is used to track changes, reflect on achievements, and plan for the future.

```markdown
# YYYY-MM-DD Journal

## Reflections, Thoughts, and Notes
- Reflection 1
- Thought 1
- Note 1

## Personal Reminders
- Check in on what's being done today working towards long-term goals

## Ongoing Summary
- How the day went
- How the user seems to be doing 
- Reflections on the day
- Thoughts on life and touching base on long-term goals
- Personal notes and thoughts

```


### Daily Workflow

**Morning Greeting Process:**
1. User starts day with a greeting to VALET
2. VALET automatically:
   - Loads USER.md into context (extensive character sheet, always available)
   - Reviews previous day's planner and journal files
   - Checks current global todo list state
   - Identifies any historical context needed based on ongoing tasks or personal goals
   - Provides daily summary and asks about priorities

**Historical Data Retrieval Criteria:**
- Pull historical data if:
  - Ongoing task details haven't been copied day-to-day
  - Personal growth goal discussion lacks historical progress context
  - User references past solutions or lessons learned
- Skip historical data if:
  - User discussing routine daily work items
  - Current context is sufficient for the conversation

**End of Day Process:**
- After daily reflection, VALET calls the "new day" script
- Prepares for next day (Git handles version history)

### Embedding System

**Storage Format:**
- FAISS index file for vectors (binary, efficient similarity search)
- Companion metadata JSON file:
```json
{
  "embeddings": [
    {
      "id": 0,
      "date": "2025-07-14",
      "source": "planner",
      "section": "ongoing_summary",
      "keywords": ["project", "debugging", "solution"]
    },
    {
      "id": 1,
      "date": "2025-07-14",
      "source": "journal",
      "section": "reflections",
      "keywords": ["growth", "learning", "goals"]
    }
  ]
}
```

**Multiple Embeddings per Date:**
- Each distinct topic in summary sections gets its own embedding
- Embeddings tool receives array of summary texts
- Metadata includes keywords, source file, and section reference

**Configuration:**
- Embedding similarity threshold range in `settings.json`
- Agent adjusts threshold based on search result quality
- Default values provided, agent learns optimal settings

**Error Handling:**
- All failures logged to `ERRORS.md` with timestamps
- Agent notifies user of any issues immediately
- Graceful degradation - continue with available functionality

### Implementation Notes

**Data Storage Philosophy:**
- Text files for development simplicity (grep/rg for keyword search)
- Even years of daily files manageable for personal use
- SQLite considered for future if complex queries needed
- Git provides version history, no redundant archiving

**Agent Flexibility:**
- Currently using Claude Code as conversational frontend
- Architecture supports any agent that can read files and follow guides
- Tools and patterns transferable to local models when ready
- Run Claude Code from `/valet-client/` folder for testing operational behavior
- Development work happens at root level with separate CLAUDE.md

**Scalability Path:**
- Personal prototype first, multi-user later
- Empty starter package for other users (no personal data)
- Schema migrations handled via converter scripts if needed
- Template changes gracefully handled by reading agents

**New Installation Handling:**
- Scripts create all necessary directories on first run
- Default templates and settings provided
- No assumptions about existing files or structure
- Clear error messages guide user through setup
- Initialize with placeholder files for USER.md, settings.json, etc.

**Tool Documentation Pattern:**
- Every script has a corresponding `.md` file with usage guidance
- `.md` files explain when to use, what it does, and error handling
- Agent references both script functionality and usage guidance
- Scripts can use Gemini MCP for intelligent summarization of large outputs

**Gemini Integration Benefits:**
- Massive context window (2M tokens) allows comprehensive data gathering
- Cheap token costs enable generous limits and intelligent summarization
- Context-aware summaries better than simple truncation
- Tools can process much more data before needing to summarize
- **Security:** Only metadata sent to Gemini, never file contents
