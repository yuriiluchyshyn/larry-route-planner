#!/bin/bash

# Quick Proxy Start Script
# Швидкий запуск тільки проксі-сервера

echo "🌐 Starting Enhanced Proxy Server only..."

# Ensure we're in the correct directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROXY_SCRIPT="src/utils/strategies/new_strategy/route/proxy/start-proxy.sh"

if [ ! -f "$PROXY_SCRIPT" ]; then
    echo "❌ Error: Enhanced proxy script not found: $PROXY_SCRIPT"
    exit 1
fi

# Make sure the script is executable
chmod +x "$PROXY_SCRIPT"

# Kill any existing proxy process
if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -ti:8848 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "🛑 Stopping existing proxy process (PID: $PID)..."
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
fi

echo "🚀 Starting enhanced proxy server..."
cd "src/utils/strategies/new_strategy/route/proxy"
exec ./start-proxy.sh