# 🚛 Larry Route Planner - CORS Solutions

## Problem: CORS Errors

You're seeing CORS errors because Trans.eu API doesn't allow cross-origin requests from localhost.

## Solution Options

### 🎯 **Option 1: Chrome Extension (Recommended)**

1. **Reload extension** in Chrome:
   - Go to `chrome://extensions/`
   - Find "Larry Route Planner"
   - Click "Reload" (🔄)

2. **Use on platform.trans.eu**:
   - Open https://platform.trans.eu
   - Login to your account
   - Click 🚛 button on the page
   - Use Larry in iframe (no CORS issues!)

### 🔧 **Option 2: CORS Proxy Server**

1. **Install dependencies**:
   ```bash
   cd larry-route-planner
   npm install express http-proxy-middleware cors
   ```

2. **Start proxy server**:
   ```bash
   node proxy-server.cjs
   ```
   
   Server will run on http://localhost:8847

3. **Use proxy URL in Larry**:
   - API URL: `http://localhost:8847/api/trans/app/exchange/api/rest/v2/freight-offers`
   - Add your bearer token
   - Click "Fetch & Optimize Routes"

### 🌐 **Option 3: Browser CORS Disable (Not Recommended)**

**Chrome with disabled security** (for development only):
```bash
# macOS
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security --disable-features=VizDisplayCompositor

# Windows
chrome.exe --user-data-dir="c:/temp/chrome_dev_test" --disable-web-security --disable-features=VizDisplayCompositor
```

⚠️ **Warning**: This disables browser security. Only use for development!

## Recommended Workflow

1. **Development**: Use Chrome Extension on platform.trans.eu
2. **Testing**: Use CORS proxy server if needed
3. **Production**: Deploy Larry to same domain as Trans.eu or use proper CORS headers

## Troubleshooting

### Extension Not Working
- Make sure extension is loaded and enabled
- Check that it's running on correct port (5175)
- Reload extension after code changes

### Proxy Server Issues
- Make sure port 8847 is not in use
- Check that bearer token is valid
- Verify API URL points to proxy server

### Still Getting CORS Errors
- Clear browser cache
- Try incognito/private mode
- Verify bearer token is not expired