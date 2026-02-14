#!/bin/bash
# run-sync-supervised.sh - 前台监督执行同步
# 用法: ./run-sync-supervised.sh [每批数量] [总批次数]

BATCH_SIZE=${1:-50}
TOTAL_BATCHES=${2:-11}  # 525 / 50 ≈ 11
LOG_FILE="sync_supervised_$(date +%Y%m%d_%H%M%S).log"

cd "$(dirname "$0")"

export MEMU_DB_PASSWORD="memu_secure_password"
export OPENAI_API_KEY="sk-0nGygIa73bGnqNON03B0F8D573174b21A58fDbA89e5a16C8"

echo "=== OpenClaw Docs 监督同步 ===" | tee "$LOG_FILE"
echo "开始时间: $(date)" | tee -a "$LOG_FILE"
echo "批次大小: $BATCH_SIZE" | tee -a "$LOG_FILE"
echo "总批次数: $TOTAL_BATCHES" | tee -a "$LOG_FILE"
echo "日志文件: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 启动 heartbeat 监控（后台）
./heartbeat-check.sh "$LOG_FILE" 30 &
HEARTBEAT_PID=$!
echo "Heartbeat PID: $HEARTBEAT_PID"

# 捕获中断信号，清理后台进程
cleanup() {
  echo ""
  echo "接收到中断信号，清理中..."
  kill $HEARTBEAT_PID 2>/dev/null
  exit 1
}
trap cleanup INT TERM

# 逐批同步
for i in $(seq 0 $((TOTAL_BATCHES - 1))); do
  OFFSET=$((i * BATCH_SIZE))
  echo "" | tee -a "$LOG_FILE"
  echo "========================================" | tee -a "$LOG_FILE"
  echo "批次 $i/$TOTAL_BATCHES: offset=$OFFSET, limit=$BATCH_SIZE" | tee -a "$LOG_FILE"
  echo "========================================" | tee -a "$LOG_FILE"
  
  # 前台执行同步（非后台）
  node sync-incremental.js $BATCH_SIZE $OFFSET 2>&1 | tee -a "$LOG_FILE"
  
  if [ $? -ne 0 ]; then
    echo "❌ 批次 $i 失败！" | tee -a "$LOG_FILE"
    kill $HEARTBEAT_PID 2>/dev/null
    exit 1
  fi
  
  # 显示当前数据库状态
  COUNT=$(export PGPASSWORD="$MEMU_DB_PASSWORD" && psql -h localhost -p 5432 -U memu -d memu_db -t -c "SELECT count(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs)
  echo "📊 数据库当前记录: $COUNT" | tee -a "$LOG_FILE"
  
  # 批次间短暂休息
  if [ $i -lt $((TOTAL_BATCHES - 1)) ]; then
    echo "休息 3 秒..." | tee -a "$LOG_FILE"
    sleep 3
  fi
done

# 停止 heartbeat
kill $HEARTBEAT_PID 2>/dev/null

echo "" | tee -a "$LOG_FILE"
echo "=== 同步完成 ===" | tee -a "$LOG_FILE"
echo "结束时间: $(date)" | tee -a "$LOG_FILE"

# 最终统计
export PGPASSWORD="$MEMU_DB_PASSWORD"
psql -h localhost -p 5432 -U memu -d memu_db -c "SELECT count(*) as total_docs, count(DISTINCT source) as total_sources FROM openclaw_docs_chunks;" | tee -a "$LOG_FILE"
