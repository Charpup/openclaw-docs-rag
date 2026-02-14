"""
Unit tests for StreamingBatchWriter
TDD Level: Interface Contract Tests
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from docs_rag.streaming import BatchNotFoundError


class TestStreamingBatchWriter:
    """Test suite for StreamingBatchWriter - per-batch persistence tests"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database connection"""
        return Mock()
    
    @pytest.fixture
    def mock_checkpoint_manager(self):
        """Mock checkpoint manager"""
        cm = Mock()
        cm.update_checkpoint.return_value = Mock(
            last_batch_id="batch_001",
            total_persisted=2,
            status="committed"
        )
        return cm
    
    @pytest.fixture
    def batch_writer(self, mock_db, mock_checkpoint_manager):
        """Create StreamingBatchWriter instance with mocked dependencies"""
        # Import will fail initially (RED phase)
        from docs_rag.streaming import StreamingBatchWriter
        return StreamingBatchWriter(
            db_connection=mock_db,
            checkpoint_manager=mock_checkpoint_manager
        )
    
    # =========================================================================
    # Test Case SBW-001: Valid batch processing
    # =========================================================================
    def test_process_batch_valid(self, batch_writer, mock_db, mock_checkpoint_manager):
        """SBW-001: Process a valid batch with documents"""
        # Arrange
        documents = [
            {"id": "doc1", "content": "test"},
            {"id": "doc2", "content": "test2"}
        ]
        batch_id = "batch_001"
        
        # Act
        result = batch_writer.process_batch(documents, batch_id)
        
        # Assert
        assert result.success is True
        assert result.persisted_count == 2
        mock_db.insert_documents.assert_called_once()
        mock_checkpoint_manager.update_checkpoint.assert_called_once()
    
    # =========================================================================
    # Test Case SBW-002: Empty batch rejection
    # =========================================================================
    def test_process_batch_empty_rejection(self, batch_writer):
        """SBW-002: Empty batch should be rejected with ValueError"""
        # Arrange
        documents = []
        batch_id = "batch_002"
        
        # Act & Assert
        with pytest.raises(ValueError, match="Batch cannot be empty"):
            batch_writer.process_batch(documents, batch_id)
    
    # =========================================================================
    # Test Case SBW-003: Database failure recovery
    # =========================================================================
    def test_process_batch_db_failure(self, batch_writer, mock_db, mock_checkpoint_manager):
        """SBW-003: Database failure should not update checkpoint"""
        # Arrange
        documents = [{"id": "doc3", "content": "test"}]
        batch_id = "batch_003"
        mock_db.insert_documents.side_effect = Exception("DatabaseError")
        
        # Act
        result = batch_writer.process_batch(documents, batch_id)
        
        # Assert
        assert result.success is False
        assert "DatabaseError" in str(result.error)
        mock_checkpoint_manager.update_checkpoint.assert_not_called()
    
    # =========================================================================
    # Test Case SBW-004: Successful commit
    # =========================================================================
    def test_commit_batch_success(self, batch_writer, mock_db):
        """SBW-004: Successfully commit a pending batch"""
        # Arrange
        batch_id = "batch_001"
        batch_writer._pending_batches[batch_id] = Mock()
        
        # Act
        result = batch_writer.commit_batch(batch_id)
        
        # Assert
        assert result is True
        mock_db.commit.assert_called_once()
    
    # =========================================================================
    # Test Case SBW-005: Commit non-existent batch
    # =========================================================================
    def test_commit_batch_not_found(self, batch_writer):
        """SBW-005: Committing non-existent batch raises BatchNotFoundError"""
        from docs_rag.streaming import BatchNotFoundError
        # Arrange
        batch_id = "batch_999"
        
        # Act & Assert
        with pytest.raises(BatchNotFoundError):
            batch_writer.commit_batch(batch_id)


class TestBatchResult:
    """Tests for BatchResult data structure"""
    
    def test_batch_result_creation(self):
        """Test BatchResult can be created with all fields"""
        from docs_rag.streaming import BatchResult
        
        result = BatchResult(
            success=True,
            persisted_count=10,
            batch_id="batch_001",
            checkpoint_updated=True
        )
        
        assert result.success is True
        assert result.persisted_count == 10
        assert result.batch_id == "batch_001"
        assert result.checkpoint_updated is True
    
    def test_batch_result_failure(self):
        """Test BatchResult for failure case"""
        from docs_rag.streaming import BatchResult
        
        result = BatchResult(
            success=False,
            persisted_count=0,
            batch_id="batch_002",
            error="DatabaseError: connection lost"
        )
        
        assert result.success is False
        assert result.persisted_count == 0
        assert "DatabaseError" in str(result.error)


class TestDocumentValidation:
    """Tests for document validation within batches"""
    
    @pytest.fixture
    def batch_writer(self, mock_db, mock_checkpoint_manager):
        """Create StreamingBatchWriter instance with mocked dependencies"""
        from docs_rag.streaming import StreamingBatchWriter
        return StreamingBatchWriter(
            db_connection=mock_db,
            checkpoint_manager=mock_checkpoint_manager
        )
    
    def test_document_requires_id(self, batch_writer):
        """Documents must have an ID field"""
        documents = [{"content": "no id"}]
        
        with pytest.raises(ValueError, match="Document missing required field: id"):
            batch_writer.process_batch(documents, "batch_001")
    
    def test_document_requires_content(self, batch_writer):
        """Documents must have a content field"""
        documents = [{"id": "doc1"}]
        
        with pytest.raises(ValueError, match="Document missing required field: content"):
            batch_writer.process_batch(documents, "batch_001")
    
    def test_batch_id_uniqueness(self, batch_writer):
        """Batch IDs must be unique within session"""
        documents = [{"id": "doc1", "content": "test"}]
        batch_writer.process_batch(documents, "batch_001")
        
        with pytest.raises(ValueError, match="Batch ID already exists"):
            batch_writer.process_batch(documents, "batch_001")
