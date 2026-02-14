"""
MarkdownHeaderParser - Parse structured markdown with Accept: text/markdown headers
"""
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import re


@dataclass
class HeaderNode:
    """Represents a parsed markdown header"""
    level: int
    text: str
    anchor: Optional[str] = None
    has_link: bool = False
    
    def __eq__(self, other):
        if not isinstance(other, HeaderNode):
            return False
        return (self.level == other.level and 
                self.text == other.text and 
                self.anchor == other.anchor and
                self.has_link == other.has_link)


class MarkdownHeaderParser:
    """
    Parser for markdown headers with support for:
    - H1-H6 headers
    - Code block exclusion
    - Anchor extraction
    - Link detection
    """
    
    def __init__(self):
        self.supported_mime_types = ["text/markdown", "text/plain"]
    
    def can_parse(self, content: str) -> bool:
        """Check if content can be parsed as markdown"""
        return isinstance(content, str)
    
    def parse_headers(self, content: str) -> List[HeaderNode]:
        """
        Parse all headers from markdown content.
        
        Args:
            content: Markdown content to parse
            
        Returns:
            List of HeaderNode objects representing headers
        """
        if not content or not content.strip():
            return []
        
        headers = []
        in_code_block = False
        
        for line in content.split('\n'):
            # Track code blocks
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            
            # Skip headers inside code blocks
            if in_code_block:
                continue
            
            # Parse ATX-style headers (# Header)
            stripped = line.lstrip()
            if stripped.startswith('#') and not in_code_block:
                # Count header level
                level = 0
                for char in stripped:
                    if char == '#':
                        level += 1
                    else:
                        break
                
                # Must be H1-H6
                if 1 <= level <= 6:
                    # Extract text (remove leading #s and whitespace)
                    text = stripped[level:].strip()
                    
                    # Extract anchor if present {#anchor}
                    anchor = None
                    anchor_match = re.search(r'\{#([^}]+)\}\s*$', text)
                    if anchor_match:
                        anchor = anchor_match.group(1)
                        text = text[:anchor_match.start()].strip()
                    
                    # Check for links
                    has_link = '[' in text and '](' in text
                    
                    headers.append(HeaderNode(
                        level=level,
                        text=text,
                        anchor=anchor,
                        has_link=has_link
                    ))
        
        return headers
    
    def extract_header_metadata(self, content: str) -> Dict[str, Any]:
        """
        Extract metadata from document headers.
        
        Args:
            content: Markdown content
            
        Returns:
            Dictionary with 'title' and 'sections' keys
        """
        headers = self.parse_headers(content)
        
        title = None
        sections = []
        
        for header in headers:
            if header.level == 1 and title is None:
                title = header.text
            elif header.level == 2:
                sections.append(header.text)
        
        return {
            "title": title,
            "sections": sections
        }
