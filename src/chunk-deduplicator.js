/**
 * ChunkDeduplicator - Ensures idempotent processing via content hashing
 * Computes hashes and tracks processed chunks to avoid duplicates
 */

const crypto = require('crypto');

class ChunkDeduplicator {
  /**
   * Compute hash for a chunk based on content, source, and heading
   * @param {Object} chunk - Document chunk
   * @param {string} chunk.text - Chunk text content
   * @param {string} chunk.source - Source URL
   * @param {string} chunk.heading - Section heading
   * @returns {string} MD5 hash
   */
  computeHash(chunk) {
    // Normalize content: trim whitespace, lowercase
    const normalizedText = (chunk.text || '').trim().toLowerCase();
    const normalizedSource = (chunk.source || '').trim();
    const normalizedHeading = (chunk.heading || '').trim();
    
    // Create deterministic hash input
    const hashInput = `${normalizedSource}::${normalizedHeading}::${normalizedText}`;
    
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }

  /**
   * Check if a chunk has already been processed
   * @param {string} chunkHash - Hash of the chunk to check
   * @param {string[]} processedHashes - Array of already processed chunk hashes
   * @returns {boolean}
   */
  isProcessed(chunkHash, processedHashes) {
    if (!Array.isArray(processedHashes)) {
      return false;
    }
    return processedHashes.includes(chunkHash);
  }
}

module.exports = { ChunkDeduplicator };
