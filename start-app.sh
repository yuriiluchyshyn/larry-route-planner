#!/bin/bash

cd "$(dirname "$0")"

echo "🚛 Starting Larry Route Planner on port 7739..."

# Check if proxy is running
if ! curl -s http://localhost:8847/health > /dev/null 2>&1; then
  echo "⚠️  Warning: Proxy server is not running on port 8847"
  echo "💡 Start proxy first with: ./start-proxy.sh"
  echo "🔄 Or use: ./run.sh (starts both proxy and app)"
  echo ""
  echo "❓ Continue anyway? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
  fi
else
  echo "✅ Proxy server is running"
fi

npm run dev -- --port 7739