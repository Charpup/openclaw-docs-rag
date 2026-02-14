/**
 * Unit Tests - BatchSync
 * Tests for batch processing logic
 */

const { BatchSync } = require('../../src/batch-sync');
const { CheckpointManager } = require('../../src/checkpoint-manager');

describe('BatchSync', () => {
  const testCheckpointPath = '/tmp/test-batch-checkpoint.json';
  let batchSync;

  beforeEach(() => {
    batchSync = new BatchSync({
      batchSize: 50,
      checkpointPath: testCheckpointPath,
      apiKey: 'test-api-key'
    });
  });

  afterEach(async () => {
    const manager = new CheckpointManager(testCheckpointPath);
    await manager.clear();
  });

  describe('constructor', () => {
    test('should initialize with valid options', () => {
      expect(batchSync.batchSize).toBe(50);
      expect(batchSync.checkpointPath).toBe(testCheckpointPath);
      expect(batchSync.apiKey).toBe('test-api-key');
      expect(batchSync.checkpointManager).toBeInstanceOf(CheckpointManager);
    });

    test('should use default batch size of 50', () => {
      const bs = new BatchSync({ apiKey: 'key' });
      expect(bs.batchSize).toBe(50);
    });

    test('should throw if batch size <= 0', () => {
      expect(() => {
        new BatchSync({ batchSize: 0, apiKey: 'key' });
      }).toThrow();
    });

    test('should throw if batch size > 500', () => {
      expect(() => {
        new BatchSync({ batchSize: 501, apiKey: 'key' });
      }).toThrow();
    });
  });

  describe('getProgress', () => {
    test('should return zero progress for fresh sync', async () => {
      // Mock internal state
      batchSync.totalChunks = 3471;
      batchSync.processedChunks = 0;
      batchSync.currentBatch = 0;

      const progress = await batchSync.getProgress();

      expect(progress.totalChunks).toBe(3471);
      expect(progress.processedChunks).toBe(0);
      expect(progress.currentBatch).toBe(0);
      expect(progress.totalBatches).toBe(70);  // ceil(3471/50)
      expect(progress.percentage).toBe(0);
    });

    test('should calculate progress correctly', async () => {
      batchSync.totalChunks = 3471;
      batchSync.processedChunks = 1500;
      batchSync.currentBatch = 30;

      const progress = await batchSync.getProgress();

      expect(progress.processedChunks).toBe(1500);
      expect(progress.percentage).toBeCloseTo(43.2, 1);  // 1500/3471
    });
  });

  describe('createBatches', () => {
    test('should create correct number of batches', () => {
      const chunks = Array(125).fill(null).map((_, i) => ({ id: i }));
      
      const batches = batchSync.createBatches(chunks, 50);

      expect(batches).toHaveLength(3);  // 50 + 50 + 25
      expect(batches[0]).toHaveLength(50);
      expect(batches[1]).toHaveLength(50);
      expect(batches[2]).toHaveLength(25);
    });

    test('should handle empty chunks array', () => {
      const batches = batchSync.createBatches([], 50);
      expect(batches).toHaveLength(0);
    });

    test('should handle exact multiple batch size', () => {
      const chunks = Array(100).fill(null).map((_, i) => ({ id: i }));
      
      const batches = batchSync.createBatches(chunks, 50);

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(50);
      expect(batches[1]).toHaveLength(50);
    });
  });

  describe('shouldSkipChunk', () => {
    test('should return true for already processed chunks', () => {
      // Create a chunk and compute its hash
      const chunk = { 
        text: 'Test content for hashing',
        source: 'https://example.com/doc',
        heading: 'Test Section'
      };
      const hash = batchSync.deduplicator.computeHash(chunk);
      
      // Now check if it's processed
      const processedIds = [hash];
      
      const shouldSkip = batchSync.shouldSkipChunk(chunk, processedIds);
      expect(shouldSkip).toBe(true);
    });

    test('should return false for unprocessed chunks', () => {
      const chunk = { 
        text: 'Different content',
        source: 'https://example.com/doc',
        heading: 'Test Section'
      };
      const hash = batchSync.deduplicator.computeHash(chunk);
      
      const processedIds = ['some-other-hash'];
      
      const shouldSkip = batchSync.shouldSkipChunk(chunk, processedIds);
      expect(shouldSkip).toBe(false);
    });
  });
});
