/**
 * Unit Tests - ChunkDeduplicator
 * Tests for content hashing and deduplication logic
 */

const { ChunkDeduplicator } = require('../../src/chunk-deduplicator');

describe('ChunkDeduplicator', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new ChunkDeduplicator();
  });

  describe('computeHash', () => {
    test('should compute consistent hash for same content', () => {
      const chunk = {
        text: 'This is test content',
        source: 'https://example.com/doc',
        heading: 'Test Section'
      };

      const hash1 = deduplicator.computeHash(chunk);
      const hash2 = deduplicator.computeHash(chunk);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32);  // MD5 hash length
    });

    test('should compute different hashes for different content', () => {
      const chunk1 = { text: 'Content A', source: 'a.com', heading: 'A' };
      const chunk2 = { text: 'Content B', source: 'b.com', heading: 'B' };

      const hash1 = deduplicator.computeHash(chunk1);
      const hash2 = deduplicator.computeHash(chunk2);

      expect(hash1).not.toBe(hash2);
    });

    test('should normalize content before hashing', () => {
      const chunk1 = { text: '  Hello World  ', source: 'a.com', heading: 'H1' };
      const chunk2 = { text: 'Hello World', source: 'a.com', heading: 'H1' };

      const hash1 = deduplicator.computeHash(chunk1);
      const hash2 = deduplicator.computeHash(chunk2);

      expect(hash1).toBe(hash2);  // Should be same after normalization
    });

    test('should include source and heading in hash', () => {
      const baseChunk = { text: 'Same content', source: 'a.com', heading: 'H1' };
      const differentSource = { text: 'Same content', source: 'b.com', heading: 'H1' };
      const differentHeading = { text: 'Same content', source: 'a.com', heading: 'H2' };

      const hashBase = deduplicator.computeHash(baseChunk);
      const hashSource = deduplicator.computeHash(differentSource);
      const hashHeading = deduplicator.computeHash(differentHeading);

      expect(hashSource).not.toBe(hashBase);
      expect(hashHeading).not.toBe(hashBase);
    });
  });

  describe('isProcessed', () => {
    test('should return true if hash is in processed list', () => {
      const processedHashes = ['hash1', 'hash2', 'hash3'];
      
      const isProcessed = deduplicator.isProcessed('hash2', processedHashes);
      
      expect(isProcessed).toBe(true);
    });

    test('should return false if hash is not in processed list', () => {
      const processedHashes = ['hash1', 'hash2', 'hash3'];
      
      const isProcessed = deduplicator.isProcessed('hash4', processedHashes);
      
      expect(isProcessed).toBe(false);
    });

    test('should return false for empty processed list', () => {
      const isProcessed = deduplicator.isProcessed('hash1', []);
      expect(isProcessed).toBe(false);
    });

    test('should handle exact match only', () => {
      const processedHashes = ['hash123'];
      
      expect(deduplicator.isProcessed('hash12', processedHashes)).toBe(false);
      expect(deduplicator.isProcessed('hash1234', processedHashes)).toBe(false);
    });
  });
});
