/**
 * Route Management Hook
 * Хук для управління маршрутами та оптимізацією
 */

import { useState, useCallback } from 'react';
import { fetchOffers, optimizeRoutes } from '../services/routeService';
import { RouteStrategy } from '../utils/routeStrategy';
import type { FreightOffer, OptimizedRoute, RouteConfig } from '../types';
import type { TranseuProgress } from '../components/ProgressBar/TranseuProgressBar';

interface UseRouteManagementProps {
  config: RouteConfig | null;
}

export function useRouteManagement({ config }: UseRouteManagementProps) {
  const [mainOffers, setMainOffers] = useState<FreightOffer[]>([]);
  const [returnOffers, setReturnOffers] = useState<FreightOffer[]>([]);
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [transeuProgress, setTranseuProgress] = useState<TranseuProgress | null>(null);
  const [aiPaginationMeta] = useState<{
    totalRoutesFound: number;
    returnedRoutesCount: number;
    nextPagePrompt: string | null;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch offers from API
  const handleFetch = useCallback(async () => {
    if (!config) {
      setError('Конфігурація не встановлена');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchOffers(config);
      setMainOffers(response.mainOffers);
      setReturnOffers(response.returnOffers);

      // Optimize routes automatically after fetching
      try {
        const optimized = await optimizeRoutes(
          response,
          config,
          {
            aiStatusCallback: setAiStatus,
          }
        );
        
        console.log(`Got ${optimized.length} optimized routes`);
        setRoutes(optimized);
        
        if (config.routeStrategy === RouteStrategy.NEW_STRATEGY) {
          setTimeout(() => setAiStatus(null), 3000);
        }
      } catch (error) {
        console.error('Route optimization failed:', error);
        setRoutes([]); // Show empty results on error
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
    } finally {
      setLoading(false);
      setTranseuProgress(null);
    }
  }, [config]);

  // Re-optimize routes using already loaded offers
  const handleReoptimize = useCallback(async () => {
    if (!config) {
      setError('Конфігурація не встановлена');
      return;
    }

    if (mainOffers.length === 0 && returnOffers.length === 0) {
      setError('Спочатку завантажте пропозиції (Fetch Offers)');
      return;
    }

    setOptimizing(true);
    setError(null);
    
    if (config.routeStrategy === RouteStrategy.NEW_STRATEGY) {
      setAiStatus('🚀 Нова стратегія аналізує пропозиції...');
    } else {
      setTranseuProgress({
        phase: 'Ініціалізація аналізу...',
        completed: 0,
        total: 1
      });
    }

    try {
      const optimized = await optimizeRoutes(
        { mainOffers, returnOffers },
        config,
        {
          aiStatusCallback: setAiStatus,
          transeuProgressCallback: setTranseuProgress,
        }
      );
      
      console.log(`Re-optimized ${optimized.length} routes`);
      setRoutes(optimized);
      
      if (config.routeStrategy === RouteStrategy.NEW_STRATEGY) {
        setAiStatus('✅ Оптимізація завершена');
        setTimeout(() => setAiStatus(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setOptimizing(false);
      setTranseuProgress(null);
    }
  }, [config, mainOffers, returnOffers]);

  // Load more AI routes (pagination) - TODO: Implement in new strategy
  const handleLoadMore = useCallback(async () => {
    if (!aiPaginationMeta?.nextPagePrompt) return;

    setLoadingMore(true);
    setAiStatus('🤖 Завантажую наступну порцію маршрутів...');

    try {
      // TODO: Implement pagination in new strategy
      setAiStatus('⚠️ Пагінація тимчасово недоступна - буде реалізована в новій стратегії');
      setTimeout(() => setAiStatus(null), 3000);
    } catch (err) {
      console.error('Load more failed:', err);
      setAiStatus(`❌ ${err instanceof Error ? err.message : 'Помилка завантаження'}`);
      setTimeout(() => setAiStatus(null), 5000);
    } finally {
      setLoadingMore(false);
    }
  }, [aiPaginationMeta]);

  return {
    // State
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
    
    // Actions
    handleFetch,
    handleReoptimize,
    handleLoadMore,
    
    // Setters for external use
    setError,
    setAiStatus,
  };
}