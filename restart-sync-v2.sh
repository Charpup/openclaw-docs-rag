#!/bin/bash
# restart-sync-v2.sh - Restart docs-rag v2.0 sync after schema fix

SCRIPT_DIR="/root/.openclaw/workspace/skills/openclaw-docs-rag"
LOG_FILE="$SCRIPT_DIR/sync-v2-restart.log"
PID_FILE="/tmp/docs-rag-v2.pid"

export MEMU_DB_PASSWORD="memu_secure_password"
export OPENAI_API_KEY="${OPENAI_API_KEY:-$(cat $SCRIPT_DIR/.env 2>/dev/null | grep OPENAI_API_KEY | cut -d= -f2)}"

cd "$SCRIPT_DIR" || exit 1

# Kill any existing process
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$OLD_PID" ]; then
    kill "$OLD_PID" 2>/dev/null
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

echo "=== docs-rag v2.0 Sync Restart ===" | tee "$LOG_FILE"
echo "Start time: $(date)" | tee -a "$LOG_FILE"
echo "Schema fixed: unique constraint added" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run sync with fresh start (no resume since data cleared)
node -e "
const { syncDocs } = require('./index.js');

async function main() {
  const result = await syncDocs({
    batchSize: 50,
    checkpointPath: '$SCRIPT_DIR/sync-checkpoint.json',
    resume: false,
    force: true,
    onProgress: (p) => {
      console.log(\`[Progress] Batch \${p.batch}/\${p.totalBatches} | \${p.processed}/\${p.total} (\${p.percentage}%)\`);
    }
  });
  
  console.log('\n=== Result ===');
  console.log('Success:', result.success);
  console.log('Docs processed:', result.docsProcessed);
  console.log('Chunks processed:', result.chunksProcessed);
  console.log('Batches completed:', result.batchesCompleted);
  
  process.exit(result.success ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
" 2>&1 | tee -a "$LOG_FILE" &

PID=$!
echo $PID > "$PID_FILE"
echo ""
echo "Sync restarted with PID: $PID"
echo "Log file: $LOG_FILE"
echo "Checkpoint file: $SCRIPT_DIR/sync-checkpoint.json"
echo ""
echo "Status check: tail -f $LOG_FILE"
