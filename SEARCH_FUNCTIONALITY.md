# Larry Route Planner - Search and Scroll Functionality

## Overview

The Larry Route Planner now includes advanced search and scroll functionality that allows you to find specific freight offers in external HTML tables (like those on Trans.eu) and automatically scroll to them. This feature handles pagination, response limits, and provides visual feedback.

## Features

### 🔍 Intelligent Offer Search
- **Multi-criteria search**: Search by offer ID, company name, loading/unloading cities
- **Fuzzy matching**: Finds offers even with partial matches
- **Pagination support**: Automatically searches across multiple pages
- **Visual highlighting**: Found offers are highlighted with animation
- **Auto-scroll**: Automatically scrolls to found offers

### 🎯 Search Criteria Support
- **Offer ID**: Most specific search (highest priority)
- **Company name**: Search by freight company
- **Loading city**: Find offers by pickup location
- **Unloading city**: Find offers by delivery location
- **Price range**: Filter by price (when available)
- **Date range**: Filter by loading/unloading dates

### 📄 Pagination Handling
- **Auto-detection**: Automatically detects pagination controls
- **Multi-page search**: Searches up to 10 pages by default
- **Smart navigation**: Uses various pagination patterns (buttons, inputs, links)
- **Page restoration**: Returns to original page if offer not found

## How It Works

### 1. In Larry Route Planner App

When you click on a freight offer row in the Larry app:

```typescript
// The app extracts offer details and sends search request
const searchData = {
  type: 'FIND_AND_CLICK_OFFER',
  offerId: offer.id,
  companyName: offer.company.legal_name,
  loadingCity: loadingSpot?.place.address.locality,
  unloadingCity: unloadingSpot?.place.address.locality,
  scrollToElement: true,
  highlightElement: true,
  maxPagesToSearch: 10
};

window.parent.postMessage(searchData, '*');
```

### 2. Extension Content Script

The browser extension receives the search request and:

1. **Searches current page** for matching offers
2. **Checks pagination** if offer not found
3. **Navigates through pages** systematically
4. **Highlights and scrolls** to found offer
5. **Sends result back** to Larry app

### 3. Search Algorithm

The search uses multiple strategies:

```javascript
// Priority order for matching:
1. Exact offer ID match (data attributes)
2. Offer ID in text content
3. Company name match
4. Loading city match (in loading columns)
5. Unloading city match (in unloading columns)
6. Combined criteria match
```

## Usage Examples

### Basic Usage (Browser Extension)

1. **Install the extension** in Chrome/Edge
2. **Navigate to Trans.eu** freight offers page
3. **Open Larry** via extension popup or button
4. **Load freight offers** in Larry
5. **Click any offer row** to find it on the main page

### Manual Search (Development)

```javascript
// Access the search functionality directly
const searcher = new OfferSearcher();

// Search for specific offer
const result = await searcher.searchWithPagination({
  offerId: "12345",
  companyName: "Transport Company",
  loadingCity: "Warsaw",
  unloadingCity: "Berlin"
}, 5); // Search up to 5 pages

if (result.found) {
  searcher.scrollToElement(result.element);
}
```

### Extension Messaging

```javascript
// Send search request from iframe
window.parent.postMessage({
  type: 'FIND_AND_CLICK_OFFER',
  offerId: '12345',
  companyName: 'Transport Co',
  loadingCity: 'Warsaw',
  unloadingCity: 'Berlin',
  maxPagesToSearch: 10
}, '*');

// Listen for search results
window.addEventListener('message', (event) => {
  if (event.data.type === 'OFFER_SEARCH_RESULT') {
    const { found, offerId, pageNumber, searchTime } = event.data;
    console.log(`Offer ${offerId} ${found ? 'found' : 'not found'}`);
  }
});
```

## Configuration Options

### Search Parameters

```typescript
interface OfferSearchCriteria {
  offerId?: string;           // Exact offer ID
  companyName?: string;       // Company name (partial match)
  loadingCity?: string;       // Loading city name
  unloadingCity?: string;     // Unloading city name
  loadingCountry?: string;    // Loading country
  unloadingCountry?: string;  // Unloading country
  priceRange?: {              // Price filter
    min: number;
    max: number;
    currency?: string;
  };
  dateRange?: {               // Date filter
    from: string;
    to: string;
  };
}
```

### Search Options

```typescript
interface SearchOptions {
  maxPagesToSearch?: number;    // Default: 10
  scrollToElement?: boolean;    // Default: true
  highlightElement?: boolean;   // Default: true
  timeout?: number;            // Default: 5000ms
}
```

## CSS Selectors

The search system uses flexible CSS selectors to work with various table formats:

### Table Detection
```css
.table-responsive table
.offers-table
table[class*="offer"]
table[class*="freight"]
```

### Row Detection
```css
tbody tr
tr[class*="offer"]
tr[data-offer-id]
```

### Pagination Detection
```css
.pagination
.pager
[class*="pagination"]
[class*="pager"]
```

## Status Messages

The Larry app shows real-time status messages:

- 🔍 **Searching**: "Шукаю пропозицію {offerId} на основній сторінці..."
- ✅ **Found**: "Знайдено пропозицію {offerId} на сторінці {pageNumber} ({searchTime}ms)"
- ❌ **Not Found**: "Не вдалося знайти пропозицію {offerId}: {error}"
- ⚠️ **Warning**: "Функція пошуку доступна тільки в розширенні браузера"

## Troubleshooting

### Common Issues

1. **Offer not found**
   - Check if offer is visible on current page
   - Verify pagination is working correctly
   - Increase `maxPagesToSearch` parameter

2. **Search too slow**
   - Reduce `maxPagesToSearch` value
   - Check network connection
   - Verify page loading times

3. **Extension not working**
   - Refresh the Trans.eu page
   - Check browser console for errors
   - Verify extension permissions

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('larryDebug', 'true');
```

### Performance Tips

- Use specific search criteria (offer ID is fastest)
- Limit pagination search range
- Ensure stable internet connection
- Close unnecessary browser tabs

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Firefox 85+ (with manifest v2 version)
- ❌ Safari (not supported)

## Security Considerations

- Extension only runs on Trans.eu domains
- No data is sent to external servers
- All processing happens locally in browser
- Respects CORS and CSP policies

## Future Enhancements

- [ ] Advanced filtering options
- [ ] Bulk offer search
- [ ] Search result caching
- [ ] Custom CSS selector configuration
- [ ] Search analytics and metrics
- [ ] Multi-language support for search terms