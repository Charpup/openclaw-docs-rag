#!/bin/bash
# query-docs.sh - Query OpenClaw documentation (v4.0)

set -e

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
    echo "Usage: ./query-docs.sh \"your question here\""
    echo ""
    echo "Examples:"
    echo "  ./query-docs.sh \"how to configure cron jobs\""
    echo "  ./query-docs.sh \"discord bot setup\""
    echo "  ./query-docs.sh \"cli commands\""
    exit 1
fi

node index.js query "$@"
