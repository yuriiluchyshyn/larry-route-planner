#!/bin/bash

cd "$(dirname "$0")"

echo "🔄 Starting CORS proxy server on port 8847..."

# Kill any existing proxy
pkill -f "node proxy-server.cjs" 2>/dev/null || true

# Start proxy
node proxy-server.cjs &
PROXY_PID=$!

echo "Proxy server started with PID: $PROXY_PID"

# Wait for proxy to be ready
echo "⏳ Waiting for proxy server to be ready..."
for i in {1..10}; do
  if curl -s http://localhost:8847/health > /dev/null 2>&1; then
    echo "✅ Proxy server is ready at http://localhost:8847"
    echo "🔍 Health check: $(curl -s http://localhost:8847/health)"
    break
  fi
  sleep 1
  echo "   Attempt $i/10..."
done

if ! curl -s http://localhost:8847/health > /dev/null 2>&1; then
  echo "❌ Error: Proxy server failed to start properly"
  exit 1
fi

echo "🎉 Proxy server is running successfully!"
echo "📝 To stop: pkill -f 'node proxy-server.cjs'"

# Keep running
wait $PROXY_PID