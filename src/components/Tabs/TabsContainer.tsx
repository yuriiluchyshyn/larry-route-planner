/**
 * Tabs Container Component
 * Компонент для відображення табів
 */

import React from 'react';
export type TabType = 'offers' | 'return' | 'routes';

interface TabsContainerProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  mainOffersCount: number;
  returnOffersCount: number;
  routesCount: number;
  loading: boolean;
  optimizing: boolean;
  includeReturnRoute: boolean;
  hasOffers: boolean;
  onExportOffers: () => void;
  onExportReturnOffers: () => void;
  onExportRoutes: () => void;
  onReoptimize: () => void;
}

export const TabsContainer: React.FC<TabsContainerProps> = ({
  activeTab,
  onTabChange,
  mainOffersCount,
  returnOffersCount,
  routesCount,
  loading,
  optimizing,
  includeReturnRoute,
  hasOffers,
  onExportOffers,
  onExportReturnOffers,
  onExportRoutes,
  onReoptimize
}) => {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
        onClick={() => onTabChange('offers')}
      >
        📦 Прямі маршрути ({loading ? '⏳' : mainOffersCount})
        {activeTab === 'offers' && mainOffersCount > 0 && (
          <span
            className="tab-export-inline"
            onClick={(e) => {
              e.stopPropagation();
              onExportOffers();
            }}
            title="Завантажити основні пропозиції у форматі CSV"
          >
            📊
          </span>
        )}
      </button>
      
      {includeReturnRoute && (
        <button
          className={`tab ${activeTab === 'return' ? 'active' : ''}`}
          onClick={() => onTabChange('return')}
        >
          🔄 Зворотні маршрути ({loading ? '⏳' : returnOffersCount})
          {activeTab === 'return' && returnOffersCount > 0 && (
            <span
              className="tab-export-inline"
              onClick={(e) => {
                e.stopPropagation();
                onExportReturnOffers();
              }}
              title="Завантажити зворотні пропозиції у форматі CSV"
            >
              📊
            </span>
          )}
        </button>
      )}
      
      <button
        className={`tab ${activeTab === 'routes' ? 'active' : ''}`}
        onClick={() => onTabChange('routes')}
      >
        🚀 Нова Стратегія ({routesCount})
        {activeTab === 'routes' && routesCount > 0 && (
          <span
            className="tab-export-inline"
            onClick={(e) => {
              e.stopPropagation();
              onExportRoutes();
            }}
            title="Завантажити оптимізовані маршрути у форматі CSV"
          >
            📊
          </span>
        )}
        {hasOffers && (
          <span
            className={`tab-refresh-inline ${optimizing ? 'spinning' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!optimizing) onReoptimize();
            }}
            title="Переоптимізувати маршрути"
          >
            🔄
          </span>
        )}
      </button>
      
      {activeTab === 'routes' && hasOffers && (
        <button
          className="tab-refresh-btn"
          onClick={onReoptimize}
          disabled={loading}
          title="Переоптимізувати маршрути на основі завантажених пропозицій"
        >
          {loading ? '⏳' : '🔄'}
        </button>
      )}
    </div>
  );
};