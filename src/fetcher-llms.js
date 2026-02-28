/**
 * fetcher-llms.js - Fetches and parses llms.txt from OpenClaw docs
 * 
 * New real-time fetcher that replaces the old sync-based approach.
 * Fetches llms.txt, parses document URLs, and caches results with TTL.
 */

const fs = require('fs');
const path = require('path');

const LLMS_TXT_URL = 'https://docs.openclaw.ai/llms.txt';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class LlmsFetcher {
  constructor(options = {}) {
    this.cachePath = options.cachePath || path.join(__dirname, '..', 'data', 'llms-cache.json');
    this.cacheTTL = options.cacheTTL || CACHE_TTL_MS;
    this.memoryCache = null;
    this.memoryCacheTime = 0;
  }

  /**
   * Fetch llms.txt and parse document list
   * @returns {Promise<Array<{title: string, url: string, category: string}>>}
   */
  async fetchDocumentList() {
    // Check memory cache first
    if (this.memoryCache && (Date.now() - this.memoryCacheTime) < this.cacheTTL) {
      console.log('[fetcher-llms] Using memory cache');
      return this.memoryCache;
    }

    // Check file cache
    const fileCache = this._loadFileCache();
    if (fileCache && (Date.now() - fileCache.timestamp) < this.cacheTTL) {
      console.log('[fetcher-llms] Using file cache');
      this.memoryCache = fileCache.documents;
      this.memoryCacheTime = fileCache.timestamp;
      return fileCache.documents;
    }

    // Fetch fresh data
    console.log('[fetcher-llms] Fetching fresh llms.txt...');
    try {
      const response = await fetch(LLMS_TXT_URL, {
        headers: {
          'User-Agent': 'OpenClaw-Docs-RAG/4.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const documents = this._parseLlmsTxt(content);
      
      // Update caches
      this._saveFileCache(documents);
      this.memoryCache = documents;
      this.memoryCacheTime = Date.now();
      
      console.log(`[fetcher-llms] Fetched ${documents.length} documents`);
      return documents;
    } catch (error) {
      console.error('[fetcher-llms] Fetch failed:', error.message);
      
      // Fallback to stale cache if available
      if (fileCache) {
        console.log('[fetcher-llms] Falling back to stale cache');
        return fileCache.documents;
      }
      
      throw error;
    }
  }

  /**
   * Parse llms.txt content into structured document list
   * @param {string} content - Raw llms.txt content
   * @returns {Array<{title: string, url: string, category: string}>}
   */
  _parseLlmsTxt(content) {
    const documents = [];
    const lines = content.split('\n');
    let currentCategory = 'General';

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        // Check for category headers
        if (trimmed.startsWith('## ')) {
          currentCategory = trimmed.replace('## ', '').trim();
        }
        continue;
      }

      // Parse markdown links: - [Title](URL)
      const match = trimmed.match(/^-\s*\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const [, title, url] = match;
        documents.push({
          title: title.trim(),
          url: url.trim(),
          category: currentCategory,
          keywords: this._extractKeywords(title)
        });
      }
    }

    return documents;
  }

  /**
   * Extract keywords from title for better matching
   * @param {string} title - Document title
   * @returns {string[]}
   */
  _extractKeywords(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  /**
   * Fetch a specific document's content
   * @param {string} url - Document URL
   * @returns {Promise<string>}
   */
  async fetchDocumentContent(url) {
    // Check memory cache for content
    const cacheKey = `content:${url}`;
    if (this.memoryCache && this.memoryCache._contentCache) {
      const cached = this.memoryCache._contentCache[cacheKey];
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        return cached.content;
      }
    }

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/markdown, text/html;q=0.8, */*;q=0.5',
          'User-Agent': 'OpenClaw-Docs-RAG/4.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      
      // Cache content
      if (!this.memoryCache) this.memoryCache = {};
      if (!this.memoryCache._contentCache) this.memoryCache._contentCache = {};
      this.memoryCache._contentCache[cacheKey] = {
        content,
        timestamp: Date.now()
      };

      return content;
    } catch (error) {
      console.error(`[fetcher-llms] Failed to fetch ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Load cache from file
   * @returns {Object|null}
   */
  _loadFileCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[fetcher-llms] Cache load error:', error.message);
    }
    return null;
  }

  /**
   * Save cache to file
   * @param {Array} documents - Document list
   */
  _saveFileCache(documents) {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const cache = {
        timestamp: Date.now(),
        documents: documents
      };
      
      fs.writeFileSync(this.cachePath, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('[fetcher-llms] Cache save error:', error.message);
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.memoryCache = null;
    this.memoryCacheTime = 0;
    
    try {
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
    } catch (error) {
      console.error('[fetcher-llms] Cache clear error:', error.message);
    }
  }
}

module.exports = { LlmsFetcher };

// CLI usage
if (require.main === module) {
  const fetcher = new LlmsFetcher();
  fetcher.fetchDocumentList()
    .then(docs => {
      console.log(`\nFetched ${docs.length} documents:\n`);
      docs.slice(0, 10).forEach((doc, i) => {
        console.log(`${i + 1}. [${doc.category}] ${doc.title}`);
        console.log(`   URL: ${doc.url}`);
        console.log(`   Keywords: ${doc.keywords.slice(0, 5).join(', ')}`);
        console.log();
      });
      if (docs.length > 10) {
        console.log(`... and ${docs.length - 10} more`);
      }
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
