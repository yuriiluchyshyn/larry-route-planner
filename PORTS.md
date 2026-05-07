# Larry Route Planner - Port Configuration

## Current Ports (Updated)

- **Main Application**: http://localhost:7739
- **CORS Proxy Server**: http://localhost:8847

## Why These Ports?

These non-standard ports were chosen to avoid conflicts with common development tools:

- **7739**: Avoids conflicts with Vite (5173), React (3000), Next.js (3000), Angular (4200)
- **8847**: Avoids conflicts with common proxy ports (3001, 8080, 8000)

## Quick Start

### Option 1: Start Everything
```bash
./run.sh
```

### Option 2: Start Separately  
```bash
# Terminal 1: Start proxy only
./start-proxy.sh

# Terminal 2: Start app only
./start-app.sh
```

Then open: http://localhost:7739

## Manual Start

### Option 3: Manual Commands
```bash
# Terminal 1: Start proxy
node proxy-server.cjs

# Terminal 2: Start app
npm run dev -- --port 7739
```

## Troubleshooting

### If proxy connection fails:
1. **Check proxy is running**: `curl http://localhost:8847/health`
2. **Start proxy separately**: `./start-proxy.sh`
3. **Check for port conflicts**: `lsof -i :8847`
4. **Kill existing proxy**: `pkill -f "node proxy-server.cjs"`

## Port Conflicts

If you need to change ports:

1. **Proxy port**: Edit `PORT` in `proxy-server.cjs`
2. **App port**: Edit `port` in `vite.config.ts` 
3. **Update proxy target**: Edit `proxy.target` in `vite.config.ts`
4. **Extension**: Edit `APP_URL` in `extension/content.js`