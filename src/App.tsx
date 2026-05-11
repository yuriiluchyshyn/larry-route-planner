import { useState, useEffect } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { EURulesHeader } from './components/EURulesHeader';
import { OffersTable } from './components/OffersTable';
import { RouteResults } from './components/RouteResults';
import { FinanceButton } from './components/FinanceButton';
import { ErrorBanner } from './components/StatusMessages/ErrorBanner';
import { StatusMessage } from './components/StatusMessages/StatusMessage';
import { TranseuProgressBar } from './components/ProgressBar/TranseuProgressBar';
import { TabsContainer, type TabType } from './components/Tabs/TabsContainer';

import { useExtensionMessaging } from './hooks/useExtensionMessaging';
import { useRouteManagement } from './hooks/useRouteManagement';
import { searchOfferOnMainPage, isInExtensionContext } from './services/extensionService';
import { getBearerTokenFromStorage, getTokenFromUrl } from './services/tokenService';
import { exportOffersToCSV, exportRoutesToCSV, generateTimestampedFilename } from './utils/csvExport';
import type { FreightOffer, RouteConfig } from './types';

import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [config, setConfig] = useState<RouteConfig | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('offers');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  // Initialize token from storage or URL parameters on app load
  useEffect(() => {
    const initializeToken = () => {
      // First check URL parameters (from extension)
      const urlToken = getTokenFromUrl();
      if (urlToken) {
        console.log('Larry: Token found in URL parameters');
        setConfig(prev => ({ 
          ...(prev || {}), 
          bearerToken: urlToken 
        } as RouteConfig));
        return;
      }
      
      // Then check localStorage
      const storageToken = getBearerTokenFromStorage();
      if (storageToken) {
        console.log('Larry: Token found in localStorage');
        setConfig(prev => ({ 
          ...(prev || {}), 
          bearerToken: storageToken 
        } as RouteConfig));
        return;
      }
      
      console.log('Larry: No token found, will request from extension if available');
    };

    initializeToken();
  }, []);

  // Route management hook
  const {
    mainOffers,
    returnOffers,
    routes,
    loading,
    optimizing,
    error,
    aiStatus,
    transeuProgress,
    aiPaginationMeta,
    loadingMore,
    handleFetch,
    handleReoptimize,
    handleLoadMore,
  } = useRouteManagement({ config });

  // Extension messaging hook
  useExtensionMessaging({
    config,
    onConfigChange: setConfig,
    onTokenReceived: (token) => {
      console.log('Larry: Received token from extension, updating config');
      setConfig(prev => ({ 
        ...(prev || {}), 
        bearerToken: token 
      } as RouteConfig));
    },
    onSearchStatusChange: setSearchStatus,
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
    const filename = generateTimestampedFilename('larry-main-offers');
    exportOffersToCSV(mainOffers, filename);
  };

  const handleExportReturnOffers = () => {
    const filename = generateTimestampedFilename('larry-return-offers');
    exportOffersToCSV(returnOffers, filename);
  };

  const handleExportRoutes = () => {
    const filename = generateTimestampedFilename('larry-optimized-routes');
    exportRoutesToCSV(routes, filename);
  };

  const hasOffers = mainOffers.length > 0 || returnOffers.length > 0;

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
        <div className="content-header">
          <EURulesHeader />
          <FinanceButton className="finance-button-container" />
        </div>

        {error && <ErrorBanner error={error} />}
        
        {searchStatus && <StatusMessage message={searchStatus} />}
        
        {aiStatus && <StatusMessage message={aiStatus} />}

        <TabsContainer
          activeTab={activeTab}
          onTabChange={setActiveTab}
          mainOffersCount={mainOffers.length}
          returnOffersCount={returnOffers.length}
          routesCount={routes.length}
          loading={loading}
          optimizing={optimizing}
          includeReturnRoute={config?.includeReturnRoute || false}
          hasOffers={hasOffers}
          onExportOffers={handleExportOffers}
          onExportReturnOffers={handleExportReturnOffers}
          onExportRoutes={handleExportRoutes}
          onReoptimize={handleReoptimize}
        />

        {activeTab === 'offers' && (
          <OffersTable offers={mainOffers} onRowClick={handleOfferRowClick} />
        )}
        
        {activeTab === 'return' && (
          <OffersTable offers={returnOffers} onRowClick={handleOfferRowClick} />
        )}
        
        {activeTab === 'routes' && (
          <>
            {transeuProgress && <TranseuProgressBar progress={transeuProgress} />}
            
            <RouteResults 
              routes={routes} 
              homeBase={config?.homeBase}
              pricePerKm={config?.pricePerKm}
            />
            
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