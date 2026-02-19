# Configuration Guide

Detailed configuration options for openclaw-docs-rag.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for embeddings |
| `MEMU_DB_PASSWORD` | Yes | - | PostgreSQL password |
| `PGHOST` | No | `localhost` | PostgreSQL host |
| `PGPORT` | No | `5432` | PostgreSQL port |
| `PGUSER` | No | `memu` | PostgreSQL user |
| `PGDATABASE` | No | `memu_db` | PostgreSQL database |

## Database Setup

### Initialize Database

```bash
npm run init-db
```

Creates the `openclaw_docs_chunks` table with:
- Vector storage (1536 dimensions)
- Full-text search support
- Similarity search index (ivfflat)

### Docker PostgreSQL

```bash
docker run -d \
  --name memu-postgres \
  -e POSTGRES_USER=memu \
  -e POSTGRES_PASSWORD=memu_secure_password \
  -e POSTGRES_DB=memu_db \
  -p 5432:5432 \
  -v memu_data:/var/lib/postgresql/data \
  pgvector/pgvector:pg17
```

## Sync Options

### Batch Sync

```javascript
await syncDocs({
  batchSize: 50,           // Chunks per batch
  resume: true,            // Resume from checkpoint
  force: false,            // Force full re-sync
  checkpointPath: './sync-checkpoint.json',
  onProgress: (p) => console.log(`${p.percentage}%`)
});
```

### Incremental Sync

```bash
npm run sync:incremental
```

## Query Options

```javascript
await queryDocs("how to use cron", {
  topK: 5,                 // Number of results
  apiKey: "sk-...",        // Override API key
  dbConfig: {              // Override DB config
    host: 'localhost',
    port: 5432
  }
});
```
