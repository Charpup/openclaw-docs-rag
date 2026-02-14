"""
Pytest configuration and shared fixtures for docs-rag v3.0 tests
"""
import pytest
import tempfile
import sqlite3
import os


@pytest.fixture
def temp_database():
    """
    Create a temporary SQLite database for testing.
    Yields connection, cleans up after test.
    """
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    
    conn = sqlite3.connect(db_path)
    
    yield conn
    
    conn.close()
    os.unlink(db_path)


@pytest.fixture
def initialized_database(temp_database):
    """
    Create a temporary database with full schema initialized.
    """
    cursor = temp_database.cursor()
    
    # Documents table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            batch_id TEXT NOT NULL,
            headers TEXT,  -- JSON
            metadata TEXT,  -- JSON
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Checkpoints table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS checkpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_batch_id TEXT NOT NULL,
            total_persisted INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Recovery log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recovery_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation TEXT NOT NULL,
            batch_id TEXT,
            status TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    temp_database.commit()
    
    return temp_database


@pytest.fixture
def sample_documents():
    """
    Provide sample documents for testing.
    """
    return [
        {"id": "doc_001", "content": "First test document"},
        {"id": "doc_002", "content": "Second test document"},
        {"id": "doc_003", "content": "Third test document"},
    ]


@pytest.fixture
def sample_markdown():
    """
    Provide sample markdown content for testing.
    """
    return """# Document Title

## Section 1
Content for section 1.

### Subsection 1.1
More detailed content.

## Section 2
Content for section 2.

### Subsection 2.1
Even more content here.
"""


@pytest.fixture
def mock_batch_result():
    """
    Factory for creating mock batch results.
    """
    def _create(success=True, persisted_count=0, batch_id="", error=None):
        from types import SimpleNamespace
        return SimpleNamespace(
            success=success,
            persisted_count=persisted_count,
            batch_id=batch_id,
            error=error,
            checkpoint_updated=success
        )
    return _create


@pytest.fixture
def mock_checkpoint():
    """
    Factory for creating mock checkpoints.
    """
    def _create(last_batch_id=None, total_persisted=0, status="pending"):
        from types import SimpleNamespace
        return SimpleNamespace(
            last_batch_id=last_batch_id,
            total_persisted=total_persisted,
            status=status
        )
    return _create


@pytest.fixture(autouse=True)
def clear_import_cache():
    """
    Clear import cache between tests to ensure fresh imports.
    This is important for testing the RED-GREEN-REFACTOR cycle.
    """
    # Remove any cached docs_rag modules
    modules_to_remove = [
        key for key in sys.modules.keys() 
        if key.startswith('docs_rag')
    ]
    for module in modules_to_remove:
        del sys.modules[module]


# Import sys for the fixture above
import sys
from unittest.mock import Mock


@pytest.fixture
def mock_db():
    """Mock database connection"""
    return Mock()


@pytest.fixture
def mock_checkpoint_manager():
    """Mock checkpoint manager"""
    cm = Mock()
    cm.update_checkpoint.return_value = Mock(
        last_batch_id="batch_001",
        total_persisted=2,
        status="committed"
    )
    return cm


@pytest.fixture
def batch_writer(mock_db, mock_checkpoint_manager):
    """Create StreamingBatchWriter instance with mocked dependencies"""
    from docs_rag.streaming import StreamingBatchWriter
    return StreamingBatchWriter(
        db_connection=mock_db,
        checkpoint_manager=mock_checkpoint_manager
    )
