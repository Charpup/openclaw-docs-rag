#!/bin/bash
# sync-batch.sh - 分批同步 OpenClaw 文档

BATCH_SIZE=50
LOG_FILE="sync_batch_$(date +%Y%m%d_%H%M%S).log"

export MEMU_DB_PASSWORD="memu_secure_password"
export OPENAI_API_KEY="sk-0nGygIa73bGnqNON03B0F8D573174b21A58fDbA89e5a16C8"

echo "=== OpenClaw Docs 分批同步 ===" | tee -a "$LOG_FILE"
echo "开始时间: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 使用 limit 参数分批同步
for i in {0..10}; do
  START=$((i * BATCH_SIZE))
  echo "[$i] 同步文档 $START - $((START + BATCH_SIZE))..." | tee -a "$LOG_FILE"
  
  node -e "
const { syncDocs } = require('./index.js');
syncDocs({ limit: $BATCH_SIZE, offset: $START })
  .then(result => {
    console.log('批次 $i 完成:', result.docsProcessed, 'docs');
    process.exit(0);
  })
  .catch(err => {
    console.error('批次 $i 失败:', err.message);
    process.exit(1);
  });
" 2>&1 | tee -a "$LOG_FILE"

  if [ $? -eq 0 ]; then
    echo "✅ 批次 $i 完成" | tee -a "$LOG_FILE"
  else
    echo "❌ 批次 $i 失败，停止同步" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  # 检查数据库状态
  COUNT=$(export PGPASSWORD="memu_secure_password" && psql -h localhost -p 5432 -U memu -d memu_db -t -c "SELECT count(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs)
  echo "📊 当前数据库记录: $COUNT" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  
  # 批次间休息，避免 API 限流
  sleep 5
done

echo "=== 同步完成 ===" | tee -a "$LOG_FILE"
echo "结束时间: $(date)" | tee -a "$LOG_FILE"
