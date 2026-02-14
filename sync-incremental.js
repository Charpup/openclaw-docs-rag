#!/usr/bin/env node
/**
 * 增量同步脚本 - 不清理数据库，支持分批
 */

const { fetchAllDocs } = require('./src/fetcher');
const { chunkDocuments } = require('./src/chunker');
const { embedChunks } = require('./src/embedder');
const VectorStore = require('./src/store');

async function incrementalSync(options = {}) {
  const { 
    limit = 50,
    offset = 0,
    apiKey = process.env.OPENAI_API_KEY
  } = options;
  
  console.log(`=== 增量同步 [${offset} - ${offset + limit}] ===\n`);
  
  try {
    // Step 1: Fetch documents with limit/offset
    console.log('Step 1: Fetching documentation...');
    const docs = await fetchAllDocs({ limit, offset });
    console.log(`✓ Fetched ${docs.length} documents\n`);
    
    if (docs.length === 0) {
      console.log('No more documents to sync.');
      return { docsProcessed: 0, chunksCreated: 0, chunksStored: 0 };
    }
    
    // Step 2: Chunk documents
    console.log('Step 2: Chunking documents...');
    const chunks = chunkDocuments(docs);
    console.log(`✓ Created ${chunks.length} chunks\n`);
    
    // Step 3: Generate embeddings
    console.log('Step 3: Generating embeddings...');
    const embeddedChunks = await embedChunks(chunks, apiKey, {
      onProgress: (current, total) => {
        if (current % 10 === 0 || current === total) {
          console.log(`  Progress: ${current}/${total}`);
        }
      }
    });
    console.log(`✓ Generated ${embeddedChunks.length} embeddings\n`);
    
    // Step 4: Store in vector database (NO CLEAR!)
    console.log('Step 4: Storing in vector database...');
    const store = new VectorStore();
    await store.init();
    
    const ids = await store.storeChunks(embeddedChunks);
    console.log(`✓ Stored ${ids.length} chunks\n`);
    
    // Get stats
    const stats = await store.getStats();
    console.log('=== 批次完成 ===');
    console.log(`Total chunks in DB: ${stats.total_chunks}`);
    console.log(`Total sources: ${stats.total_sources}\n`);
    
    await store.close();
    
    return {
      docsProcessed: docs.length,
      chunksCreated: chunks.length,
      chunksStored: ids.length,
      stats
    };
  } catch (error) {
    console.error('Sync error:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const limit = parseInt(process.argv[2]) || 50;
  const offset = parseInt(process.argv[3]) || 0;
  
  incrementalSync({ limit, offset })
    .then(result => {
      console.log('Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

module.exports = { incrementalSync };
