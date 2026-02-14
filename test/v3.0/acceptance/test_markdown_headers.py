"""
Acceptance tests for Markdown Header Extraction
SDD Level: End-to-End Acceptance Tests
Implements E2E-003: Process markdown with headers
"""
import pytest
import tempfile
import sqlite3
import os


class TestMarkdownHeaderExtraction:
    """
    E2E-003: Process markdown with headers
    
    Given:
    - Markdown document with H1-H6 headers
    - Headers have custom anchors
    
    When:
    - Parse document headers
    - Store document with header metadata
    
    Then:
    - All headers extracted with correct levels
    - Anchors preserved in metadata
    - Document structure queryable
    """
    
    @pytest.fixture
    def markdown_env(self):
        """Create environment for markdown tests"""
        from docs_rag.parsers import MarkdownHeaderParser
        from docs_rag.streaming import StreamingBatchWriter
        from docs_rag.checkpoint import CheckpointManager
        from docs_rag.database import Database
        
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "markdown.db")
            conn = sqlite3.connect(db_path)
            db = Database(conn)
            cursor = conn.cursor()
            
            parser = MarkdownHeaderParser()
            checkpoint_manager = CheckpointManager(db_connection=db)
            batch_writer = StreamingBatchWriter(
                db_connection=db,
                checkpoint_manager=checkpoint_manager
            )
            
            yield {
                "db": conn,
                "db_wrapper": db,
                "cursor": cursor,
                "parser": parser,
                "batch_writer": batch_writer
            }
            
            conn.close()
    
    def test_e2e_markdown_header_extraction(self, markdown_env):
        """
        E2E-003 Complete Scenario: Process markdown with headers
        """
        parser = markdown_env["parser"]
        batch_writer = markdown_env["batch_writer"]
        cursor = markdown_env["cursor"]
        
        # ========================================
        # Given: Markdown document with headers
        # ========================================
        content = """# Main Document Title {#main-title}

## Introduction {#intro}
This is the introduction section with some content.

### Overview {#overview}
Overview subsection content here.

### Scope {#scope}
Scope subsection content here.

## Methodology {#method}
Methodology section content.

### Data Collection {#data}
Data collection details.

### Analysis {#analysis}
Analysis procedures.

## Conclusion {#conclusion}
Conclusion section.

### Summary {#summary}
Summary of findings.

### Future Work {#future}
Future research directions."""
        
        # ========================================
        # When: Parse document headers
        # ========================================
        headers = parser.parse_headers(content)
        metadata = parser.extract_header_metadata(content)
        
        # ========================================
        # Then: Verify headers extracted correctly
        # ========================================
        assert len(headers) == 10
        
        # Verify H1
        assert headers[0].level == 1
        assert headers[0].text == "Main Document Title"
        assert headers[0].anchor == "main-title"
        
        # Verify H2s
        h2_headers = [h for h in headers if h.level == 2]
        assert len(h2_headers) == 3
        assert h2_headers[0].text == "Introduction"
        assert h2_headers[0].anchor == "intro"
        assert h2_headers[1].text == "Methodology"
        assert h2_headers[1].anchor == "method"
        
        # Verify H3s
        h3_headers = [h for h in headers if h.level == 3]
        assert len(h3_headers) == 6
        
        # ========================================
        # Then: Verify metadata extracted
        # ========================================
        assert metadata["title"] == "Main Document Title"
        assert "Introduction" in metadata["sections"]
        assert "Methodology" in metadata["sections"]
        assert "Conclusion" in metadata["sections"]
        
        # ========================================
        # When: Store document with metadata
        # ========================================
        import json
        document = {
            "id": "doc_markdown_001",
            "content": content,
            "headers": json.dumps([{
                "level": h.level,
                "text": h.text,
                "anchor": h.anchor
            } for h in headers]),
            "title": metadata["title"],
            "sections": json.dumps(metadata["sections"]),
            "metadata": json.dumps({
                "header_count": len(headers),
                "h1_count": len([h for h in headers if h.level == 1]),
                "h2_count": len([h for h in headers if h.level == 2]),
                "h3_count": len([h for h in headers if h.level == 3])
            })
        }
        
        result = batch_writer.process_batch([document], "batch_md_001")
        assert result.success is True
        
        # ========================================
        # Then: Verify stored document queryable
        # ========================================
        cursor.execute("SELECT * FROM documents WHERE id = ?", ("doc_markdown_001",))
        row = cursor.fetchone()
        
        assert row is not None
        stored_headers = json.loads(row[3])  # headers column
        assert len(stored_headers) == 10
        assert stored_headers[0]["anchor"] == "main-title"
    
    def test_e2e_markdown_no_headers(self, markdown_env):
        """
        Test markdown document without headers
        """
        parser = markdown_env["parser"]
        
        content = """This is a plain document without any headers.

It has multiple paragraphs but no structured headers.

Just plain text content."""
        
        headers = parser.parse_headers(content)
        metadata = parser.extract_header_metadata(content)
        
        assert headers == []
        assert metadata["title"] is None
        assert metadata["sections"] == []
    
    def test_e2e_markdown_headers_without_anchors(self, markdown_env):
        """
        Test markdown with headers that don't have custom anchors
        """
        parser = markdown_env["parser"]
        
        content = """# Title Without Anchor
## Section Without Anchor
### Subsection Without Anchor"""
        
        headers = parser.parse_headers(content)
        
        assert len(headers) == 3
        assert headers[0].anchor is None
        assert headers[1].anchor is None
        assert headers[2].anchor is None
    
    def test_e2e_document_structure_queryable(self, markdown_env):
        """
        Test that document structure can be queried from database
        """
        batch_writer = markdown_env["batch_writer"]
        cursor = markdown_env["cursor"]
        
        import json
        
        # Create document with rich structure
        documents = [
            {
                "id": "api_guide",
                "content": "# API Guide\n## Authentication\n## Endpoints",
                "title": "API Guide",
                "sections": json.dumps(["Authentication", "Endpoints"]),
                "metadata": json.dumps({"type": "api", "version": "1.0"})
            },
            {
                "id": "user_manual",
                "content": "# User Manual\n## Getting Started\n## Advanced Features",
                "title": "User Manual",
                "sections": json.dumps(["Getting Started", "Advanced Features"]),
                "metadata": json.dumps({"type": "manual", "version": "2.0"})
            }
        ]
        
        result = batch_writer.process_batch(documents, "batch_docs")
        assert result.success is True
        
        # Query by title
        cursor.execute("SELECT id FROM documents WHERE title = ?", ("API Guide",))
        assert cursor.fetchone()[0] == "api_guide"
        
        # Query documents with specific section
        cursor.execute("SELECT id, sections FROM documents")
        rows = cursor.fetchall()
        
        all_sections = []
        for row in rows:
            sections = json.loads(row[1])  # sections column
            all_sections.extend(sections)
        
        assert "Authentication" in all_sections
        assert "Getting Started" in all_sections
    
    def test_e2e_markdown_special_characters(self, markdown_env):
        """
        Test markdown with special characters in headers
        """
        parser = markdown_env["parser"]
        
        content = """# Header with "quotes"
## Header with 'apostrophes'
### Header with &amp; entities
#### Header with [brackets] and (parentheses)
##### Header with *asterisks* and **double**
###### Header with `code`"""
        
        headers = parser.parse_headers(content)
        
        assert len(headers) == 6
        # Verify headers parsed despite special characters
        assert "quotes" in headers[0].text
        assert "apostrophes" in headers[1].text
        assert "code" in headers[5].text
    
    def test_e2e_nested_header_structure(self, markdown_env):
        """
        Test preservation of header hierarchy
        """
        parser = markdown_env["parser"]
        
        content = """# Root
## Level 2 A
### Level 3 A1
### Level 3 A2
## Level 2 B
### Level 3 B1
#### Level 4 B1a
##### Level 5 B1a1
###### Level 6 B1a1i"""
        
        headers = parser.parse_headers(content)
        
        # Verify order preserved
        assert headers[0].level == 1
        assert headers[1].level == 2
        assert headers[2].level == 3
        assert headers[3].level == 3
        assert headers[4].level == 2
        assert headers[5].level == 3
        assert headers[6].level == 4
        assert headers[7].level == 5
        assert headers[8].level == 6
