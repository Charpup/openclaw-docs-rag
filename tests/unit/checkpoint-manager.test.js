/**
 * Unit Tests - CheckpointManager
 * Tests for checkpoint state persistence and recovery
 */

const { CheckpointManager } = require('../../src/checkpoint-manager');
const fs = require('fs');
const path = require('path');

describe('CheckpointManager', () => {
  const testCheckpointPath = '/tmp/test-checkpoint.json';
  let manager;

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(testCheckpointPath)) {
      fs.unlinkSync(testCheckpointPath);
    }
    manager = new CheckpointManager(testCheckpointPath);
  });

  afterEach(() => {
    // Clean up after each test
    if (fs.existsSync(testCheckpointPath)) {
      fs.unlinkSync(testCheckpointPath);
    }
  });

  describe('constructor', () => {
    test('should initialize with checkpoint path', () => {
      expect(manager.checkpointPath).toBe(testCheckpointPath);
    });

    test('should create checkpoint file if not exists', () => {
      expect(fs.existsSync(testCheckpointPath)).toBe(false);
      new CheckpointManager(testCheckpointPath);
      // File should be created on first save, not constructor
      expect(fs.existsSync(testCheckpointPath)).toBe(false);
    });
  });

  describe('save', () => {
    test('should persist state to checkpoint file', async () => {
      const state = {
        totalChunks: 3471,
        processedChunkIds: ['chunk1', 'chunk2', 'chunk3'],
        failedChunkIds: ['chunk4'],
        currentBatch: 5,
        lastUpdated: new Date().toISOString()
      };

      await manager.save(state);

      expect(fs.existsSync(testCheckpointPath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(testCheckpointPath, 'utf8'));
      expect(saved.totalChunks).toBe(3471);
      expect(saved.processedChunkIds).toEqual(['chunk1', 'chunk2', 'chunk3']);
      expect(saved.currentBatch).toBe(5);
    });

    test('should overwrite existing checkpoint', async () => {
      await manager.save({ totalChunks: 100, processedChunkIds: ['a'], currentBatch: 1 });
      await manager.save({ totalChunks: 200, processedChunkIds: ['a', 'b'], currentBatch: 2 });

      const saved = JSON.parse(fs.readFileSync(testCheckpointPath, 'utf8'));
      expect(saved.totalChunks).toBe(200);
      expect(saved.processedChunkIds).toEqual(['a', 'b']);
    });
  });

  describe('load', () => {
    test('should return null if no checkpoint exists', async () => {
      const state = await manager.load();
      expect(state).toBeNull();
    });

    test('should return parsed state if checkpoint exists', async () => {
      const expectedState = {
        totalChunks: 3471,
        processedChunkIds: ['chunk1', 'chunk2'],
        failedChunkIds: [],
        currentBatch: 10,
        lastUpdated: '2026-02-14T10:00:00.000Z'
      };
      fs.writeFileSync(testCheckpointPath, JSON.stringify(expectedState));

      const state = await manager.load();

      expect(state).toEqual(expectedState);
    });

    test('should return null for corrupted checkpoint', async () => {
      fs.writeFileSync(testCheckpointPath, 'invalid json');
      const state = await manager.load();
      expect(state).toBeNull();
    });
  });

  describe('clear', () => {
    test('should remove checkpoint file', async () => {
      await manager.save({ totalChunks: 100, processedChunkIds: [] });
      expect(fs.existsSync(testCheckpointPath)).toBe(true);

      await manager.clear();

      expect(fs.existsSync(testCheckpointPath)).toBe(false);
    });

    test('should not throw if file does not exist', async () => {
      expect(fs.existsSync(testCheckpointPath)).toBe(false);
      await expect(manager.clear()).resolves.not.toThrow();
    });
  });

  describe('isResumable', () => {
    test('should return false if no checkpoint exists', async () => {
      const resumable = await manager.isResumable();
      expect(resumable).toBe(false);
    });

    test('should return true for recent checkpoint (< 24h)', async () => {
      const recentState = {
        totalChunks: 1000,
        processedChunkIds: ['a', 'b'],
        failedChunkIds: [],
        currentBatch: 10,
        lastUpdated: new Date().toISOString()  // Now
      };
      await manager.save(recentState);

      const resumable = await manager.isResumable();
      expect(resumable).toBe(true);
    });

    test('should return false for stale checkpoint (> 24h)', async () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 25);  // 25 hours ago

      const staleState = {
        totalChunks: 1000,
        processedChunkIds: ['a', 'b'],
        failedChunkIds: [],
        currentBatch: 10,
        lastUpdated: staleDate.toISOString()
      };
      await manager.save(staleState);

      const resumable = await manager.isResumable();
      expect(resumable).toBe(false);
    });
  });
});
