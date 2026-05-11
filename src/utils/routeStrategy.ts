/**
 * Route Optimization Strategy Manager
 * 
 * Manages route optimization using the new enhanced strategy only.
 */

import type { FreightOffer, OptimizedRoute } from '../types';
import type { OptimizedRoute as NewStrategyOptimizedRoute } from './strategies/new_strategy/models/optimizationModels';

// Available optimization strategies - тільки нова стратегія
export const RouteStrategy = {
  NEW_STRATEGY: 'new_strategy', // New enhanced strategy with Redis and proxy
} as const;

export type RouteStrategy = typeof RouteStrategy[keyof typeof RouteStrategy];

// Strategy configuration interface
export interface StrategyConfig {
  strategy: RouteStrategy;
  
  // Common parameters
  maxEmptyRunPercent: number;
  homeBaseLat: number;
  homeBaseLon: number;
  departureDate: string;
  returnDate: string;
  averageSpeedKmh: number;
  
  // Internal algorithm specific
  daysOnRoad?: number;
  minPricePerKm?: number;
  
  // Trans.eu specific
  vehicleType?: 'truck' | 'van';
  bearerToken?: string;
  transeuProgressCallback?: (progress: {
    phase: string;
    completed: number;
    total: number;
    currentBatch?: number;
    totalBatches?: number;
    totalApiRequests?: number;
    completedApiRequests?: number;
  }) => void;
  
  // AI specific
  aiStatusCallback?: (status: string) => void;
}

// Strategy metadata for UI display
export interface StrategyInfo {
  id: RouteStrategy;
  name: string;
  description: string;
  icon: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
  available: boolean;
}

// Available strategies with metadata - тільки нова стратегія
export const AVAILABLE_STRATEGIES: StrategyInfo[] = [
  {
    id: RouteStrategy.NEW_STRATEGY,
    name: 'Нова Стратегія (Enhanced)',
    description: 'Покращена система оптимізації з Redis кешуванням, проксі-сервером та розширеними можливостями',
    icon: '🚀',
    pros: [
      'Найшвидша обробка завдяки Redis кешуванню',
      'Покращений проксі-сервер з JWT автентифікацією',
      'Розширені можливості сканування та оптимізації',
      'Модульна архітектура для легкого розширення',
      'Детальна статистика та моніторинг',
      'Автоматичне кешування маршрутів'
    ],
    cons: [
      'Потребує Redis сервер',
      'Більш складна конфігурація'
    ],
    recommended: true,
    available: true,
  }
];

/**
 * Get strategy info by ID
 */
export function getStrategyInfo(strategy: RouteStrategy): StrategyInfo | undefined {
  return AVAILABLE_STRATEGIES.find(s => s.id === strategy);
}

/**
 * Get available strategies (only new strategy)
 */
export function getAvailableStrategies(): StrategyInfo[] {
  return AVAILABLE_STRATEGIES.filter(s => s.available);
}

/**
 * Get recommended strategy (always new strategy)
 */
export function getRecommendedStrategy(): StrategyInfo {
  return AVAILABLE_STRATEGIES[0];
}

/**
 * Main strategy executor - uses only new enhanced strategy
 */
export async function executeRouteOptimization(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): Promise<OptimizedRoute[]> {
  
  console.log(`🚀 Strategy: Executing new enhanced strategy optimization`);
  
  // Завжди використовуємо нову стратегію
  return await executeNewStrategy(offers, config);
}

/**
 * Execute new enhanced strategy with Redis caching and proxy
 */
async function executeNewStrategy(
  _offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): Promise<OptimizedRoute[]> {
  
  if (config.aiStatusCallback) {
    config.aiStatusCallback('🚀 Використання нової покращеної стратегії...');
  }
  
  try {
    // Динамічно імпортуємо нову стратегію
    const { createRouteOptimizationSystem } = await import('./strategies/new_strategy');
    
    // Створюємо систему оптимізації
    const system = createRouteOptimizationSystem({
      api: {
        baseUrl: 'http://localhost:8848/api/trans',
        apiKey: config.bearerToken
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'larry:routes:'
      },
      optimization: {
        maxDistance: 1000000, // 1000 км
        minCapacity: 1,
        maxCapacity: 50,
        costPerKm: 1.2,
        fuelConsumption: 35,
        fuelPrice: 1.4
      }
    });

    // Ініціалізуємо систему
    await system.initialize();

    if (config.aiStatusCallback) {
      config.aiStatusCallback('🔍 Сканування та кешування маршрутів...');
    }

    // Сканируємо маршрути (якщо кеш порожній)
    const scanResult = await system.scanRoutes();
    console.log('🔍 Результат сканування:', scanResult);

    if (config.aiStatusCallback) {
      config.aiStatusCallback('🎯 Оптимізація маршрутів...');
    }

    // Оптимізуємо маршрути
    const optimization = await system.optimizeRoutes({
      maxDistance: 800000, // 800 км
      minCapacity: 10,
      costPerKm: config.averageSpeedKmh ? 1.5 : 1.2
    });

    if (config.aiStatusCallback) {
      config.aiStatusCallback(`✅ Нова стратегія: знайдено ${optimization.totalRoutes} оптимізованих маршрутів`);
    }

    // Конвертуємо результати з нової стратегії в формат OptimizedRoute[]
    const convertedRoutes: OptimizedRoute[] = optimization.routes.map(route => ({
      id: route.id,
      from: route.routeSegments?.loadingPoints[0]?.place?.address?.locality || 'Unknown',
      to: route.routeSegments?.unloadingPoints[0]?.place?.address?.locality || 'Unknown',
      distanceKm: Math.round(route.distance / 1000), // конвертуємо з метрів в км
      loadingDate: config.departureDate,
      unloadingDate: config.returnDate,
      priceEUR: route.estimatedProfit,
      pricePerKm: route.efficiency,
      isEmpty: false,
      optimizationScore: route.optimizationScore,
      estimatedProfit: route.estimatedProfit,
      fuelCost: route.fuelCost,
      efficiency: route.efficiency,
      recommendations: route.recommendations,
      emptyRoadPercentage: route.emptyRoadPercentage || 0,
      routeSegments: route.routeSegments
    }));

    console.log(`🚀 New Strategy: Successfully converted ${convertedRoutes.length} routes (no limits applied)`);
    return convertedRoutes;
    
  } catch (error) {
    console.error('🚀 New Strategy: Execution failed:', error);
    
    if (config.aiStatusCallback) {
      const errorMessage = error instanceof Error ? error.message : 'Невідома помилка';
      config.aiStatusCallback(`❌ Нова стратегія не вдалася: ${errorMessage}`);
    }
    
    // Повертаємо порожній масив при помилці
    return [];
  }
}

/**
 * Convert legacy boolean useAIOptimization to new strategy enum
 */
export function legacyToStrategy(_useAIOptimization: boolean): RouteStrategy {
  // Завжди повертаємо нову стратегію
  return RouteStrategy.NEW_STRATEGY;
}

/**
 * Convert strategy enum to legacy boolean for backward compatibility
 */
export function strategyToLegacy(_strategy: RouteStrategy): boolean {
  // Завжди повертаємо false (не AI)
  return false;
}