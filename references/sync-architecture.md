# Sync Architecture & Recovery Guide

## 关键设计决策

### 1. Batch 级立即写入 (Critical)

**问题历史**: 
- v1/v2: 所有 embeddings 生成后最后一次性写入数据库
- 结果: 进程中断导致全部数据丢失

**当前设计 (v3)**:
```
Batch N → 生成 embeddings → 立即写入 DB → 保存 checkpoint ✅
```

**保证**: 每个 batch 完成后数据立即持久化，进程崩溃最多丢失当前 batch。

### 2. Checkpoint 机制

**文件**: `sync-checkpoint.json`

**内容**:
```json
{
  "totalChunks": 7493,
  "processedChunkIds": ["hash1", "hash2", ...],
  "failedChunkIds": [],
  "currentBatch": 9,
  "lastUpdated": "2026-02-23T05:22:01.484Z"
}
```

**恢复命令**:
```bash
./sync-docs.sh              # 自动恢复
# 或
npm run sync               # 同上
```

**强制重新开始**:
```bash
./sync-docs.sh --force     # 清除 checkpoint，重新同步
```

### 3. 写入验证

每个 batch 写入后会验证数据库计数，确保数据真正落盘。

## 故障排查

### 症状: 进程终止但 checkpoint 显示已完成 batches

**检查**:
```bash
# 1. 检查数据库实际存储数量
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"

# 2. 对比 checkpoint
node -e "console.log(require('./sync-checkpoint.json').processedChunkIds.length)"

# 3. 如果差距很大，说明写入失败
```

**解决**:
```bash
# 重置并重新同步
rm sync-checkpoint.json
./sync-docs.sh --force
```

### 症状: 同步太慢

**调整 batch size**:
```javascript
// index.js 或环境变量
batchSize: 25  // 默认 50，网络不稳定时减小
```

### 症状: API 错误

**检查 API key**:
```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  $OPENAI_BASE_URL/models
```

## 监控

### 实时查看进度

```bash
# 方法 1: 查看 checkpoint
watch -n 10 'cat sync-checkpoint.json | jq .currentBatch'

# 方法 2: 查看数据库计数
watch -n 10 'psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"'

# 方法 3: 使用监测脚本
./sync-monitor.sh once
```

### 定时报告 (已配置 cron)

```
每15分钟: sync-monitor.sh once
每天8:30:  version-check.sh
每周日1:00: 完整同步
每日1:30:   增量同步
```

## 历史问题记录

| 日期 | 问题 | 原因 | 解决 |
|------|------|------|------|
| 2026-02-14 | 同步失败 | DB 约束错误 | 添加 UNIQUE(source, checksum) |
| 2026-02-23 | Embeddings 丢失 | 最后一次性写入 | 改为 batch 级立即写入 |

## 最佳实践

1. **首次同步**: 使用 `./sync-docs.sh --force`，预计 3-4 小时
2. **中断恢复**: 直接重新运行 `./sync-docs.sh`，会自动从 checkpoint 恢复
3. **定期验证**: 每周运行 `./sync-monitor.sh report` 检查健康状态
4. **API Key**: 存储在 `.env`，受 `.gitignore` 保护
