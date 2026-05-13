import { useState, useEffect } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { EURulesHeader } from './components/EURulesHeader';
import { OffersTable } from './components/OffersTable';
import { RouteResults } from './components/RouteResults';
import { FinanceButton } from './components/FinanceButton';
import { ErrorBanner } from './components/StatusMessages/ErrorBanner';
import { StatusMessage } from './components/StatusMessages/StatusMessage';
import { TabsContainer, type TabType } from './components/Tabs/TabsContainer';

import { useExtensionMessaging } from './hooks/useExtensionMessaging';
import { useRouteManagement } from './hooks/useRouteManagement';
import { searchOfferOnMainPage, isInExtensionContext } from './services/extensionService';
import { getBearerTokenFromStorage, getTokenFromUrl } from './services/tokenService';
import SearchProgressBar from './components/SearchProgressBar';
import { exportOffersToCSV, exportRoutesToCSV, generateTimestampedFilename } from './utils/csvExport';
import type { FreightOffer, RouteConfig } from './types';
import { RoutePointType } from './types';

import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [config, setConfig] = useState<RouteConfig | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('offers');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [extensionVehicleTypes, setExtensionVehicleTypes] = useState<string[]>([]);

  // Initialize token from storage or URL parameters on app load
  useEffect(() => {
    const initializeToken = () => {
      // First check URL parameters (from extension)
      const urlToken = getTokenFromUrl();
      if (urlToken) {
        console.log('Larry: Token found in URL parameters');
        setConfig(prev => prev ? { 
          ...prev, 
          bearerToken: urlToken 
        } : null);
        return;
      }
      
      // Then check localStorage
      const storageToken = getBearerTokenFromStorage();
      if (storageToken) {
        console.log('Larry: Token found in localStorage');
        setConfig(prev => prev ? { 
          ...prev, 
          bearerToken: storageToken 
        } : null);
        return;
      }
      
      console.log('Larry: No token found, will request from extension if available');
    };

    initializeToken();
  }, []);

  // Route management hook
  const {
    offers,
    routes,
    loading,
    error,
    aiStatus,
    searchProgress,
    handleFetch,
    handleOptimizeRoutes,
  } = useRouteManagement({ config });

  // Extension messaging hook
  useExtensionMessaging({
    config,
    onConfigChange: setConfig,
    onTokenReceived: (token) => {
      console.log('Larry: Received token from extension, updating config');
      setConfig(prev => prev ? { 
        ...prev, 
        bearerToken: token 
      } : null);
    },
    onSearchStatusChange: setSearchStatus,
    onExtensionVehicleTypesReceived: setExtensionVehicleTypes,
  });

  // Handle offer row click
  const handleOfferRowClick = (offer: FreightOffer) => {
    if (!isInExtensionContext()) {
      setSearchStatus('⚠️ Функція пошуку доступна тільки в розширенні браузера');
      setTimeout(() => setSearchStatus(null), 3000);
      return;
    }
    
    try {
      setSearchStatus(`🔍 Шукаю пропозицію ${offer.id} на основній сторінці...`);
      searchOfferOnMainPage(offer);
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : 'Помилка пошуку');
      setTimeout(() => setSearchStatus(null), 3000);
    }
  };

  // Export functions
  const handleExportOffers = () => {
    const filename = generateTimestampedFilename('larry-all-offers');
    exportOffersToCSV(offers, filename);
  };

  const handleExportRoutes = () => {
    const filename = generateTimestampedFilename('larry-optimized-routes');
    exportRoutesToCSV(routes, filename);
  };

  const hasOffers = offers.length > 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <ConfigPanel
          config={config}
          onChange={setConfig}
          onFetch={handleFetch}
          loading={loading}
          extensionVehicleTypes={extensionVehicleTypes}
        />
      </aside>

      <main className="content">
        <div className="content-header">
          <EURulesHeader />
          <FinanceButton className="finance-button-container" />
        </div>

        {error && <ErrorBanner error={error} />}
        
        {searchStatus && <StatusMessage message={searchStatus} />}
        
        {aiStatus && <StatusMessage message={aiStatus} />}
        
        {searchProgress && (
          <SearchProgressBar
            current={searchProgress.current}
            total={searchProgress.total}
            currentRoute={searchProgress.currentRoute}
            phase={searchProgress.phase}
          />
        )}

        <TabsContainer
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allOffersCount={offers.length}
          routesCount={routes.length}
          loading={loading}
          optimizing={false}
          hasOffers={hasOffers}
          onExportOffers={handleExportOffers}
          onExportRoutes={handleExportRoutes}
          onReoptimize={handleOptimizeRoutes}
        />

        {activeTab === 'offers' && (
          <OffersTable offers={offers} onRowClick={handleOfferRowClick} />
        )}
        
        {activeTab === 'routes' && (
          <RouteResults 
            routes={routes} 
            homeBase={config?.routes?.find(point => point.type === RoutePointType.HOME_POINT) || { 
              id: 'default-home', 
              locality: 'Unknown', 
              postalCode: '', 
              country: '', 
              latitude: 0, 
              longitude: 0, 
              range: 0 
            }}
            pricePerKm={config?.pricePerKm || 1.5}
          />
        )}
      </main>
    </div>
  );
}

export default App;