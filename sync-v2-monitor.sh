#!/bin/bash
# sync-v2-monitor.sh - Monitor docs-rag v2.0 sync with progress reporting

SCRIPT_DIR="/root/.openclaw/workspace/skills/openclaw-docs-rag"
LOG_FILE="$SCRIPT_DIR/sync-v2.log"
CHECKPOINT_FILE="$SCRIPT_DIR/sync-checkpoint.json"
PID_FILE="/tmp/docs-rag-v2.pid"

echo "=== docs-rag v2.0 Sync Monitor - $(date) ==="

# Check if process is running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "✅ Sync process running (PID: $PID)"
  else
    echo "⚠️ Sync process not running"
    rm -f "$PID_FILE"
  fi
else
  echo "⚠️ No PID file found"
fi

# Get checkpoint status
if [ -f "$CHECKPOINT_FILE" ]; then
  echo ""
  echo "📂 Checkpoint status:"
  cat "$CHECKPOINT_FILE" | grep -E '"(totalChunks|processedChunkIds|currentBatch|lastUpdated)"' | sed 's/^/  /'
  
  # Calculate progress from checkpoint
  TOTAL=$(cat "$CHECKPOINT_FILE" | grep -o '"totalChunks": [0-9]*' | awk '{print $2}')
  # Count processed chunk IDs from array
  PROCESSED=$(cat "$CHECKPOINT_FILE" | grep -o '"processedChunkIds":' -A1 | grep -c '\[' || echo "0")
  if [ "$PROCESSED" = "0" ]; then
    # Alternative: count items in array
    PROCESSED=$(cat "$CHECKPOINT_FILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('processedChunkIds',[])))" 2>/dev/null || echo "0")
  fi
  
  if [ -n "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
    PERCENTAGE=$((PROCESSED * 100 / TOTAL))
    echo ""
    echo "📊 Progress: ~$PROCESSED / $TOTAL chunks ($PERCENTAGE%)"
  fi
else
  echo "📂 No checkpoint yet (fresh sync)"
fi

# Show recent log activity
echo ""
echo "📝 Recent activity:"
tail -10 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'

echo ""
echo "=== Monitor complete ==="
