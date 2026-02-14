"""
Database wrapper for SQLite operations
Provides interface expected by CheckpointManager, StreamingBatchWriter, and CrashRecoveryHandler
"""
import sqlite3
import json
from typing import List, Dict, Any, Optional


class Database:
    """
    SQLite database wrapper providing interface for docs-rag operations.
    """
    
    def __init__(self, connection: sqlite3.Connection):
        """
        Initialize with SQLite connection.
        
        Args:
            connection: SQLite database connection
        """
        self.conn = connection
        self.cursor = connection.cursor()
        self._ensure_tables()
    
    def _ensure_tables(self):
        """Ensure required tables exist."""
        # Documents table with full schema for markdown support
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
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
        
        # Checkpoints table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS checkpoints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                last_batch_id TEXT,
                total_persisted INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Recovery log table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS recovery_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation TEXT NOT NULL,
                batch_id TEXT,
                status TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.conn.commit()
    
    def check_connection(self) -> bool:
        """Verify database connection is active."""
        try:
            self.cursor.execute("SELECT 1")
            return True
        except sqlite3.Error:
            return False
    
    def insert_documents(self, documents: List[Dict[str, Any]], batch_id: str):
        """
        Insert documents into database.
        
        Args:
            documents: List of documents to insert
            batch_id: Batch identifier
            
        Raises:
            sqlite3.IntegrityError: If document ID already exists
        """
        for doc in documents:
            # Handle fields that may already be JSON strings or Python objects
            headers = doc.get('headers')
            if headers is not None and not isinstance(headers, str):
                headers = json.dumps(headers)
                
            title = doc.get('title')
            
            sections = doc.get('sections')
            if sections is not None and not isinstance(sections, str):
                sections = json.dumps(sections)
                
            metadata = doc.get('metadata')
            if metadata is not None and not isinstance(metadata, str):
                metadata = json.dumps(metadata)
            
            self.cursor.execute('''
                INSERT INTO documents (id, content, batch_id, headers, title, sections, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                doc['id'],
                doc['content'],
                batch_id,
                headers,
                title,
                sections,
                metadata
            ))
        self.conn.commit()
    
    def commit(self):
        """Commit pending transactions."""
        self.conn.commit()
    
    def get_latest_checkpoint(self) -> Optional[Dict[str, Any]]:
        """
        Get the latest checkpoint from database.
        
        Returns:
            Checkpoint data as dictionary, or None if no checkpoints exist
        """
        self.cursor.execute('''
            SELECT last_batch_id, total_persisted, status, timestamp
            FROM checkpoints
            ORDER BY id DESC
            LIMIT 1
        ''')
        row = self.cursor.fetchone()
        
        if row is None:
            return None
        
        return {
            'last_batch_id': row[0],
            'total_persisted': row[1],
            'status': row[2],
            'timestamp': row[3]
        }
    
    def save_checkpoint(self, checkpoint_data: Dict[str, Any]):
        """
        Save checkpoint to database.
        
        Args:
            checkpoint_data: Checkpoint data to save
        """
        self.cursor.execute('''
            INSERT INTO checkpoints (last_batch_id, total_persisted, status)
            VALUES (?, ?, ?)
        ''', (
            checkpoint_data['last_batch_id'],
            checkpoint_data['total_persisted'],
            checkpoint_data['status']
        ))
        self.conn.commit()
    
    def get_document_count(self) -> int:
        """
        Get total count of documents in database.
        
        Returns:
            Number of documents
        """
        self.cursor.execute('SELECT COUNT(*) FROM documents')
        row = self.cursor.fetchone()
        return row[0] if row else 0
    
    def has_partial_batch(self) -> bool:
        """
        Check if there are documents without a committed checkpoint.
        
        Returns:
            True if partial batch exists
        """
        # Get all batch_ids from documents
        self.cursor.execute('SELECT DISTINCT batch_id FROM documents')
        doc_batches = {row[0] for row in self.cursor.fetchall()}
        
        # Get the latest checkpoint
        latest = self.get_latest_checkpoint()
        if not latest:
            # No checkpoint means any document is partial
            return len(doc_batches) > 0
        
        # Parse the latest batch number
        last_batch_id = latest.get('last_batch_id', '')
        try:
            parts = last_batch_id.split('_')
            if len(parts) == 2 and parts[1].isdigit():
                last_batch_num = int(parts[1])
            else:
                last_batch_num = 0
        except (ValueError, IndexError):
            last_batch_num = 0
        
        # Check if any document batch is beyond the committed checkpoint
        for batch_id in doc_batches:
            try:
                # Handle partial batch names like "batch_006_partial"
                base_id = batch_id.split('_partial')[0]
                parts = base_id.split('_')
                if len(parts) == 2 and parts[1].isdigit():
                    batch_num = int(parts[1])
                    if batch_num > last_batch_num:
                        return True
            except (ValueError, IndexError):
                # Unknown batch format, treat as partial
                if batch_id != last_batch_id:
                    return True
        
        return False
    
    def discard_partial_batch(self):
        """Remove documents from partial batches."""
        # Get the latest checkpoint
        latest = self.get_latest_checkpoint()
        if not latest:
            # No checkpoint, delete all documents
            self.cursor.execute('DELETE FROM documents')
            self.conn.commit()
            return
        
        # Parse the latest batch number
        last_batch_id = latest.get('last_batch_id', '')
        try:
            parts = last_batch_id.split('_')
            if len(parts) == 2 and parts[1].isdigit():
                last_batch_num = int(parts[1])
            else:
                last_batch_num = 0
        except (ValueError, IndexError):
            last_batch_num = 0
        
        # Get all batch_ids from documents
        self.cursor.execute('SELECT DISTINCT batch_id FROM documents')
        doc_batches = {row[0] for row in self.cursor.fetchall()}
        
        # Delete documents from partial batches (batches beyond the checkpoint)
        for batch_id in doc_batches:
            try:
                # Handle partial batch names
                base_id = batch_id.split('_partial')[0]
                parts = base_id.split('_')
                if len(parts) == 2 and parts[1].isdigit():
                    batch_num = int(parts[1])
                    if batch_num > last_batch_num:
                        self.cursor.execute('DELETE FROM documents WHERE batch_id = ?', (batch_id,))
                elif batch_id != last_batch_id:
                    # Unknown format, treat as partial
                    self.cursor.execute('DELETE FROM documents WHERE batch_id = ?', (batch_id,))
            except (ValueError, IndexError):
                if batch_id != last_batch_id:
                    self.cursor.execute('DELETE FROM documents WHERE batch_id = ?', (batch_id,))
        
        self.conn.commit()
    
    def get_documents_by_batch(self, batch_id: str) -> List[Dict[str, Any]]:
        """
        Get documents by batch ID.
        
        Args:
            batch_id: Batch identifier
            
        Returns:
            List of documents
        """
        self.cursor.execute('''
            SELECT id, content, batch_id, headers, metadata
            FROM documents
            WHERE batch_id = ?
        ''', (batch_id,))
        
        documents = []
        for row in self.cursor.fetchall():
            doc = {
                'id': row[0],
                'content': row[1],
                'batch_id': row[2]
            }
            if row[3]:
                doc['headers'] = json.loads(row[3])
            if row[4]:
                doc['metadata'] = json.loads(row[4])
            documents.append(doc)
        
        return documents
    
    def close(self):
        """Close database connection."""
        self.conn.close()
