---
name: openclaw-docs-rag
description: Offline OpenClaw documentation with vector search and RAG capabilities
author: Galatea
version: 3.0.0
---

# OpenClaw Docs RAG v3.0

Query OpenClaw documentation using natural language and vector search.

## What's New in v3.0

- **Streaming batch writes** - Per-batch DB persistence for reliable large-scale processing
- **Native Markdown support** - Extract and query document structure with header parsing
- **Enhanced checkpoint system** - Full DB state tracking with automated recovery
- **Crash recovery with integrity validation** - Resume from any failure point
- **100% test coverage** - 97/97 tests passing

## When to Use

- Before executing tasks: Query relevant documentation for context
- Learning OpenClaw: Find specific feature explanations
- Troubleshooting: Search for error solutions and best practices

## Installation

```bash
git clone https://github.com/Charpup/openclaw-docs-rag.git ~/.openclaw/skills/openclaw-docs-rag
cd ~/.openclaw/skills/openclaw-docs-rag
npm install
```

## Setup

### Prerequisites

- Docker PostgreSQL with pgvector (port 5432)
- Node.js 18+
- OpenAI API key (for embeddings)

### 1. Environment Variables

```bash
export OPENAI_API_KEY="sk-..."           # For embeddings
export MEMU_DB_PASSWORD="memu_secure_password"  # PostgreSQL password
export PGHOST="localhost"
export PGPORT="5432"
export PGUSER="memu"
export PGDATABASE="memu_db"
```

### 2. Initialize Database

```bash
# Create tables and indexes
node scripts/init-db.js

# Or use npm script
npm run init-db
```

This creates the `openclaw_docs_chunks` table with:
- Vector storage (1536 dimensions)
- Full-text search support
- Similarity search index (ivfflat)

### 3. Sync Documentation

```bash
# Full sync (first time)
npm run sync

# Incremental sync (daily)
npm run sync:incremental
```

### 4. Verify Installation

```bash
# Test query
./query-docs.sh "how to configure cron jobs"

# Check database stats
node -e "const s=require('./src/store');new s().init().then(s=>s.getStats().then(c=>console.log(c)))"
```

## Tools

### queryDocs

Query OpenClaw documentation with natural language.

**Usage:**
```bash
./query-docs.sh "how to configure cron jobs"
```

**Parameters:**
- `query` (string, required): Search query
- `top_k` (int, optional): Number of results (default: 5)

**Returns:**
- Relevant documentation chunks
- Source URLs
- Similarity scores

### syncDocs

Sync documentation from docs.openclaw.ai.

**Usage:**
```bash
./sync-docs.sh
```

**Parameters:**
- `force` (boolean, optional): Force full re-sync (default: false)

## API Usage

```javascript
const { queryDocs, syncDocs } = require('./index.js');

// Query
const results = await queryDocs("cron jobs configuration", { topK: 5 });

// Sync
await syncDocs({ force: true });
```

## Architecture

- **Vector Store**: MemU PostgreSQL + pgvector
- **Embeddings**: text-embedding-3-small (1536d)
- **Chunk Size**: ~1000 tokens with overlap
- **Query Latency**: <500ms (p95)

## License

MIT
