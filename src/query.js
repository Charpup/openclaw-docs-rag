/**
 * Query Engine - RAG query interface
 */
const VectorStore = require('./store');
const { generateEmbedding } = require('./embedder');

class QueryEngine {
  constructor(config = {}) {
    this.store = new VectorStore(config);
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  }

  /**
   * Initialize the query engine
   */
  async init() {
    await this.store.init();
  }

  /**
   * Query documentation with natural language
   */
  async query(question, options = {}) {
    const { topK = 5 } = options;
    
    console.log(`Querying: "${question}"`);
    
    // 1. Generate embedding for the question
    const startTime = Date.now();
    const embedding = await generateEmbedding(question, this.apiKey);
    
    // 2. Search vector store
    const results = await this.store.search(embedding.vector, { topK });
    
    const queryTime = Date.now() - startTime;
    console.log(`Found ${results.length} results in ${queryTime}ms`);
    
    return {
      question,
      results,
      queryTime,
      totalChunks: await this.store.getStats()
    };
  }

  /**
   * Get context for a query (formatted for LLM consumption)
   */
  async getContext(question, options = {}) {
    const { topK = 5, maxContextLength = 4000 } = options;
    
    const { results } = await this.query(question, { topK });
    
    // Format results as context
    let context = '';
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chunk = `\n[${i + 1}] Source: ${result.metadata.source}\nTitle: ${result.metadata.title}\n${result.text}\n`;
      
      if ((context + chunk).length > maxContextLength) {
        break;
      }
      context += chunk;
    }
    
    return {
      question,
      context: context.trim(),
      sources: results.map(r => ({
        source: r.metadata.source,
        title: r.metadata.title,
        score: r.score
      }))
    };
  }

  /**
   * Close connections
   */
  async close() {
    await this.store.close();
  }
}

module.exports = QueryEngine;
