/**
 * Route Service
 * Сервіс для роботи з маршрутами та оптимізацією
 */

import { fetchFreightOffers } from '../utils/services/ApiTransService.compatibility';
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
  offers: FreightOffer[];
}

/**
 * Оптимізувати маршрути
 * Домашня база використовується як початкова і кінцева точка тільки якщо вона задана
 */
export async function optimizeRoutes(
  offers: FetchOffersResult,
  config: RouteConfig,
  params: Partial<RouteOptimizationParams> = {}
): Promise<OptimizedRoute[]> {
  const home = config.homeBase;
  
  // Перевіряємо чи домашня база задана
  const hasHomeBase = home && 
                     home.locality && 
                     home.latitude !== 0 && 
                     home.longitude !== 0;
  
  if (hasHomeBase) {
    console.log(`🏠 Домашня база для оптимізації: ${home.locality} (${home.country}) [${home.latitude}, ${home.longitude}]`);
  } else {
    console.log(`📍 Домашня база не задана - оптимізація без прив'язки до домашньої точки`);
  }
  
  // Determine strategy (support both legacy and new system)
  const strategy = config.routeStrategy 
    ? config.routeStrategy as RouteStrategy
    : legacyToStrategy(config.useAIOptimization);
  
  console.log(`🎯 Strategy: Using ${strategy} optimization`);
  
  const optimizationParams = {
    strategy,
    maxEmptyRunPercent: config.maxEmptyRunPercent,
    // Використовуємо домашню базу тільки якщо вона задана, інакше використовуємо першу точку завантаження
    homeBaseLat: hasHomeBase ? home.latitude : (config.loadingPoints[0]?.latitude || 0),
    homeBaseLon: hasHomeBase ? home.longitude : (config.loadingPoints[0]?.longitude || 0),
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
      { mainOffers: offers.offers, returnOffers: [] }, // Всі offers тепер в одному списку
      optimizationParams
    );
    
    console.log(`🎯 Strategy: ${strategy} returned ${optimized.length} routes`);
    
    if (hasHomeBase) {
      console.log(`🏠 Всі маршрути починаються і закінчуються в: ${home.locality} (${home.country})`);
    } else {
      console.log(`📍 Маршрути оптимізовані без прив'язки до домашньої бази`);
    }
    
    return optimized;
  } catch (error) {
    console.error('Route optimization failed:', error);
    if (params.aiStatusCallback) {
      params.aiStatusCallback(`❌ Оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
    }
    throw error;
  }
}

