#!/bin/bash
# query-docs.sh - Query OpenClaw documentation

set -e

# Load environment variables from .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

if [ $# -eq 0 ]; then
    echo "Usage: $0 <query> [--top-k N]"
    exit 1
fi

QUERY="$1"
TOP_K=5

# Parse arguments
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --top-k)
            TOP_K="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run query
node -e "
const { queryDocs } = require('./index.js');
queryDocs('$QUERY', { topK: $TOP_K })
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('Query failed:', err);
    process.exit(1);
  });
"
