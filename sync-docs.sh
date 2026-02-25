#!/bin/bash
# sync-docs.sh - Sync OpenClaw documentation to vector store

set -e

# Load environment variables from .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "=== OpenClaw Docs Sync ==="

# Check environment
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY not set"
    exit 1
fi

# Parse arguments
FORCE=false
MAX_BATCHES="${MAX_BATCHES:-10}"   # Default: 10 batches per run
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        --max-batches)
            MAX_BATCHES="$2"
            shift 2
            ;;
        --max-batches=*)
            MAX_BATCHES="${1#*=}"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Send webhook notification
send_webhook() {
    local message="$1"
    if [ -n "$DISCORD_WEBHOOK" ]; then
        curl -s -H "Content-Type: application/json" \
            -d "{\"content\":\"$message\"}" \
            "$DISCORD_WEBHOOK" > /dev/null || true
    fi
}

# Run sync
send_webhook "🚀 Docs-RAG 同步启动 | Batch size: 25 | Max batches: ${MAX_BATCHES}"

node -e "
const { syncDocs } = require('./index.js');
const maxBatches = parseInt('${MAX_BATCHES}') || null;
syncDocs({ force: $FORCE, batchSize: 25, maxBatches: maxBatches })
  .then(result => {
    if (result.status === 'partial') {
      console.log('[partial] Batches completed: ' + result.batchesCompleted + ', remaining: ' + result.batchesRemaining);
      console.log('[partial] DB chunks: ' + result.chunksStored);
      process.exit(0);
    } else if (result.success) {
      console.log('[complete] Full sync done! DB chunks: ' + result.chunksStored);
      process.exit(0);
    } else {
      console.log('[failed] ' + JSON.stringify(result));
      process.exit(1);
    }
  })
  .catch(err => { console.error('[error]', err); process.exit(1); });
"

EXIT_CODE=$?

# Send completion notification
if [ $EXIT_CODE -eq 0 ]; then
    send_webhook "✅ Docs-RAG 批次完成 (max=${MAX_BATCHES}) | cron 将继续"
else
    send_webhook "❌ Docs-RAG 失败 (code: $EXIT_CODE) | 请检查日志"
fi

exit $EXIT_CODE
