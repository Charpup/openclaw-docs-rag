#!/bin/bash
# sync-batch-v2.sh - Batch sync with checkpoint/resume support (v2.0)

LOG_FILE="/root/.openclaw/workspace/skills/openclaw-docs-rag/sync-v2.log"
CHECKPOINT_FILE="/root/.openclaw/workspace/skills/openclaw-docs-rag/sync-checkpoint.json"
BATCH_SIZE=50

export MEMU_DB_PASSWORD="memu_secure_password"
export OPENAI_API_KEY="${OPENAI_API_KEY:-$(cat /root/.openclaw/workspace/skills/openclaw-docs-rag/.env 2>/dev/null | grep OPENAI_API_KEY | cut -d= -f2)}"

echo "=== OpenClaw Docs RAG v2.0 - Batch Sync with Checkpoint ===" | tee -a "$LOG_FILE"
echo "Start time: $(date)" | tee -a "$LOG_FILE"
echo "Batch size: $BATCH_SIZE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

cd /root/.openclaw/workspace/skills/openclaw-docs-rag || exit 1

# Check if there's a valid checkpoint
echo "Checking for existing checkpoint..." | tee -a "$LOG_FILE"
if [ -f "$CHECKPOINT_FILE" ]; then
    LAST_UPDATE=$(cat "$CHECKPOINT_FILE" | grep -o '"lastUpdated": "[^"]*"' | cut -d'"' -f4)
    if [ -n "$LAST_UPDATE" ]; then
        echo "Found checkpoint from: $LAST_UPDATE" | tee -a "$LOG_FILE"
        echo "Will resume from checkpoint (resume: true)" | tee -a "$LOG_FILE"
    fi
else
    echo "No checkpoint found. Starting fresh sync." | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Run batch sync with Node.js
node -e "
const { BatchSync } = require('./src/batch-sync');

async function main() {
  const sync = new BatchSync({
    batchSize: $BATCH_SIZE,
    checkpointPath: '$CHECKPOINT_FILE',
    apiKey: process.env.OPENAI_API_KEY
  });
  
  console.log('Starting batch sync...');
  const startTime = Date.now();
  
  try {
    const result = await sync.sync({ 
      resume: true,  // Resume from checkpoint if available
      force: false   // Set to true for full re-sync
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\\n=== Sync Complete ===');
    console.log('Success:', result.success);
    console.log('Chunks processed:', result.chunksProcessed);
    console.log('Batches completed:', result.batchesCompleted);
    console.log('Errors:', result.errors.length);
    console.log('Duration:', duration, 'seconds');
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  }
}

main();
" 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=$?

echo "" | tee -a "$LOG_FILE"
echo "=== End of Sync ===" | tee -a "$LOG_FILE"
echo "End time: $(date)" | tee -a "$LOG_FILE"
echo "Exit code: $EXIT_CODE" | tee -a "$LOG_FILE"

exit $EXIT_CODE
