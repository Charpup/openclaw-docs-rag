#!/bin/bash
# sync-v2-run.sh - Run docs-rag v2.0 batch sync with checkpoint support

SCRIPT_DIR="/root/.openclaw/workspace/skills/openclaw-docs-rag"
LOG_FILE="$SCRIPT_DIR/sync-v2.log"
CHECKPOINT_FILE="$SCRIPT_DIR/sync-checkpoint.json"
PID_FILE="/tmp/docs-rag-v2.pid"

export MEMU_DB_PASSWORD="memu_secure_password"
export OPENAI_API_KEY="${OPENAI_API_KEY:-$(cat $SCRIPT_DIR/.env 2>/dev/null | grep OPENAI_API_KEY | cut -d= -f2)}"

cd "$SCRIPT_DIR" || exit 1

# Check if already running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    echo "Sync already running (PID: $OLD_PID)"
    exit 0
  fi
fi

echo "=== OpenClaw Docs RAG v2.0 - Batch Sync ===" | tee "$LOG_FILE"
echo "Start time: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run sync
node -e "
const { syncDocs } = require('./index.js');

async function main() {
  const result = await syncDocs({
    batchSize: 50,
    checkpointPath: '$CHECKPOINT_FILE',
    resume: true,
    force: false,
    onProgress: (p) => {
      console.log(\`[Progress] Batch \${p.batch}/\${p.totalBatches} | \${p.processed}/\${p.total} (\${p.percentage}%)\`);
    }
  });
  
  console.log('\\n=== Result ===');
  console.log('Success:', result.success);
  console.log('Docs processed:', result.docsProcessed);
  console.log('Chunks processed:', result.chunksProcessed);
  console.log('Batches completed:', result.batchesCompleted);
  console.log('Resumed:', result.resumed);
  
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
" 2>&1 | tee -a "$LOG_FILE" &

PID=$!
echo $PID > "$PID_FILE"
echo "Sync started with PID: $PID"
echo "Log file: $LOG_FILE"
echo "Checkpoint file: $CHECKPOINT_FILE"
