# 🚛 Larry Route Planner

**Intelligent freight route optimization tool for Trans.eu platform**

Larry Route Planner is a powerful web application and browser extension that helps logistics professionals optimize freight routes, reduce empty runs, and maximize profitability using real-time data from the Trans.eu freight exchange platform.

![Larry Route Planner Screenshot](https://via.placeholder.com/800x400/4a9eff/ffffff?text=Larry+Route+Planner)

## ✨ Features

### 🎯 **Smart Route Optimization**
- **Multi-stop route planning** - Combine multiple freight offers into efficient routes
- **Empty run minimization** - Reduce deadhead miles between loads
- **EU driving regulations compliance** - Automatic rest stops and daily driving limits
- **Home base optimization** - Routes start and end at your depot location

### 📊 **Advanced Analytics**
- **Interactive route visualization** on OpenStreetMap
- **Profitability scoring** based on loaded km vs empty runs
- **Time and distance calculations** with realistic driving hours
- **Price per kilometer analysis** for better decision making

### 🔗 **Trans.eu Integration**
- **Browser extension** for seamless platform integration
- **Automatic data extraction** from Trans.eu search results
- **One-click offer selection** directly from the platform
- **Real-time token synchronization** for API access

### 🌍 **European Coverage**
- Support for **25+ European countries**
- **Geocoding integration** for accurate coordinates
- **Multi-language city names** (English, German, Polish, Ukrainian)
- **Postal code validation** and auto-completion

## 🚀 Quick Start

### Option 1: Browser Extension (Recommended)

1. **Install the extension:**
   ```bash
   # Clone the repository
   git clone https://github.com/yuriiluchyshyn/larry-route-planner.git
   cd larry-route-planner
   
   # Load extension in Chrome
   # 1. Open chrome://extensions/
   # 2. Enable "Developer mode"
   # 3. Click "Load unpacked"
   # 4. Select the "extension/" folder
   ```

## 🧪 Testing Weight Filter Parsing

If your extension is not correctly reading weight values from Trans.eu filters, you can test the parsing logic:

1. **Open the test page:**
   ```bash
   # Start the development server
   npm run dev
   
   # Open test page in browser
   open http://localhost:7739/test-extension.html
   ```

2. **Test the parsing:**
   - The test page simulates Trans.eu form structure
   - Click "Тестувати парсинг extension" to see parsed values
   - Check browser console for detailed debug logs

3. **Expected results:**
   - Maximum weight should be parsed as `3.5` from the form
   - Vehicle type should show "Бус" (van)
   - All debug information appears in console

4. **Troubleshooting:**
   - If weight is not parsed correctly, check the HTML selectors in `extension/content.js`
   - Compare with actual Trans.eu page structure using browser DevTools
   - Look for console errors in the extension background page

2. **Use on Trans.eu:**
   - Navigate to [platform.trans.eu](https://platform.trans.eu)
   - Set up your search filters (loading/unloading cities, dates, etc.)
   - Click the floating 🚛 button in the bottom-right corner
   - Larry will automatically import your filters and bearer token

### Option 2: Standalone Web App

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Configure API access:**
   - Get your bearer token from Trans.eu (see setup guide below)
   - Add loading and unloading points
   - Set your home base location
   - Click "Fetch Offers" to start optimization

## 🔧 Setup Guide

### Getting Trans.eu Bearer Token

1. **Login to Trans.eu:**
   - Go to [platform.trans.eu](https://platform.trans.eu)
   - Login with your account

2. **Extract bearer token:**
   - Open Developer Tools (F12)
   - Go to Network tab
   - Perform any search on the platform
   - Find a request to `api-platform.trans.eu`
   - Copy the `Authorization: Bearer` token from request headers

3. **Add token to Larry:**
   - Paste the token in the "API Connection" section
   - The token will be automatically saved and reused

### Configuring Route Parameters

```typescript
// Example configuration
{
  "homeBase": {
    "locality": "Kraków",
    "country": "47_poland",
    "latitude": 50.0647,
    "longitude": 19.9450
  },
  "loadingPoints": [
    {
      "locality": "Berlin",
      "country": "21_germany",
      "range": 50
    }
  ],
  "unloadingPoints": [
    {
      "locality": "Paris", 
      "country": "33_france",
      "range": 100
    }
  ],
  "minWeight": 1,
  "maxDailyDriving": 9,
  "daysOnRoad": 5
}
```

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Leaflet maps** for interactive route visualization
- **Modular component architecture** for maintainability
- **CSS Grid/Flexbox** for responsive design

### Browser Extension
- **Manifest V3** for modern Chrome extension standards
- **Content scripts** for Trans.eu platform integration
- **Background service worker** for token management
- **Cross-frame messaging** for seamless data exchange

### API Integration
- **Trans.eu REST API** with full pagination support
- **Nominatim geocoding** for address resolution
- **CORS handling** for cross-origin requests
- **Rate limiting** and error recovery

### Route Optimization Engine
```typescript
// Core optimization strategies
1. Single offer cycles (Home → Load → Unload → Home)
2. Multi-offer routes (Home → Load1 → Unload1 → Load2 → Unload2 → Home)
3. EU regulation compliance (max 9h/day, 4.5h continuous)
4. Empty run minimization algorithms
5. Profitability scoring (loaded km / total km ratio)
```

## 📁 Project Structure

```
larry-route-planner/
├── src/                          # React application source
│   ├── components/               # React components
│   │   ├── ConfigPanel.tsx      # Configuration interface
│   │   ├── OffersTable.tsx      # Freight offers display
│   │   ├── RouteResults.tsx     # Optimized routes
│   │   └── RouteMapModal.tsx    # Interactive map
│   ├── utils/                   # Utility functions
│   │   ├── apiClient.ts         # Trans.eu API integration
│   │   ├── routeOptimizer.ts    # Route optimization logic
│   │   └── geocode.ts           # Address geocoding
│   └── types.ts                 # TypeScript definitions
├── extension/                   # Browser extension
│   ├── manifest.json           # Extension configuration
│   ├── content.js              # Trans.eu integration
│   ├── content.css             # Extension styling
│   └── background.js           # Service worker
├── public/                     # Static assets
└── docs/                      # Documentation
```

## 🔍 Key Algorithms

### Route Optimization
Larry uses a multi-strategy approach to find optimal routes:

1. **Greedy Single Cycles**: Fast calculation of simple round trips
2. **Dynamic Programming**: Multi-stop route optimization with memoization
3. **Constraint Satisfaction**: EU driving regulations compliance
4. **Heuristic Scoring**: Weighted scoring based on multiple factors

### Scoring Formula
```typescript
score = (loadedKm * 2) - (emptyKm * 0.5) - (idleHours * 10) + euCompliantBonus
```

### Distance Calculation
- **Haversine formula** for great-circle distances
- **Realistic driving time** estimates (avg 60 km/h)
- **Rest stop calculations** per EU regulations

## 🌐 Supported Countries

| Country | Code | Cities Supported |
|---------|------|------------------|
| 🇩🇪 Germany | `21_germany` | 50+ major cities |
| 🇵🇱 Poland | `47_poland` | 30+ major cities |
| 🇫🇷 France | `33_france` | 25+ major cities |
| 🇨🇿 Czech Republic | `42_czech_republic` | 15+ major cities |
| 🇦🇹 Austria | `43_austria` | 10+ major cities |
| 🇳🇱 Netherlands | `31_netherlands` | 15+ major cities |
| 🇧🇪 Belgium | `32_belgium` | 10+ major cities |
| ... | ... | 25+ countries total |

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Chrome browser (for extension development)

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Extension Development
```bash
# Build extension
npm run build:extension

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select dist/extension folder
```

## 📊 Performance

- **API Response Time**: ~2-3 seconds for 400+ offers
- **Route Optimization**: <1 second for 20 routes
- **Memory Usage**: ~50MB for large datasets
- **Extension Overhead**: <5MB memory footprint

## 🔒 Security & Privacy

- **No data storage** - All data processed locally
- **Bearer token encryption** - Tokens stored securely in browser
- **CORS compliance** - Proper cross-origin handling
- **No tracking** - Zero analytics or user tracking

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Full setup guide](SETUP.md)
- **Issues**: [GitHub Issues](https://github.com/yuriiluchyshyn/larry-route-planner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yuriiluchyshyn/larry-route-planner/discussions)

## 🙏 Acknowledgments

- **Trans.eu** for providing the freight exchange platform and API
- **OpenStreetMap** for mapping data and Nominatim geocoding
- **Leaflet** for the interactive mapping library
- **React community** for the excellent ecosystem

---

**Made with ❤️ for the logistics community**

*Larry Route Planner - Making freight logistics smarter, one route at a time.*