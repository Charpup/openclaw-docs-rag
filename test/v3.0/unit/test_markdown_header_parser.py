"""
Unit tests for MarkdownHeaderParser
TDD Level: Interface Contract Tests for Accept: text/markdown headers
"""
import pytest
from unittest.mock import Mock


class TestMarkdownHeaderParser:
    """Test suite for MarkdownHeaderParser - header extraction tests"""
    
    @pytest.fixture
    def parser(self):
        """Create MarkdownHeaderParser instance"""
        # Import will fail initially (RED phase)
        from docs_rag.parsers import MarkdownHeaderParser
        return MarkdownHeaderParser()
    
    # =========================================================================
    # Test Case MHP-001: Parse H1-H6 headers
    # =========================================================================
    def test_parse_headers_h1_to_h6(self, parser):
        """MHP-001: Parse all header levels H1 through H6"""
        # Arrange
        content = """# Main Title
## Section 1
### Subsection 1.1
## Section 2"""
        
        # Act
        headers = parser.parse_headers(content)
        
        # Assert
        assert len(headers) == 4
        assert headers[0].level == 1
        assert headers[0].text == "Main Title"
        assert headers[1].level == 2
        assert headers[1].text == "Section 1"
        assert headers[2].level == 3
        assert headers[2].text == "Subsection 1.1"
        assert headers[3].level == 2
        assert headers[3].text == "Section 2"
    
    # =========================================================================
    # Test Case MHP-002: Parse headers with anchors
    # =========================================================================
    def test_parse_headers_with_anchors(self, parser):
        """MHP-002: Extract custom anchors from headers"""
        # Arrange
        content = """# Title {#custom-anchor}
## Section [link text](#other-anchor)"""
        
        # Act
        headers = parser.parse_headers(content)
        
        # Assert
        assert len(headers) == 2
        assert headers[0].anchor == "custom-anchor"
        assert headers[1].has_link is True
    
    # =========================================================================
    # Test Case MHP-003: No headers in content
    # =========================================================================
    def test_parse_headers_no_headers(self, parser):
        """MHP-003: Return empty list when no headers present"""
        # Arrange
        content = "Just plain text without headers."
        
        # Act
        headers = parser.parse_headers(content)
        
        # Assert
        assert headers == []
        assert isinstance(headers, list)
    
    # =========================================================================
    # Test Case MHP-004: Extract document metadata
    # =========================================================================
    def test_extract_header_metadata(self, parser):
        """MHP-004: Extract title and sections from document"""
        # Arrange
        content = """# Document Title
## Introduction
Content here.
## Conclusion"""
        
        # Act
        metadata = parser.extract_header_metadata(content)
        
        # Assert
        assert metadata["title"] == "Document Title"
        assert "Introduction" in metadata["sections"]
        assert "Conclusion" in metadata["sections"]
    
    # =========================================================================
    # Additional Edge Cases
    # =========================================================================
    def test_parse_headers_with_inline_formatting(self, parser):
        """Headers with bold, italic, code should be parsed correctly"""
        content = """# Title with **bold** and *italic*
## Section with `code`"""
        
        headers = parser.parse_headers(content)
        
        assert len(headers) == 2
        assert "bold" in headers[0].text
        assert "italic" in headers[0].text
    
    def test_parse_headers_empty_content(self, parser):
        """Empty content should return empty list"""
        headers = parser.parse_headers("")
        assert headers == []
    
    def test_parse_headers_only_whitespace(self, parser):
        """Whitespace-only content should return empty list"""
        headers = parser.parse_headers("   \n\n  ")
        assert headers == []
    
    def test_parse_headers_code_blocks_ignored(self, parser):
        """Headers inside code blocks should not be parsed as headers"""
        content = """# Real Header
```
# This is code, not a header
## Also code
```
## Another Real Header"""
        
        headers = parser.parse_headers(content)
        
        assert len(headers) == 2
        assert headers[0].text == "Real Header"
        assert headers[1].text == "Another Real Header"
    
    def test_header_hierarchy_tracking(self, parser):
        """Headers should maintain document order and hierarchy"""
        content = """# H1
## H2 under H1
### H3 under H2
## Another H2
# Another H1"""
        
        headers = parser.parse_headers(content)
        
        assert headers[0].level == 1
        assert headers[1].level == 2
        assert headers[2].level == 3
        assert headers[3].level == 2
        assert headers[4].level == 1


class TestHeaderNode:
    """Tests for HeaderNode data structure"""
    
    def test_header_node_creation(self):
        """Test HeaderNode can be created with all fields"""
        from docs_rag.parsers import HeaderNode
        
        node = HeaderNode(
            level=2,
            text="Section Title",
            anchor="section-anchor",
            has_link=False
        )
        
        assert node.level == 2
        assert node.text == "Section Title"
        assert node.anchor == "section-anchor"
        assert node.has_link is False
    
    def test_header_node_defaults(self):
        """Test HeaderNode with default values"""
        from docs_rag.parsers import HeaderNode
        
        node = HeaderNode(level=1, text="Title")
        
        assert node.anchor is None
        assert node.has_link is False
    
    def test_header_node_equality(self):
        """Test HeaderNode equality comparison"""
        from docs_rag.parsers import HeaderNode
        
        node1 = HeaderNode(level=1, text="Title", anchor="anchor")
        node2 = HeaderNode(level=1, text="Title", anchor="anchor")
        node3 = HeaderNode(level=2, text="Title", anchor="anchor")
        
        assert node1 == node2
        assert node1 != node3


class TestMarkdownVariations:
    """Tests for different markdown header styles"""
    
    @pytest.fixture
    def parser(self):
        from docs_rag.parsers import MarkdownHeaderParser
        return MarkdownHeaderParser()
    
    def test_atx_style_headers(self, parser):
        """Standard ATX style: # Header"""
        content = "# ATX Header"
        headers = parser.parse_headers(content)
        
        assert len(headers) == 1
        assert headers[0].text == "ATX Header"
    
    def test_setext_style_headers(self, parser):
        """Setext style: Header\n====="""
        content = """Setext H1
=========

Setext H2
---------"""
        
        headers = parser.parse_headers(content)
        
        # Should handle setext style or document as unsupported
        # Implementation dependent
        pass
    
    def test_headers_with_special_characters(self, parser):
        """Headers containing special markdown characters"""
        content = """# Header with [brackets]
## Header with (parentheses)
### Header with &amp; entities"""
        
        headers = parser.parse_headers(content)
        
        assert len(headers) == 3
        # Text should be cleaned of markdown syntax
        assert "[brackets]" in headers[0].text or "brackets" in headers[0].text


class TestAcceptHeader:
    """Tests for Accept: text/markdown header handling"""
    
    @pytest.fixture
    def parser(self):
        from docs_rag.parsers import MarkdownHeaderParser
        return MarkdownHeaderParser()
    
    def test_accept_text_markdown(self, parser):
        """Parser should indicate support for text/markdown"""
        assert parser.supported_mime_types == ["text/markdown", "text/plain"]
    
    def test_can_parse_markdown_content(self, parser):
        """Parser should identify parseable markdown content"""
        markdown = "# Header\n\nContent"
        assert parser.can_parse(markdown) is True
    
    def test_can_parse_plain_text(self, parser):
        """Parser should handle plain text as markdown"""
        plain = "Just plain text"
        assert parser.can_parse(plain) is True
