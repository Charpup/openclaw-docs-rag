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
    onProgress = null,  // Callback for progress updates
    maxBatches = null   // Limit batches per run for segmented execution
  } = options;
  
  console.log('=== OpenClaw Docs RAG Sync v2.0 ===\n');
  const maxBatchesLabel = maxBatches !== null ? maxBatches : 'unlimited';
  console.log(`Batch size: ${batchSize} | Resume: ${resume} | Force: ${force} | Max batches: ${maxBatchesLabel}\n`);
  
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
  let processedIds = checkpoint ? [...checkpoint.processedChunkIds] : [];
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
  
  const failedChunkIds = [...(checkpoint ? checkpoint.failedChunkIds : [])];
  let currentBatch = checkpoint ? checkpoint.currentBatch : 0;
  let totalStoredChunks = checkpoint ? processedIds.length : 0;
  
  // Initialize vector store for batch writing
  console.log('Step 4: Initializing vector database...');
  const store = new VectorStore(dbConfig);
  await store.init();
  
  // Only clear if fresh sync (no checkpoint)
  if (!checkpoint) {
    await store.clear();
  }
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = currentBatch + i + 1;
    
    console.log(`   [Batch ${batchNum}/${currentBatch + batches.length}] Processing ${batch.length} chunks...`);
    
    try {
      // Generate embeddings for this batch
      const embeddedBatch = await embedChunks(batch, apiKey);
      
      // Store embeddings immediately after generation
      if (embeddedBatch.length > 0) {
        console.log(`   📤 Calling storeChunks with ${embeddedBatch.length} chunks...`);
        const ids = await store.storeChunks(embeddedBatch);
        
        // Verify actual database count after store
        const afterStats = await store.getStats();
        console.log(`   📥 storeChunks returned ${ids.length} IDs`);
        console.log(`   📊 Database now has ${afterStats.total_chunks} total chunks`);
        
        totalStoredChunks = parseInt(afterStats.total_chunks);
        console.log(`   ✓ Batch ${batchNum} stored (${ids.length} returned, ${afterStats.total_chunks} in DB)`);
      }
      
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

      // Accumulate processed IDs so next batch's checkpoint is complete
      processedIds = newProcessedIds;

      // Progress callback
      if (onProgress) {
        onProgress({
          batch: batchNum,
          totalBatches: currentBatch + batches.length,
          processed: newProcessedIds.length,
          stored: totalStoredChunks,
          total: chunks.length,
          percentage: Math.round((newProcessedIds.length / chunks.length) * 100)
        });
      }

      // Check maxBatches limit — exit cleanly for next cron run
      const processedBatchCount = i + 1;
      if (maxBatches !== null && processedBatchCount >= maxBatches) {
        console.log(`\n[maxBatches] Reached limit of ${maxBatches} batches. Exiting cleanly for next cron run.`);
        console.log(`[maxBatches] Checkpoint saved at batch ${batchNum}. DB has ${totalStoredChunks} chunks.\n`);
        await store.close();
        return {
          success: false,
          status: 'partial',
          docsProcessed: docs.length,
          chunksCreated: chunks.length,
          chunksStored: totalStoredChunks,
          batchesCompleted: batchNum,
          batchesRemaining: (currentBatch + batches.length) - batchNum,
          failedChunks: failedChunkIds.length,
          resumed: !!checkpoint,
          maxBatchesReached: true
        };
      }

      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
      failedChunkIds.push(...batch.map(c => c.hash));
      
      // Save checkpoint with failures
      const currentProcessed = processedIds.length + ((i - failedChunkIds.length) * batchSize);
      await checkpointManager.save({
        totalChunks: chunks.length,
        processedChunkIds: [...processedIds.slice(0, currentProcessed)],
        failedChunkIds,
        currentBatch: batchNum,
        lastUpdated: new Date().toISOString()
      });
    }
  }
  
  // Get final stats
  const stats = await store.getStats();
  console.log('=== Sync Progress Report ===');
  console.log(`Total sources: ${stats.total_sources}`);
  console.log(`Total chunks in DB: ${stats.total_chunks}`);
  console.log(`Checkpoint batch: ${currentBatch + batches.length}`);
  if (failedChunkIds.length > 0) {
    console.log(`Failed chunks: ${failedChunkIds.length}`);
  }
  
  await store.close();
  
  // Clear checkpoint on successful completion
  if (stats.total_chunks >= chunks.length) {
    console.log('\n🎉 Full sync complete! Clearing checkpoint...');
    await checkpointManager.clear();
  } else {
    console.log(`\n⏸️ Sync paused at batch ${currentBatch + batches.length}. Resume with: npm run sync`);
  }
  
  return {
    success: stats.total_chunks >= chunks.length,
    docsProcessed: docs.length,
    chunksCreated: chunks.length,
    chunksStored: stats.total_chunks,
    batchesCompleted: currentBatch + batches.length,
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
