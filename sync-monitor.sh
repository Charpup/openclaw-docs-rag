#!/bin/bash
# docs-rag-sync-monitor.sh - 监控并自动重启 docs-rag 同步进程

LOG_FILE="/root/.openclaw/workspace/skills/openclaw-docs-rag/sync.log"
PID_FILE="/tmp/docs-rag-sync.pid"
FAIL_COUNT_FILE="/tmp/docs-rag-sync-fail-count"
MAX_RETRIES=10

# 检查进程是否在运行
check_process() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0  # 进程在运行
        fi
    fi
    return 1  # 进程未运行
}

# 检查数据库是否有数据
check_database() {
    COUNT=$(psql -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | head -3 | tail -1 | tr -d ' ')
    echo "$COUNT"
}

# 获取日志最后几行
get_log_tail() {
    if [ -f "$LOG_FILE" ]; then
        tail -5 "$LOG_FILE"
    else
        echo "Log file not found"
    fi
}

# 重启同步进程
restart_sync() {
    cd /root/.openclaw/workspace/skills/openclaw-docs-rag || exit 1
    export $(cat .env | grep -v '^#' | xargs)
    
    # 清理旧日志
    mv "$LOG_FILE" "$LOG_FILE.bak.$(date +%s)" 2>/dev/null
    
    nohup node -e "
const { syncDocs } = require('./index.js');
syncDocs({ force: true })
  .then(result => {
    console.log('✅ Sync complete:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
" > "$LOG_FILE" 2>&1 &
    
    echo $! > "$PID_FILE"
    echo "$(date): Sync restarted with PID: $!"
}

# 主逻辑
main() {
    echo "=== docs-rag Sync Monitor - $(date) ==="
    
    # 检查数据库状态
    DB_COUNT=$(check_database)
    echo "Database count: $DB_COUNT"
    
    # 如果数据库已有数据，同步已完成
    if [ "$DB_COUNT" -gt 0 ] 2>/dev/null; then
        echo "✅ Sync appears complete ($DB_COUNT chunks in database)"
        rm -f "$FAIL_COUNT_FILE"
        exit 0
    fi
    
    # 检查进程状态
    if check_process; then
        echo "✅ Sync process is running (PID: $(cat $PID_FILE))"
        echo "Recent log:"
        get_log_tail
        rm -f "$FAIL_COUNT_FILE"
    else
        echo "⚠️ Sync process not running"
        
        # 读取失败次数
        FAIL_COUNT=0
        if [ -f "$FAIL_COUNT_FILE" ]; then
            FAIL_COUNT=$(cat "$FAIL_COUNT_FILE")
        fi
        
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "$FAIL_COUNT" > "$FAIL_COUNT_FILE"
        
        echo "Failure count: $FAIL_COUNT / $MAX_RETRIES"
        
        if [ "$FAIL_COUNT" -ge "$MAX_RETRIES" ]; then
            echo "❌ Max retries reached! Notifying user..."
            # 这里会输出到 stderr，可以被 cron 捕获
            echo "docs-rag sync failed $MAX_RETRIES times. Manual intervention required." >&2
            exit 1
        fi
        
        echo "🔄 Restarting sync process..."
        restart_sync
    fi
}

main
