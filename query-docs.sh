#!/bin/bash
# query-docs.sh - Query OpenClaw documentation (Claw-Doc v5.0)

set -e

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
    echo "Usage: ./query-docs.sh \"your question here\""
    echo ""
    echo "Examples:"
    echo "  ./query-docs.sh \"how to configure cron jobs\""
    echo "  ./query-docs.sh \"OpenClaw 配置怎么改\""
    echo "  ./query-docs.sh \"discord bot setup\""
    exit 1
fi

node index.js query "$@"
