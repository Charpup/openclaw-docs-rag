#!/bin/bash
# monitor-sync-progress.sh - Background monitor for sync progress reporting

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/sync-progress-monitor.log"
REPORT_INTERVAL=300  # 5 minutes

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

get_progress() {
    local checkpoint="${SCRIPT_DIR}/sync-checkpoint.json"
    if [ -f "$checkpoint" ]; then
        cat "$checkpoint" | node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync(0, 'utf-8'));
            const processed = data.processedChunkIds?.length || 0;
            const total = data.totalChunks || 7493;
            const batch = data.currentBatch || 0;
            const percentage = ((processed / total) * 100).toFixed(1);
            console.log(\`Batch \${batch} | \${processed}/\${total} chunks (\${percentage}%)\`);
        " 2>/dev/null || echo "Checkpoint parsing error"
    else
        echo "No checkpoint found"
    fi
}

get_db_stats() {
    export PGPASSWORD=memu_secure_password
    psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs || echo "N/A"
}

# Main monitoring loop
log "=== Sync Progress Monitor Started ==="
log "Report interval: ${REPORT_INTERVAL}s"

while true; do
    PROGRESS=$(get_progress)
    DB_CHUNKS=$(get_db_stats)
    
    log "Progress: $PROGRESS | DB: $DB_CHUNKS chunks"
    
    sleep $REPORT_INTERVAL
done
