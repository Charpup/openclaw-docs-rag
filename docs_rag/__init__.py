"""
docs_rag - OpenClaw Documentation RAG System
v3.0 - Streaming, Checkpointing, and Recovery
"""

from .streaming import StreamingBatchWriter, BatchResult, BatchNotFoundError
from .parsers import MarkdownHeaderParser, HeaderNode
from .checkpoint import (
    CheckpointManager, 
    Checkpoint, 
    RecoveryPoint, 
    ConsistencyReport,
    CorruptCheckpointError,
    ConflictError
)
from .recovery import (
    CrashRecoveryHandler,
    RecoveryResult,
    IntegrityReport
)
from .database import Database

__all__ = [
    # Streaming
    'StreamingBatchWriter',
    'BatchResult',
    'BatchNotFoundError',
    # Parsers
    'MarkdownHeaderParser',
    'HeaderNode',
    # Checkpoint
    'CheckpointManager',
    'Checkpoint',
    'RecoveryPoint',
    'ConsistencyReport',
    'CorruptCheckpointError',
    'ConflictError',
    # Recovery
    'CrashRecoveryHandler',
    'RecoveryResult',
    'IntegrityReport',
    # Database
    'Database',
]
