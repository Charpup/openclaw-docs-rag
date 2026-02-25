#!/bin/bash
# sync-supervisor.sh - Advanced supervisor for docs-rag sync with aggressive restart

# DEPRECATED 2026-02-25: Replaced by segmented cron execution (*/15 * * * *).
# DO NOT re-add to crontab. The pkill commands herein kill healthy sync processes.
exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="/tmp/docs-rag-sync.pid"
LOG_FILE="${SCRIPT_DIR}/logs/supervisor.log"
CHECK_INTERVAL=60  # Check every minute
MAX_SILENT_MINUTES=5  # Restart if no progress for 5 minutes

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

get_db_count() {
    export PGPASSWORD=memu_secure_password
    psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs || echo "0"
}

get_checkpoint_batch() {
    if [ -f "$SCRIPT_DIR/sync-checkpoint.json" ]; then
        cat "$SCRIPT_DIR/sync-checkpoint.json" | node -e "const d=require('./sync-checkpoint.json'); console.log(d.currentBatch || 0);" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

is_sync_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    # Also check for sync-docs process
    if pgrep -f "sync-docs.sh" > /dev/null; then
        return 0
    fi
    return 1
}

start_sync() {
    log "🚀 Starting docs-rag sync (English-only)..."
    cd "$SCRIPT_DIR" || exit 1
    
    export PGPASSWORD=memu_secure_password
    export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-PDR54SXSVf7vgue83dA5Ac7791424bEe8c9150021b6eDdF7}"
    export DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-https://discord.com/api/webhooks/1475438133528236152/YF7k9FRswbVwlWAMfCB8-m7qayyrX7P2kZmuiVVeEjAqmnaq36-kXFRTZsAf4O-DXA7M}"
    
    # Kill any existing sync processes
    pkill -f "sync-docs.sh" 2>/dev/null || true
    pkill -f "node.*syncDocs" 2>/dev/null || true
    sleep 2
    
    # Start new sync
    nohup ./sync-docs.sh >> logs/sync-daemon.log 2>&1 < /dev/null &
    local pid=$!
    echo $pid > "$PID_FILE"
    
    log "✅ Sync started with PID: $pid"
    
    # Send Discord notification
    if [ -n "$DISCORD_WEBHOOK" ]; then
        local db_count=$(get_db_count)
        local batch=$(get_checkpoint_batch)
        curl -s -H "Content-Type: application/json" \
            -d "{\"content\":\"🚀 Docs-RAG 同步启动/重启 | Batch: $batch | DB: $db_count chunks | PID: $pid\"}" \
            "$DISCORD_WEBHOOK" > /dev/null || true
    fi
}

# Main supervisor loop
log "=== Docs-RAG Supervisor Started ==="
log "Check interval: ${CHECK_INTERVAL}s, Max silent: ${MAX_SILENT_MINUTES}min"

last_db_count=$(get_db_count)
last_progress_time=$(date +%s)
last_batch=$(get_checkpoint_batch)

while true; do
    current_db=$(get_db_count)
    current_batch=$(get_checkpoint_batch)
    now=$(date +%s)
    
    # Check if sync is running
    if ! is_sync_running; then
        log "⚠️ Sync not running detected (DB: $current_db, Batch: $current_batch)"
        start_sync
        last_db_count=$current_db
        last_progress_time=$now
        last_batch=$current_batch
    else
        # Check for progress
        if [ "$current_db" -gt "$last_db_count" ] || [ "$current_batch" -gt "$last_batch" ]; then
            log "✅ Progress: DB $last_db_count → $current_db, Batch $last_batch → $current_batch"
            last_db_count=$current_db
            last_progress_time=$now
            last_batch=$current_batch
        else
            # No progress, check if stuck
            elapsed=$(( (now - last_progress_time) / 60 ))
            if [ $elapsed -ge $MAX_SILENT_MINUTES ]; then
                log "⚠️ No progress for ${elapsed}min, restarting..."
                start_sync
                last_progress_time=$now
            else
                log "⏳ No progress (${elapsed}min/${MAX_SILENT_MINUTES}min), waiting..."
            fi
        fi
    fi
    
    sleep $CHECK_INTERVAL
done
