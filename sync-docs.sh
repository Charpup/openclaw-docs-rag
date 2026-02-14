#!/bin/bash
# sync-docs.sh - Sync OpenClaw documentation to vector store

set -e

# Load environment variables from .env file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

echo "=== OpenClaw Docs Sync ==="

# Check environment
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY not set"
    exit 1
fi

# Parse arguments
FORCE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run sync
node -e "
const { syncDocs } = require('./index.js');
syncDocs({ force: $FORCE })
  .then(result => {
    console.log('Sync complete:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
"
