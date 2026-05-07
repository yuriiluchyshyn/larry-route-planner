import { useState, useEffect } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { EURulesHeader } from './components/EURulesHeader';
import { OffersTable } from './components/OffersTable';
import { RouteResults } from './components/RouteResults';
import { fetchFreightOffers } from './utils/apiClient';
import { buildOptimizedRoutes } from './utils/routeOptimizer';
import type { FreightOffer, OptimizedRoute, RouteConfig } from './types';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Function to get bearer token from extension or localStorage
function getBearerTokenFromStorage(): string {
  try {
    // First check URL parameters (from extension)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      console.log('Larry: Token received from URL parameter');
      return urlToken;
    }
    
    // Then try local storage (for development)
    const localToken = localStorage.getItem('transFrameToken');
    if (localToken) {
      console.log('Larry: Token found in local localStorage');
      return localToken;
    }
    
    console.log('Larry: No token found, will request from extension');
    return '';
  } catch (error) {
    console.warn('Failed to read transFrameToken:', error);
    return '';
  }
}

// Function to parse filters from URL parameters
function parseFiltersFromUrl(): Partial<RouteConfig> | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const filtersParam = urlParams.get('filters');
    
    if (!filtersParam) return null;
    
    const filters = JSON.parse(filtersParam);
    console.log('Larry: Filters received from URL:', filters);
    
    const config: Partial<RouteConfig> = {};
    
    // Map loading points
    if (filters.loadingPoints && filters.loadingPoints.length > 0) {
      config.loadingPoints = filters.loadingPoints.map((point: any, index: number) => ({
        id: point.id || `lp${index + 1}`,
        locality: point.locality || '',
        postalCode: point.postalCode || '',
        country: point.country || '47_poland',
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        range: point.range || 50
      }));
    }
    
    // Map unloading points
    if (filters.unloadingPoints && filters.unloadingPoints.length > 0) {
      config.unloadingPoints = filters.unloadingPoints.map((point: any, index: number) => ({
        id: point.id || `up${index + 1}`,
        locality: point.locality || '',
        postalCode: point.postalCode || '',
        country: point.country || '21_germany',
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        range: point.range || 50
      }));
    }
    
    // Map weight filters
    if (filters.minWeight) {
      config.minWeight = filters.minWeight;
    }
    
    return config;
  } catch (error) {
    console.warn('Larry: Failed to parse filters from URL:', error);
    return null;
  }
}

const urlFilters = parseFiltersFromUrl();

const defaultConfig: RouteConfig = {
  apiUrl: '/api/trans/app/exchange/api/rest/v2/freight-offers',
  bearerToken: getBearerTokenFromStorage(),
  loadingPoints: urlFilters?.loadingPoints || [
    {
      id: 'lp1',
      locality: 'Kraków',
      postalCode: '30-001',
      country: '47_poland',
      latitude: 50.077850516,
      longitude: 19.94171128,
      range: 50,
    },
  ],
  unloadingPoints: urlFilters?.unloadingPoints || [
    {
      id: 'up1',
      locality: 'Berlin',
      postalCode: '10115',
      country: '21_germany',
      latitude: 52.5319105,
      longitude: 13.384131422,
      range: 50,
    },
  ],
  minWeight: urlFilters?.minWeight || 10,
  minCapacity: 10,
  daysOnRoad: 7,
  maxEmptyRunPercent: 30,
  minPricePerKm: 0.8,
  homeBase: {
    id: 'home',
    locality: 'Kraków',
    postalCode: '30-001',
    country: '47_poland',
    latitude: 50.077850516,
    longitude: 19.94171128,
    range: 50,
  },
  includeReturnRoute: true,
  departureFrom: new Date().toISOString().split('T')[0],
  departureTo: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
  returnFrom: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
  returnTo: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
};

