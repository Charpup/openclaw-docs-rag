# Findings: OpenClaw Docs RAG Research

## Date: 2026-02-10

## Existing Solutions Analysis

### clawddocs Skill (Installed)
**Capabilities:**
- Decision tree navigation for common questions
- Search scripts (keyword-based)
- Doc fetching utilities
- Sitemap generation
- Version tracking

**Gaps for RAG:**
- ❌ No vector embeddings
- ❌ No semantic search
- ❌ No automatic context assembly
- ❌ Manual query → find → read workflow

**Reusable Components:**
- ✅ Sitemap discovery (`./scripts/sitemap.sh`)
- ✅ Doc fetching (`./scripts/fetch-doc.sh`)
- ✅ Local caching structure

## Technical Architecture Options

### Option A: MemU PostgreSQL + pgvector (Recommended)
```
Docs → Chunks → Embeddings → PostgreSQL (pgvector)
                                      ↓
                                Semantic Query
```

**Pros:**
- Existing MemU infrastructure
- SQL interface for metadata filtering
- ACID compliance
- Free (using existing DB)

**Cons:**
- Requires pgvector extension (already installed ✅)
- Schema design needed

### Option B: ChromaDB (Separate)
```
Docs → Chunks → Embeddings → ChromaDB
                               ↓
                         Vector Query
```

**Pros:**
- Purpose-built for embeddings
- Simple API
- Good Python integration

**Cons:**
- Additional service to maintain
- More complex deployment

### Option C: JSON + In-Memory (Fallback)
```
Docs → Chunks → Embeddings → JSON files
                               ↓
                         Brute-force cosine similarity
```

**Pros:**
- Zero dependencies
- Simple to debug

**Cons:**
- Slow for large corpus
- No metadata filtering
- Memory intensive

## Document Corpus Estimation

**Source:** docs.openclaw.ai

**Pages to index:**
- /start/ (getting-started, setup, FAQ) ~5 pages
- /gateway/ (configuration, security, troubleshooting) ~10 pages
- /providers/ (discord, telegram, whatsapp, etc.) ~15 pages
- /concepts/ (agent, sessions, models, etc.) ~10 pages
- /tools/ (bash, browser, skills, etc.) ~15 pages
- /automation/ (cron, webhooks, etc.) ~8 pages
- /cli/ (commands) ~5 pages
- /platforms/ (macos, linux, etc.) ~5 pages

**Estimated total:** ~73 pages

**Chunking strategy:**
- Section-level chunks (h2/h3 boundaries)
- Average 500 tokens per chunk
- Estimated 200-300 chunks total

**Embedding cost:**
- text-embedding-3-small: $0.02 per 1M tokens
- 300 chunks × 500 tokens = 150K tokens
- **Cost: ~$0.003** (negligible)

## Embedding Model Options

| Model | Provider | Cost | Quality | Decision |
|-------|----------|------|---------|----------|
| text-embedding-3-small | OpenAI (apiyi) | Low | Good | ✅ Use existing |
| text-embedding-v1 | Moonshot | Free | Medium | Alternative |
| E5 | HuggingFace | Free | Good | Self-hosted |

**Decision:** Use existing `text-embedding-3-small` (already configured in openclaw.json)

## Sync Strategy

**Full Sync:**
- Weekly cron (Sunday 02:00 CST)
- Re-fetch all docs, regenerate embeddings
- Delete old vectors, insert new

**Incremental Sync:**
- Daily check for changes
- Only update changed pages
- Track versions with checksums

**Decision:** Start with full weekly sync, add incremental later

## Query Interface Design

**Function: `queryDocs(question, topK=5)`**
```javascript
// 1. Embed question
// 2. Vector similarity search
// 3. Return top-K chunks with metadata
// 4. Optional: re-rank by relevance
```

**Function: `syncDocs(force=false)`**
```javascript
// 1. Fetch sitemap
// 2. For each page: fetch, chunk, embed
// 3. Store in vector DB
// 4. Report stats
```

---
*Research Status: Complete*
*Next: SPEC.yaml design*
