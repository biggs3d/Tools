#!/bin/bash
# AI Context Gathering Script
# Focuses on documentation and current state

echo "=== AI Context Gathering ==="
echo "Generated at: $(date)"
echo ""

echo "=== Current Git State ==="
echo "Branch: $(git branch --show-current)"
echo "Modified files:"
git status --porcelain | head -10
echo ""

echo "=== Project Documentation ==="
echo "Root level docs:"
ls -la *.md 2>/dev/null | awk '{print "  - " $9}'
echo ""

if [ -d "./ai-guide" ]; then
    echo "AI Guide docs:"
    ls -1 ./ai-guide/*.md 2>/dev/null | xargs -I {} basename {} | sed 's/^/  - /'
    echo ""
fi

echo "=== Key Documentation Files ==="
# Read key sections from important docs
if [ -f "CLAUDE.md" ]; then
    echo "📄 CLAUDE.md (first 20 lines):"
    head -20 CLAUDE.md | sed 's/^/  /'
    echo ""
fi

if [ -f "NEXT_SESSION_GUIDE.md" ]; then
    echo "📄 NEXT_SESSION_GUIDE.md (first 20 lines):"
    head -20 NEXT_SESSION_GUIDE.md | sed 's/^/  /'
    echo ""
fi

echo "=== TODO/NOTE-AI Summary ==="
echo "TODO count: $(grep -r "TODO" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)"
echo "NOTE-AI locations:"
grep -r "NOTE-AI" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l 2>/dev/null | head -10 | sed 's/^/  - /'
echo ""

echo "=== Session Journey Status ==="
if [ -f "SESSION_JOURNEY.md" ]; then
    echo "📊 SESSION_JOURNEY.md found"
    # Show key metrics if available
    echo "Recent patterns:"
    grep -A 1 "^### Pattern:" SESSION_JOURNEY.md 2>/dev/null | grep -v "^--$" | head -6 | sed 's/^/  /'
    echo ""
    echo "Last updated:"
    grep "Last updated:" SESSION_JOURNEY.md 2>/dev/null | sed 's/^/  /'
else
    echo "No SESSION_JOURNEY.md found - use template to create one"
fi
echo ""

echo "=== Recommended Reading Order ==="
echo "1. CLAUDE.md - Project-specific guidance"
echo "2. AI_COLLABORATION_GUIDE.md - How to work with AI"
echo "3. ./ai-guide/_START_HERE.md - Framework overview"
echo "4. NEXT_SESSION_GUIDE.md - Current session context"
echo "5. SESSION_JOURNEY.md - Project evolution & patterns"
echo ""

echo "=== Quick Stats ==="
echo "TypeScript files: $(find . -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | wc -l)"
echo "Test files: $(find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "*.test.tsx" -o -name "*.spec.tsx" 2>/dev/null | grep -v node_modules | wc -l)"
echo ""

echo "Use this context to understand the project state and documentation available."