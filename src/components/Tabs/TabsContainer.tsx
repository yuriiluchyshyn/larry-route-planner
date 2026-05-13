/**
 * Tabs Container Component
 * Компонент для відображення табів
 */

import React from 'react';
export type TabType = 'offers' | 'routes';

interface TabsContainerProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  allOffersCount: number;
  routesCount: number;
  loading: boolean;
  optimizing: boolean;
  hasOffers: boolean;
  onExportOffers: () => void;
  onExportRoutes: () => void;
  onReoptimize: () => void;
}

export const TabsContainer: React.FC<TabsContainerProps> = ({
  activeTab,
  onTabChange,
  allOffersCount,
  routesCount,
  loading,
  optimizing,
  hasOffers,
  onExportOffers,
  onExportRoutes,
  onReoptimize
}) => {
  return (
    <div className="tabs">
      <button
        className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
        onClick={() => onTabChange('offers')}
      >
        📦 Прямі маршрути ({loading ? '⏳' : allOffersCount})
        {activeTab === 'offers' && allOffersCount > 0 && (
          <span
            className="tab-export-inline"
            onClick={(e) => {
              e.stopPropagation();
              onExportOffers();
            }}
            title="Завантажити всі пропозиції у форматі CSV"
          >
            📊
          </span>
        )}
      </button>
      
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