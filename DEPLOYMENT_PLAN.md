# MemU 基础设施修复与部署计划

## 当前状态诊断

### ✅ 已运行
- Docker 容器: `memu-postgres` (pgvector/pgvector:pg17)
- 端口映射: 5432:5432
- 数据库: `memu_db`
- 用户: `memu` / `memu_secure_password`
- 表结构: 6 张表已创建

### ❌ 缺失
- memory_items 表为空 (count = 0)
- OpenClaw 未配置使用 MemU
- 环境变量未设置
- docs-rag 未初始化

## Phase 1: 环境配置 (15 min)

### 1.1 设置全局环境变量
```bash
# 添加到 ~/.bashrc 或 ~/.profile
export MEMU_DB_PASSWORD="memu_secure_password"
export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="memu"
export PGDATABASE="memu_db"
export OPENAI_API_KEY="sk-..."  # 用于 embeddings
```

### 1.2 验证连接
```bash
psql -h localhost -U memu -d memu_db -c "SELECT 1;"
```

## Phase 2: OpenClaw MemU 集成配置 (20 min)

### 2.1 修改 OpenClaw 配置
文件: `~/.openclaw/config.json`

需要添加 MemU 作为 memory provider 选项，或配置工具使用 MemU。

### 2.2 验证记忆写入
测试写入一条记忆，验证数据库有数据。

## Phase 3: Docs-RAG Skill 部署 (30 min)

### 3.1 初始化 Docs 向量表
```bash
cd ~/.openclaw/workspace/skills/openclaw-docs-rag
export MEMU_DB_PASSWORD=memu_secure_password
npm run init-db
```

### 3.2 同步 OpenClaw 文档
```bash
export OPENAI_API_KEY=sk-...
npm run sync
```

### 3.3 验证查询
```bash
./query-docs.sh "how to configure cron"
```

## Phase 4: 测试与验证 (15 min)

### 4.1 测试 MemU 记忆功能
- 写入测试记忆
- 读取验证
- 检查数据库有数据

### 4.2 测试 Docs-RAG
- 查询文档
- 验证返回结果

## 依赖与前提

| 依赖 | 状态 | 行动 |
|------|------|------|
| PostgreSQL 客户端 | ❌ | 安装 `postgresql-client` |
| Node.js/npm | ✅ | 已安装 |
| OpenAI API Key | ⚠️ | 确认可用额度 |
| Docker | ✅ | 已运行 |

## 风险与回滚

### 风险
- MemU 容器重启可能导致数据丢失（如果未使用持久化卷）
- 但检查显示使用了 `memu_data` volume，数据应安全

### 回滚方案
1. 备份当前数据库: `docker exec memu-postgres pg_dump -U memu memu_db > backup.sql`
2. 如失败，恢复配置使用外部 API

## 总时间估算
- Phase 1: 15 min
- Phase 2: 20 min
- Phase 3: 30 min
- Phase 4: 15 min
- **总计: ~80 分钟**

## 立即执行检查

```bash
# 1. 检查数据卷
ls -la /var/lib/docker/volumes/memu_data/_data/

# 2. 检查表结构
docker exec memu-postgres psql -U memu -d memu_db -c "\dt"

# 3. 检查 OpenClaw 配置
cat ~/.openclaw/config.json | grep -A10 memorySearch
```
