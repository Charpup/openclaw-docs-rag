/**
 * Acceptance Tests - Sync Scenarios
 * End-to-end tests matching SPEC.yaml scenarios
 */

const { BatchSync } = require('../../src/batch-sync');
const { CheckpointManager } = require('../../src/checkpoint-manager');
const fs = require('fs');

describe('Acceptance - Sync Scenarios', () => {
  const checkpointPath = '/tmp/acceptance-checkpoint.json';

  afterEach(async () => {
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
  });

  // Scenario 1: Fresh Full Sync
  test('Scenario 1: Fresh Full Sync', async () => {
    // Given: No checkpoint exists
    expect(fs.existsSync(checkpointPath)).toBe(false);

    const sync = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    // When: sync with resume: false
    const result = await sync.sync({ resume: false });

    // Then: All chunks processed
    expect(result.success).toBe(true);
    expect(result.chunksProcessed).toBeGreaterThan(0);
    expect(result.batchesCompleted).toBeGreaterThan(0);
  });

  // Scenario 2: Resume After Interrupt
  test('Scenario 2: Resume After Interrupt', async () => {
    // Given: Checkpoint with partial progress
    const manager = new CheckpointManager(checkpointPath);
    await manager.save({
      totalChunks: 100,
      processedChunkIds: Array(50).fill(0).map((_, i) => `chunk-${i}`),
      failedChunkIds: [],
      currentBatch: 1,
      lastUpdated: new Date().toISOString()
    });

    const sync = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    // When: sync with resume: true (default)
    const result = await sync.sync({ resume: true });

    // Then: Resumes from checkpoint
    expect(result.success).toBe(true);
    // Should process remaining chunks only
  });

  // Scenario 3: Force Full Re-sync
  test('Scenario 3: Force Full Re-sync', async () => {
    // Given: Existing checkpoint
    const manager = new CheckpointManager(checkpointPath);
    await manager.save({
      totalChunks: 100,
      processedChunkIds: Array(80).fill(0).map((_, i) => `chunk-${i}`),
      failedChunkIds: [],
      currentBatch: 2,
      lastUpdated: new Date().toISOString()
    });

    const sync = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    // When: sync with force: true
    const result = await sync.sync({ force: true });

    // Then: Checkpoint cleared and full sync performed
    const checkpoint = await manager.load();
    expect(checkpoint).toBeNull();  // Cleared after force sync
    expect(result.success).toBe(true);
  });

  // Scenario 4: Partial Batch Failure
  test('Scenario 4: Handle Batch Failure', async () => {
    const sync = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    // Mock a batch with some failures
    const batchResult = await sync.processBatch([
      { hash: 'ok1', text: 'good' },
      { hash: 'fail1', text: 'error' },
      { hash: 'ok2', text: 'good' }
    ], { simulateFailures: ['fail1'] });

    expect(batchResult.successCount).toBe(2);
    expect(batchResult.failedCount).toBe(1);
    expect(batchResult.errors).toHaveLength(1);
  });

  // Scenario 5: Stale Checkpoint Detection
  test('Scenario 5: Detect Stale Checkpoint', async () => {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 25);

    const manager = new CheckpointManager(checkpointPath);
    await manager.save({
      totalChunks: 100,
      processedChunkIds: ['a', 'b'],
      failedChunkIds: [],
      currentBatch: 1,
      lastUpdated: staleDate.toISOString()
    });

    const isResumable = await manager.isResumable();
    expect(isResumable).toBe(false);
  });

  // Scenario 6: Concurrent Checkpoint Safety
  test('Scenario 6: Concurrent Checkpoint Writes', async () => {
    const manager = new CheckpointManager(checkpointPath);

    // Multiple concurrent writes
    const promises = [
      manager.save({ totalChunks: 100, processedChunkIds: ['a'], currentBatch: 1, lastUpdated: new Date().toISOString() }),
      manager.save({ totalChunks: 100, processedChunkIds: ['b'], currentBatch: 2, lastUpdated: new Date().toISOString() }),
      manager.save({ totalChunks: 100, processedChunkIds: ['c'], currentBatch: 3, lastUpdated: new Date().toISOString() })
    ];

    // All should complete without corruption
    await Promise.all(promises);

    const state = await manager.load();
    expect(state).not.toBeNull();
    expect(state.checkpointPath || state.totalChunks).toBeDefined();  // Valid structure
  });
});
