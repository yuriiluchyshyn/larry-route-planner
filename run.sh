#!/bin/bash

cd "$(dirname "$0")"

# Ports used by this app
PROXY_PORT=8847
DEV_PORT=7739

# Kill any processes running on our ports
kill_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "🔪 Killing processes on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null
    sleep 1
  else
    echo "✓ Port $port is free"
  fi
}

echo "🧹 Cleaning up ports..."
kill_port $PROXY_PORT
kill_port $DEV_PORT

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🔄 Starting CORS proxy server on port $PROXY_PORT..."
node proxy-server.cjs &
PROXY_PID=$!
echo "Proxy server started with PID: $PROXY_PID"

# Wait for proxy to be ready
echo "⏳ Waiting for proxy server to be ready..."
for i in {1..10}; do
  if curl -s http://localhost:$PROXY_PORT/health > /dev/null 2>&1; then
    echo "✅ Proxy server is ready!"
    break
  fi
  sleep 1
  echo "   Attempt $i/10..."
done

# Final check that proxy is working
if ! curl -s http://localhost:$PROXY_PORT/health > /dev/null 2>&1; then
  echo "❌ Error: Proxy server is not responding. Please check the logs above."
  kill $PROXY_PID 2>/dev/null
  exit 1
fi

echo "🚛 Starting Larry Route Planner on port $DEV_PORT..."

# Cleanup proxy on exit
trap 'echo "🛑 Shutting down..."; kill $PROXY_PID 2>/dev/null; kill_port $PROXY_PORT; kill_port $DEV_PORT' EXIT INT TERM

npm run dev -- --port $DEV_PORT
