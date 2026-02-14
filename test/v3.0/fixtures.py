"""
Test fixtures for docs-rag v3.0
Reusable test data and helpers
"""
import json
from datetime import datetime


class Fixtures:
    """Test fixtures container"""
    
    @staticmethod
    def documents(count=10, prefix="doc"):
        """Generate test documents"""
        return [
            {
                "id": f"{prefix}_{i:04d}",
                "content": f"Content for document {i}",
                "metadata": {"index": i, "generated": True}
            }
            for i in range(count)
        ]
    
    @staticmethod
    def markdown_with_headers():
        """Sample markdown with all header levels"""
        return """# Main Title {#main}
## Section 1 {#sec1}
Content here.
### Subsection 1.1 {#sub1}
More content.
#### Level 4 {#l4}
##### Level 5 {#l5}
###### Level 6 {#l6}
## Section 2 {#sec2}"""
    
    @staticmethod
    def markdown_without_headers():
        """Plain markdown without headers"""
        return """This is just plain text.

Multiple paragraphs but no headers."""
    
    @staticmethod
    def checkpoint_data(batch_id="batch_001", persisted=100):
        """Generate checkpoint data"""
        return {
            "last_batch_id": batch_id,
            "total_persisted": persisted,
            "status": "committed",
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def batch_result_dict(success=True, count=100, batch_id="batch_001"):
        """Generate batch result data"""
        return {
            "success": success,
            "persisted_count": count,
            "batch_id": batch_id,
            "checkpoint_updated": success,
            "error": None if success else "Test error"
        }


class TestDataFactory:
    """Factory for creating test data with variations"""
    
    @staticmethod
    def create_batch_documents(batch_num, count=100, include_errors=False):
        """Create documents for a specific batch"""
        documents = []
        for i in range(count):
            doc_id = f"batch{batch_num:03d}_doc{i:04d}"
            if include_errors and i == count // 2:
                # Create a problematic document
                doc_id = None  # This will cause validation error
            documents.append({
                "id": doc_id,
                "content": f"Batch {batch_num}, Document {i}"
            })
        return documents
    
    @staticmethod
    def create_header_tree(depth=3):
        """Create a hierarchical header structure"""
        headers = []
        for i in range(1, depth + 1):
            headers.append({
                "level": i,
                "text": f"Level {i} Header",
                "anchor": f"level-{i}"
            })
        return headers
