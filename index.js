/**
 * OpenClaw Docs RAG v4.0 - Real-time llms.txt-based retrieval
 * 
 * Replaces the old sync-based vector search with lightweight keyword matching
 * on llms.txt document list. No database required, no embeddings, no sync.
 */

const { DocsRAG } = require('./src/index');

// Re-export for backward compatibility
module.exports = { DocsRAG };

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'query' || command === 'q') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('Usage: ./query-docs.sh "your question here"');
      console.error('   or: node index.js query "your question here"');
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
    console.log(result.context);

  } else if (command === 'status') {
    const rag = new DocsRAG();
    await rag.init();
    const status = rag.getStatus();
    console.log('Docs-RAG v4.0 Status:');
    console.log(JSON.stringify(status, null, 2));

  } else if (command === 'clear-cache') {
    const rag = new DocsRAG();
    rag.clearCache();
    console.log('✅ Cache cleared');

  } else if (command === 'sync') {
    console.log('⚠️  Sync is deprecated in v4.0');
    console.log('   Documents are now fetched in real-time from llms.txt');
    console.log('   Use "query" command instead.');

  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           OpenClaw Docs RAG v4.0                             ║
║     Real-time Documentation Retrieval (llms.txt-based)       ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  ./query-docs.sh "your question"        Query documentation
  node index.js query "your question"    Same as above
  node index.js status                   Show system status
  node index.js clear-cache              Clear all caches

Examples:
  ./query-docs.sh "how to configure cron jobs"
  ./query-docs.sh "discord bot setup"
  ./query-docs.sh "cli commands"

New in v4.0:
  - No database required (no PostgreSQL/pgvector)
  - No embeddings generation (no API costs)
  - Real-time fetching from llms.txt
  - Simple keyword-based matching
  - 5-minute TTL cache

Legacy commands (deprecated):
  sync                                   Now fetches in real-time
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
