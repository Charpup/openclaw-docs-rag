"""
Mock implementations for testing docs-rag v3.0
Use these before real implementations exist (RED phase)
"""
from unittest.mock import Mock, MagicMock
from types import SimpleNamespace


class MockDatabase:
    """Mock database connection for testing"""
    
    def __init__(self):
        self.documents = {}
        self.checkpoints = []
        self.transactions = []
        self._should_fail = False
        self._failure_point = None
    
    def insert_documents(self, documents, batch_id):
        """Mock document insertion"""
        if self._should_fail and self._failure_point == 'insert':
            raise Exception("DatabaseError: Insert failed")
        
        for doc in documents:
            self.documents[doc['id']] = {
                **doc,
                'batch_id': batch_id
            }
        return len(documents)
    
    def commit(self):
        """Mock transaction commit"""
        if self._should_fail and self._failure_point == 'commit':
            raise Exception("DatabaseError: Commit failed")
        self.transactions.append('committed')
    
    def rollback(self):
        """Mock transaction rollback"""
        self.transactions.append('rolled_back')
    
    def get_document_count(self):
        """Get count of stored documents"""
        return len(self.documents)
    
    def save_checkpoint(self, checkpoint):
        """Save checkpoint to mock storage"""
        self.checkpoints.append(checkpoint)
    
    def get_latest_checkpoint(self):
        """Get latest checkpoint"""
        return self.checkpoints[-1] if self.checkpoints else None
    
    def set_failure(self, point):
        """Configure mock to fail at specific point"""
        self._should_fail = True
        self._failure_point = point
    
    def clear_failure(self):
        """Clear failure configuration"""
        self._should_fail = False
        self._failure_point = None


class MockCheckpointManager:
    """Mock checkpoint manager for testing"""
    
    def __init__(self):
        self.checkpoints = []
        self._consistency = True
    
    def update_checkpoint(self, batch_id, persisted_count, metadata=None):
        """Mock checkpoint update"""
        checkpoint = SimpleNamespace(
            last_batch_id=batch_id,
            total_persisted=persisted_count,
            status='committed',
            db_count_matches=True
        )
        self.checkpoints.append(checkpoint)
        return checkpoint
    
    def get_recovery_point(self):
        """Mock recovery point retrieval"""
        if not self.checkpoints:
            return SimpleNamespace(
                last_batch_id=None,
                total_persisted=0,
                can_resume=False
            )
        latest = self.checkpoints[-1]
        return SimpleNamespace(
            last_batch_id=latest.last_batch_id,
            total_persisted=latest.total_persisted,
            can_resume=True,
            resume_from=self._next_batch_id(latest.last_batch_id)
        )
    
    def verify_consistency(self):
        """Mock consistency verification"""
        return SimpleNamespace(
            consistent=self._consistency,
            discrepancies=[] if self._consistency else ["checkpoint: 100, db: 95"]
        )
    
    def set_consistency(self, consistent):
        """Set consistency state for testing"""
        self._consistency = consistent
    
    def _next_batch_id(self, batch_id):
        """Calculate next batch ID"""
        if not batch_id:
            return "batch_001"
        num = int(batch_id.split('_')[1]) + 1
        return f"batch_{num:03d}"


class MockMarkdownParser:
    """Mock markdown parser for testing"""
    
    def __init__(self):
        self.supported_mime_types = ["text/markdown", "text/plain"]
    
    def can_parse(self, content):
        """Check if content can be parsed"""
        return True
    
    def parse_headers(self, content):
        """Mock header parsing"""
        # Simple mock implementation
        headers = []
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('#'):
                level = len(line) - len(line.lstrip('#'))
                text = line.lstrip('#').strip()
                
                # Extract anchor if present
                anchor = None
                if '{#' in text:
                    parts = text.split('{#')
                    text = parts[0].strip()
                    anchor = parts[1].rstrip('}')
                
                headers.append(SimpleNamespace(
                    level=level,
                    text=text,
                    anchor=anchor,
                    has_link='[' in text and '](' in text
                ))
        return headers
    
    def extract_header_metadata(self, content):
        """Mock metadata extraction"""
        headers = self.parse_headers(content)
        
        title = None
        sections = []
        
        for h in headers:
            if h.level == 1 and not title:
                title = h.text
            elif h.level == 2:
                sections.append(h.text)
        
        return {
            "title": title,
            "sections": sections
        }


class MockRecoveryHandler:
    """Mock recovery handler for testing"""
    
    def __init__(self, checkpoint_manager, db_connection):
        self.checkpoint_manager = checkpoint_manager
        self.db = db_connection
        self._should_fail = False
    
    def recover(self):
        """Mock recovery process"""
        if self._should_fail:
            return SimpleNamespace(
                success=False,
                error="Recovery failed",
                data_loss=None
            )
        
        recovery_point = self.checkpoint_manager.get_recovery_point()
        
        if not recovery_point.can_resume:
            return SimpleNamespace(
                success=True,
                recovered_batches=0,
                resume_from=None,
                data_loss=0
            )
        
        # Mock recovered batches calculation
        batch_num = int(recovery_point.last_batch_id.split('_')[1])
        
        return SimpleNamespace(
            success=True,
            recovered_batches=batch_num,
            resume_from=recovery_point.resume_from,
            data_loss=0,
            partial_batch_discarded=False
        )
    
    def validate_integrity(self):
        """Mock integrity validation"""
        return SimpleNamespace(
            success=True,
            integrity="full",
            issues=[]
        )
    
    def set_failure(self, should_fail=True):
        """Configure mock to fail"""
        self._should_fail = should_fail


def create_mock_streaming_pipeline():
    """
    Factory function to create a fully mocked streaming pipeline.
    Useful for testing without real dependencies.
    """
    db = MockDatabase()
    checkpoint_manager = MockCheckpointManager()
    
    # Create a mock batch writer
    batch_writer = Mock()
    batch_writer.process_batch = Mock(return_value=SimpleNamespace(
        success=True,
        persisted_count=100,
        batch_id="mock_batch",
        checkpoint_updated=True
    ))
    batch_writer.commit_batch = Mock(return_value=True)
    
    return {
        "db": db,
        "checkpoint_manager": checkpoint_manager,
        "batch_writer": batch_writer
    }