function App() {
  const [config, setConfig] = useState<RouteConfig>(defaultConfig);
  const [mainOffers, setMainOffers] = useState<FreightOffer[]>([]);
  const [returnOffers, setReturnOffers] = useState<FreightOffer[]>([]);
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'offers' | 'return' | 'routes'>('offers');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Initialize extension messaging
  useEffect(() => {
    // Extension messaging is automatically initialized in the module
    console.log('Larry: Extension messaging ready');
    
    // Dynamically import the extension messaging to avoid build issues
    import('./utils/extensionMessaging').then(() => {
      console.log('Larry: Extension messaging loaded');
    }).catch(error => {
      console.warn('Larry: Extension messaging not available:', error);
    });
  }, []);

  // Request token and filters from extension if not found
  useEffect(() => {
    if (window.parent !== window) {
      if (!config.bearerToken) {
        console.log('Larry: Requesting token from extension...');
        window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');
      }
      
      // Always request fresh filters from the page
      console.log('Larry: Requesting filters from extension...');
      window.parent.postMessage({ type: 'REQUEST_FILTERS' }, '*');
    }
  }, [config.bearerToken]);

  // Listen for token and filters from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'TOKEN_RESPONSE' && event.data.token) {
        console.log('Larry: Received token from extension');
        setConfig(prev => ({ ...prev, bearerToken: event.data.token }));
      }
      
      if (event.data.type === 'FILTERS_RESPONSE' && event.data.filters) {
        console.log('Larry: Received filters from extension:', event.data.filters);
        const filters = event.data.filters;
        const newConfig = { ...config };
        
        // Helper to deduplicate points by country+locality+postalCode key
        const dedupe = (points: any[]) => {
          const seen = new Set<string>();
          return points.filter(p => {
            const key = `${p.country || ''}|${p.locality || ''}|${p.postalCode || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };
        
        // Update loading points - ALWAYS set coords to 0 so geocoder fetches fresh from API
        if (filters.loadingPoints && filters.loadingPoints.length > 0) {
          const dedupedLoading = dedupe(filters.loadingPoints);
          console.log(`Larry: Loading points: ${filters.loadingPoints.length} from extension, ${dedupedLoading.length} after dedupe`);
          newConfig.loadingPoints = dedupedLoading.map((point: any, index: number) => ({
            id: point.id || `lp${index + 1}`,
            locality: point.locality || '',
            postalCode: point.postalCode || '',
            country: point.country || '47_poland',
            latitude: 0, // Always 0 - geocoder will fill these
            longitude: 0,
            range: point.range || 50
          }));
        }
        
        // Update unloading points - ALWAYS set coords to 0 so geocoder fetches fresh from API
        if (filters.unloadingPoints && filters.unloadingPoints.length > 0) {
          const dedupedUnloading = dedupe(filters.unloadingPoints);
          console.log(`Larry: Unloading points: ${filters.unloadingPoints.length} from extension, ${dedupedUnloading.length} after dedupe`);
          newConfig.unloadingPoints = dedupedUnloading.map((point: any, index: number) => ({
            id: point.id || `up${index + 1}`,
            locality: point.locality || '',
            postalCode: point.postalCode || '',
            country: point.country || '21_germany',
            latitude: 0, // Always 0 - geocoder will fill these
            longitude: 0,
            range: point.range || 50
          }));
        }
        
        // Update weight
        if (filters.minWeight) {
          newConfig.minWeight = filters.minWeight;
        }
        
        setConfig(newConfig);
      }
      
      if (event.data.type === 'OFFER_SEARCH_RESULT') {
        const { found, offerId, error, searchTime, pageNumber } = event.data;
        
        if (found) {
          const message = pageNumber 
            ? `✅ Знайдено пропозицію ${offerId} на сторінці ${pageNumber} (${searchTime}ms)`
            : `✅ Знайдено пропозицію ${offerId} (${searchTime}ms)`;
          
          setSearchStatus(message);
          console.log(`Larry: Successfully found and clicked offer ${offerId}`);
        } else {
          const message = `❌ Не вдалося знайти пропозицію ${offerId}: ${error}`;
          setSearchStatus(message);
          console.warn(`Larry: Could not find offer ${offerId}`, error);
        }
        
        // Clear status after 5 seconds
        setTimeout(() => setSearchStatus(null), 5000);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config]);

  const handleOfferRowClick = (offer: FreightOffer) => {
    // Only work if we're in an iframe (extension context)
    if (window.parent === window) {
      console.log('Larry: Not in extension context, cannot search on main page');
      setSearchStatus('⚠️ Функція пошуку доступна тільки в розширенні браузера');
      setTimeout(() => setSearchStatus(null), 3000);
      return;
    }
    
    console.log('Larry: Requesting search for offer on main page:', offer.id);
    setSearchStatus(`🔍 Шукаю пропозицію ${offer.id} на основній сторінці...`);
    
    // Extract offer details for search
    const loadingSpot = offer.freight.spots.find(s => 
      s.operations.some(o => o.type === 'loading')
    );
    const unloadingSpot = offer.freight.spots.find(s => 
      s.operations.some(o => o.type === 'unloading')
    );
    
    const searchData = {
      type: 'FIND_AND_CLICK_OFFER',
      offerId: offer.id,
      companyName: offer.company.legal_name,
      loadingCity: loadingSpot?.place.address.locality || '',
      unloadingCity: unloadingSpot?.place.address.locality || '',
      loadingCountry: loadingSpot?.place.address.country || '',
      unloadingCountry: unloadingSpot?.place.address.country || '',
      scrollToElement: true,
      highlightElement: true,
      maxPagesToSearch: 10
    };
    
    // Send request to extension to find and click the offer
    window.parent.postMessage(searchData, '*');
  };

  const handleFetch = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFreightOffers(config);
      const fetchedOffers = response._embedded['freight-offers'];
      setMainOffers(response.mainOffers || []);
      setReturnOffers(response.returnOffers || []);

      const home = config.homeBase;
      // Use first loading point as home base if homeBase is not properly set
      const homeBase = config.loadingPoints.length > 0 && 
        (home.latitude === 0 || home.longitude === 0) 
        ? config.loadingPoints[0] 
        : home;
        
      const optimized = buildOptimizedRoutes(fetchedOffers, {
        daysOnRoad: config.daysOnRoad,
        maxEmptyRunPercent: config.maxEmptyRunPercent,
        minPricePerKm: config.minPricePerKm,
        homeBaseLat: homeBase.latitude,
        homeBaseLon: homeBase.longitude,
        departureFrom: config.departureFrom,
        departureTo: config.departureTo,
        returnFrom: config.returnFrom,
        returnTo: config.returnTo,
      });
      setRoutes(optimized);

      if (optimized.length > 0) {
        setActiveTab('routes');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <ConfigPanel
          config={config}
          onChange={setConfig}
          onFetch={handleFetch}
          loading={loading}
        />
      </aside>

      <main className="content">
        <EURulesHeader />

        {error && (
          <div className="error-banner">
            ❌ {error}
            {error.includes('CORS') && (
              <div style={{ marginTop: '8px', fontSize: '0.85em' }}>
                <strong>💡 Рішення:</strong> Використовуйте Chrome Extension на platform.trans.eu 
                або переконайтеся, що bearer token правильний.
              </div>
            )}
          </div>
        )}

        {searchStatus && (
          <div className={`search-status ${searchStatus.includes('✅') ? 'success' : searchStatus.includes('❌') ? 'error' : 'info'}`}>
            {searchStatus}
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
            onClick={() => setActiveTab('offers')}
          >
            📦 Прямі маршрути ({loading ? '⏳' : mainOffers.length})
          </button>
          {config.includeReturnRoute && (
            <button
              className={`tab ${activeTab === 'return' ? 'active' : ''}`}
              onClick={() => setActiveTab('return')}
            >
              🔄 Зворотні маршрути ({loading ? '⏳' : returnOffers.length})
            </button>
          )}
          <button
            className={`tab ${activeTab === 'routes' ? 'active' : ''}`}
            onClick={() => setActiveTab('routes')}
          >
            🏆 Оптимізовані пропозиції ({routes.length})
          </button>
        </div>

        {activeTab === 'offers' && (
          <>
            <div className="route-stats">
              <strong>Прямі маршрути:</strong> {mainOffers.length} пропозицій
              {config.includeReturnRoute && (
                <> | <strong>Зворотні маршрути:</strong> {returnOffers.length} пропозицій</>
              )}
            </div>
            <OffersTable offers={mainOffers} onRowClick={handleOfferRowClick} />
          </>
        )}
        {activeTab === 'return' && (
          <>
            <div className="route-stats">
              <strong>Зворотні маршрути:</strong> {returnOffers.length} пропозицій
            </div>
            <OffersTable offers={returnOffers} onRowClick={handleOfferRowClick} />
          </>
        )}
        {activeTab === 'routes' && <RouteResults routes={routes} homeBase={config.homeBase} />}
      </main>
    </div>
  );
}

export default App;
