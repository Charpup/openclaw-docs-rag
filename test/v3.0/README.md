# docs-rag v3.0 Test Suite

Generated for Phase 3: TDD Test Generation following TDD+SDD dual-pyramid methodology.

## Test Structure (Dual-Pyramid)

```
SDD Pyramid (Behavior Layer - AI Agent)
  └── acceptance/     - End-to-End Acceptance Tests (BDD scenarios)
  └── integration/    - Module Collaboration Tests

TDD Pyramid (Implementation Layer)
  └── unit/           - Interface Contract Tests
```

## Test Coverage by Component

### StreamingBatchWriter
| Test File | Type | Test Cases |
|-----------|------|------------|
| `test_streaming_batch_writer.py` | Unit | SBW-001 to SBW-005 |
| `test_streaming_pipeline.py` | Integration | Pipeline flow, batch sequences, rollback |
| `test_large_dataset.py` | Acceptance | E2E-001: 1000 document processing |

**Test Cases Mapped:**
- SBW-001: Valid batch processing
- SBW-002: Empty batch rejection
- SBW-003: Database failure recovery
- SBW-004: Successful commit
- SBW-005: Commit non-existent batch

### MarkdownHeaderParser
| Test File | Type | Test Cases |
|-----------|------|------------|
| `test_markdown_header_parser.py` | Unit | MHP-001 to MHP-004 |
| `test_markdown_headers.py` | Acceptance | E2E-003: Header extraction |

**Test Cases Mapped:**
- MHP-001: Parse H1-H6 headers
- MHP-002: Parse headers with anchors
- MHP-003: No headers in content
- MHP-004: Extract document metadata

### CheckpointManager
| Test File | Type | Test Cases |
|-----------|------|------------|
| `test_checkpoint_manager.py` | Unit | CPM-001 to CPM-006 |
| `test_streaming_pipeline.py` | Integration | Consistency verification |
| `test_recovery_flow.py` | Integration | Recovery point tracking |

**Test Cases Mapped:**
- CPM-001: Update after successful batch
- CPM-002: Checkpoint tracks actual DB state
- CPM-003: Get valid recovery point
- CPM-004: No checkpoint exists
- CPM-005: Consistent state verified
- CPM-006: Inconsistent state detected

### CrashRecoveryHandler
| Test File | Type | Test Cases |
|-----------|------|------------|
| `test_crash_recovery_handler.py` | Unit | CRH-001 to CRH-003 |
| `test_recovery_flow.py` | Integration | Full recovery scenarios |
| `test_crash_recovery.py` | Acceptance | E2E-002: Crash recovery |

**Test Cases Mapped:**
- CRH-001: Successful recovery
- CRH-002: Recovery with partial batch
- CRH-003: Full integrity verified

## File Structure

```
test/v3.0/
├── conftest.py                    # Shared pytest fixtures
├── fixtures.py                    # Test data factories
├── mocks.py                       # Mock implementations (RED phase)
├── unit/
│   ├── __init__.py
│   ├── test_streaming_batch_writer.py      (184 lines)
│   ├── test_markdown_header_parser.py      (254 lines)
│   ├── test_checkpoint_manager.py          (300 lines)
│   └── test_crash_recovery_handler.py      (263 lines)
├── integration/
│   ├── __init__.py
│   ├── test_streaming_pipeline.py          (327 lines)
│   └── test_recovery_flow.py               (302 lines)
└── acceptance/
    ├── __init__.py
    ├── test_crash_recovery.py              (316 lines)
    ├── test_large_dataset.py               (307 lines)
    └── test_markdown_headers.py            (315 lines)

Total: 2,574 lines of test code
```

## Running Tests

### Run all tests (expect RED phase - tests will fail)
```bash
cd skills/openclaw-docs-rag
pytest test/v3.0/ -v
```

### Run specific test layer
```bash
# Unit tests only
pytest test/v3.0/unit/ -v

# Integration tests only
pytest test/v3.0/integration/ -v

# Acceptance tests only
pytest test/v3.0/acceptance/ -v
```

### Run tests for specific component
```bash
# StreamingBatchWriter tests
pytest test/v3.0/ -k "streaming" -v

# CheckpointManager tests
pytest test/v3.0/ -k "checkpoint" -v
```

### Run with coverage
```bash
pytest test/v3.0/ --cov=docs_rag --cov-report=html --cov-report=term
```

## TDD Cycle State

**Current Phase: RED** 🔴

All tests are designed to fail initially because the implementation modules do not exist yet:

```python
# These imports will fail (expected in RED phase)
from docs_rag.streaming import StreamingBatchWriter
from docs_rag.parsers import MarkdownHeaderParser
from docs_rag.checkpoint import CheckpointManager
from docs_rag.recovery import CrashRecoveryHandler
```

## Quality Attributes Verified

| Attribute | Test Location | Threshold |
|-----------|---------------|-----------|
| processing_time | `test_large_dataset.py` | < 60 seconds |
| memory_usage | `test_large_dataset.py` | < 200MB |
| recovery_time | `test_crash_recovery.py` | < 5 seconds |
| data_integrity | `test_crash_recovery.py` | 100% |
| code_coverage | All tests | >= 80% |

## SDD Scenarios Implemented

| Scenario ID | Description | Test File |
|-------------|-------------|-----------|
| E2E-001 | Process large document set with streaming | `test_large_dataset.py` |
| E2E-002 | Recover from crash during batch 5 | `test_crash_recovery.py` |
| E2E-003 | Process markdown with headers | `test_markdown_headers.py` |

## Next Steps (Phase 4: Implementation)

1. Create implementation modules to make unit tests pass
2. Run integration tests to verify module collaboration
3. Run acceptance tests to verify E2E scenarios
4. Refactor while keeping tests green

## Test Data Structures

### BatchResult
```python
{
    success: bool,
    persisted_count: int,
    batch_id: str,
    checkpoint_updated: bool,
    error: Optional[str]
}
```

### Checkpoint
```python
{
    last_batch_id: str,
    total_persisted: int,
    status: str,  # 'committed', 'pending'
    timestamp: datetime
}
```

### RecoveryPoint
```python
{
    last_batch_id: Optional[str],
    total_persisted: int,
    can_resume: bool,
    resume_from: Optional[str]
}
```

### HeaderNode
```python
{
    level: int,  # 1-6
    text: str,
    anchor: Optional[str],
    has_link: bool
}
```

## Notes

- All tests follow Arrange-Act-Assert pattern
- Comments reference SPEC.yaml test case IDs
- Mocks provided for RED phase development
- Fixtures support both SQLite and mock databases
