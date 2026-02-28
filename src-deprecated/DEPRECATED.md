# Deprecated Code Notice

## Status: DEPRECATED

This directory contains the old RAG (Retrieval-Augmented Generation) implementation that has been replaced by the new llms.txt-based real-time retrieval system.

## Deprecated Date
2026-02-28

## Reason for Deprecation
- Old system required complex sync infrastructure (PostgreSQL + pgvector)
- Batch processing with checkpoint/resume was error-prone
- High maintenance overhead
- Replaced with simpler llms.txt-based real-time fetching

## Old Components
- `fetcher.js` - Old document fetcher with markdown support
- `chunker.js` - Document chunking logic
- `embedder.js` - OpenAI embedding generation
- `store.js` - PostgreSQL vector storage
- `query.js` - Vector similarity search
- `checkpoint-manager.js` - Sync checkpoint management
- `batch-sync.js` - Batch processing logic
- `version-detector.js` - OpenClaw version tracking
- `version-store.js` - Version history storage
- `chunk-deduplicator.js` - Chunk deduplication

## New System
See `../src/` for the new llms.txt-based implementation:
- `fetcher-llms.js` - Fetches and parses llms.txt
- `query-engine.js` - Keyword-based document selection
- `cache.js` - Simple TTL cache

## Migration Notes
- Old database can be safely dropped after verification
- Old checkpoint files can be removed
- Cron jobs have been disabled

## Cleanup Schedule
This directory will be removed in 30 days (2026-03-30) if no issues are reported.
