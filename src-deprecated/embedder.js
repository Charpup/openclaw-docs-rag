/**
 * Embedding Generator - Create vector embeddings for text
 */
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Use the configured embedding endpoint from openclaw.json
const EMBEDDING_CONFIG = {
  baseUrl: 'https://api.apiyi.com/v1',
  model: 'text-embedding-3-small',
  dimensions: 1536
};

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text, apiKey) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  
  // Truncate if too long (embedding models have token limits)
  const truncatedText = text.slice(0, 8000);
  
  const response = await fetch(`${EMBEDDING_CONFIG.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_CONFIG.model,
      input: truncatedText
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${error}`);
  }
  
  const data = await response.json();
  return {
    vector: data.data[0].embedding,
    model: EMBEDDING_CONFIG.model,
    dimensions: EMBEDDING_CONFIG.dimensions
  };
}

/**
 * Generate embeddings for multiple texts (batch)
 */
async function generateEmbeddings(texts, apiKey, options = {}) {
  const { onProgress, batchSize = 10 } = options;
  
  const embeddings = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`Generating embeddings [${i + 1}-${Math.min(i + batchSize, texts.length)}/${texts.length}]`);
    
    // Process batch sequentially to avoid rate limits
    for (let j = 0; j < batch.length; j++) {
      const text = batch[j];
      try {
        const embedding = await generateEmbedding(text, apiKey);
        embeddings.push(embedding);
        
        if (onProgress) {
          onProgress(i + j + 1, texts.length, embedding);
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        console.error(`Failed to generate embedding for text ${i + j}:`, error);
        embeddings.push(null);
      }
    }
  }
  
  return embeddings;
}

/**
 * Generate embeddings for chunks with metadata
 */
async function embedChunks(chunks, apiKey, options = {}) {
  const texts = chunks.map(c => c.text);
  const embeddings = await generateEmbeddings(texts, apiKey, options);
  
  // Combine chunks with embeddings
  const embeddedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    if (embeddings[i]) {
      embeddedChunks.push({
        ...chunks[i],
        embedding: embeddings[i].vector,
        embeddingModel: embeddings[i].model
      });
    }
  }
  
  console.log(`Successfully embedded ${embeddedChunks.length}/${chunks.length} chunks`);
  return embeddedChunks;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  embedChunks,
  EMBEDDING_CONFIG
};
