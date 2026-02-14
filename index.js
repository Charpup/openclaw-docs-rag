/**
 * OpenClaw Docs RAG v2.0 - Main entry point with Batch + Checkpoint support
 */
const { fetchAllDocs } = require('./src/fetcher');
const { chunkDocuments } = require('./src/chunker');
const { embedChunks } = require('./src/embedder');
const VectorStore = require('./src/store');
const QueryEngine = require('./src/query');
const { CheckpointManager } = require('./src/checkpoint-manager');
const { ChunkDeduplicator } = require('./src/chunk-deduplicator');

/**
 * Full sync pipeline: fetch → chunk → embed → store
 * v2.0: Added batch processing with checkpoint/resume
 */
async function syncDocs(options = {}) {
  const { 
    limit,
    apiKey = process.env.OPENAI_API_KEY,
    dbConfig = {},
    batchSize = 50,
    checkpointPath = './sync-checkpoint.json',
    resume = true,
    force = false,
    onProgress = null  // Callback for progress updates
  } = options;
  
  console.log('=== OpenClaw Docs RAG Sync v2.0 ===\n');
  console.log(`Batch size: ${batchSize} | Resume: ${resume} | Force: ${force}\n`);
  
  const checkpointManager = new CheckpointManager(checkpointPath);
  const deduplicator = new ChunkDeduplicator();
  
  // Check for existing checkpoint
  let checkpoint = null;
  if (!force && resume) {
    const isResumable = await checkpointManager.isResumable();
    if (isResumable) {
      checkpoint = await checkpointManager.load();
      console.log(`📂 Resuming from checkpoint (batch ${checkpoint.currentBatch})`);
      console.log(`   Already processed: ${checkpoint.processedChunkIds.length} chunks\n`);
    }
  }
  
  if (force) {
    console.log('🔄 Force mode: clearing checkpoint and starting fresh\n');
    await checkpointManager.clear();
    checkpoint = null;
  }
  
  // Step 1: Fetch documents (always needed to get chunks)
  console.log('Step 1: Fetching documentation...');
  const docs = await fetchAllDocs({ limit });
  console.log(`✓ Fetched ${docs.length} documents\n`);
  
  // Step 2: Chunk documents
  console.log('Step 2: Chunking documents...');
  const chunks = chunkDocuments(docs);
  console.log(`✓ Created ${chunks.length} chunks\n`);
  
  // Compute hashes for all chunks
  const chunksWithHash = chunks.map(chunk => ({
    ...chunk,
    hash: deduplicator.computeHash(chunk)
  }));
  
  // Filter out already processed chunks
  const processedIds = checkpoint ? checkpoint.processedChunkIds : [];
  const remainingChunks = chunksWithHash.filter(chunk => 
    !deduplicator.isProcessed(chunk.hash, processedIds)
  );
  
  console.log(`Step 3: Generating embeddings...`);
  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Already processed: ${processedIds.length}`);
  console.log(`   Remaining: ${remainingChunks.length}\n`);
  
  if (remainingChunks.length === 0) {
    console.log('✅ All chunks already processed!\n');
    return {
      success: true,
      docsProcessed: docs.length,
      chunksCreated: chunks.length,
      chunksProcessed: 0,
      batchesCompleted: 0,
      resumed: !!checkpoint,
      stats: { total_sources: docs.length, total_chunks: chunks.length }
    };
  }
  
  // Step 3: Process in batches
  const batches = [];
  for (let i = 0; i < remainingChunks.length; i += batchSize) {
    batches.push(remainingChunks.slice(i, i + batchSize));
  }
  
  console.log(`   Processing ${batches.length} batches...\n`);
  
  const allEmbeddedChunks = [];
  const failedChunkIds = [...(checkpoint ? checkpoint.failedChunkIds : [])];
  let currentBatch = checkpoint ? checkpoint.currentBatch : 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = currentBatch + i + 1;
    
    console.log(`   [Batch ${batchNum}/${currentBatch + batches.length}] Processing ${batch.length} chunks...`);
    
    try {
      // Generate embeddings for this batch
      const embeddedBatch = await embedChunks(batch, apiKey);
      allEmbeddedChunks.push(...embeddedBatch);
      
      // Update checkpoint after each batch
      const newProcessedIds = [
        ...processedIds,
        ...batch.map(c => c.hash)
      ];
      
      await checkpointManager.save({
        totalChunks: chunks.length,
        processedChunkIds: newProcessedIds,
        failedChunkIds,
        currentBatch: batchNum,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`   ✓ Batch ${batchNum} complete (${embeddedBatch.length} embeddings)\n`);
      
      // Progress callback
      if (onProgress) {
        onProgress({
          batch: batchNum,
          totalBatches: currentBatch + batches.length,
          processed: newProcessedIds.length,
          total: chunks.length,
          percentage: Math.round((newProcessedIds.length / chunks.length) * 100)
        });
      }
      
      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
      failedChunkIds.push(...batch.map(c => c.hash));
      
      // Save checkpoint with failures
      await checkpointManager.save({
        totalChunks: chunks.length,
        processedChunkIds: [...processedIds, ...allEmbeddedChunks.map(c => c.hash)],
        failedChunkIds,
        currentBatch: batchNum,
        lastUpdated: new Date().toISOString()
      });
    }
  }
  
  // Step 4: Store in vector database
  console.log('Step 4: Storing in vector database...');
  const store = new VectorStore(dbConfig);
  await store.init();
  
  // Only clear if fresh sync (no checkpoint)
  if (!checkpoint) {
    await store.clear();
  }
  
  if (allEmbeddedChunks.length > 0) {
    const ids = await store.storeChunks(allEmbeddedChunks);
    console.log(`✓ Stored ${ids.length} chunks\n`);
  }
  
  // Get stats
  const stats = await store.getStats();
  console.log('=== Sync Complete ===');
  console.log(`Total sources: ${stats.total_sources}`);
  console.log(`Total chunks: ${stats.total_chunks}`);
  console.log(`Processed this run: ${allEmbeddedChunks.length}`);
  if (failedChunkIds.length > 0) {
    console.log(`Failed chunks: ${failedChunkIds.length}`);
  }
  
  await store.close();
  
  // Clear checkpoint on successful completion
  if (stats.total_chunks >= chunks.length) {
    console.log('\n🎉 Full sync complete! Clearing checkpoint...');
    await checkpointManager.clear();
  }
  
  return {
    success: true,
    docsProcessed: docs.length,
    chunksCreated: chunks.length,
    chunksProcessed: allEmbeddedChunks.length,
    batchesCompleted: batches.length,
    failedChunks: failedChunkIds.length,
    resumed: !!checkpoint,
    stats
  };
}

/**
 * Query the documentation
 */
async function queryDocs(question, options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    dbConfig = {},
    topK = 5
  } = options;
  
  const engine = new QueryEngine({ ...dbConfig, apiKey });
  await engine.init();
  
  const result = await engine.query(question, { topK });
  
  await engine.close();
  return result;
}

/**
 * Get context for LLM
 */
async function getDocsContext(question, options = {}) {
  const {
    apiKey = process.env.OPENAI_API_KEY,
    dbConfig = {},
    topK = 5
  } = options;
  
  const engine = new QueryEngine({ ...dbConfig, apiKey });
  await engine.init();
  
  const result = await engine.getContext(question, { topK });
  
  await engine.close();
  return result;
}

module.exports = {
  syncDocs,
  queryDocs,
  getDocsContext,
  fetchAllDocs,
  chunkDocuments,
  embedChunks,
  VectorStore,
  QueryEngine,
  CheckpointManager,
  ChunkDeduplicator
};
