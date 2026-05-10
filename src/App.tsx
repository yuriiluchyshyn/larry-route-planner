import { useState, useEffect } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { EURulesHeader } from './components/EURulesHeader';
import { OffersTable } from './components/OffersTable';
import { RouteResults } from './components/RouteResults';
import { fetchFreightOffers } from './utils/apiClient';
import { executeRouteOptimization, legacyToStrategy, RouteStrategy } from './utils/routeStrategy';
import { getLastAIPaginationMetadata, loadNextAIPage } from './utils/aiOptimizer';
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
    if (filters.minWeight !== undefined && filters.minWeight !== null) {
      config.minWeight = filters.minWeight;
    }
    if (filters.maxWeight !== undefined && filters.maxWeight !== null) {
      config.maxWeight = filters.maxWeight;
    }
    // Map capacity filter from extension
    if (filters.minCapacity !== undefined && filters.minCapacity !== null) {
      config.minCapacity = filters.minCapacity;
    }
    if (filters.maxCapacity !== undefined && filters.maxCapacity !== null) {
      config.maxCapacity = filters.maxCapacity;
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
  minWeight: urlFilters?.minWeight || 0,
  maxWeight: urlFilters?.maxWeight,
  minCapacity: 0,
  maxCapacity: urlFilters?.maxCapacity,
  maxEmptyRunPercent: 10,
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
  useAIOptimization: false, // Default to internal algorithm (legacy)
  routeStrategy: RouteStrategy.DFS_BRANCH_BOUND, // Default to DFS optimization (new system)
  pricePerKm: 1.5, // Default 1.5 EUR per km
  averageSpeedKmh: 80, // Default 80 km/h average speed
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
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [aiPaginationMeta, setAiPaginationMeta] = useState<{totalRoutesFound: number; returnedRoutesCount: number; nextPagePrompt: string | null} | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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
        
        // Log current config before update
        console.log('Larry: Current config before update:', {
          minWeight: newConfig.minWeight,
          maxWeight: newConfig.maxWeight,
          minCapacity: newConfig.minCapacity,
          maxCapacity: newConfig.maxCapacity
        });
        
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
        
        // Update weight with detailed logging
        if (filters.minWeight !== undefined && filters.minWeight !== null) {
          console.log('Larry: Setting minWeight from extension:', filters.minWeight);
          newConfig.minWeight = filters.minWeight;
        }
        if (filters.maxWeight !== undefined && filters.maxWeight !== null) {
          console.log('Larry: Setting maxWeight from extension:', filters.maxWeight);
          newConfig.maxWeight = filters.maxWeight;
        }
        // Update capacity from extension
        if (filters.minCapacity !== undefined && filters.minCapacity !== null) {
          console.log('Larry: Setting minCapacity from extension:', filters.minCapacity);
          newConfig.minCapacity = filters.minCapacity;
        }
        if (filters.maxCapacity !== undefined && filters.maxCapacity !== null) {
          console.log('Larry: Setting maxCapacity from extension:', filters.maxCapacity);
          newConfig.maxCapacity = filters.maxCapacity;
        }
        
        // Log final config after update
        console.log('Larry: Final config after update:', {
          minWeight: newConfig.minWeight,
          maxWeight: newConfig.maxWeight,
          minCapacity: newConfig.minCapacity,
          maxCapacity: newConfig.maxCapacity
        });
        
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
      const mainArr = response.mainOffers || [];
      const returnArr = response.returnOffers || [];
      setMainOffers(mainArr);
      setReturnOffers(returnArr);

      const home = config.homeBase;
      // Use first loading point as home base if homeBase is not properly set
      const homeBase = config.loadingPoints.length > 0 && 
        (home.latitude === 0 || home.longitude === 0) 
        ? config.loadingPoints[0] 
        : home;
      
      // Pass main + return separately so optimizer can build round-trip cycles
      let optimized: OptimizedRoute[];
      
      // Determine strategy (support both legacy and new system)
      const strategy = config.routeStrategy 
        ? config.routeStrategy as RouteStrategy
        : legacyToStrategy(config.useAIOptimization);
      
      console.log(`🎯 Strategy: Using ${strategy} optimization`);
      
      try {
        optimized = await executeRouteOptimization(
          { mainOffers: mainArr, returnOffers: returnArr },
          {
            strategy,
            maxEmptyRunPercent: config.maxEmptyRunPercent,
            homeBaseLat: homeBase.latitude,
            homeBaseLon: homeBase.longitude,
            departureFrom: config.departureFrom,
            departureTo: config.departureTo,
            returnFrom: config.returnFrom,
            returnTo: config.returnTo,
            averageSpeedKmh: config.averageSpeedKmh,
            daysOnRoad: 7,
            minPricePerKm: 0,
            aiStatusCallback: setAiStatus,
          }
        );
        
        if (strategy === RouteStrategy.AI_OPTIMIZATION) {
          setAiPaginationMeta(getLastAIPaginationMetadata());
          setTimeout(() => setAiStatus(null), 3000);
        }
        
      } catch (error) {
        console.error('Route optimization failed:', error);
        if (strategy === RouteStrategy.AI_OPTIMIZATION) {
          setAiStatus(`❌ Оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
          setAiPaginationMeta(null);
          setTimeout(() => setAiStatus(null), 5000);
        }
        optimized = []; // Show empty results on error
      }
      console.log(`${config.useAIOptimization ? '🤖 AI' : '🏆 Internal'}: Got ${optimized.length} optimized routes`);
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

  // Re-optimize routes using already loaded offers (no re-fetch)
  const handleReoptimize = async () => {
    if (mainOffers.length === 0 && returnOffers.length === 0) {
      setError('Спочатку завантажте пропозиції (Fetch Offers)');
      return;
    }

    setOptimizing(true);
    setError(null);
    
    // Determine strategy (support both legacy and new system)
    const strategy = config.routeStrategy 
      ? config.routeStrategy as RouteStrategy
      : legacyToStrategy(config.useAIOptimization);
    
    if (strategy === RouteStrategy.AI_OPTIMIZATION) {
      setAiStatus('🤖 AI аналізує пропозиції...');
    }

    try {
      const home = config.homeBase;
      const homeBase = config.loadingPoints.length > 0 && 
        (home.latitude === 0 || home.longitude === 0) 
        ? config.loadingPoints[0] 
        : home;

      let optimized: OptimizedRoute[];

      try {
        optimized = await executeRouteOptimization(
          { mainOffers, returnOffers },
          {
            strategy,
            maxEmptyRunPercent: config.maxEmptyRunPercent,
            homeBaseLat: homeBase.latitude,
            homeBaseLon: homeBase.longitude,
            departureFrom: config.departureFrom,
            departureTo: config.departureTo,
            returnFrom: config.returnFrom,
            returnTo: config.returnTo,
            averageSpeedKmh: config.averageSpeedKmh,
            daysOnRoad: 7,
            minPricePerKm: 0,
            aiStatusCallback: setAiStatus,
          }
        );
        
        console.log(`🎯 Strategy: ${strategy} returned ${optimized.length} routes:`, optimized);
        
        if (strategy === RouteStrategy.AI_OPTIMIZATION) {
          setAiStatus('✅ AI оптимізація завершена');
          setAiPaginationMeta(getLastAIPaginationMetadata());
          setTimeout(() => setAiStatus(null), 3000);
        }
        
      } catch (error) {
        console.error('Route optimization failed:', error);
        if (strategy === RouteStrategy.AI_OPTIMIZATION) {
          setAiStatus(`❌ Оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
          setAiPaginationMeta(null);
          setTimeout(() => setAiStatus(null), 5000);
        }
        optimized = []; // Show empty results on error
      }

      console.log(`🎯 Strategy: Re-optimized ${optimized.length} routes using ${strategy}`);
      console.log('Setting routes to state:', optimized);
      setRoutes(optimized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setOptimizing(false);
    }
  };

  // Load more AI routes (pagination)
  const handleLoadMore = async () => {
    if (!aiPaginationMeta?.nextPagePrompt) return;

    setLoadingMore(true);
    setAiStatus('🤖 Завантажую наступну порцію маршрутів...');

    try {
      const home = config.homeBase;
      const homeBase = config.loadingPoints.length > 0 && 
        (home.latitude === 0 || home.longitude === 0) 
        ? config.loadingPoints[0] 
        : home;

      // Merge all offers for parsing
      const allOffers = [...mainOffers, ...returnOffers].filter(
        (offer, idx, arr) => arr.findIndex(o => o.id === offer.id) === idx
      );

      const newRoutes = await loadNextAIPage(
        aiPaginationMeta.nextPagePrompt,
        allOffers,
        {
          maxEmptyRunPercent: config.maxEmptyRunPercent,
          homeBaseLat: homeBase.latitude,
          homeBaseLon: homeBase.longitude,
          departureFrom: config.departureFrom,
          departureTo: config.departureTo,
          returnFrom: config.returnFrom,
          returnTo: config.returnTo,
          averageSpeedKmh: config.averageSpeedKmh,
        },
        setAiStatus
      );

      // APPEND new routes to existing ones
      setRoutes(prev => [...prev, ...newRoutes]);
      
      // Update pagination metadata
      setAiPaginationMeta(getLastAIPaginationMetadata());
      
      setAiStatus(`✅ Завантажено ще ${newRoutes.length} маршрутів`);
      setTimeout(() => setAiStatus(null), 3000);
    } catch (err) {
      console.error('Load more failed:', err);
      setAiStatus(`❌ ${err instanceof Error ? err.message : 'Помилка завантаження'}`);
      setTimeout(() => setAiStatus(null), 5000);
    } finally {
      setLoadingMore(false);
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

        {aiStatus && (
          <div className={`search-status ${aiStatus.includes('✅') ? 'success' : aiStatus.includes('❌') ? 'error' : 'info'}`}>
            {aiStatus}
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
            {(() => {
              const strategy = config.routeStrategy 
                ? config.routeStrategy as RouteStrategy
                : legacyToStrategy(config.useAIOptimization);
              
              const strategyIcon = strategy === RouteStrategy.AI_OPTIMIZATION ? '🤖' : '🏆';
              const strategyName = strategy === RouteStrategy.AI_OPTIMIZATION ? 'AI Оптимізовані' : 'Оптимізовані пропозиції';
              
              return strategy === RouteStrategy.AI_OPTIMIZATION
                ? `${strategyIcon} ${strategyName} (${routes.length}/${aiPaginationMeta?.totalRoutesFound || routes.length})`
                : `${strategyIcon} ${strategyName} (${routes.length})`;
            })()}
            {(mainOffers.length > 0 || returnOffers.length > 0) && (
              <span
                className={`tab-refresh-inline ${optimizing ? 'spinning' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!optimizing) handleReoptimize();
                }}
                title="Переоптимізувати маршрути"
              >
                🔄
              </span>
            )}
          </button>
          {activeTab === 'routes' && (mainOffers.length > 0 || returnOffers.length > 0) && (
            <button
              className="tab-refresh-btn"
              onClick={handleReoptimize}
              disabled={loading}
              title="Переоптимізувати маршрути на основі завантажених пропозицій"
            >
              {loading ? '⏳' : '🔄'}
            </button>
          )}
        </div>

        {activeTab === 'offers' && (
          <>
          
            <OffersTable offers={mainOffers} onRowClick={handleOfferRowClick} />
          </>
        )}
        {activeTab === 'return' && (
          <>
        
            <OffersTable offers={returnOffers} onRowClick={handleOfferRowClick} />
          </>
        )}
        {activeTab === 'routes' && (
          <>
            <RouteResults routes={routes} homeBase={config.homeBase} pricePerKm={config.pricePerKm} />
            {aiPaginationMeta?.nextPagePrompt && (
              <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid #e0e0e0' }}>
                <div style={{ marginBottom: '8px', fontSize: '0.9em', color: '#666' }}>
                  Показано {routes.length} з {aiPaginationMeta.totalRoutesFound} маршрутів
                </div>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={{
                    padding: '10px 24px',
                    fontSize: '1em',
                    backgroundColor: loadingMore ? '#ccc' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                >
                  {loadingMore ? '⏳ Завантаження...' : '📥 Завантажити ще'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
