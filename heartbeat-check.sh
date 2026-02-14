#!/bin/bash
# heartbeat-check.sh - 监控 docs-rag 同步进程

LOG_FILE="${1:-sync.log}"
INTERVAL=${2:-60}  # 默认每 60 秒检查一次

echo "=== Heartbeat 监控启动 ==="
echo "监控日志: $LOG_FILE"
echo "检查间隔: ${INTERVAL}秒"
echo ""

while true; do
  # 检查日志文件是否有更新
  if [ -f "$LOG_FILE" ]; then
    LAST_MODIFIED=$(stat -c %Y "$LOG_FILE" 2>/dev/null || stat -f %m "$LOG_FILE" 2>/dev/null)
    CURRENT_TIME=$(date +%s)
    TIME_DIFF=$((CURRENT_TIME - LAST_MODIFIED))
    
    # 检查数据库状态
    COUNT=$(export PGPASSWORD="memu_secure_password" && psql -h localhost -p 5432 -U memu -d memu_db -t -c "SELECT count(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs)
    
    echo "[$(date '+%H:%M:%S')] 数据库记录: $COUNT | 日志更新: ${TIME_DIFF}秒前"
    
    # 如果日志超过 5 分钟没有更新，报警
    if [ $TIME_DIFF -gt 300 ]; then
      echo "⚠️ 警告: 日志超过 5 分钟未更新，可能卡住！"
    fi
    
    # 显示最近进度
    tail -5 "$LOG_FILE" 2>/dev/null | grep -E "(Fetching|Generated|Stored)" | tail -3
  else
    echo "[$(date '+%H:%M:%S')] 等待日志文件..."
  fi
  
  echo "---"
  sleep $INTERVAL
done
