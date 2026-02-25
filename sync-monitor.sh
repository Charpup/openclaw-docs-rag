#!/bin/bash
# sync-monitor.sh - Monitors docs-rag sync progress with periodic reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/sync-monitor.log"
REPORT_FILE="${SCRIPT_DIR}/logs/monitor-report.json"
STATUS_FILE="${SCRIPT_DIR}/monitor-status.json"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Load environment
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Configuration
CHECK_INTERVAL=${CHECK_INTERVAL:-300}  # 5 minutes
REPORT_INTERVAL=${REPORT_INTERVAL:-1800}  # 30 minutes
DISCORD_WEBHOOK=${DISCORD_WEBHOOK:-}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check sync status
check_status() {
    local checkpoint_file="${SCRIPT_DIR}/sync-checkpoint.json"
    local db_status="unknown"
    local sync_progress="unknown"
    local last_update="unknown"
    
    # Check database
    if [ -n "$PGPASSWORD" ]; then
        db_status=$(psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs || echo "error")
    fi
    
    # Check checkpoint
    if [ -f "$checkpoint_file" ]; then
        sync_progress=$(cat "$checkpoint_file" | node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(0,'utf-8')); console.log(\`\${d.processedChunkIds.length}/\${d.totalChunks} chunks (Batch \${d.currentBatch})\`);" 2>/dev/null || echo "parsing error")
        last_update=$(stat -c %Y "$checkpoint_file" 2>/dev/null || echo "0")
    fi
    
    echo "{\"dbChunks\":\"$db_status\",\"syncProgress\":\"$sync_progress\",\"lastUpdate\":$last_update}"
}

# Generate report
generate_report() {
    local status=$(check_status)
    local timestamp=$(date -Iseconds)
    
    cat > "$REPORT_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "status": $status,
  "checks": $(cat "$STATUS_FILE" 2>/dev/null | jq '.checks // 0'),
  "lastReport": "$timestamp"
}
EOF
    
    echo "$status"
}

# Send Discord notification (if configured)
send_notification() {
    local message="$1"
    
    if [ -n "$DISCORD_WEBHOOK" ]; then
        curl -s -H "Content-Type: application/json" \
            -d "{\"content\":\"$message\"}" \
            "$DISCORD_WEBHOOK" > /dev/null || true
    fi
}

# Main monitoring loop
main() {
    log "Starting docs-rag sync monitor..."
    log "Check interval: ${CHECK_INTERVAL}s, Report interval: ${REPORT_INTERVAL}s"
    
    local check_count=0
    local last_report=0
    
    # Initialize status file
    echo '{"checks":0,"startTime":'$(date +%s)'}' > "$STATUS_FILE"
    
    while true; do
        check_count=$((check_count + 1))
        
        local status=$(check_status)
        local now=$(date +%s)
        
        # Update status file
        jq ".checks = $check_count | .lastCheck = $now | .status = $status" "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
        
        log "Check #$check_count: DB chunks=$(echo $status | jq -r '.dbChunks'), Progress=$(echo $status | jq -r '.syncProgress')"
        
        # Generate periodic report
        if [ $((now - last_report)) -ge $REPORT_INTERVAL ]; then
            local report=$(generate_report)
            log "=== PROGRESS REPORT ==="
            log "Total checks: $check_count"
            log "Status: $report"
            
            # Send notification if Discord webhook configured
            send_notification "📊 Docs-RAG Sync Progress: $(echo $status | jq -r '.syncProgress') | DB: $(echo $status | jq -r '.dbChunks') chunks"
            
            last_report=$now
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Handle arguments
case "${1:-}" in
    status)
        check_status | jq .
        ;;
    report)
        generate_report | jq .
        ;;
    once)
        check_status
        ;;
    *)
        main
        ;;
esac
