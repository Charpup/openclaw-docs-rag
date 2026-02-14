# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
