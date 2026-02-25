# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-02-25

### Fixed
- Segmented execution: `syncDocs()` now accepts `maxBatches` parameter for clean exit after N batches
- Bug fix: `processedIds` changed from `const` to `let` — accumulates correctly across batches
- Deprecated `sync-supervisor.sh` (was sending SIGTERM to healthy sync processes every minute)

### Changed
- Default cron: every 15 min with `flock`, replaces 1-minute supervisor loop
- `sync-docs.sh`: supports `MAX_BATCHES` env var and `--max-batches` flag
- Webhook notifications now distinguish `partial` / `complete` / `failed` sync status

### Added
- `bin/docs-rag.js` — CLI entry point (`docs-rag query` / `docs-rag sync`)
- `LICENSE` — MIT License
- `package.json` `bin` field for global CLI installation
- `crontab.txt` — segmented cron strategy
- `src/version-detector.js`, `src/version-store.js` — OpenClaw version tracking
- `sync-daemon.sh`, `verify-sync.sh`, `version-check.sh`, `monitor-sync-progress.sh`
- `references/sync-architecture.md` — design decisions for segmented execution

---

## [3.0.0] - 2026-02-14

### Added
- **Streaming batch writes** - Per-batch database persistence with checkpoint tracking
- **Native Markdown support** - Extract and query document structure using `Accept: text/markdown` header
- **Enhanced checkpoint system** - Full DB state tracking with cumulative progress
- **Crash recovery with automated integrity validation** - Resume from any failure point with consistency verification
- **100% test coverage** - 97/97 tests passing across unit, integration, and acceptance suites
- **Markdown header extraction** - Parse H1-H6 headers with anchors for structured document navigation
- **ACID guarantees** - Atomic batch processing with rollback capabilities
- **Performance benchmarks** - <5 second recovery time, <200MB memory usage, 1000+ document processing support

### Changed
- **Breaking**: Streamlined batch processing API with mandatory document validation
- **Breaking**: Checkpoint format now includes cumulative processing statistics
- Improved error handling with detailed batch failure reporting
- Enhanced database consistency verification

### Fixed
- Memory issues during large-scale document processing
- Checkpoint corruption edge cases during crash scenarios
- Markdown parsing for documents with special characters

---

## [2.0.0] - 2026-02-14

### Added
- **Batch processing with checkpoint/resume** - Robust sync with automatic state recovery
- **50 chunks per batch** - Optimized batch size for API stability
- **PostgreSQL + pgvector storage** - Production-ready vector database backend
- **Full OpenClaw docs sync** - Complete documentation synchronization
  - 522 documents indexed
  - 3,471 chunks embedded and stored
- **Enhanced sync monitoring** - Real-time progress tracking and health checks
- **Automatic retry with backoff** - Resilient API handling for embedding generation

### Changed
- Migrated from SQLite to PostgreSQL for better concurrency
- Improved chunking algorithm with better context preservation
- Optimized embedding batch processing for stability

### Fixed
- Memory issues with large documentation syncs
- API rate limiting handling
- Database connection pool management

## [1.1.0] - 2026-02-12

### Added
- Incremental sync support
- Better error handling for API failures
- Progress logging during sync operations

### Changed
- Improved documentation chunking strategy

## [1.0.0] - 2026-02-10

### Added
- Initial release
- Vector search with text-embedding-3-small
- Natural language query interface
- SQLite storage backend
- Full documentation sync capability
