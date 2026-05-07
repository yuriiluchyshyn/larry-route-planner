#!/bin/bash

cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if proxy server is already running
if ! lsof -i :8847 > /dev/null 2>&1; then
  echo "🔄 Starting CORS proxy server on port 8847..."
  node proxy-server.cjs &
  PROXY_PID=$!
  echo "Proxy server started with PID: $PROXY_PID"
  
  # Wait for proxy to be ready
  echo "⏳ Waiting for proxy server to be ready..."
  for i in {1..10}; do
    if curl -s http://localhost:8847/health > /dev/null 2>&1; then
      echo "✅ Proxy server is ready!"
      break
    fi
    sleep 1
    echo "   Attempt $i/10..."
  done
else
  echo "✅ Proxy server already running on port 8847"
fi

echo "🚛 Starting Larry Route Planner on port 7739..."

# Final check that proxy is working
if ! curl -s http://localhost:8847/health > /dev/null 2>&1; then
  echo "❌ Error: Proxy server is not responding. Please check the logs above."
  exit 1
fi

npm run dev -- --port 7739

# Cleanup proxy on exit
trap 'kill $PROXY_PID 2>/dev/null' EXIT
