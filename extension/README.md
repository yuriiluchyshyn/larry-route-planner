# Larry Route Planner - Chrome Extension

This Chrome extension overlays the Larry Route Planner app on top of platform.trans.eu with **automatic token access**.

## ✨ Key Features

- **🔑 Automatic Token Access**: Reads your bearer token directly from platform.trans.eu localStorage
- **🚛 Seamless Integration**: Works as an overlay on the Trans.eu platform  
- **⚡ No Manual Setup**: Token is automatically injected from the platform
- **🎯 Smart Communication**: Extension and app communicate via postMessage API

## Installation

1. **Build the main app** (if not already done):
   ```bash
   cd larry-route-planner
   npm run build
   ```

2. **Load extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select this `extension/` folder

## Usage

1. **Start the Larry app**:
   ```bash
   cd larry-route-planner
   npm run dev  # or serve the built version
   ```

2. **Go to platform.trans.eu** and log in

3. **Click the 🚛 button** in the bottom-right corner

4. **Larry Route Planner opens** with your token automatically loaded from platform.trans.eu

5. **Start planning routes** — no manual token entry needed!

## 🔧 How Token Access Works

1. **Extension reads** `transFrameToken` from platform.trans.eu localStorage
2. **Passes token** to Larry app via URL parameter or postMessage
3. **App receives token** and uses it for API calls
4. **Updates automatically** if token changes on the platform

## Panel Features

The Larry panel is:
- **🖱️ Draggable** — grab the header to move it
- **📏 Resizable** — click ⤢ to toggle size
- **❌ Closeable** — click ✕ or the 🚛 button again

## Configuration

If your dev server runs on a different port, edit `content.js`:
```js
const APP_URL = 'http://localhost:7739';
```

## Production Deployment

```bash
npm run build
npx serve dist -p 7739
```

Then update `APP_URL` in `content.js` to your production URL.

## Troubleshooting

- **❌ No token found**: Make sure you're logged into platform.trans.eu
- **🔄 Extension not visible**: Refresh the platform.trans.eu page  
- **🌐 Connection issues**: Check that Larry app is running on correct port
- **🔑 Token not loading**: Check browser console for error messages
