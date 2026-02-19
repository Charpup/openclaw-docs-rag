# API Reference

Complete API documentation for openclaw-docs-rag.

## Core Functions

### `syncDocs(options)`

Full sync pipeline: fetch → chunk → embed → store.

**Parameters:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | number | - | Max documents to fetch |
| `apiKey` | string | `OPENAI_API_KEY` | OpenAI API key |
| `batchSize` | number | 50 | Chunks per batch |
| `resume` | boolean | true | Resume from checkpoint |
| `force` | boolean | false | Force full re-sync |
| `checkpointPath` | string | `./sync-checkpoint.json` | Checkpoint file path |
| `onProgress` | function | - | Progress callback |

**Returns:**
```javascript
{
  success: true,
  docsProcessed: 73,
  chunksCreated: 312,
  chunksProcessed: 312,
  batchesCompleted: 7,
  failedChunks: 0,
  resumed: false,
  stats: { total_sources: 73, total_chunks: 312 }
}
```

**Example:**
```javascript
const { syncDocs } = require('openclaw-docs-rag');

const result = await syncDocs({
  batchSize: 50,
  onProgress: (p) => console.log(`${p.percentage}% complete`)
});
```

---

### `queryDocs(question, options)`

Query documentation with natural language.

**Parameters:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `question` | string | required | Search query |
| `topK` | number | 5 | Number of results |
| `apiKey` | string | `OPENAI_API_KEY` | OpenAI API key |
| `dbConfig` | object | - | Database configuration |

**Returns:**
```javascript
{
  question: "how to use cron",
  results: [
    {
      text: "...",
      source: "https://docs.openclaw.ai/...",
      score: 0.89,
      heading: "Cron Jobs"
    }
  ],
  queryTime: 450
}
```

**Example:**
```javascript
const { queryDocs } = require('openclaw-docs-rag');

const result = await queryDocs('What are subagents?', { topK: 5 });
console.log(result.results[0].text);
```

---

### `getDocsContext(question, options)`

Get formatted context for LLM consumption.

**Parameters:** Same as `queryDocs`

**Returns:**
```javascript
{
  context: "# Cron Jobs\n\nTo configure cron jobs...",
  sources: [
    { url: "https://docs.openclaw.ai/...", score: 0.89 }
  ]
}
```

**Example:**
```javascript
const { getDocsContext } = require('openclaw-docs-rag');

const { context, sources } = await getDocsContext('cron jobs');
// Use context in LLM prompt
```

---

## Classes

### `CheckpointManager`

Manages checkpoint state for resume capability.

```javascript
const { CheckpointManager } = require('openclaw-docs-rag');

const cm = new CheckpointManager('./checkpoint.json');

// Save state
await cm.save({
  totalChunks: 1000,
  processedChunkIds: ['hash1', 'hash2'],
  failedChunkIds: [],
  currentBatch: 10,
  lastUpdated: new Date().toISOString()
});

// Load state
const state = await cm.load();

// Check if resumable
const canResume = await cm.isResumable(); // true if <24h old

// Clear checkpoint
await cm.clear();
```

---

### `ChunkDeduplicator`

Ensures idempotent processing via content hashing.

```javascript
const { ChunkDeduplicator } = require('openclaw-docs-rag');

const dedup = new ChunkDeduplicator();

// Compute hash
const hash = dedup.computeHash({
  text: "chunk content",
  source: "https://...",
  heading: "Section"
});

// Check if processed
const isDup = dedup.isProcessed(hash, processedHashes);
```

---

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

- **Vector Store**: MemU PostgreSQL + pgvector
- **Embeddings**: text-embedding-3-small (1536d)
- **Chunk Size**: ~1000 tokens with overlap
- **Query Latency**: <500ms (p95)
