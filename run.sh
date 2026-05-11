#!/bin/bash

# Larry Route Planner - Development Setup Script
echo "🚛 Larry Route Planner - Starting development environment..."

# Ensure we're in the correct directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# This script should be in larry-route-planner directory
if [[ "$(basename "$SCRIPT_DIR")" == "larry-route-planner" ]]; then
    PROJECT_DIR="$SCRIPT_DIR"
else
    # If called from parent directory, look for larry-route-planner subdirectory
    if [ -d "$SCRIPT_DIR/larry-route-planner" ]; then
        PROJECT_DIR="$SCRIPT_DIR/larry-route-planner"
    else
        echo "❌ Error: Cannot find larry-route-planner directory"
        echo "Current: $SCRIPT_DIR"
        echo "Please run from larry-route-planner directory or its parent"
        exit 1
    fi
fi

cd "$PROJECT_DIR"
echo "📁 Working directory: $(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_service() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

print_url() {
    echo -e "${CYAN}🔗 $1${NC}"
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2
    
    if command -v lsof >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port 2>/dev/null)
        
        if [ ! -z "$pid" ]; then
            print_info "Killing $service_name process on port $port (PID: $pid)"
            kill -9 $pid 2>/dev/null || true
            sleep 1
            
            # Verify port is free
            if lsof -ti:$port >/dev/null 2>&1; then
                print_warning "Port $port still in use after kill attempt"
            else
                print_status "Port $port is now free"
            fi
        fi
    fi
}

# Function to cleanup all ports and processes
cleanup_ports() {
    print_info "Cleaning up ports and processes..."
    
    # Kill processes on specific ports
    kill_port 7740 "Frontend (Vite)"
    kill_port 8848 "Backend/Proxy"
    kill_port 5173 "Vite (fallback)"
    
    # Kill processes by name as backup
    pkill -f "proxyServer.js" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    print_status "Ports cleaned up"
}

# Function to cleanup background processes (called on script exit)
cleanup() {
    print_info "Stopping all services..."
    
    # Kill background processes by PID if they exist
    [ ! -z "$PROXY_PID" ] && kill $PROXY_PID 2>/dev/null || true
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    
    # Clean up all ports
    cleanup_ports
    
    print_status "All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check dependencies
check_dependencies() {
    print_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        print_info "Please install Node.js from https://nodejs.org or use: brew install node"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_status "Dependencies check passed"
}

# Install npm dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the larry-route-planner directory?"
        exit 1
    fi
    
    # Main project dependencies
    if [ ! -d "node_modules" ]; then
        print_info "Installing main project dependencies..."
        npm install
    fi
    
    # Install proxy dependencies
    PROXY_DIR="src/utils/strategies/new_strategy/route/proxy"
    if [ -f "$PROXY_DIR/package.json" ] && [ ! -d "$PROXY_DIR/node_modules" ]; then
        print_info "Installing proxy dependencies..."
        cd "$PROXY_DIR"
        npm install
        cd "$PROJECT_DIR"
    fi
    
    print_status "Dependencies installed"
}

# Start Backend/Proxy Server
start_backend() {
    print_service "Starting Backend/Proxy Server on port 8848..."
    
    # Ensure port 8848 is free
    kill_port 8848 "Backend/Proxy"
    
    PROXY_SCRIPT="src/utils/strategies/new_strategy/route/proxy/start-proxy.sh"
    
    if [ ! -f "$PROXY_SCRIPT" ]; then
        print_error "Proxy script not found: $PROXY_SCRIPT"
        return 1
    fi
    
    # Make sure the script is executable
    chmod +x "$PROXY_SCRIPT"
    
    # Set proxy port environment variable
    export PROXY_PORT=8848
    
    # Start the proxy in background
    cd "src/utils/strategies/new_strategy/route/proxy"
    ./start-proxy.sh &
    PROXY_PID=$!
    cd "$PROJECT_DIR"
    
    # Wait for proxy to start
    sleep 3
    
    # Check if proxy is running
    if curl -s http://localhost:8848/health > /dev/null 2>&1; then
        print_status "Backend/Proxy server is running on port 8848"
        return 0
    else
        print_warning "Backend/Proxy may not have started properly"
        print_info "Check logs in src/utils/strategies/new_strategy/route/proxy/logs/"
        return 1
    fi
}

# Start Frontend Server
start_frontend() {
    print_service "Starting Frontend (Vite) Server on port 7740..."
    
    # Ensure port 7740 is free
    kill_port 7740 "Frontend (Vite)"
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in $(pwd)"
        return 1
    fi
    
    # Start Vite development server
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for dev server to start
    sleep 5
    
    # Check if frontend is running
    if curl -s http://localhost:7740 > /dev/null 2>&1; then
        print_status "Frontend server is running on port 7740"
        return 0
    else
        print_warning "Frontend may not have started properly"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "🚛 Larry Route Planner Development Environment"
    echo "=============================================="
    echo ""
    
    # Check system requirements
    check_dependencies
    
    # Install dependencies
    install_dependencies
    
    # Clean up any existing processes
    cleanup_ports
    
    echo ""
    print_info "Starting services..."
    echo ""
    
    # Start Backend/Proxy Server
    if start_backend; then
        print_status "✅ Backend/Proxy: Ready"
    else
        print_error "❌ Backend/Proxy: Failed to start"
    fi
    
    echo ""
    
    # Start Frontend Server
    if start_frontend; then
        print_status "✅ Frontend: Ready"
    else
        print_error "❌ Frontend: Failed to start"
    fi
    
    echo ""
    echo "🎉 Larry Route Planner is ready!"
    echo "================================"
    echo ""
    
    print_url "📱 Frontend (UI):         http://localhost:7740"
    print_url "🌐 Backend/Proxy:         http://localhost:8848"
    print_url "📊 Proxy Health:          http://localhost:8848/health"
    print_url "📈 Proxy Status:          http://localhost:8848/status"
    
    echo ""
    echo "📋 Available Features:"
    echo "   • Route Planning & Optimization"
    echo "   • Trans.eu API Integration (via proxy)"
    echo "   • Chrome Extension Support"
    echo "   • Finance Calculators"
    echo "   • CSV Export"
    
    echo ""
    echo "🔧 Useful Commands:"
    echo "   • Stop everything:           Ctrl+C"
    echo "   • Check proxy health:        curl http://localhost:8848/health"
    echo "   • View proxy logs:           tail -f src/utils/strategies/new_strategy/route/proxy/logs/*.log"
    echo "   • Open frontend:             open http://localhost:7740"
    
    echo ""
    print_warning "Press Ctrl+C to stop all services"
    echo ""
    
    # Wait for all processes
    wait
}

# Run main function
main