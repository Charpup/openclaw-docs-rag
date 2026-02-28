# Changelog

All notable changes to this project will be documented in this file.

## [4.0.0] - 2026-02-28

### 🎉 Major Release - Complete Architecture Rewrite

**New Features:**
- Real-time llms.txt-based document retrieval
- Keyword-based document matching (replaces vector search)
- Simple TTL cache (5 minutes)
- Zero database dependencies
- Zero embedding API costs

**Removed:**
- PostgreSQL/pgvector dependency
- OpenAI embedding generation
- Sync infrastructure (cron, checkpoints, batch processing)
- Complex setup requirements

**Changed:**
- Simplified API - same interface, new implementation
- Faster setup - no database configuration needed
- Lower resource usage - in-memory only

**Migration:**
- Old code moved to `src-deprecated/`
- Database backups preserved
- Cron jobs disabled

## [3.1.1] - 2026-02-25

### Changed
- Improved SKILL.md description and frontmatter

## [3.1.0] - 2026-02-25

### Added
- Segmented execution with `maxBatches` parameter
- CLI commands in `bin/` directory
- MIT LICENSE
- `processedIds` fix for checkpoint consistency

## [3.0.0] - 2026-02-23

### Added
- Batch-level immediate persistence
- Version tracking system
- Monitoring and health checks
- `verify-sync.sh` script

### Fixed
- Data loss prevention with per-batch writes

## [2.0.0] - 2026-02-14

### Added
- Checkpoint/resume capability
- Batch processing for large document sets
- Progress tracking

## [1.0.0] - 2026-02-12

### Added
- Initial release
- Vector search with PostgreSQL/pgvector
- OpenAI embeddings
- Basic query interface
