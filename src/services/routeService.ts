/**
 * Route Service
 * Сервіс для роботи з маршрутами та оптимізацією
 */

import { fetchFreightOffers } from '../utils/strategies/new_strategy/route/routeApiService';
import { executeRouteOptimization, legacyToStrategy, RouteStrategy } from '../utils/routeStrategy';
import type { FreightOffer, OptimizedRoute, RouteConfig } from '../types';

export interface RouteOptimizationParams {
  strategy?: RouteStrategy;
  maxEmptyRunPercent: number;
  homeBaseLat: number;
  homeBaseLon: number;
  departureDate: string;
  returnDate: string;
  averageSpeedKmh: number;
  daysOnRoad: number;
  minPricePerKm: number;
  aiStatusCallback?: (status: string | null) => void;
  bearerToken: string;
  transeuProgressCallback?: (progress: any) => void;
}

export interface FetchOffersResult {
  mainOffers: FreightOffer[];
  returnOffers: FreightOffer[];
}

/**
 * Завантажити пропозиції з API
 */
export async function fetchOffers(config: RouteConfig): Promise<FetchOffersResult> {
  const response = await fetchFreightOffers(config);
  return {
    mainOffers: response.mainOffers || [],
    returnOffers: response.returnOffers || []
  };
}

/**
 * Оптимізувати маршрути
 */
export async function optimizeRoutes(
  offers: FetchOffersResult,
  config: RouteConfig,
  params: Partial<RouteOptimizationParams> = {}
): Promise<OptimizedRoute[]> {
  const home = config.homeBase;
  // Use first loading point as home base if homeBase is not properly set
  const homeBase = config.loadingPoints.length > 0 && 
    (home.latitude === 0 || home.longitude === 0) 
    ? config.loadingPoints[0] 
    : home;
  
  // Determine strategy (support both legacy and new system)
  const strategy = config.routeStrategy 
    ? config.routeStrategy as RouteStrategy
    : legacyToStrategy(config.useAIOptimization);
  
  console.log(`🎯 Strategy: Using ${strategy} optimization`);
  
  const optimizationParams = {
    strategy,
    maxEmptyRunPercent: config.maxEmptyRunPercent,
    homeBaseLat: homeBase.latitude,
    homeBaseLon: homeBase.longitude,
    departureDate: config.departureDate,
    returnDate: config.returnDate,
    averageSpeedKmh: config.averageSpeedKmh,
    daysOnRoad: 7,
    minPricePerKm: 0,
    bearerToken: config.bearerToken,
    // maxResults видалено - виводимо всі маршрути без обмежень
    ...params
  };
  
  try {
    const optimized = await executeRouteOptimization(
      { mainOffers: offers.mainOffers, returnOffers: offers.returnOffers },
      optimizationParams
    );
    
    console.log(`🎯 Strategy: ${strategy} returned ${optimized.length} routes`);
    return optimized;
  } catch (error) {
    console.error('Route optimization failed:', error);
    if (params.aiStatusCallback) {
      params.aiStatusCallback(`❌ Оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
    }
    throw error;
  }
}

/**
 * Отримати домашню базу з конфігурації
 */
export function getHomeBase(config: RouteConfig) {
  const home = config.homeBase;
  return config.loadingPoints.length > 0 && 
    (home.latitude === 0 || home.longitude === 0) 
    ? config.loadingPoints[0] 
    : home;
}