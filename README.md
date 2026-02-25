# OpenClaw Docs RAG v3.1.0

Offline OpenClaw documentation with vector search and RAG capabilities. Sync is driven by a segmented cron strategy — no long-running processes needed.

## Features

- **Offline Access** — Full OpenClaw documentation locally indexed
- **Semantic Search** — Natural language queries with vector similarity
- **Fast Retrieval** — < 2 second query latency
- **Segmented Sync** — Cron-driven, 10 batches per run, auto-resumes from checkpoint
- **RAG Ready** — Context assembly for LLM consumption
- **CLI** — `docs-rag query` / `docs-rag sync`

## Quick Start

```bash
npm install

# Configure environment
cp .env.example .env
# Edit .env with OPENAI_API_KEY and DB credentials

# Initialize database (first time only)
npm run init-db

# Install cron jobs — sync runs automatically every 15 minutes
crontab crontab.txt

# Or trigger a manual sync round (10 batches)
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh

# Query documentation
./query-docs.sh "How do I configure cron jobs?"
# or
docs-rag query "How do I configure cron jobs?"
```

Scripts automatically load `.env`. No need to manually export variables.

## Segmented Sync Architecture

Full sync (~3,500 chunks, ~70 batches) is split across multiple cron runs:

```
cron (*/15 min)
    └─▶ flock /tmp/docs-rag-sync.lock
            └─▶ sync-docs.sh MAX_BATCHES=10
                    └─▶ syncDocs({ maxBatches: 10 })
                            ├─▶ Process batches 1–10
                            ├─▶ Save checkpoint after each batch
                            └─▶ Exit cleanly → next cron run picks up
```

- Each cron run processes 10 batches (500 chunks), then exits
- `flock` prevents overlapping runs
- Checkpoint accumulates batch-by-batch — no data loss on interrupt
- Full sync completes in ~2 hours (7 cron runs × 10 batches)
- Weekly Sunday 1 AM: force resync from scratch

## API

### `syncDocs(options)`

Full sync pipeline: fetch → chunk → embed → store.

```javascript
const { syncDocs } = require('openclaw-docs-rag');

// Segmented run (10 batches, then exit cleanly)
const result = await syncDocs({ maxBatches: 10 });
// { success: false, status: 'partial', chunksStored: 500, batchesRemaining: 60, ... }

// Force fresh sync
const result = await syncDocs({ force: true, maxBatches: 10 });

// Unlimited (not recommended — process may be killed)
const result = await syncDocs({ force: true });
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `force` | boolean | `false` | Clear checkpoint, start fresh |
| `resume` | boolean | `true` | Resume from checkpoint |
| `maxBatches` | number | `null` | Exit after N batches (for cron segmentation) |
| `batchSize` | number | `50` | Chunks per batch |

### `queryDocs(question, options)`

```javascript
const { queryDocs } = require('openclaw-docs-rag');

const result = await queryDocs('What are subagents?', { topK: 5 });
// { question, results: [...], queryTime: 450 }
```

### `getDocsContext(question, options)`

```javascript
const { getDocsContext } = require('openclaw-docs-rag');

const { context, sources } = await getDocsContext('cron jobs');
// context: formatted text for LLM consumption
// sources: array of source URLs and relevance scores
```

## CLI

```bash
# Query
docs-rag query "what is an agent"
docs-rag query "cron configuration" --top-k 10

# Sync
docs-rag sync --max-batches 10
docs-rag sync --force --max-batches 20
```

## Monitoring

```bash
# Check checkpoint progress
cat sync-checkpoint.json | jq '{batch: .currentBatch, processed: (.processedChunkIds | length)}'

# Check database chunk count
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"

# Full health check
./verify-sync.sh

# Real-time monitor
./monitor-sync-progress.sh

# Version check
./version-check.sh
```

### Cron Schedule (crontab.txt)

```
*/15 * * * *  flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 /path/sync-docs.sh
*/30 * * * *  /path/sync-monitor.sh once
0 1 * * 0     MAX_BATCHES=999 /path/sync-docs.sh --force
```

## Architecture

```
cron (*/15 min)
    └─▶ flock ──▶ sync-docs.sh (MAX_BATCHES=10)
                      └─▶ syncDocs()
                              ├─▶ fetch docs
                              ├─▶ chunk
                              ├─▶ embed (batch N)
                              ├─▶ store batch → DB (immediate write)
                              ├─▶ save checkpoint
                              └─▶ if batches >= maxBatches → exit cleanly
                                        ↑
                              next cron run resumes here
```

### Key Components

| File | Purpose |
|------|---------|
| `index.js` | Main API: `syncDocs`, `queryDocs`, `getDocsContext` |
| `bin/docs-rag.js` | CLI entry point |
| `src/fetcher.js` | Fetch docs with markdown support |
| `src/chunker.js` | Split docs into chunks |
| `src/embedder.js` | Generate embeddings via API |
| `src/store.js` | PostgreSQL vector storage |
| `src/checkpoint-manager.js` | Resume capability |
| `src/version-detector.js` | OpenClaw version tracking |
| `src/version-store.js` | Version history storage |
| `sync-docs.sh` | Shell wrapper (reads MAX_BATCHES env) |
| `crontab.txt` | Production cron schedule |
| `verify-sync.sh` | Health check |

## Troubleshooting

### Sync stalled / no progress

```bash
# Check if flock is blocking
flock -n /tmp/docs-rag-sync.lock echo "lock free" || echo "locked"

# Check checkpoint
cat sync-checkpoint.json | jq .currentBatch

# Manual one-shot run
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=5 ./sync-docs.sh
```

### DB has fewer chunks than expected

```bash
# DB count
psql -h localhost -U memu -d memu_db -c "SELECT COUNT(*) FROM openclaw_docs_chunks;"

# Checkpoint count
cat sync-checkpoint.json | jq '.processedChunkIds | length'

# If DB < checkpoint: reset and force resync
rm sync-checkpoint.json
flock -n /tmp/docs-rag-sync.lock MAX_BATCHES=10 ./sync-docs.sh --force
```

### Database connection failed

```bash
sudo systemctl status postgresql
# or
podman ps | grep postgres
```

### API errors

```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" $OPENAI_BASE_URL/models
```

## References

- [Configuration](./references/configuration.md) — Environment variables, database setup
- [API Reference](./references/api-reference.md) — Complete API documentation
- [Sync Architecture](./references/sync-architecture.md) — Critical design decisions
- [Troubleshooting](./references/troubleshooting.md) — Common issues and solutions

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v3.1.0 | 2026-02-25 | Segmented execution, maxBatches, processedIds fix, bin/ CLI, LICENSE |
| v3.0.0 | 2026-02-23 | Batch-level immediate persistence, version tracking, monitoring |
| v2.0.0 | 2026-02-14 | Checkpoint/resume, batch processing, PostgreSQL |
| v1.0.0 | 2026-02-10 | Initial release |

## License

MIT — see [LICENSE](./LICENSE)
