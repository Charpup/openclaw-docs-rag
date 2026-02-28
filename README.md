# OpenClaw Docs RAG v4.0

Real-time documentation retrieval for OpenClaw using llms.txt.

## What's New in v4.0

**Complete Architecture Rewrite**
- ✅ No database required (removed PostgreSQL/pgvector dependency)
- ✅ No embeddings generation (zero API costs for retrieval)
- ✅ Real-time fetching from llms.txt
- ✅ Simple keyword-based matching
- ✅ 5-minute TTL cache
- ✅ Zero sync infrastructure

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Charpup/openclaw-docs-rag.git ~/.openclaw/skills/openclaw-docs-rag
cd ~/.openclaw/skills/openclaw-docs-rag
npm install

# Query documentation
./query-docs.sh "how to configure cron jobs"
./query-docs.sh "discord bot setup"
./query-docs.sh "cli commands"
```

## Usage

### CLI

```bash
# Query documentation
./query-docs.sh "your question here"

# Or via Node
node index.js query "your question here"

# Check status
node index.js status

# Clear cache
node index.js clear-cache
```

### Programmatic API

```javascript
const { DocsRAG } = require('./src/index');

const rag = new DocsRAG();

// Query with full content
const result = await rag.query("how to setup cron jobs", { topK: 5 });
console.log(result.context);  // Formatted context for LLM
console.log(result.sources);  // Source references

// Quick query (titles only)
const quick = await rag.quickQuery("discord configuration");
```

## Architecture

### v4.0 (Current) - Real-time Retrieval

```
User Query → llms.txt Fetch → Keyword Matching → Document Fetch → Context
                (5min cache)    (in-memory)        (5min cache)
```

**Components:**
- `fetcher-llms.js` - Fetches and parses llms.txt
- `query-engine.js` - Keyword-based document selection
- `cache.js` - Simple TTL cache
- `index.js` - Main orchestrator

### v3.x (Legacy) - Vector Search

```
User Query → Vector DB → Similarity Search → Pre-chunked Results
                (PostgreSQL/pgvector)
```

## Migration from v3.x

### What's Changed

| Feature | v3.x | v4.0 |
|---------|------|------|
| Database | PostgreSQL + pgvector | None (in-memory) |
| Embeddings | OpenAI API | None (keywords) |
| Sync | Cron jobs + checkpoints | Real-time fetch |
| Storage | ~5GB DB + vectors | ~1MB cache |
| Query Latency | ~50ms | ~100-500ms |
| Setup Complexity | High | Low |

### Breaking Changes

- Removed `syncDocs()` function - no longer needed
- Removed database dependencies
- Removed embedding-related options
- Same query API, different underlying implementation

### Cleanup (Optional)

After verifying v4.0 works correctly:

```bash
# Stop and remove old cron jobs
crontab -r

# Remove old database (optional)
dropdb memu_db  # or your database name

# Remove deprecated code
rm -rf src-deprecated/
rm sync-checkpoint.json
```

## Configuration

No configuration required! The system works out of the box.

Optional environment variables:

```bash
# Cache TTL (default: 5 minutes)
export CACHE_TTL_MS=300000

# Max cache entries (default: 50)
export CACHE_MAX_SIZE=50
```

## How It Works

1. **Fetch llms.txt** - Downloads the documentation index from https://docs.openclaw.ai/llms.txt
2. **Parse Documents** - Extracts document URLs, titles, and categories
3. **Keyword Matching** - Matches query keywords against document metadata
4. **Fetch Content** - Retrieves full content of top matching documents
5. **Format Context** - Returns formatted context for LLM consumption

## Performance

- **Initial fetch**: ~500ms (llms.txt + top documents)
- **Cached query**: ~10-50ms
- **Memory usage**: ~10-50MB
- **Cache TTL**: 5 minutes

## Troubleshooting

### No results found
- Check internet connectivity to docs.openclaw.ai
- Try broader search terms
- Clear cache: `node index.js clear-cache`

### Slow queries
- First query after cache expiry is slower (expected)
- Subsequent queries use cached data
- Check network latency to docs.openclaw.ai

### Outdated content
- Cache auto-expires after 5 minutes
- Force refresh: `node index.js clear-cache`

## License

MIT

## Changelog

### v4.0.0 (2026-02-28)
- Complete rewrite with llms.txt-based retrieval
- Removed PostgreSQL/pgvector dependency
- Removed embedding generation
- Added real-time fetching
- Added keyword-based matching
- Simplified architecture

### v3.1.1 (2026-02-25)
- Improved SKILL.md description

### v3.1 (2026-02-25)
- Segmented execution with maxBatches
- CLI bin/ commands

### v3.0 (2026-02-23)
- Batch-level immediate persistence
- Version tracking
- Monitoring

### v2.0 (2026-02-14)
- Checkpoint/resume
- Batch processing

### v1.0 (2026-02-12)
- Initial release
