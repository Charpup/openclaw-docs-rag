# OpenClaw Docs RAG

Offline OpenClaw documentation with vector search and RAG capabilities.

## Features

- 📚 **Offline Access** - Full OpenClaw documentation locally indexed
- 🔍 **Semantic Search** - Natural language queries with vector similarity
- ⚡ **Fast Retrieval** - < 2 second query latency
- 🔄 **Auto Sync** - Weekly automatic documentation updates
- 🤖 **RAG Ready** - Context assembly for LLM consumption

## Quick Start

```bash
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Initialize database (first time only)
npm run init-db

# Sync documentation
npm run sync

# Query documentation
./query-docs.sh "How do I configure cron jobs?"
```

**Note:** Scripts automatically load `.env` file. No need to manually export variables.

## API

### `syncDocs(options)`

Full sync pipeline: fetch → chunk → embed → store.

```javascript
const { syncDocs } = require('openclaw-docs-rag');

const result = await syncDocs();
// {
//   success: true,
//   docsProcessed: 73,
//   chunksCreated: 312,
//   chunksEmbedded: 312,
//   chunksStored: 312
// }
```

### `queryDocs(question, options)`

Query documentation with natural language.

```javascript
const { queryDocs } = require('openclaw-docs-rag');

const result = await queryDocs('What are subagents?');
// {
//   question: 'What are subagents?',
//   results: [...],
//   queryTime: 450
// }
```

### `getDocsContext(question, options)`

Get formatted context for LLM.

```javascript
const { getDocsContext } = require('openclaw-docs-rag');

const { context, sources } = await getDocsContext('cron jobs');
// context: Formatted text with relevant docs
// sources: Array of source URLs and scores
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Fetcher   │───▶│   Chunker   │───▶│  Embedder   │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Query    │◀───│   Engine    │◀───│  Vector DB  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Testing

```bash
npm test
```

## Changelog

### v1.1.0 (2026-02-12)

**Improvements:**
- Scripts now auto-load `.env` file (no manual exports needed)
- Database password hardcoded for cloud VM environments
- Added comprehensive troubleshooting guide

**Fixes:**
- Resolved pyenv lock contention causing shell timeouts
- Fixed environment variable propagation in sub-scripts

### v1.0.0 (2026-02-10)

- Initial release
- Full sync pipeline with embeddings
- Vector search with pgvector
- CLI query interface

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## License

MIT
