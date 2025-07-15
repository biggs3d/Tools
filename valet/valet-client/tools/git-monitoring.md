# Git Repository Monitoring Script

This script checks local git repositories for recent activity and provides structured summaries.

## Purpose

Use this script to:
- Monitor development activity across multiple projects
- Get summaries of recent commits and changes
- Track project progress for daily briefings
- Identify active development areas

## When to Use

- **Morning briefings** when `git_monitoring.include_in_briefing` is true
- **User asks about project activity** ("What's been happening with my projects?")
- **Daily check-ins** to stay updated on development progress
- **Before planning work** to see what's been done recently

## Configuration

Uses settings from `settings.json`:
- `tools.git_monitoring.enabled` - Whether to include git monitoring
- `tools.git_monitoring.repos` - Array of **local** repository paths to monitor
- `tools.git_monitoring.check_frequency` - How often to check (daily, weekly)
- `tools.git_monitoring.include_in_briefing` - Include in morning briefings
- `tools.git_monitoring.last_check_timestamp` - When the tool was last run (updated by script)
- `tools.git_monitoring.max_commits_per_repo` - Limit commits per repository (default: 200)
- `tools.git_monitoring.max_output_chars` - Limit total raw output (default: 50000 chars)
- `tools.git_monitoring.use_summarization` - Use Gemini MCP for intelligent summarization
- `tools.git_monitoring.summarization_threshold` - Summarize if output > threshold (default: 15000)
- `tools.git_monitoring.prioritize_merges` - Prioritize merge commits over regular commits

## Script Location

```bash
node tools/git-monitoring.mjs
```

## What It Does

1. **Checks local repositories:**
   - Validates each repo path exists and is a git repository
   - Runs trusted git commands to gather activity data
   - No remote access required - works with local state

2. **Gathers activity data:**
   - Recent commits since last check (or configurable timeframe)
   - Commit messages and PR descriptions
   - **Merge commits** - Important for understanding feature completion
   - Author activity summary
   - Branch information (focus on commit text, not file changes)
   - Limits: Max 200 commits per repo, up to 50000 chars raw output
   - **Merge prioritization:** Merge commits included before regular commits if at limit

3. **Returns structured data:**
   - JSON output for easy parsing
   - Human-readable summary for briefings
   - Error information for problematic repos
   - Updates `last_check_timestamp` in settings.json after successful run

## Security Benefits

- **Local repos only:** No remote authentication required
- **Trusted commands:** Script runs only safe git commands
- **Metadata only:** No file contents sent - only commit messages, hashes, authors
- **Structured output:** Returns clean data, no command injection risks
- **Permission control:** Script handles file system access

## Output Format

Returns JSON with summary like:
```json
{
  "repos": [
    {
      "path": "/path/to/repo1",
      "status": "clean",
      "recent_commits": 5,
      "authors": ["author1", "author2"],
      "latest_commit": {
        "hash": "abc123",
        "author": "author1",
        "message": "Fix bug in feature X"
      }
    }
  ]
}
```

## Error Handling

- Logs errors to `ERRORS.md` for missing/invalid repos
- Continues with remaining repos if some fail
- Returns error status in JSON output
- Graceful handling of permission issues

## Agent Usage

Call this script when:
- User greets you and `tools.git_monitoring.include_in_briefing` is true
- User asks about project activity or progress
- Daily check-in routine includes development updates
- User wants to see what's been worked on recently

Don't call if:
- `tools.git_monitoring.enabled` is false
- No repositories configured
- User specifically asks to skip development updates

## Data Focus

- **Commit messages:** What was done, why it was done
- **Merge commits:** Feature completions, branch integrations
- **PR descriptions:** Higher-level context and purpose
- **Author activity:** Who's been working on what
- **Branch context:** Which features/fixes are in progress
- **Commit metadata:** Hashes, dates, authors, branch names
- **NEVER file contents:** No actual code or file changes for security

## Output Strategy

- **Raw data limits:** Up to 200 commits per repo, 50000 chars total
- **Merge prioritization:** Merge commits included before regular commits
- **Intelligent summarization:** If output > 15000 chars, use Gemini MCP to summarize
- **Context-aware:** Gemini understands project themes and groups related work
- **Consistent output:** Always returns digestible summary regardless of activity level

## Summarization Process

1. **Gather comprehensive data:** All commits, merges, PRs within limits
2. **Check threshold:** If raw output > `summarization_threshold`
3. **Call Gemini MCP:** Intelligent summarization focusing on:
   - Key feature completions (merges)
   - Major themes and patterns from commit messages
   - Author contributions
   - Project progress highlights
   - **Only metadata processed:** No file contents sent to Gemini
4. **Return summary:** Concise, context-aware development overview