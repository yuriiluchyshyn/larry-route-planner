#!/bin/bash

# Start Enhanced Proxy Server
# Скрипт для запуску покращеного проксі-сервера

echo "🚀 Starting Larry Route Planner Enhanced Proxy Server..."

# Перевіряємо чи встановлені залежності
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Перевіряємо чи порт вільний
PORT=${PROXY_PORT:-8848} # Змінено з 7740 на 8848
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $PORT is already in use. Trying to stop existing process..."
    
    # Знаходимо та зупиняємо процес на порту
    PID=$(lsof -ti:$PORT)
    if [ ! -z "$PID" ]; then
        echo "🛑 Stopping process $PID on port $PORT..."
        kill -9 $PID
        sleep 2
    fi
fi

# Створюємо лог файл
LOG_DIR="logs"
mkdir -p $LOG_DIR
LOG_FILE="$LOG_DIR/proxy-$(date +%Y%m%d-%H%M%S).log"

echo "📝 Logs will be saved to: $LOG_FILE"

# Експортуємо змінні середовища
export PROXY_PORT=$PORT
export NODE_ENV=${NODE_ENV:-development}

# Перевіряємо API ключі
echo "🔑 Checking API credentials..."
if [ ! -z "$TRANSEU_API_KEY" ]; then
    echo "✅ TRANSEU_API_KEY is set"
elif [ ! -z "$TRANSEU_CLIENT_ID" ] && [ ! -z "$TRANSEU_CLIENT_SECRET" ]; then
    echo "✅ OAuth2 credentials are set"
else
    echo "⚠️  No API credentials found!"
    echo "   This may cause 403 Forbidden errors."
    echo "   See API_SETUP.md for instructions."
    echo ""
    echo "   Quick setup:"
    echo "   export TRANSEU_API_KEY='your_api_key_here'"
    echo "   Or create .env file with API credentials"
    echo ""
fi

# Запускаємо сервер
echo "🌐 Starting proxy server on port $PORT..."
echo "🎯 Target: https://api.trans.eu"
echo "📊 Health check: http://localhost:$PORT/health"
echo "📈 Status: http://localhost:$PORT/status"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================="

# Запуск з логуванням
node proxyServer.js 2>&1 | tee $LOG_FILE