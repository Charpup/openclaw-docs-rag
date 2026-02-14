# Findings & Decisions: docs-rag v3.0

<!--
  Research and knowledge base for docs-rag v3.0 development
  Maintained alongside task_plan_docs_rag_v3.md
  Created: 2026-02-14
-->

## Requirements

### Core v3.0 Features (User-Defined)

1. **Streaming Writes (Per-Batch Persist)**
   - Process documents in batches
   - Each batch persisted to DB before next batch
   - Prevents data loss on interruption
   - Enables processing of large document sets

2. **Text/Markdown Header Support**
   - Parse H1-H6 headers from markdown
   - Store header hierarchy in metadata
   - Support both `# Header` and `## Header` syntax
   - Extract header anchors/IDs if present

3. **Improved Checkpoint**
   - Track actual DB-persisted state
   - Not just "processed count" but "committed count"
   - Distinguish between processed and persisted
   - Enable accurate resume from interruption

4. **Crash Recovery Testing**
   - Automated test scenarios for crashes
   - Verify data integrity after simulated failures
   - Test partial batch scenarios
   - Validate checkpoint consistency

### Implicit Requirements

- Backward compatibility with v2.x APIs
- Performance: No significant regression
- Memory efficiency for large datasets
- Clear error messages for recovery scenarios

## Research Findings

<!-- To be filled during Phase 1 research -->

### Streaming Patterns (TBD)
- Database: SQLite transaction batching
- Pattern: Iterator-based batch processing
- Consider: SQLAlchemy bulk operations

### Crash Recovery Patterns (TBD)
- WAL (Write-Ahead Logging) consideration
- Two-phase commit for batch+checkpoint
- Idempotency of batch operations

### Markdown Parsing (TBD)
- Existing parser: regex-based or library?
- Headers: frontmatter vs inline
- Libraries: mistletoe, markdown-it, etc.

## Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Use TDD+SDD workflow | Complex feature set requires structured approach | 2026-02-14 |
| File-based planning | Multi-phase task with research needs | 2026-02-14 |
| Separate spec directory | Version-specific specs (v3.0/) | 2026-02-14 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| None yet | - |

## Resources

### Project Files
- Task Plan: `task_plan_docs_rag_v3.md`
- Specification: `spec/v3.0/SPEC.yaml`
- Location: `/root/.openclaw/workspace/skills/openclaw-docs-rag/`

### Existing Codebase
- Current version: v2.x (in same directory)
- Database: SQLite with SQLAlchemy
- Parser: Custom regex-based

### External References
<!-- To be added during research -->
- OpenClaw docs-rag documentation
- SQLite WAL mode documentation
- Python batch processing patterns

## Visual/Browser Findings

<!-- N/A for initial planning - will populate during research phase -->

---
*Part of docs-rag v3.0 development planning*
*See task_plan_docs_rag_v3.md for phase tracking*
