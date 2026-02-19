---
name: openclaw-docs-rag
description: Query OpenClaw documentation using natural language and vector search. Keywords - docs, documentation, rag, search, query, openclaw docs, vector search, semantic search, documentation query
---

# OpenClaw Docs RAG

Query OpenClaw documentation using natural language and vector search.

## When to Use

- **Before executing tasks**: Query relevant documentation for context
- **Learning OpenClaw**: Find specific feature explanations
- **Troubleshooting**: Search for error solutions and best practices

## Quick Start

```bash
# 1. Install
git clone https://github.com/Charpup/openclaw-docs-rag.git ~/.openclaw/skills/openclaw-docs-rag
cd ~/.openclaw/skills/openclaw-docs-rag
npm install

# 2. Configure
cp .env.example .env
# Edit .env with OPENAI_API_KEY and MEMU_DB_PASSWORD

# 3. Initialize database
npm run init-db

# 4. Sync documentation
npm run sync

# 5. Query
./query-docs.sh "how to configure cron jobs"
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
# Full sync
npm run sync

# Incremental sync
npm run sync:incremental
```

### Programmatic API

```javascript
const { queryDocs, syncDocs, getDocsContext } = require('./index.js');

// Query
const results = await queryDocs("cron jobs configuration", { topK: 5 });

// Sync
await syncDocs({ force: true });

// Get LLM context
const { context, sources } = await getDocsContext("subagents");
```

## References

- [Configuration](./references/configuration.md) - Environment variables, database setup
- [API Reference](./references/api-reference.md) - Complete API documentation
- [Troubleshooting](./references/troubleshooting.md) - Common issues and solutions
