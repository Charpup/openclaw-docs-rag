#!/bin/bash
# webhook-reporter.sh - Send progress report to Discord every 30 minutes

WEBHOOK_URL="https://discord.com/api/webhooks/1475438133528236152/YF7k9FRswbVwlWAMfCB8-m7qayyrX7P2kZmuiVVeEjAqmnaq36-kXFRTZsAf4O-DXA7M"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get current status from database and checkpoint
DB_COUNT=$(export PGPASSWORD=memu_secure_password && psql -h localhost -U memu -d memu_db -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs || echo "0")

CHECKPOINT_DATA=$(cat "$SCRIPT_DIR/sync-checkpoint.json" 2>/dev/null || echo '{}')
BATCH=$(echo "$CHECKPOINT_DATA" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.currentBatch || 0);" 2>/dev/null || echo "0")
PROCESSED=$(echo "$CHECKPOINT_DATA" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.processedChunkIds ? d.processedChunkIds.length : 0);" 2>/dev/null || echo "0")

# Read latest batch info from sync-cron.log (the active log)
LATEST_BATCH_INFO=$(tail -50 "$SCRIPT_DIR/logs/sync-cron.log" 2>/dev/null | grep -E "Batch [0-9]+ stored" | tail -1 || echo "")
if [ -n "$LATEST_BATCH_INFO" ]; then
    LATEST_BATCH=$(echo "$LATEST_BATCH_INFO" | grep -oE "Batch [0-9]+" | head -1 | awk '{print $2}')
    LATEST_DB=$(echo "$LATEST_BATCH_INFO" | grep -oE "[0-9]+ in DB" | head -1 | awk '{print $1}')
    if [ -n "$LATEST_BATCH" ] && [ "$LATEST_BATCH" -gt "$BATCH" ] 2>/dev/null; then
        BATCH="$LATEST_BATCH"
    fi
    if [ -n "$LATEST_DB" ] && [ "$LATEST_DB" -gt "$DB_COUNT" ] 2>/dev/null; then
        DB_COUNT="$LATEST_DB"
    fi
fi

# Check if sync is currently running
if flock -n /tmp/docs-rag-sync.lock echo "no" 2>/dev/null | grep -q "no"; then
    SYNC_STATUS="⏸️ 等待中"
else
    SYNC_STATUS="🔄 同步中"
fi

# Calculate progress
TOTAL_BATCHES=189
PERCENT=$(( BATCH * 100 / TOTAL_BATCHES ))

# Determine progress emoji
if [ $PERCENT -ge 100 ]; then
    PROGRESS_EMOJI="🎉 同步完成！"
elif [ $PERCENT -ge 80 ]; then
    PROGRESS_EMOJI="🔜 即将完成"
elif [ $PERCENT -ge 50 ]; then
    PROGRESS_EMOJI="⏳ 过半"
elif [ $PERCENT -ge 20 ]; then
    PROGRESS_EMOJI="🚀 进行中"
else
    PROGRESS_EMOJI="🆕 刚开始"
fi

# Send webhook
curl -s -H "Content-Type: application/json" \
  -d "{
    \"content\": \"📊 **Docs-RAG 同步进度汇报**\n\n⏰ 时间: $(date '+%Y-%m-%d %H:%M:%S')\n💾 DB Chunks: $DB_COUNT\n📦 Checkpoint Batch: $BATCH / $TOTAL_BATCHES\n📊 进度: $PERCENT%\n✅ 已处理: $PROCESSED chunks\n🔄 状态: $SYNC_STATUS\n\n$PROGRESS_EMOJI\"
  }" \
  "$WEBHOOK_URL" > /dev/null 2>&1

echo "[$(date '+%H:%M:%S')] Report sent: DB=$DB_COUNT, Batch=$BATCH/$TOTAL_BATCHES ($PERCENT%)"
