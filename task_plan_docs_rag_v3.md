# Task Plan: docs-rag v3.0 Development

<!--
  Planning file for docs-rag v3.0 major release
  Combines planning-with-files + tdd-sdd-development workflows
  Created: 2026-02-14
-->

## Goal

Develop and release docs-rag v3.0 with streaming writes, markdown header support, improved checkpointing, and crash recovery capabilities - ensuring production-grade reliability and data integrity.

## Current Phase

Phase 1: Requirements & Discovery

## Phases

### Phase 1: Requirements & Discovery
- [x] Define known v3.0 requirements
- [x] Identify technical constraints
- [x] Document existing architecture gaps
- [ ] Research streaming database patterns
- [ ] Research crash recovery best practices
- **Status:** in_progress

### Phase 2: SDD Spec Definition
- [ ] Create comprehensive SPEC.yaml
- [ ] Define interfaces for streaming writer
- [ ] Define checkpoint/ recovery interfaces
- [ ] Define markdown parser contracts
- [ ] Document preconditions/postconditions
- [ ] Create BDD scenarios for crash recovery
- [ ] Validate SPEC.yaml against schema
- **Status:** pending

### Phase 3: TDD Test Generation
- [x] Generate unit test stubs
- [x] Generate integration tests for streaming
- [x] Generate acceptance tests for crash recovery
- [x] Create test fixtures for batch operations
- [x] Create mocks for database layer
- [x] Verify RED phase (tests fail without impl)
- **Status:** completed
- **Output:** See `test/v3.0/` directory with 9 test files, fixtures, and mocks

### Phase 4: Implementation (Red-Green-Refactor)
- [ ] Implement streaming batch writer
- [ ] Implement per-batch DB persistence
- [ ] Implement text/markdown header parser
- [ ] Implement improved checkpoint tracking
- [ ] Implement crash recovery logic
- [ ] Refactor for performance
- **Status:** pending

### Phase 5: Testing & Verification
- [ ] Unit test coverage >= 80%
- [ ] Integration tests for streaming
- [ ] Crash recovery scenario testing
- [ ] Performance benchmarks
- [ ] End-to-end acceptance tests
- **Status:** pending

### Phase 6: Release Preparation
- [ ] Update documentation
- [ ] Migration guide from v2.x
- [ ] Version bump and tagging
- [ ] ClawHub publication
- **Status:** pending

## Known Requirements (v3.0 Scope)

### Streaming Writes
- **Requirement:** Per-batch persistence to database
- **Motivation:** Prevent data loss on large document processing
- **Acceptance Criteria:** Each batch committed before next processed

### Text/Markdown Header Support
- **Requirement:** Accept headers from markdown documents
- **Motivation:** Better document structure extraction
- **Acceptance Criteria:** H1-H6 headers parsed and stored with metadata

### Improved Checkpoint
- **Requirement:** Track database-persisted state accurately
- **Motivation:** Reliable resume after interruption
- **Acceptance Criteria:** Checkpoint reflects actual DB state, not just processed count

### Crash Recovery Testing
- **Requirement:** Automated tests for crash scenarios
- **Motivation:** Ensure data integrity guarantees
- **Acceptance Criteria:** Simulated crashes don't lose committed data

## Key Questions

1. What batch size is optimal for streaming? (Memory vs. throughput tradeoff)
2. Should checkpointing be synchronous or asynchronous?
3. How to handle partial batch failures during streaming?
4. What's the recovery time objective (RTO) target?
5. Should we support parallel stream processing?

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use TDD+SDD dual pyramid | Production-grade reliability requires structured testing |
| File-based planning | Complex multi-phase task with many unknowns |
| Separate checkpoint from batch tracking | Clearer state management, easier testing |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |

## Notes

- **Integration:** This task_plan is enhanced by tdd-sdd-development workflow
- **Location:** /root/.openclaw/workspace/skills/openclaw-docs-rag/task_plan_docs_rag_v3.md
- **Related Files:**
  - findings_docs_rag_v3.md (research and decisions)
  - spec/v3.0/SPEC.yaml (formal specification)
  - progress.md (session logs - to be created during implementation)

---
*Updated via planning-with-files + tdd-sdd-development skills*
