# Larry Route Planner - Setup Guide

## Quick Start

### Option 1: Start Everything (Recommended)
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

### Option 3: Manual Start
```bash
# Terminal 1: Start proxy
node proxy-server.cjs

# Terminal 2: Start app
npm run dev -- --port 7739
```

This script will:
- Install dependencies if needed
- Start CORS proxy server on port 8847
- Start the main app on port 7739 (http://localhost:7739)

### 2. Ports Configuration
- **Main App**: http://localhost:7739 (Vite dev server)
- **Proxy Server**: http://localhost:8847 (CORS proxy for Trans.eu API)

The proxy server starts automatically and routes `/api/trans/*` requests to `https://api-platform.trans.eu`.

## Features

### ✅ Collapsible Configuration Sections
Each section in the left panel can be collapsed/expanded by clicking the header:
- 🔗 API Connection
- 📍 Loading Points 
- 📍 Unloading Points
- 🏠 Home Base
- ⚙️ Filter Parameters
- 🔄 Route Optimization  
- 📅 Departure & Return

### ✅ Auto-sync Loading/Unloading Points
- Adding a **Loading Point** automatically adds a corresponding **Unloading Point**
- Adding an **Unloading Point** automatically adds a corresponding **Loading Point**
- Removing points removes corresponding pairs when possible

### ✅ Home Base Map Selection
- Click "🗺️ Pick Home Base on Map" to select location visually
- Auto-reverse geocoding fills city/country information
- Option to use first loading point as home base

### ✅ Route Visualization
- Click "🗺 На карті" button on any route card
- Shows complete route with:
  - **Green solid lines**: Loaded segments (with cargo)
  - **Orange dashed lines**: Empty runs (no cargo)
  - **Markers**: Loading (L1, L2...) and Unloading (U1, U2...) points
  - **Home base marker**: Start/end point
- Detailed popups with dates, distances, prices

### ✅ Local Storage
- All configuration automatically saved to browser localStorage
- Settings persist between sessions
- No manual save required

## API Configuration

### Option 1: Chrome Extension (Recommended)
1. Use the app directly on platform.trans.eu
2. No CORS issues
3. Token automatically available

### Option 2: Proxy Server (Current Setup)
1. Get Bearer token from platform.trans.eu:
   - Login to platform.trans.eu
   - Open Dev Tools (F12) → Network tab
   - Make a search
   - Find API request to api-platform.trans.eu
   - Copy Authorization header token
2. Paste token in "Bearer Token" field
3. Proxy handles CORS automatically

### Option 3: Direct API (Advanced)
- Change API URL to direct Trans.eu endpoint
- Handle CORS in browser (not recommended for production)

## Troubleshooting

### Proxy Server Issues
```bash
# Check if proxy is running
lsof -i :8847

# Kill existing proxy if needed
pkill -f "node proxy-server.cjs"

# Restart manually
node proxy-server.cjs
```

### Port Conflicts
If ports 8847 or 7739 are in use:
1. Edit `vite.config.ts` to change app port
2. Edit `proxy-server.js` to change proxy port
3. Update `vite.config.ts` proxy target accordingly

### Clear Saved Configuration
```javascript
// In browser console:
localStorage.removeItem('larry-route-planner-config');
```

## Development

### Manual Start (without run.sh)
```bash
# Terminal 1: Start proxy
node proxy-server.js

# Terminal 2: Start app  
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```