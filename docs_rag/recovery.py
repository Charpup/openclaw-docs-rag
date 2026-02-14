"""
CrashRecoveryHandler - Detect incomplete syncs and recover
"""
from dataclasses import dataclass
from typing import Optional, List

from docs_rag.checkpoint import CorruptCheckpointError


class DatabaseUnavailableError(Exception):
    """Raised when database is unavailable during recovery"""
    pass


@dataclass
class RecoveryResult:
    """Result of recovery operation"""
    success: bool
    recovered_batches: int = 0
    resume_from: Optional[str] = None
    data_loss: Optional[int] = None
    partial_batch_discarded: bool = False
    error: Optional[str] = None
    can_resume: bool = False


@dataclass
class IntegrityReport:
    """Report on data integrity after recovery"""
    success: bool
    integrity: str  # 'full', 'partial', 'corrupt'
    issues: List[str]


class CrashRecoveryHandler:
    """
    Handles crash recovery with:
    - Incomplete sync detection
    - DB state vs checkpoint validation
    - Automatic or manual recovery
    """
    
    def __init__(self, checkpoint_manager=None, db_connection=None):
        """
        Initialize the CrashRecoveryHandler.
        
        Args:
            checkpoint_manager: CheckpointManager instance
            db_connection: Database connection for state checks
        """
        self.checkpoint_manager = checkpoint_manager
        self.db = db_connection
    
    def recover(self) -> RecoveryResult:
        """
        Perform recovery from crash.
        
        Returns:
            RecoveryResult with recovery details
        """
        try:
            # Check database availability
            if self.db:
                try:
                    self.db.check_connection()
                except Exception as e:
                    return RecoveryResult(
                        success=False,
                        error=f"Database unavailable: {str(e)}",
                        data_loss=None
                    )
            
            # Get recovery point from checkpoint manager
            try:
                recovery_point = self.checkpoint_manager.get_recovery_point()
            except CorruptCheckpointError as e:
                return RecoveryResult(
                    success=False,
                    error=f"corrupt checkpoint: {str(e)}",
                    data_loss=None
                )
            
            # No checkpoint - fresh start
            if not recovery_point.can_resume:
                return RecoveryResult(
                    success=True,
                    recovered_batches=0,
                    resume_from=None,
                    data_loss=0,
                    can_resume=False
                )
            
            # Calculate recovered batches
            batch_count = 0
            if recovery_point.last_batch_id:
                try:
                    parts = recovery_point.last_batch_id.split('_')
                    if len(parts) == 2 and parts[1].isdigit():
                        batch_count = int(parts[1])
                except (ValueError, IndexError):
                    pass
            
            # Check for partial batch
            partial_batch_discarded = False
            if self.db and hasattr(self.db, 'has_partial_batch') and self.db.has_partial_batch():
                if hasattr(self.db, 'discard_partial_batch'):
                    self.db.discard_partial_batch()
                partial_batch_discarded = True
            
            return RecoveryResult(
                success=True,
                recovered_batches=batch_count,
                resume_from=recovery_point.resume_from,
                data_loss=0,
                partial_batch_discarded=partial_batch_discarded,
                can_resume=True
            )
            
        except Exception as e:
            return RecoveryResult(
                success=False,
                error=str(e),
                data_loss=None
            )
    
    def validate_integrity(self) -> IntegrityReport:
        """
        Validate data integrity after recovery.
        
        Returns:
            IntegrityReport with integrity details
        """
        try:
            if not self.checkpoint_manager:
                return IntegrityReport(
                    success=True,
                    integrity="full",
                    issues=[]
                )
            
            # Verify consistency between checkpoint and DB
            consistency = self.checkpoint_manager.verify_consistency()
            
            if consistency.consistent:
                return IntegrityReport(
                    success=True,
                    integrity="full",
                    issues=[]
                )
            else:
                return IntegrityReport(
                    success=True,
                    integrity="partial",
                    issues=consistency.discrepancies
                )
                
        except Exception as e:
            return IntegrityReport(
                success=False,
                integrity="corrupt",
                issues=[str(e)]
            )
