"""
Unit tests for CheckpointManager
TDD Level: Interface Contract Tests for DB state tracking
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from docs_rag.checkpoint import CorruptCheckpointError, ConflictError


class TestCheckpointManager:
    """Test suite for CheckpointManager - DB state tracking tests"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database connection"""
        db = Mock()
        db.get_document_count.return_value = 100
        return db
    
    @pytest.fixture
    def checkpoint_manager(self, mock_db):
        """Create CheckpointManager instance"""
        # Import will fail initially (RED phase)
        from docs_rag.checkpoint import CheckpointManager
        return CheckpointManager(db_connection=mock_db)
    
    # =========================================================================
    # Test Case CPM-001: Update after successful batch
    # =========================================================================
    def test_update_checkpoint_success(self, checkpoint_manager, mock_db):
        """CPM-001: Update checkpoint after successful batch persistence"""
        # Arrange
        batch_id = "batch_001"
        persisted_count = 100
        metadata = {"timestamp": "2026-02-14T10:00:00Z"}
        
        # Act
        checkpoint = checkpoint_manager.update_checkpoint(
            batch_id, persisted_count, metadata
        )
        
        # Assert
        assert checkpoint.last_batch_id == "batch_001"
        assert checkpoint.total_persisted == 100
        assert checkpoint.status == "committed"
        mock_db.save_checkpoint.assert_called_once()
    
    # =========================================================================
    # Test Case CPM-002: Checkpoint tracks actual DB state
    # =========================================================================
    def test_checkpoint_tracks_actual_db_state(self, checkpoint_manager, mock_db):
        """CPM-002: Checkpoint should reflect actual database document count"""
        # Arrange
        batch_id = "batch_002"
        persisted_count = 50
        mock_db.get_document_count.return_value = 50
        
        # Act
        checkpoint = checkpoint_manager.update_checkpoint(
            batch_id, persisted_count, verify_db_state=True
        )
        
        # Assert
        mock_db.get_document_count.assert_called_once()
        assert checkpoint.db_count_matches is True
    
    # =========================================================================
    # Test Case CPM-003: Get valid recovery point
    # =========================================================================
    def test_get_recovery_point_valid(self, checkpoint_manager, mock_db):
        """CPM-003: Get recovery point when checkpoint exists"""
        # Arrange
        mock_db.get_latest_checkpoint.return_value = {
            "last_batch_id": "batch_005",
            "total_persisted": 500
        }
        
        # Act
        recovery_point = checkpoint_manager.get_recovery_point()
        
        # Assert
        assert recovery_point.last_batch_id == "batch_005"
        assert recovery_point.total_persisted == 500
        assert recovery_point.can_resume is True
    
    # =========================================================================
    # Test Case CPM-004: No checkpoint exists
    # =========================================================================
    def test_get_recovery_point_none_exists(self, checkpoint_manager, mock_db):
        """CPM-004: Handle case when no checkpoint exists"""
        # Arrange
        mock_db.get_latest_checkpoint.return_value = None
        
        # Act
        recovery_point = checkpoint_manager.get_recovery_point()
        
        # Assert
        assert recovery_point.last_batch_id is None
        assert recovery_point.total_persisted == 0
        assert recovery_point.can_resume is False
    
    # =========================================================================
    # Test Case CPM-005: Consistent state verified
    # =========================================================================
    def test_verify_consistency_pass(self, checkpoint_manager, mock_db):
        """CPM-005: Verify checkpoint matches DB state"""
        # Arrange
        mock_db.get_latest_checkpoint.return_value = {
            "total_persisted": 100
        }
        mock_db.get_document_count.return_value = 100
        
        # Act
        report = checkpoint_manager.verify_consistency()
        
        # Assert
        assert report.consistent is True
        assert report.discrepancies == []
    
    # =========================================================================
    # Test Case CPM-006: Inconsistent state detected
    # =========================================================================
    def test_verify_consistency_fail(self, checkpoint_manager, mock_db):
        """CPM-006: Detect when checkpoint doesn't match DB state"""
        # Arrange
        mock_db.get_latest_checkpoint.return_value = {
            "total_persisted": 100
        }
        mock_db.get_document_count.return_value = 95
        
        # Act
        report = checkpoint_manager.verify_consistency()
        
        # Assert
        assert report.consistent is False
        assert len(report.discrepancies) > 0
        assert "checkpoint: 100, db: 95" in report.discrepancies[0]
    
    # =========================================================================
    # Additional Edge Cases
    # =========================================================================
    def test_update_checkpoint_negative_count(self, checkpoint_manager):
        """Negative persisted count should be rejected"""
        with pytest.raises(ValueError, match="persisted_count must be non-negative"):
            checkpoint_manager.update_checkpoint("batch_001", -1)
    
    def test_update_checkpoint_zero_count(self, checkpoint_manager, mock_db):
        """Zero count should be valid (empty batch edge case)"""
        checkpoint = checkpoint_manager.update_checkpoint("batch_001", 0)
        assert checkpoint.total_persisted == 0
    
    def test_recovery_point_with_corrupt_checkpoint(self, checkpoint_manager, mock_db):
        """Handle corrupt checkpoint data gracefully"""
        mock_db.get_latest_checkpoint.return_value = {
            # Missing required fields
        }
        
        from docs_rag.checkpoint import CorruptCheckpointError
        with pytest.raises(CorruptCheckpointError):
            checkpoint_manager.get_recovery_point()
    
    def test_concurrent_checkpoint_updates(self, checkpoint_manager, mock_db):
        """Handle concurrent checkpoint updates safely"""
        from docs_rag.checkpoint import ConflictError
        mock_db.save_checkpoint.side_effect = [
            None,  # First call succeeds
            ConflictError("Concurrent update detected")
        ]
        
        # First update succeeds
        checkpoint_manager.update_checkpoint("batch_001", 100)
        
        # Second update fails due to conflict
        with pytest.raises(ConflictError):
            checkpoint_manager.update_checkpoint("batch_002", 200)


