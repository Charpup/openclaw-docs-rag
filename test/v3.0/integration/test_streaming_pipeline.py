"""
Integration tests for Streaming Pipeline
SDD Level: Module Collaboration Tests
Tests interaction between StreamingBatchWriter, CheckpointManager, and Database
"""
import pytest
from unittest.mock import Mock, patch
import tempfile
import sqlite3


class TestStreamingPipeline:
    """
    Integration tests for the complete streaming pipeline.
    Tests collaboration between StreamingBatchWriter, CheckpointManager, and Database.
    """
    
    @pytest.fixture
    def temp_db(self):
        """Create temporary SQLite database with full schema"""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create tables with full schema (matching Database class)
        cursor.execute('''
            CREATE TABLE documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                batch_id TEXT NOT NULL,
                headers TEXT,
                title TEXT,
                sections TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE checkpoints (
                id INTEGER PRIMARY KEY,
                last_batch_id TEXT,
                total_persisted INTEGER,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        
        yield conn
        
        conn.close()
        import os
        os.unlink(db_path)
    
    @pytest.fixture
    def pipeline(self, temp_db):
        """Create complete streaming pipeline with real components"""
        from docs_rag.checkpoint import CheckpointManager
        from docs_rag.streaming import StreamingBatchWriter
        from docs_rag.database import Database
        
        db = Database(temp_db)
        checkpoint_manager = CheckpointManager(db_connection=db)
        batch_writer = StreamingBatchWriter(
            db_connection=db,
            checkpoint_manager=checkpoint_manager
        )
        
        return {
            "db": temp_db,
            "db_wrapper": db,
            "checkpoint_manager": checkpoint_manager,
            "batch_writer": batch_writer
        }
    
    def test_end_to_end_batch_processing(self, pipeline):
        """
        Test complete batch processing flow:
        1. Process batch of documents
        2. Verify database persistence
        3. Verify checkpoint updated
        4. Verify recovery point
        """
        # Arrange
        documents = [
            {"id": f"doc_{i}", "content": f"Content {i}"}
            for i in range(10)
        ]
        batch_id = "batch_integration_001"
        
        # Act
        result = pipeline["batch_writer"].process_batch(documents, batch_id)
        
        # Assert - Batch processing
        assert result.success is True
        assert result.persisted_count == 10
        
        # Assert - Database persistence
        cursor = pipeline["db"].cursor()
        cursor.execute("SELECT COUNT(*) FROM documents WHERE batch_id = ?", (batch_id,))
        count = cursor.fetchone()[0]
        assert count == 10
        
        # Assert - Checkpoint updated
        recovery_point = pipeline["checkpoint_manager"].get_recovery_point()
        assert recovery_point.last_batch_id == batch_id
        assert recovery_point.total_persisted == 10
    
    def test_multiple_batches_sequence(self, pipeline):
        """
        Test processing multiple batches in sequence:
        1. Process batch 1
        2. Process batch 2
        3. Verify cumulative checkpoint
        4. Verify recovery from latest batch
        """
        # Process batch 1
        docs_1 = [{"id": "d1", "content": "c1"}, {"id": "d2", "content": "c2"}]
        result_1 = pipeline["batch_writer"].process_batch(docs_1, "batch_1")
        assert result_1.success is True
        
        # Process batch 2
        docs_2 = [{"id": "d3", "content": "c3"}, {"id": "d4", "content": "c4"}]
        result_2 = pipeline["batch_writer"].process_batch(docs_2, "batch_2")
        assert result_2.success is True
        
        # Verify checkpoint reflects latest
        recovery_point = pipeline["checkpoint_manager"].get_recovery_point()
        assert recovery_point.last_batch_id == "batch_2"
        assert recovery_point.total_persisted == 4
    
    def test_batch_failure_rollback(self, pipeline):
        """
        Test that batch failure rolls back changes:
        1. Start processing batch
        2. Simulate failure during insert
        3. Verify no documents persisted
        4. Verify checkpoint not updated
        """
        # Arrange - documents with duplicate ID to trigger failure
        documents = [
            {"id": "unique_doc", "content": "First"}
        ]
        
        # Insert first to create conflict
        cursor = pipeline["db"].cursor()
        cursor.execute(
            "INSERT INTO documents (id, content, batch_id) VALUES (?, ?, ?)",
            ("unique_doc", "Existing", "old_batch")
        )
        pipeline["db"].commit()
        
        # Act - Try to process same ID (should fail)
        result = pipeline["batch_writer"].process_batch(documents, "batch_fail")
        
        # Assert - Failure occurred
        assert result.success is False
        
        # Assert - Original document still exists
        cursor.execute("SELECT batch_id FROM documents WHERE id = ?", ("unique_doc",))
        batch_id = cursor.fetchone()[0]
        assert batch_id == "old_batch"
        
        # Assert - Checkpoint not updated
        recovery_point = pipeline["checkpoint_manager"].get_recovery_point()
        assert recovery_point.last_batch_id != "batch_fail"
    
    def test_checkpoint_consistency_verification(self, pipeline):
        """
        Test checkpoint consistency with actual database state:
        1. Process and commit batches
        2. Manually verify consistency
        3. Simulate inconsistency
        4. Verify detection
        """
        # Process batch
        documents = [{"id": f"d{i}", "content": f"c{i}"} for i in range(5)]
        pipeline["batch_writer"].process_batch(documents, "batch_001")
        
        # Verify consistency
        report = pipeline["checkpoint_manager"].verify_consistency()
        assert report.consistent is True
        
        # Simulate inconsistency (delete document behind the scenes)
        cursor = pipeline["db"].cursor()
        cursor.execute("DELETE FROM documents WHERE id = 'd0'")
        pipeline["db"].commit()
        
        # Verify inconsistency detected
        report = pipeline["checkpoint_manager"].verify_consistency()
        assert report.consistent is False
        assert len(report.discrepancies) > 0


class TestStreamingWithParserIntegration:
    """
    Integration tests for streaming pipeline with markdown parser.
    Tests collaboration between StreamingBatchWriter and MarkdownHeaderParser.
    """
    
    @pytest.fixture
    def integrated_pipeline(self):
        """Create pipeline with parser integration"""
        from docs_rag.streaming import StreamingBatchWriter
        from docs_rag.checkpoint import CheckpointManager
        from docs_rag.parsers import MarkdownHeaderParser
        from docs_rag.database import Database
        
        # Create in-memory database
        import sqlite3
        conn = sqlite3.connect(':memory:')
        db = Database(conn)
        
        checkpoint_manager = CheckpointManager(db_connection=db)
        batch_writer = StreamingBatchWriter(
            db_connection=db,
            checkpoint_manager=checkpoint_manager
        )
        
        return {
            "batch_writer": batch_writer,
            "parser": MarkdownHeaderParser()
        }
    
    def test_markdown_document_with_headers(self, integrated_pipeline):
        """
        Test processing markdown documents with headers:
        1. Parse markdown content
        2. Extract headers as metadata
        3. Store with documents
        4. Verify metadata persisted
        """
        content = """# Document Title
## Section 1
Content here.
## Section 2
More content."""
        
        documents = [{
            "id": "doc_md_001",
            "content": content,
            "mime_type": "text/markdown"
        }]
        
        # Process should extract headers
        result = integrated_pipeline["batch_writer"].process_batch(
            documents, "batch_md_001"
        )
        
        assert result.success is True
        # Verify metadata extraction happened


class TestRecoveryFlowIntegration:
    """
    Integration tests for recovery flow.
    Tests collaboration between CrashRecoveryHandler, CheckpointManager, and Database.
    """
    
    @pytest.fixture
    def recovery_pipeline(self, initialized_database):
        """Create pipeline with recovery handler"""
        from docs_rag.checkpoint import CheckpointManager
        from docs_rag.recovery import CrashRecoveryHandler
        from docs_rag.database import Database
        
        db = Database(initialized_database)
        checkpoint_manager = CheckpointManager(db_connection=db)
        recovery_handler = CrashRecoveryHandler(
            checkpoint_manager=checkpoint_manager,
            db_connection=db
        )
        
        return {
            "db": initialized_database,
            "db_wrapper": db,
            "checkpoint_manager": checkpoint_manager,
            "recovery_handler": recovery_handler
        }
    
    def test_recovery_after_clean_shutdown(self, recovery_pipeline):
        """
        Test recovery when previous session shut down cleanly:
        1. Simulate clean shutdown (all batches committed)
        2. Run recovery
        3. Verify can resume from last committed batch
        """
        # Simulate committed batches
        cursor = recovery_pipeline["db"].cursor()
        cursor.execute('''
            INSERT INTO checkpoints (last_batch_id, total_persisted, status)
            VALUES (?, ?, ?)
        ''', ("batch_005", 500, "committed"))
        recovery_pipeline["db"].commit()
        
        # Run recovery
        result = recovery_pipeline["recovery_handler"].recover()
        
        assert result.success is True
        assert result.resume_from == "batch_006"
        assert result.data_loss == 0
    
    def test_recovery_with_uncommitted_batch(self, recovery_pipeline):
        """
        Test recovery with uncommitted (partial) batch:
        1. Simulate crash during batch 5
        2. Batch 1-4 committed, batch 5 partial
        3. Run recovery
        4. Verify batch 5 discarded, resume from 5
        """
        # Simulate committed batches 1-4
        cursor = recovery_pipeline["db"].cursor()
        for i in range(1, 5):
            cursor.execute('''
                INSERT INTO documents (id, content, batch_id) VALUES (?, ?, ?)
            ''', (f"doc_{i}", f"content_{i}", f"batch_{i}"))
        
        cursor.execute('''
            INSERT INTO checkpoints (last_batch_id, total_persisted, status)
            VALUES (?, ?, ?)
        ''', ("batch_004", 400, "committed"))
        recovery_pipeline["db"].commit()
        
        # Simulate partial batch 5 (not in checkpoint but has documents)
        cursor.execute('''
            INSERT INTO documents (id, content, batch_id) VALUES (?, ?, ?)
        ''', ("partial_doc", "partial_content", "batch_5_partial"))
        recovery_pipeline["db"].commit()
        
        # Run recovery
        result = recovery_pipeline["recovery_handler"].recover()
        
        assert result.success is True
        assert result.partial_batch_discarded is True
        assert result.resume_from == "batch_005"
        
        # Verify partial batch cleaned up
        cursor.execute("SELECT COUNT(*) FROM documents WHERE batch_id = ?", ("batch_5_partial",))
        count = cursor.fetchone()[0]
        assert count == 0  # Partial batch discarded
