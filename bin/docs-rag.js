#!/usr/bin/env node
/**
 * docs-rag CLI - OpenClaw Docs RAG v3.1.0
 * Usage:
 *   docs-rag query <question> [--top-k N]
 *   docs-rag sync [--force] [--max-batches N]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { queryDocs, syncDocs } = require('../index.js');

const args = process.argv.slice(2);
const cmd = args[0];

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') flags.force = true;
    if (args[i] === '--top-k' && args[i + 1]) flags.topK = parseInt(args[++i], 10);
    if (args[i] === '--max-batches' && args[i + 1]) flags.maxBatches = parseInt(args[++i], 10);
  }
  return flags;
}

async function main() {
  if (cmd === 'query') {
    const question = args.slice(1).filter(a => !a.startsWith('--')).join(' ');
    if (!question) {
      console.error('Usage: docs-rag query <question> [--top-k N]');
      process.exit(1);
    }
    const flags = parseFlags(args.slice(1));
    const result = await queryDocs(question, { topK: flags.topK || 5 });
    if (result.results && result.results.length > 0) {
      result.results.forEach((r, i) => {
        console.log(`\n[${i + 1}] ${r.source || r.url || 'unknown'} (score: ${(r.score || 0).toFixed(3)})`);
        console.log(r.text || r.content || '');
      });
    } else {
      console.log('No results found.');
    }
  } else if (cmd === 'sync') {
    const flags = parseFlags(args.slice(1));
    const result = await syncDocs({
      force: flags.force || false,
      maxBatches: flags.maxBatches || null
    });
    if (result.status === 'partial') {
      console.log(`\nPartial sync complete: ${result.chunksStored} chunks stored, ${result.batchesRemaining} batches remaining.`);
    } else if (result.success) {
      console.log(`\nSync complete: ${result.chunksStored} chunks stored.`);
    } else {
      console.log(`\nSync finished with issues. Check logs.`);
    }
  } else {
    console.log('OpenClaw Docs RAG v3.1.0');
    console.log('');
    console.log('Usage:');
    console.log('  docs-rag query <question> [--top-k N]');
    console.log('  docs-rag sync [--force] [--max-batches N]');
    console.log('');
    console.log('Examples:');
    console.log('  docs-rag query "what is an agent"');
    console.log('  docs-rag sync --max-batches 10');
    console.log('  docs-rag sync --force --max-batches 20');
    process.exit(cmd ? 1 : 0);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