class TestCheckpoint:
    """Tests for Checkpoint data structure"""
    
    def test_checkpoint_creation(self):
        """Test Checkpoint can be created with all fields"""
        from docs_rag.checkpoint import Checkpoint
        
        checkpoint = Checkpoint(
            last_batch_id="batch_001",
            total_persisted=100,
            status="committed",
            timestamp=datetime.now()
        )
        
        assert checkpoint.last_batch_id == "batch_001"
        assert checkpoint.total_persisted == 100
        assert checkpoint.status == "committed"
    
    def test_checkpoint_serialization(self):
        """Test Checkpoint can be serialized to dict"""
        from docs_rag.checkpoint import Checkpoint
        
        checkpoint = Checkpoint(
            last_batch_id="batch_001",
            total_persisted=100,
            status="committed"
        )
        
        data = checkpoint.to_dict()
        
        assert data["last_batch_id"] == "batch_001"
        assert data["total_persisted"] == 100
        assert data["status"] == "committed"
    
    def test_checkpoint_deserialization(self):
        """Test Checkpoint can be deserialized from dict"""
        from docs_rag.checkpoint import Checkpoint
        
        data = {
            "last_batch_id": "batch_002",
            "total_persisted": 200,
            "status": "pending"
        }
        
        checkpoint = Checkpoint.from_dict(data)
        
        assert checkpoint.last_batch_id == "batch_002"
        assert checkpoint.total_persisted == 200
        assert checkpoint.status == "pending"


class TestRecoveryPoint:
    """Tests for RecoveryPoint data structure"""
    
    def test_recovery_point_can_resume(self):
        """Test can_resume logic for valid recovery point"""
        from docs_rag.checkpoint import RecoveryPoint
        
        point = RecoveryPoint(
            last_batch_id="batch_010",
            total_persisted=1000
        )
        
        assert point.can_resume is True
    
    def test_recovery_point_cannot_resume(self):
        """Test can_resume logic for invalid recovery point"""
        from docs_rag.checkpoint import RecoveryPoint
        
        point = RecoveryPoint(
            last_batch_id=None,
            total_persisted=0
        )
        
        assert point.can_resume is False
    
    def test_recovery_point_resume_batch(self):
        """Test getting next batch to resume from"""
        from docs_rag.checkpoint import RecoveryPoint
        
        point = RecoveryPoint(
            last_batch_id="batch_005",
            total_persisted=500
        )
        
        assert point.resume_from == "batch_006"


class TestConsistencyReport:
    """Tests for ConsistencyReport data structure"""
    
    def test_consistency_report_pass(self):
        """Test consistent report creation"""
        from docs_rag.checkpoint import ConsistencyReport
        
        report = ConsistencyReport(
            consistent=True,
            discrepancies=[]
        )
        
        assert report.consistent is True
        assert report.discrepancies == []
    
    def test_consistency_report_fail(self):
        """Test inconsistent report with discrepancies"""
        from docs_rag.checkpoint import ConsistencyReport
        
        report = ConsistencyReport(
            consistent=False,
            discrepancies=["checkpoint: 100, db: 95"]
        )
        
        assert report.consistent is False
        assert len(report.discrepancies) == 1
