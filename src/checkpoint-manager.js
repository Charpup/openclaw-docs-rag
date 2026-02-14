/**
 * CheckpointManager - Manages checkpoint state for resume capability
 * Provides atomic save/load/clear operations for sync progress
 */

const fs = require('fs').promises;
const path = require('path');

class CheckpointManager {
  constructor(checkpointPath) {
    this.checkpointPath = checkpointPath;
  }

  /**
   * Save state to checkpoint file atomically
   * @param {Object} state - Checkpoint state
   * @param {number} state.totalChunks - Total number of chunks
   * @param {string[]} state.processedChunkIds - Array of processed chunk IDs
   * @param {string[]} state.failedChunkIds - Array of failed chunk IDs
   * @param {number} state.currentBatch - Current batch number
   * @param {string} state.lastUpdated - ISO timestamp
   */
  async save(state) {
    const tempPath = `${this.checkpointPath}.tmp`;
    
    // Add lastUpdated if not provided
    const stateWithTimestamp = {
      ...state,
      lastUpdated: state.lastUpdated || new Date().toISOString()
    };
    
    // Write to temp file first (atomic operation)
    await fs.writeFile(
      tempPath, 
      JSON.stringify(stateWithTimestamp, null, 2),
      'utf8'
    );
    
    // Rename temp to final (atomic on POSIX systems)
    await fs.rename(tempPath, this.checkpointPath);
  }

  /**
   * Load state from checkpoint file
   * @returns {Object|null} Checkpoint state or null if not exists/invalid
   */
  async load() {
    try {
      const content = await fs.readFile(this.checkpointPath, 'utf8');
      const state = JSON.parse(content);
      
      // Validate required fields
      if (!this._isValidState(state)) {
        return null;
      }
      
      return state;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  /**
   * Clear checkpoint file
   */
  async clear() {
    try {
      await fs.unlink(this.checkpointPath);
    } catch (error) {
      // File doesn't exist, ignore error
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if checkpoint is resumable (exists and not stale)
   * @param {number} staleHours - Hours after which checkpoint is considered stale (default: 24)
   * @returns {boolean}
   */
  async isResumable(staleHours = 24) {
    const state = await this.load();
    
    if (!state) {
      return false;
    }
    
    // Check if checkpoint is stale
    const lastUpdated = new Date(state.lastUpdated);
    const now = new Date();
    const hoursDiff = (now - lastUpdated) / (1000 * 60 * 60);
    
    if (hoursDiff > staleHours) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate checkpoint state structure
   * @private
   */
  _isValidState(state) {
    return (
      state &&
      typeof state.totalChunks === 'number' &&
      Array.isArray(state.processedChunkIds) &&
      Array.isArray(state.failedChunkIds) &&
      typeof state.currentBatch === 'number' &&
      typeof state.lastUpdated === 'string'
    );
  }
}

module.exports = { CheckpointManager };
