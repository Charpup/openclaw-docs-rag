const { 
  chunkByHeadings, 
  createChunks 
} = require('../src/chunker');

describe('chunker', () => {
  test('chunkByHeadings splits by h2 headings', () => {
    const text = `
## Section 1
Content for section 1

## Section 2
Content for section 2
    `;
    
    const chunks = chunkByHeadings(text);
    expect(chunks.length).toBeGreaterThan(0);
  });

  test('createChunks includes metadata', () => {
    const doc = {
      url: 'https://example.com/doc',
      title: 'Test Doc',
      content: '## Section\nSome content here that is long enough to be chunked properly',
      checksum: 'abc123',
      fetchedAt: '2026-02-10'
    };
    
    const chunks = createChunks(doc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.source).toBe(doc.url);
    expect(chunks[0].metadata.title).toBe(doc.title);
  });
});
