#!/bin/bash
# docs-rag 和 session 索引综合监控脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
REPORT_FILE="/tmp/docs-rag-monitor-report.txt"

echo "=== 综合索引监控报告 - $TIMESTAMP ===" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 1. docs-rag 同步状态
echo "📚 docs-rag 文档同步状态" >> "$REPORT_FILE"
echo "------------------------" >> "$REPORT_FILE"

DB_COUNT=$(PGPASSWORD=memu_secure_password psql -U memu -d memu_db -h localhost -t -c "SELECT COUNT(*) FROM openclaw_docs_chunks;" 2>/dev/null | xargs)
if [ -z "$DB_COUNT" ]; then
    DB_COUNT="0"
fi

SYNC_PID=$(pgrep -f "sync-v2" | head -1)
if [ -n "$SYNC_PID" ]; then
    SYNC_STATUS="运行中 (PID: $SYNC_PID)"
else
    SYNC_STATUS="未运行"
fi

echo "  数据库文档数: $DB_COUNT" >> "$REPORT_FILE"
echo "  同步进程状态: $SYNC_STATUS" >> "$REPORT_FILE"

# 检查 sync log 获取进度
if [ -f "$SCRIPT_DIR/sync.log" ]; then
    LAST_LOG=$(tail -20 "$SCRIPT_DIR/sync.log" 2>/dev/null | grep -E "(Processing|embedding|batch)" | tail -1)
    if [ -n "$LAST_LOG" ]; then
        echo "  最近活动: $LAST_LOG" >> "$REPORT_FILE"
    fi
fi

echo "" >> "$REPORT_FILE"

# 2. Session 文件索引进度
echo "💾 Session 索引状态" >> "$REPORT_FILE"
echo "-------------------" >> "$REPORT_FILE"

SESSION_FILES=$(ls ~/.openclaw/agents/main/sessions/*.jsonl 2>/dev/null | wc -l)
MAIN_CHUNKS=$(sqlite3 ~/.openclaw/memory/main.sqlite "SELECT COUNT(*) FROM chunks;" 2>/dev/null | xargs)
MAIN_FILES=$(sqlite3 ~/.openclaw/memory/main.sqlite "SELECT COUNT(*) FROM files;" 2>/dev/null | xargs)

echo "  Session 文件数: $SESSION_FILES" >> "$REPORT_FILE"
echo "  已索引文件数: $MAIN_FILES" >> "$REPORT_FILE"
echo "  总 chunks 数: $MAIN_CHUNKS" >> "$REPORT_FILE"

# 计算索引覆盖率
if [ "$SESSION_FILES" -gt 0 ]; then
    COVERAGE=$(awk "BEGIN {printf \"%.1f\", ($MAIN_FILES/$SESSION_FILES)*100}")
    echo "  索引覆盖率: ${COVERAGE}%" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"

# 3. 检查是否有未索引的 session
UNINDEXED=$(ls ~/.openclaw/agents/main/sessions/*.jsonl 2>/dev/null | while read f; do
    basename "$f" .jsonl
done | sqlite3 ~/.openclaw/memory/main.sqlite "SELECT name FROM files;" 2>/dev/null | sort | comm -23 <(ls ~/.openclaw/agents/main/sessions/*.jsonl 2>/dev/null | xargs -n1 basename | sed 's/.jsonl//' | sort) - | wc -l)

echo "  待索引 session: $UNINDEXED" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "📊 总结:" >> "$REPORT_FILE"

if [ "$DB_COUNT" -eq 0 ]; then
    echo "  • docs-rag: 同步未完成 ($SYNC_STATUS)" >> "$REPORT_FILE"
else
    echo "  • docs-rag: ✅ 同步完成 ($DB_COUNT 文档)" >> "$REPORT_FILE"
fi

if [ "$UNINDEXED" -gt 0 ]; then
    echo "  • session 索引: 有 $UNINDEXED 个待索引文件" >> "$REPORT_FILE"
else
    echo "  • session 索引: ✅ 已完全同步" >> "$REPORT_FILE"
fi

cat "$REPORT_FILE"
