/**
 * Text Chunker - Split documents into semantic chunks
 */

/**
 * Split text into chunks by headings (h2, h3)
 */
function chunkByHeadings(text, options = {}) {
  const { minChunkSize = 50, maxChunkSize = 1000 } = options;
  
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // Split by h2/h3 headings
  const headingRegex = /##?\s+.+\n/g;
  const sections = text.split(headingRegex);
  const headings = text.match(headingRegex) || [];
  
  const chunks = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (section.length < minChunkSize) continue;
    
    const heading = headings[i - 1] || 'Introduction';
    
    // If section is too long, split further by paragraphs
    if (section.length > maxChunkSize) {
      const subChunks = splitByParagraphs(section, maxChunkSize);
      subChunks.forEach((subChunk, idx) => {
        chunks.push({
          text: subChunk,
          metadata: {
            heading: heading.replace(/\n/g, '').trim(),
            index: idx,
            type: 'paragraph_chunk'
          }
        });
      });
    } else {
      chunks.push({
        text: section,
        metadata: {
          heading: heading.replace(/\n/g, '').trim(),
          type: 'section'
        }
      });
    }
  }
  
  // If no headings found, treat entire text as one chunk
  if (chunks.length === 0 && text.trim().length >= minChunkSize) {
    chunks.push({
      text: text.trim(),
      metadata: {
        heading: 'Content',
        type: 'section'
      }
    });
  }
  
  return chunks;
}

/**
 * Split text by paragraphs with overlap
 */
function splitByParagraphs(text, maxLength, overlap = 100) {
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  const chunks = [];
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-overlap / 5); // Approximate words
      currentChunk = overlapWords.join(' ') + '\n\n' + para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Create chunks from a document
 */
function createChunks(doc, options = {}) {
  const { maxChunkSize = 1000, overlap = 100 } = options;
  
  const chunks = [];
  const text = doc.content;
  
  // Strategy: Split by headings first, then by paragraphs if needed
  const sections = chunkByHeadings(text, { maxChunkSize });
  
  for (const section of sections) {
    chunks.push({
      text: section.text,
      metadata: {
        source: doc.url,
        title: doc.title,
        heading: section.metadata.heading,
        checksum: doc.checksum,
        fetchedAt: doc.fetchedAt,
        chunkType: section.metadata.type
      }
    });
  }
  
  return chunks;
}

/**
 * Batch process multiple documents
 */
function chunkDocuments(docs, options = {}) {
  const allChunks = [];
  
  for (const doc of docs) {
    const chunks = createChunks(doc, options);
    allChunks.push(...chunks);
  }
  
  console.log(`Created ${allChunks.length} chunks from ${docs.length} documents`);
  return allChunks;
}

module.exports = {
  chunkByHeadings,
  splitByParagraphs,
  createChunks,
  chunkDocuments
};
