---
name: openclaw-docs-rag
description: Query OpenClaw official documentation in real time via llms.txt index + markdown page fetch. Use before executing tasks, troubleshooting, or learning OpenClaw features.
version: 4.0.1
---

# OpenClaw Docs RAG (v4.x)

Real-time docs retrieval based on `https://docs.openclaw.ai/llms.txt`.

## When to Use

- Before executing OpenClaw operations
- Troubleshooting OpenClaw config/runtime issues
- Looking up CLI/tools/concepts usage

## Core Flow

1. Fetch and parse `llms.txt` (document index)
2. Keyword-match relevant pages
3. Fetch target pages with markdown-first request
4. Return formatted context + source links

No PostgreSQL, no embeddings, no sync job required.

## Fetching Rules

### Index Source
- `https://docs.openclaw.ai/llms.txt`

### Content Fetch Header
```http
Accept: text/markdown, text/html;q=0.8, */*;q=0.5
```

### Cache
- In-memory + file cache
- Default TTL: 5 minutes

## Usage

```bash
# Query docs
./query-docs.sh "how to configure cron jobs"

# Equivalent
node index.js query "how to configure cron jobs"

# Status / cache
node index.js status
node index.js clear-cache
```

## Programmatic API

```javascript
const { DocsRAG } = require('./src/index');

const rag = new DocsRAG();
const result = await rag.query('discord setup', { topK: 5 });
console.log(result.context);
console.log(result.sources);
```

## Notes

- Legacy sync/vector code is deprecated and moved under `src-deprecated/`.
- If docs site is temporarily unavailable, it falls back to file cache when possible.

## References

- [README](./README.md)
- [CHANGELOG](./CHANGELOG.md)
- [Development Log](./development-log.md)
