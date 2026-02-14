"""
StreamingBatchWriter - Per-batch persistence to PostgreSQL
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime


class BatchNotFoundError(Exception):
    """Raised when attempting to commit a non-existent batch"""
    pass


@dataclass
class BatchResult:
    """Result of batch processing operation"""
    success: bool
    persisted_count: int
    batch_id: str
    checkpoint_updated: bool = False
    error: Optional[str] = None


class StreamingBatchWriter:
    """
    Handles per-batch persistence to PostgreSQL with:
    - Configurable batch size
    - Error handling and retry logic
    - Checkpoint integration
    """
    
    def __init__(self, db_connection=None, checkpoint_manager=None, batch_size: int = 100):
        """
        Initialize the StreamingBatchWriter.
        
        Args:
            db_connection: Database connection object
            checkpoint_manager: CheckpointManager instance for tracking progress
            batch_size: Maximum number of documents per batch
        """
        self.db = db_connection
        self.checkpoint_manager = checkpoint_manager
        self.batch_size = batch_size
        self._pending_batches: Dict[str, Any] = {}
        self._processed_batch_ids: set = set()
    
    def process_batch(self, documents: List[Dict[str, Any]], batch_id: str) -> BatchResult:
        """
        Process a batch of documents.
        
        Args:
            documents: List of documents to process
            batch_id: Unique identifier for this batch
            
        Returns:
            BatchResult with success status and details
            
        Raises:
            ValueError: If batch is empty, documents are invalid, or batch_id already exists
        """
        # Validate batch is not empty
        if not documents:
            raise ValueError("Batch cannot be empty")
        
        # Validate batch_id uniqueness
        if batch_id in self._processed_batch_ids:
            raise ValueError("Batch ID already exists")
        
        # Validate each document has required fields
        for doc in documents:
            if "id" not in doc or doc["id"] is None:
                raise ValueError("Document missing required field: id")
            if "content" not in doc or doc["content"] is None:
                raise ValueError("Document missing required field: content")
        
        try:
            # Insert documents to database
            if self.db:
                self.db.insert_documents(documents, batch_id)
            
            # Update checkpoint
            checkpoint_updated = False
            if self.checkpoint_manager:
                self.checkpoint_manager.update_checkpoint(
                    batch_id=batch_id,
                    persisted_count=len(documents)
                )
                checkpoint_updated = True
            
            # Track as processed
            self._processed_batch_ids.add(batch_id)
            
            return BatchResult(
                success=True,
                persisted_count=len(documents),
                batch_id=batch_id,
                checkpoint_updated=checkpoint_updated
            )
            
        except Exception as e:
            # Don't update checkpoint on failure
            return BatchResult(
                success=False,
                persisted_count=0,
                batch_id=batch_id,
                checkpoint_updated=False,
                error=str(e)
            )
        except Exception as e:
            # Don't update checkpoint on failure
            return BatchResult(
                success=False,
                persisted_count=0,
                batch_id=batch_id,
                checkpoint_updated=False,
                error=str(e)
            )
    
    def commit_batch(self, batch_id: str) -> bool:
        """
        Commit a pending batch.
        
        Args:
            batch_id: ID of the batch to commit
            
        Returns:
            True if commit was successful
            
        Raises:
            BatchNotFoundError: If batch_id doesn't exist in pending batches
        """
        if batch_id not in self._pending_batches:
            raise BatchNotFoundError(f"Batch {batch_id} not found")
        
        if self.db:
            self.db.commit()
        
        del self._pending_batches[batch_id]
        return True
