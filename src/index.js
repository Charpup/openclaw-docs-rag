/**
 * index.js - Main entry point for Docs-RAG v4.0
 * 
 * New real-time retrieval system based on llms.txt
 * Replaces the old sync-based vector search approach
 */

const { LlmsFetcher } = require('./fetcher-llms');
const { QueryEngine } = require('./query-engine');
const { TTLCache } = require('./cache');

class DocsRAG {
  constructor(options = {}) {
    this.fetcher = new LlmsFetcher(options.fetcher);
    this.engine = new QueryEngine(options.engine);
    this.contentCache = new TTLCache({ 
      ttl: options.contentCacheTTL || 5 * 60 * 1000, // 5 minutes
      maxSize: options.contentCacheSize || 50
    });
    this.documents = null;
  }

  /**
   * Initialize and load document list
   */
  async init() {
    this.documents = await this.fetcher.fetchDocumentList();
    console.log(`[docs-rag] Loaded ${this.documents.length} documents`);
  }

  /**
   * Query documentation and return relevant results
   * @param {string} query - User query
   * @param {Object} options - Query options
   * @returns {Promise<{results: Array, context: string, sources: Array}>}
   */
  async query(query, options = {}) {
    const topK = options.topK || 5;
    const includeContent = options.includeContent !== false;

    // Ensure documents are loaded
    if (!this.documents) {
      await this.init();
    }

    // Search for relevant documents
    const searchResults = this.engine.search(query, this.documents, { topK });

    if (searchResults.length === 0) {
      return {
        results: [],
        context: 'No relevant documentation found.',
        sources: []
      };
    }

    // Fetch content for each result (with caching)
    const resultsWithContent = await Promise.all(
      searchResults.map(async (result) => {
        const cacheKey = result.url;
        let content = this.contentCache.get(cacheKey);

        if (!content && includeContent) {
          try {
            content = await this.fetcher.fetchDocumentContent(result.url);
            this.contentCache.set(cacheKey, content);
          } catch (error) {
            console.error(`[docs-rag] Failed to fetch ${result.url}:`, error.message);
            content = 'Failed to load content';
          }
        }

        return {
          ...result,
          content: content || 'Content not cached'
        };
      })
    );

    // Format context for LLM
    const context = this.engine.formatContext(resultsWithContent);
    const sources = this.engine.getSources(resultsWithContent);

    return {
      results: resultsWithContent,
      context,
      sources
    };
  }

  /**
   * Get quick answer without full content
   * @param {string} query - User query
   * @returns {Promise<{results: Array, sources: Array}>}
   */
  async quickQuery(query) {
    return this.query(query, { includeContent: false });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.fetcher.clearCache();
    this.contentCache.clear();
    this.documents = null;
  }

  /**
   * Get system status
   */
  getStatus() {
    return {
      documentsLoaded: this.documents ? this.documents.length : 0,
      contentCacheSize: this.contentCache.size(),
      fetcherCachePath: this.fetcher.cachePath
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'query' || command === 'q') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('Usage: node index.js query "your question here"');
      process.exit(1);
    }

    const rag = new DocsRAG();
    console.log(`Query: "${query}"\n`);
    
    const startTime = Date.now();
    const result = await rag.query(query);
    const duration = Date.now() - startTime;

    console.log(`Found ${result.results.length} results in ${duration}ms\n`);
    
    result.sources.forEach((source, i) => {
      console.log(`${i + 1}. ${source.title}`);
      console.log(`   Category: ${source.category}`);
      console.log(`   Score: ${source.score.toFixed(2)}`);
      console.log(`   URL: ${source.url}`);
      console.log();
    });

    console.log('--- Context for LLM ---\n');
    console.log(result.context.slice(0, 2000) + '...');

  } else if (command === 'status') {
    const rag = new DocsRAG();
    await rag.init();
    console.log('Status:', JSON.stringify(rag.getStatus(), null, 2));

  } else if (command === 'clear-cache') {
    const rag = new DocsRAG();
    rag.clearCache();
    console.log('Cache cleared');

  } else {
    console.log(`
Docs-RAG v4.0 - Real-time Documentation Retrieval

Usage:
  node index.js query "your question"    Query documentation
  node index.js status                   Show system status
  node index.js clear-cache              Clear all caches

Examples:
  node index.js query "how to configure cron jobs"
  node index.js query "discord bot setup"
`);
  }
}

// Export for programmatic use
module.exports = { DocsRAG, LlmsFetcher, QueryEngine, TTLCache };

// Run CLI if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
