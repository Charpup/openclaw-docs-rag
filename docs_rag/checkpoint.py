"""
CheckpointManager - Track DB-persisted chunk IDs with DB state awareness
"""
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from datetime import datetime


class CorruptCheckpointError(Exception):
    """Raised when checkpoint data is corrupt or invalid"""
    pass


class ConflictError(Exception):
    """Raised when concurrent update conflict detected"""
    pass


@dataclass
class Checkpoint:
    """Represents a checkpoint state"""
    last_batch_id: str
    total_persisted: int
    status: str  # 'committed', 'pending', etc.
    timestamp: datetime = field(default_factory=datetime.now)
    db_count_matches: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize checkpoint to dictionary"""
        return {
            "last_batch_id": self.last_batch_id,
            "total_persisted": self.total_persisted,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
            "db_count_matches": self.db_count_matches
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Checkpoint':
        """Deserialize checkpoint from dictionary"""
        timestamp = data.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        elif timestamp is None:
            timestamp = datetime.now()
            
        return cls(
            last_batch_id=data["last_batch_id"],
            total_persisted=data["total_persisted"],
            status=data["status"],
            timestamp=timestamp,
            db_count_matches=data.get("db_count_matches", False)
        )


@dataclass
class RecoveryPoint:
    """Represents a point to resume from"""
    last_batch_id: Optional[str]
    total_persisted: int
    can_resume: bool = None
    
    def __post_init__(self):
        if self.can_resume is None:
            self.can_resume = self.last_batch_id is not None
    
    @property
    def resume_from(self) -> Optional[str]:
        """Get the next batch ID to resume from"""
        if not self.last_batch_id:
            return None
        # Parse batch_001 format
        try:
            parts = self.last_batch_id.split('_')
            if len(parts) == 2 and parts[1].isdigit():
                next_num = int(parts[1]) + 1
                return f"batch_{next_num:03d}"
        except (ValueError, IndexError):
            pass
        return None


@dataclass
class ConsistencyReport:
    """Report on checkpoint vs DB consistency"""
    consistent: bool
    discrepancies: List[str]


class CheckpointManager:
    """
    Manages checkpoints with:
    - DB-persisted chunk ID tracking
    - DB state awareness
    - JSON checkpoint file with atomic writes
    - Resume from any batch
    """
    
    def __init__(self, db_connection=None, checkpoint_file: Optional[str] = None):
        """
        Initialize the CheckpointManager.
        
        Args:
            db_connection: Database connection for state verification
            checkpoint_file: Path to checkpoint file (optional)
        """
        self.db = db_connection
        self.checkpoint_file = checkpoint_file
        self._checkpoints: List[Checkpoint] = []
    
    def update_checkpoint(
        self, 
        batch_id: str, 
        persisted_count: int, 
        metadata: Optional[Dict[str, Any]] = None,
        verify_db_state: bool = False
    ) -> Checkpoint:
        """
        Update checkpoint after successful batch persistence.
        
        Args:
            batch_id: ID of the processed batch
            persisted_count: Number of documents persisted in this batch
            metadata: Optional metadata to store
            verify_db_state: Whether to verify against actual DB state
            
        Returns:
            Updated Checkpoint object
            
        Raises:
            ValueError: If persisted_count is negative
            ConflictError: If concurrent update conflict detected
        """
        if persisted_count < 0:
            raise ValueError("persisted_count must be non-negative")
        
        # Calculate cumulative count
        cumulative_count = persisted_count
        if self._checkpoints:
            cumulative_count += self._checkpoints[-1].total_persisted
        elif self.db:
            # Try to get count from latest checkpoint in DB
            latest = self.db.get_latest_checkpoint()
            if latest:
                prev_count = latest.get("total_persisted", 0)
                # Handle case where prev_count is not an int (e.g., Mock in tests)
                if isinstance(prev_count, int):
                    cumulative_count += prev_count
        
        # Verify against DB state if requested
        db_count_matches = False
        if verify_db_state and self.db:
            actual_count = self.db.get_document_count()
            db_count_matches = (actual_count == cumulative_count)
        
        checkpoint = Checkpoint(
            last_batch_id=batch_id,
            total_persisted=cumulative_count,
            status="committed",
            db_count_matches=db_count_matches
        )
        
        self._checkpoints.append(checkpoint)
        
        # Persist to database if available
        if self.db:
            try:
                self.db.save_checkpoint(checkpoint.to_dict())
            except Exception as e:
                if "concurrent" in str(e).lower() or "conflict" in str(e).lower():
                    raise ConflictError("Concurrent update detected") from e
                raise
        
        # Persist to file if path provided
        if self.checkpoint_file:
            self._write_checkpoint_file(checkpoint)
        
        return checkpoint
    
    def get_recovery_point(self) -> RecoveryPoint:
        """
        Get the current recovery point.
        
        Returns:
            RecoveryPoint with resume information
            
        Raises:
            CorruptCheckpointError: If checkpoint data is invalid
        """
        # Try database first
        latest = None
        if self.db:
            latest = self.db.get_latest_checkpoint()
        
        # Fall back to in-memory checkpoints
        if latest is None and self._checkpoints:
            latest = self._checkpoints[-1].to_dict()
        
        if latest is None:
            return RecoveryPoint(
                last_batch_id=None,
                total_persisted=0,
                can_resume=False
            )
        
        # Validate checkpoint data
        if not isinstance(latest, dict):
            raise CorruptCheckpointError("Checkpoint data is not a dictionary")
        
        required_fields = ["last_batch_id", "total_persisted"]
        for field in required_fields:
            if field not in latest:
                raise CorruptCheckpointError(f"Checkpoint missing required field: {field}")
        
        # Validate total_persisted is non-negative
        if latest.get("total_persisted", 0) < 0:
            raise CorruptCheckpointError("Checkpoint has negative total_persisted")
        
        can_resume = latest.get("last_batch_id") is not None
        
        return RecoveryPoint(
            last_batch_id=latest.get("last_batch_id"),
            total_persisted=latest.get("total_persisted", 0),
            can_resume=can_resume
        )
    
    def verify_consistency(self) -> ConsistencyReport:
        """
        Verify that checkpoint matches actual database state.
        
        Returns:
            ConsistencyReport indicating if states match
        """
        if not self.db:
            return ConsistencyReport(consistent=True, discrepancies=[])
        
        # Get latest checkpoint from DB
        cp_data = self.db.get_latest_checkpoint()
        
        if not cp_data:
            return ConsistencyReport(consistent=True, discrepancies=[])
        
        # Compare with actual DB count
        actual_count = self.db.get_document_count()
        expected_count = cp_data.get("total_persisted", 0)
        
        if actual_count == expected_count:
            return ConsistencyReport(consistent=True, discrepancies=[])
        else:
            missing_count = expected_count - actual_count
            if missing_count > 0:
                message = f"missing {missing_count} documents (checkpoint: {expected_count}, db: {actual_count})"
            else:
                message = f"extra {-missing_count} documents (checkpoint: {expected_count}, db: {actual_count})"
            return ConsistencyReport(
                consistent=False,
                discrepancies=[message]
            )
    
    def _write_checkpoint_file(self, checkpoint: Checkpoint):
        """Write checkpoint to file atomically"""
        import json
        import os
        import tempfile
        
        if not self.checkpoint_file:
            return
        
        # Write to temp file first for atomicity
        temp_path = self.checkpoint_file + ".tmp"
        with open(temp_path, 'w') as f:
            json.dump(checkpoint.to_dict(), f, indent=2)
        
        # Atomic rename
        os.rename(temp_path, self.checkpoint_file)
