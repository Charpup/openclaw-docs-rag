#!/bin/bash
# health-check.sh - Simple health check for Docs-RAG v4.0
# Runs every 5 minutes via cron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="logs/health-check.log"
mkdir -p logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if node is available
if ! command -v node &> /dev/null; then
    log "ERROR: Node.js not found"
    exit 1
fi

# Check if llms.txt is accessible
if ! curl -sf https://docs.openclaw.ai/llms.txt > /dev/null; then
    log "ERROR: Cannot reach docs.openclaw.ai"
    exit 1
fi

# Run a test query
if node -e "
const { DocsRAG } = require('./src/index');
const rag = new DocsRAG();
rag.query('cron jobs').then(r => {
    if (r.results.length > 0) {
        console.log('OK');
        process.exit(0);
    } else {
        console.log('FAIL: No results');
        process.exit(1);
    }
}).catch(e => {
    console.log('FAIL:', e.message);
    process.exit(1);
});
" 2>&1 | grep -q "OK"; then
    log "OK: Health check passed"
    exit 0
else
    log "ERROR: Query test failed"
    exit 1
fi
