#!/bin/bash
# verify-sync.sh - Verify sync health and detect issues

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "=== Docs-RAG Sync Verification ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: API Key
echo -n "1. API Key configured: "
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} (prefix: ${OPENAI_API_KEY:0:10}...)"
else
    echo -e "${RED}✗ Missing${NC}"
    exit 1
fi

# Check 2: Database connection
echo -n "2. Database connection: "
if psql -h localhost -U memu -d memu_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    exit 1
fi

# Check 3: Database stats
echo "3. Database statistics:"
DB_STATS=$(psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*), COUNT(DISTINCT source), MAX(created_at) FROM openclaw_docs_chunks;" 2>/devnull | xargs)
echo "   - Total chunks: $(echo $DB_STATS | cut -d' ' -f1)"
echo "   - Unique sources: $(echo $DB_STATS | cut -d' ' -f2)"
echo "   - Last update: $(echo $DB_STATS | cut -d' ' -f3-4)"

# Check 4: Checkpoint status
echo "4. Checkpoint status:"
if [ -f "$SCRIPT_DIR/sync-checkpoint.json" ]; then
    CHECKPOINT=$(cat "$SCRIPT_DIR/sync-checkpoint.json")
    TOTAL=$(echo $CHECKPOINT | node -e "const d=require('./sync-checkpoint.json'); console.log(d.totalChunks);" 2>/dev/null || echo "?")
    BATCH=$(echo $CHECKPOINT | node -e "const d=require('./sync-checkpoint.json'); console.log(d.currentBatch);" 2>/dev/null || echo "?")
    PROCESSED=$(echo $CHECKPOINT | node -e "const d=require('./sync-checkpoint.json'); console.log(d.processedChunkIds.length);" 2>/dev/null || echo "?")
    
    echo "   - Total expected: $TOTAL"
    echo "   - Current batch: $BATCH"
    echo "   - Processed in checkpoint: $PROCESSED"
    
    # Verify consistency
    DB_COUNT=$(psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks WHERE created_at > '2026-02-23';" 2>/dev/null | xargs || echo "0")
    
    echo "   - Recently stored in DB: $DB_COUNT"
    
    if [ "$PROCESSED" -gt "$DB_COUNT" ] 2>/dev/null; then
        echo -e "   ${YELLOW}⚠ Warning: Checkpoint shows more processed than stored in DB${NC}"
        echo -e "   ${YELLOW}  This may indicate previous data loss. Consider running: ./sync-docs.sh --force${NC}"
    fi
else
    echo -e "   ${YELLOW}No checkpoint found (fresh start)${NC}"
fi

# Check 5: Process running
echo -n "5. Sync process running: "
if pgrep -f "syncDocs" > /dev/null; then
    echo -e "${GREEN}✓ Yes${NC}"
else
    echo -e "${YELLOW}No${NC}"
fi

# Check 6: Cron jobs
echo "6. Cron jobs installed:"
crontab -l 2>/dev/null | grep -E "(sync-monitor|version-check|sync-docs)" | wc -l | xargs -I {} echo "   {} jobs found"

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Quick actions:"
echo "  - Start/Resume sync: ./sync-docs.sh"
echo "  - Force restart:     ./sync-docs.sh --force"
echo "  - Check status:      ./sync-monitor.sh once"
echo "  - Query docs:        ./query-docs.sh 'your question'"
