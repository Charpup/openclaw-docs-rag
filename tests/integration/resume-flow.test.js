/**
 * Integration Tests - Resume Flow
 * Tests for checkpoint save/resume across process restarts
 */

const { BatchSync } = require('../../src/batch-sync');
const { CheckpointManager } = require('../../src/checkpoint-manager');
const fs = require('fs');

describe('Resume Flow Integration', () => {
  const checkpointPath = '/tmp/integration-checkpoint.json';

  afterEach(async () => {
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
    }
  });

  test('should resume from checkpoint after simulated crash', async () => {
    // Phase 1: Initial sync, process some batches, simulate crash
    const sync1 = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    // Simulate processing first 3 batches (150 chunks)
    await sync1.checkpointManager.save({
      totalChunks: 3471,
      processedChunkIds: Array(150).fill(0).map((_, i) => `chunk-${i}`),
      failedChunkIds: [],
      currentBatch: 3,
      lastUpdated: new Date().toISOString()
    });

    // Phase 2: New sync instance, should resume
    const sync2 = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    const checkpoint = await sync2.checkpointManager.load();
    expect(checkpoint).not.toBeNull();
    expect(checkpoint.currentBatch).toBe(3);
    expect(checkpoint.processedChunkIds).toHaveLength(150);

    // Verify it's resumable
    const resumable = await sync2.checkpointManager.isResumable();
    expect(resumable).toBe(true);
  });

  test('should not duplicate chunks when resuming', async () => {
    const processedIds = ['chunk-0', 'chunk-1', 'chunk-2'];
    
    const sync = new BatchSync({
      batchSize: 50,
      checkpointPath,
      apiKey: 'test-key'
    });

    await sync.checkpointManager.save({
      totalChunks: 10,
      processedChunkIds: processedIds,
      failedChunkIds: [],
      currentBatch: 1,
      lastUpdated: new Date().toISOString()
    });

    // Simulate checking if chunks should be skipped
    const chunk0 = { hash: 'chunk-0', text: 'content 0' };
    const chunk3 = { hash: 'chunk-3', text: 'content 3' };

    expect(sync.shouldSkipChunk(chunk0, processedIds)).toBe(true);
    expect(sync.shouldSkipChunk(chunk3, processedIds)).toBe(false);
  });

  test('should handle stale checkpoint gracefully', async () => {
    const staleDate = new Date();
    staleDate.setHours(staleDate.getHours() - 25);

    const manager = new CheckpointManager(checkpointPath);
    await manager.save({
      totalChunks: 100,
      processedChunkIds: ['a', 'b'],
      failedChunkIds: [],
      currentBatch: 2,
      lastUpdated: staleDate.toISOString()
    });

    const resumable = await manager.isResumable();
    expect(resumable).toBe(false);
  });

  test('should handle concurrent checkpoint writes safely', async () => {
    const manager = new CheckpointManager(checkpointPath);

    // Simulate concurrent writes
    const write1 = manager.save({
      totalChunks: 100,
      processedChunkIds: ['a'],
      failedChunkIds: [],
      currentBatch: 1,
      lastUpdated: new Date().toISOString()
    });

    const write2 = manager.save({
      totalChunks: 100,
      processedChunkIds: ['a', 'b'],
      failedChunkIds: [],
      currentBatch: 2,
      lastUpdated: new Date().toISOString()
    });

    // Both should complete without error
    await expect(write1).resolves.not.toThrow();
    await expect(write2).resolves.not.toThrow();

    // Checkpoint should be valid (one of the writes)
    const state = await manager.load();
    expect(state).not.toBeNull();
    expect(state.currentBatch).toBeGreaterThanOrEqual(1);
  });
});
