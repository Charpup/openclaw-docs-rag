/**
 * query-engine.js - Keyword-based document selection engine
 * 
 * Replaces vector similarity search with simple keyword matching.
 * Much lighter weight and suitable for llms.txt-based retrieval.
 */

class QueryEngine {
  constructor(options = {}) {
    this.stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
      'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'am', 'it', 'its', 'we', 'our', 'ours',
      'you', 'your', 'yours', 'they', 'them', 'their', 'theirs', 'i', 'me',
      'my', 'mine', 'he', 'him', 'his', 'she', 'her', 'hers', 'how', 'openclaw'
    ]);
    
    this.categoryWeights = {
      'CLI Reference': 1.2,
      'Channels': 1.1,
      'Automation': 1.1,
      'Configuration': 1.0,
      'General': 1.0
    };
  }

  /**
   * Tokenize and extract keywords from query
   * @param {string} query - User query
   * @returns {string[]}
   */
  extractQueryKeywords(query) {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !this.stopWords.has(word)
      );
  }

  /**
   * Calculate relevance score between query and document
   * @param {string[]} queryKeywords - Keywords from query
   * @param {Object} doc - Document object
   * @returns {number}
   */
  calculateRelevance(queryKeywords, doc) {
    let score = 0;
    const docKeywords = new Set(doc.keywords || []);
    const titleLower = doc.title.toLowerCase();
    const categoryLower = (doc.category || '').toLowerCase();
    
    for (const keyword of queryKeywords) {
      // Exact match in title (highest weight)
      if (titleLower.includes(keyword)) {
        score += 10;
        // Bonus for word boundary match
        const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (wordBoundaryRegex.test(titleLower)) {
          score += 5;
        }
      }
      
      // Match in keywords
      if (docKeywords.has(keyword)) {
        score += 3;
      }
      
      // Match in category
      if (categoryLower.includes(keyword)) {
        score += 2;
      }
      
      // Partial match in title
      for (const docKeyword of docKeywords) {
        if (docKeyword.includes(keyword) || keyword.includes(docKeyword)) {
          score += 1;
        }
      }
    }

    // Apply category weight
    const categoryWeight = this.categoryWeights[doc.category] || 1.0;
    score *= categoryWeight;

    return score;
  }

  /**
   * Search documents and return ranked results
   * @param {string} query - User query
   * @param {Array<Object>} documents - Document list from fetcher
   * @param {Object} options - Search options
   * @returns {Array<Object>}
   */
  search(query, documents, options = {}) {
    const topK = options.topK || 5;
    const minScore = options.minScore || 1;
    
    const queryKeywords = this.extractQueryKeywords(query);
    
    if (queryKeywords.length === 0) {
      // If no meaningful keywords, return first N documents
      return documents.slice(0, topK).map(doc => ({
        ...doc,
        score: 1
      }));
    }

    // Score all documents
    const scored = documents.map(doc => ({
      ...doc,
      score: this.calculateRelevance(queryKeywords, doc)
    }));

    // Filter by minimum score and sort
    const results = scored
      .filter(doc => doc.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * Get context string for LLM from search results
   * @param {Array<Object>} results - Search results with content
   * @returns {string}
   */
  formatContext(results) {
    if (!results || results.length === 0) {
      return 'No relevant documentation found.';
    }

    const sections = results.map((result, index) => {
      const content = result.content 
        ? result.content.slice(0, 3000) // Limit content length
        : 'Content not available';
      
      return `## Document ${index + 1}: ${result.title}
**Category:** ${result.category}
**Relevance:** ${result.score.toFixed(2)}
**URL:** ${result.url}

${content}
`;
    });

    return sections.join('\n---\n\n');
  }

  /**
   * Get sources list for citation
   * @param {Array<Object>} results - Search results
   * @returns {Array<Object>}
   */
  getSources(results) {
    return results.map((result, index) => ({
      index: index + 1,
      title: result.title,
      url: result.url,
      category: result.category,
      score: result.score
    }));
  }
}

module.exports = { QueryEngine };

// CLI usage
if (require.main === module) {
  const engine = new QueryEngine();
  
  // Test documents
  const testDocs = [
    { title: 'Cron Jobs', url: 'https://docs.openclaw.ai/automation/cron-jobs.md', category: 'Automation', keywords: ['cron', 'jobs', 'automation', 'schedule'] },
    { title: 'Discord Channel', url: 'https://docs.openclaw.ai/channels/discord.md', category: 'Channels', keywords: ['discord', 'channel', 'bot'] },
    { title: 'CLI Reference', url: 'https://docs.openclaw.ai/cli/index.md', category: 'CLI Reference', keywords: ['cli', 'command', 'reference'] },
    { title: 'Configuration', url: 'https://docs.openclaw.ai/config.md', category: 'Configuration', keywords: ['config', 'configuration', 'settings'] }
  ];

  const testQueries = [
    'how to setup cron jobs',
    'discord bot configuration',
    'cli commands reference'
  ];

  console.log('Query Engine Test\n');
  
  for (const query of testQueries) {
    console.log(`Query: "${query}"`);
    console.log('Results:');
    const results = engine.search(query, testDocs, { topK: 3 });
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title} (score: ${r.score.toFixed(2)})`);
    });
    console.log();
  }
}
