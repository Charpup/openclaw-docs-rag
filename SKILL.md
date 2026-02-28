---
name: openclaw-docs-rag
description: Query OpenClaw official documentation using natural language and vector search. Use before executing tasks, learning OpenClaw features, troubleshooting errors, or finding configuration options. Triggers on "openclaw docs", "documentation query", "search docs", "how to configure", "rag query".
version: 3.1.1
---

# OpenClaw Docs RAG

Query OpenClaw documentation using natural language and vector search.

## ⚠️ Important: Sync Architecture

**Critical Design**: This skill uses **batch-level immediate persistence** to prevent data loss.

```
Batch N → Generate embeddings → IMMEDIATELY write to DB → Save checkpoint ✅
```

**Never modify** the sync logic to buffer all embeddings in memory before writing - this has caused data loss in previous versions.

See: [Sync Architecture Guide](./references/sync-architecture.md)

## When to Use

- **Before executing tasks**: Query relevant documentation for context
- **Learning OpenClaw**: Find specific feature explanations
- **Troubleshooting**: Search for error solutions and best practices

## Quick Start

```bash
# 1. Install
git clone https://github.com/Charpup/openclaw-docs-rag.git ~/.openclaw/skills/openclaw-docs-rag
cd ~/.openclaw/workspace/skills/openclaw-docs-rag
npm install

# 2. Configure
cp .env.example .env
# Edit .env with OPENAI_API_KEY

# 3. Verify setup
./verify-sync.sh

# 4. Initialize database
npm run init-db

# 5. Install cron jobs (segmented sync — runs automatically every 15 min)
crontab crontab.txt
# Full sync completes in ~2 hours across multiple 15-min cron runs (10 batches each)

# 6. Query
./query-docs.sh "how to configure cron jobs"
# or via CLI:
docs-rag query "how to configure cron jobs"
```

## Core Usage

### Query Documentation

```bash
./query-docs.sh "your question here"
```

**Options:**
- `top_k`: Number of results (default: 5)

### Sync Documentation

```bash
# Run one segmented round (10 batches, then exit cleanly)
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh

# Force fresh sync (one segmented round)
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh --force

# Run unlimited batches in one shot (use with caution — may be killed by OS)
MAX_BATCHES=999 ./sync-docs.sh

# Via CLI
docs-rag sync --max-batches 10
docs-rag sync --force --max-batches 20
```

**Sync Behavior:**
- Automatically resumes from checkpoint if interrupted
- Each batch (50 chunks) is immediately written to database
- Progress saved after every batch
- Safe to interrupt and resume
- `--max-batches N` / `MAX_BATCHES=N`: exit cleanly after N batches, checkpoint preserved for next run
- `flock` prevents concurrent sync processes

### Verify Sync Health

```bash
./verify-sync.sh
```

Checks:
- API key configuration
- Database connectivity
- Checkpoint consistency
- Process status
- Cron jobs

### Programmatic API

```javascript
const { queryDocs, syncDocs, getDocsContext } = require('./index.js');

// Query
const results = await queryDocs("cron jobs configuration", { topK: 5 });

// Sync (auto-resumes from checkpoint)
await syncDocs({ force: true });

// Get LLM context
const { context, sources } = await getDocsContext("subagents");
```

## Monitoring

### Real-time Progress

```bash
# Watch checkpoint
watch -n 10 'cat sync-checkpoint.json | jq .currentBatch'

# Watch database
watch -n 10 'psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"'
```

### Automated Monitoring (Cron)

```bash
# Check installed cron jobs
crontab -l | grep docs-rag

# Manual run
./sync-monitor.sh once
./version-check.sh
```

**Default Schedule** (see `crontab.txt`):
- `*/15 * * * *`: Segmented sync — 10 batches per run, with flock (full sync completes in ~2 hours)
- `*/30 * * * *`: Monitor check
- `0 1 * * 0`: Weekly Sunday 1:00 AM force resync (clears checkpoint, starts fresh)

## Troubleshooting

### Sync interrupted / Data loss symptoms

**Check**: `./verify-sync.sh`

**If checkpoint shows more processed than stored in DB:**
```bash
# Reset and restart
rm sync-checkpoint.json
./sync-docs.sh --force
```

### Database connection failed

```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Or with podman
podman ps | grep postgres
```

### API errors

```bash
# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  $OPENAI_BASE_URL/models
```

## Architecture

### Key Components

| File | Purpose |
|------|---------|
| `src/fetcher.js` | Fetch docs with markdown support (English-only, Accept: text/markdown) |
| `src/chunker.js` | Split docs into chunks |
| `src/embedder.js` | Generate embeddings via API |
| `src/store.js` | PostgreSQL vector storage |
| `src/checkpoint-manager.js` | Resume capability |
| `src/version-detector.js` | OpenClaw version tracking |
| `src/version-store.js` | Version history storage |

### Fetching Strategy

**Language Filter**: Only English documentation is fetched
- Filters out: `zh-CN`, `ja-JP`, `ko-KR`, `es-ES`, `fr-FR`, `de-DE`
- Result: ~285 English pages from docs.openclaw.ai

**Request Headers**: Explicitly requests markdown format
```javascript
Accept: text/markdown, text/html;q=0.8, */*;q=0.5
User-Agent: OpenClaw-Docs-RAG/3.0.0
```

**Chunking**: Documents are split into semantic chunks (~1000 tokens each)
- Average: ~15 chunks per document
- Total: ~4,000-4,500 chunks for full documentation

### Data Flow

```
Docs Site → Fetch → Chunk → Embed → Store (per batch) → Checkpoint
                ↑___________________________________________|
                              (resume on interrupt)
```

## References

- [Configuration](./references/configuration.md) - Environment variables, database setup
- [API Reference](./references/api-reference.md) - Complete API documentation
- [Sync Architecture](./references/sync-architecture.md) - Critical design decisions
- [Troubleshooting](./references/troubleshooting.md) - Common issues and solutions

## History

| Version | Date | Changes |
|---------|------|---------|
| v3.1.1 | 2026-02-25 | Improved SKILL.md description and frontmatter |
| v3.1 | 2026-02-25 | Segmented execution, maxBatches, processedIds fix, bin/ CLI, LICENSE |
| v3.0 | 2026-02-23 | Batch-level immediate persistence, version tracking, monitoring |
| v2.0 | 2026-02-14 | Checkpoint/resume, batch processing |
| v1.0 | 2026-02-12 | Initial release |
