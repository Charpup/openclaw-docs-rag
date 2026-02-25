#!/bin/bash
# sync-daemon.sh - Auto-restart sync if it fails

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="/tmp/docs-rag-sync.pid"
LOG_FILE="${SCRIPT_DIR}/logs/daemon.log"
MAX_RETRIES=3
RETRY_COUNT=0

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

is_sync_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

start_sync() {
    log "Starting docs-rag sync..."
    cd "$SCRIPT_DIR" || exit 1
    
    export PGPASSWORD=memu_secure_password
    export OPENAI_API_KEY="sk-PDR54SXSVf7vgue83dA5Ac7791424bEe8c9150021b6eDdF7"
    
    # Start sync in background
    ./sync-docs.sh >> logs/sync-daemon.log 2>&1 &
    local pid=$!
    echo $pid > "$PID_FILE"
    log "Sync started with PID: $pid"
    
    # Wait for completion
    wait $pid
    local exit_code=$?
    
    rm -f "$PID_FILE"
    return $exit_code
}

# Main loop
log "=== Docs-RAG Sync Daemon Started ==="

while true; do
    if ! is_sync_running; then
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            RETRY_COUNT=$((RETRY_COUNT + 1))
            log "Sync not running. Starting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
            
            if start_sync; then
                log "Sync completed successfully"
                RETRY_COUNT=0
            else
                log "Sync failed with exit code $?"
            fi
        else
            log "Max retries reached. Waiting 1 hour before trying again..."
            sleep 3600
            RETRY_COUNT=0
        fi
    else
        log "Sync is already running (PID: $(cat $PID_FILE))"
    fi
    
    # Check every 5 minutes
    sleep 300
done
