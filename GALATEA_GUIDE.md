# Docs-RAG Skill — Galatea 使用指南 v3.1.0

## 概述

`openclaw-docs-rag` 是 OpenClaw 文档的本地语义检索系统。它将 OpenClaw 文档拆分为 chunks、生成 embedding、存入 PostgreSQL (pgvector)，让你能用自然语言查询文档内容。同步由 cron 驱动（每 15 分钟一轮，每轮 10 个 batch），不需要手动长跑进程。

---

## 核心 API 速查

```javascript
const { queryDocs, syncDocs, getDocsContext } = require('./index.js');

// 语义查询（最常用）
const result = await queryDocs("what is an agent", { topK: 5 });

// 获取 LLM 上下文
const { context, sources } = await getDocsContext("subagents");

// 触发一轮同步（10 batches，然后退出）
const result = await syncDocs({ maxBatches: 10 });
```

```bash
# CLI 等价命令
docs-rag query "what is an agent"
docs-rag sync --max-batches 10
docs-rag sync --force --max-batches 20
```

---

## DO：正确用法

**查询前获取上下文**
```javascript
// 在执行任务前，先调用 getDocsContext 获取相关文档
const { context } = await getDocsContext("cron job configuration");
// 将 context 注入到你的 prompt 中
```

**检查同步进度**
```bash
# 查看当前已处理到第几个 batch
cat sync-checkpoint.json | jq '{batch: .currentBatch, processed: (.processedChunkIds | length)}'

# 查看 DB 中实际存储的 chunk 数量
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"
```

**手动触发单轮同步**（不影响 cron）
```bash
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh
```

**DB < 500 chunks 时等待 cron 补充**
- 每 15 分钟自动运行一轮（10 batches = ~500 chunks）
- 不要急于手动干预，先等 1-2 轮

**健康检查**
```bash
./verify-sync.sh
```

**使用 pgvector 语义检索**
```javascript
// topK 控制返回结果数量（默认 5）
const result = await queryDocs("webhook configuration", { topK: 10 });
result.results.forEach(r => console.log(r.source, r.score));
```

**强制重置后必须先 --force**
```bash
rm sync-checkpoint.json
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh --force
```

---

## DON'T：禁止操作

**DON'T 直接编辑 `.env`**
- 通过 `openclaw config set` 或重建 `.env`；直接编辑可能破坏转义格式

**DON'T 运行无 maxBatches 限制的 sync**
```bash
# 危险：可能被 OS 或 cron 杀死，留下不完整状态
./sync-docs.sh --force   # ❌

# 正确做法：始终带 MAX_BATCHES
MAX_BATCHES=999 ./sync-docs.sh --force   # ✅（明确知道风险时才用）
```

**DON'T 手动 pkill sync 进程**
- 会破坏 checkpoint 一致性；如必须停止，等当前 batch 完成后 Ctrl+C

**DON'T 绕过 flock 同时启动多个 sync**
```bash
# flock 已阻止并发，不要这样做：
./sync-docs.sh &
./sync-docs.sh &   # ❌ 两个进程同时写 DB 和 checkpoint 会导致数据损坏
```

**DON'T 删除 sync-checkpoint.json（除非有意重置）**
- 删除后下次 sync 会从头开始，已处理的 chunks 会被重复写入
- 如需重置：`rm sync-checkpoint.json && ./sync-docs.sh --force`

**DON'T 在 sync 进行中调用 store.clear()**
- 会清空 DB 中已存储的 chunks，导致 checkpoint 与 DB 不一致

**DON'T 重新启用 sync-supervisor.sh**
- 该脚本已废弃（v3.1.0 deprecated）
- 它每分钟发送 SIGTERM，会杀死健康的 sync 进程

**DON'T 在 DB < 500 chunks 时依赖精确查询结果**
- 文档覆盖率不足时，语义检索结果不完整
- 先确认 chunk 数量再使用：`SELECT COUNT(*) FROM openclaw_docs_chunks;`

---

## 状态检查

```bash
# 1. DB chunk 总数
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"

# 2. Checkpoint 状态
cat sync-checkpoint.json | jq '{batch: .currentBatch, processed: (.processedChunkIds | length), failed: (.failedChunkIds | length)}'

# 3. 是否有 sync 进程在跑
flock -n /tmp/docs-rag-sync.lock echo "no sync running" 2>/dev/null || echo "sync in progress"

# 4. Cron 安装情况
crontab -l | grep docs-rag

# 5. 全面健康检查
./verify-sync.sh
```

**健康状态参考：**
| 指标 | 正常范围 |
|------|---------|
| DB chunks | ≥ 3000（完整约 3500） |
| Checkpoint batch | 递增，不超过总 batch 数 |
| flock | 每 15 min 短暂锁定，随后释放 |

---

## 常见场景示例

### 场景 1：任务执行前查询文档

```javascript
// 在 agent 任务开始前获取相关上下文
const { context, sources } = await getDocsContext("how to use openclaw plugins");
// 将 context 注入到系统提示或用户消息中
```

### 场景 2：检查同步是否完成

```bash
# 查看已处理 batch 数 vs 估算总 batch 数
cat sync-checkpoint.json | jq .currentBatch
# 约 70 个 batch = 3500 chunks = 完整同步
```

### 场景 3：手动补一轮同步（不等 cron）

```bash
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh
# 退出后查看进度
cat sync-checkpoint.json | jq .currentBatch
```

### 场景 4：完全重置并重新同步

```bash
# 1. 删除 checkpoint（触发 --force 模式）
rm sync-checkpoint.json

# 2. 清空 DB（可选，--force 会通过 store.clear() 处理）
# psql -c "TRUNCATE openclaw_docs_chunks;"

# 3. 触发强制重新同步
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh --force

# 4. 等待 cron 继续剩余 batches，或多次手动运行
```

### 场景 5：查询结果为空

```bash
# 检查 DB 是否有数据
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"

# 如果 < 500：等待 cron 或手动同步
# 如果 >= 500：检查查询词是否过于具体，调整 topK
docs-rag query "your question" --top-k 10
```

---

## 架构快速理解

```
cron (*/15 min)
    └─▶ flock /tmp/docs-rag-sync.lock
            └─▶ sync-docs.sh (MAX_BATCHES=10)
                    └─▶ syncDocs({ maxBatches: 10 })
                            ├─▶ fetch docs (网络)
                            ├─▶ chunk documents
                            ├─▶ for batch in batches[0..9]:
                            │       ├─▶ generate embeddings (OpenAI API)
                            │       ├─▶ store batch → PostgreSQL (立即写入)
                            │       └─▶ save checkpoint (atomic)
                            └─▶ exit cleanly → 下一轮 cron 继续

查询路径：
queryDocs("...") → embedQuery → pgvector cosine search → top-K chunks
```

**关键设计原则**：每个 batch 处理后立即写入 DB + checkpoint，不缓存，不等全部完成。这是防止数据丢失的核心保证。

---

## 关键文件路径

| 文件 | 路径 |
|------|------|
| Skill 根目录 | `/root/.openclaw/workspace/skills/openclaw-docs-rag/` |
| 主入口 | `index.js` |
| CLI | `bin/docs-rag.js` |
| 规范 | `SKILL.md`, `SPEC.yaml` |
| Cron 策略 | `crontab.txt` |
| 本指南 | `GALATEA_GUIDE.md` |
| GitHub | `https://github.com/Charpup/openclaw-docs-rag` |
