#!/bin/bash

# Larry Route Planner - Development Setup
echo "🚛 Larry Route Planner - Starting development environment..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping all processes..."
    kill $TRANS_PROXY_PID $DEV_PID 2>/dev/null
    pkill -f "node proxy-server.cjs" 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Start Trans.eu CORS proxy server in background
echo "🌐 Starting Trans.eu CORS proxy server on port 8847..."
node proxy-server.cjs &
TRANS_PROXY_PID=$!

# Wait for proxy to start
sleep 2

# Start Vite development server (includes AI API proxies for Gemini/Claude/Groq/OpenAI)
echo "⚡ Starting Vite development server on port 7739..."
npm run dev &
DEV_PID=$!

echo ""
echo "🎉 Larry Route Planner is ready!"
echo "📱 Frontend: http://localhost:7739"
echo "🌐 Trans.eu Proxy: http://localhost:8847"
echo "🤖 AI APIs: proxied through Vite (no CORS issues)"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for all processes
wait
