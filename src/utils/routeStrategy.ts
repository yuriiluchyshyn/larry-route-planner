/**
 * Route Optimization Strategy Manager
 * 
 * Manages different route optimization strategies and selects the appropriate one
 * based on configuration settings.
 */

import type { FreightOffer, OptimizedRoute } from '../types';
import { buildOptimizedRoutes } from './routeOptimizer';
import { buildAIOptimizedRoutes } from './aiOptimizer';

// Available optimization strategies
export enum RouteStrategy {
  INTERNAL_ALGORITHM = 'internal',
  AI_OPTIMIZATION = 'ai',
  HYBRID = 'hybrid', // Future: combine both approaches
  GREEDY = 'greedy', // Future: simple greedy algorithm
  GENETIC = 'genetic', // Future: genetic algorithm
}

// Strategy configuration interface
export interface StrategyConfig {
  strategy: RouteStrategy;
  
  // Common parameters for all strategies
  maxEmptyRunPercent: number;
  homeBaseLat: number;
  homeBaseLon: number;
  departureFrom: string;
  departureTo: string;
  returnFrom: string;
  returnTo: string;
  averageSpeedKmh: number;
  
  // Internal algorithm specific
  daysOnRoad?: number;
  minPricePerKm?: number;
  
  // AI specific
  aiStatusCallback?: (status: string) => void;
  
  // Future strategy parameters
  hybridWeights?: {
    aiWeight: number;
    internalWeight: number;
  };
  geneticParams?: {
    populationSize: number;
    generations: number;
    mutationRate: number;
  };
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

// Available strategies with metadata
export const AVAILABLE_STRATEGIES: StrategyInfo[] = [
  {
    id: RouteStrategy.AI_OPTIMIZATION,
    name: 'AI Оптимізація',
    description: 'Використовує штучний інтелект для пошуку найкращих маршрутів',
    icon: '🤖',
    pros: [
      'Знаходить складні комбінації маршрутів',
      'Враховує багато факторів одночасно',
      'Постійно покращується',
      'Може обробляти великі обсяги даних'
    ],
    cons: [
      'Потребує API ключ',
      'Може бути повільніше',
      'Залежить від інтернет з\'єднання'
    ],
    recommended: true,
    available: true,
  },
  {
    id: RouteStrategy.INTERNAL_ALGORITHM,
    name: 'Внутрішній Алгоритм',
    description: 'Використовує вбудований алгоритм Branch-and-Bound',
    icon: '🏆',
    pros: [
      'Швидкий та надійний',
      'Працює офлайн',
      'Не потребує API ключів',
      'Передбачуваний результат'
    ],
    cons: [
      'Обмежена складність маршрутів',
      'Менше факторів враховується',
      'Може пропустити оптимальні рішення'
    ],
    recommended: false,
    available: true,
  },
  {
    id: RouteStrategy.HYBRID,
    name: 'Гібридний Підхід',
    description: 'Комбінує AI та внутрішній алгоритм для кращих результатів',
    icon: '⚡',
    pros: [
      'Найкращі результати',
      'Резервний варіант при збоях AI',
      'Балансує швидкість та якість'
    ],
    cons: [
      'Складніша конфігурація',
      'Довший час обробки'
    ],
    recommended: false,
    available: false, // Not implemented yet
  },
  {
    id: RouteStrategy.GREEDY,
    name: 'Жадібний Алгоритм',
    description: 'Простий та швидкий алгоритм для базової оптимізації',
    icon: '⚡',
    pros: [
      'Дуже швидкий',
      'Простий у використанні',
      'Мінімальне споживання ресурсів'
    ],
    cons: [
      'Не оптимальні результати',
      'Не враховує складні залежності'
    ],
    recommended: false,
    available: false, // Not implemented yet
  },
];

/**
 * Get strategy info by ID
 */
export function getStrategyInfo(strategy: RouteStrategy): StrategyInfo | undefined {
  return AVAILABLE_STRATEGIES.find(s => s.id === strategy);
}

/**
 * Get available strategies (only implemented ones)
 */
export function getAvailableStrategies(): StrategyInfo[] {
  return AVAILABLE_STRATEGIES.filter(s => s.available);
}

/**
 * Get recommended strategy
 */
export function getRecommendedStrategy(): StrategyInfo {
  return AVAILABLE_STRATEGIES.find(s => s.recommended) || AVAILABLE_STRATEGIES[0];
}

/**
 * Main strategy executor - routes optimization requests to appropriate strategy
 */
export async function executeRouteOptimization(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): Promise<OptimizedRoute[]> {
  
  console.log(`🎯 Strategy: Executing ${config.strategy} optimization`);
  
  switch (config.strategy) {
    case RouteStrategy.AI_OPTIMIZATION:
      return await executeAIStrategy(offers, config);
      
    case RouteStrategy.INTERNAL_ALGORITHM:
      return executeInternalStrategy(offers, config);
      
    case RouteStrategy.HYBRID:
      return await executeHybridStrategy(offers, config);
      
    case RouteStrategy.GREEDY:
      return executeGreedyStrategy(offers, config);
      
    case RouteStrategy.GENETIC:
      return executeGeneticStrategy(offers, config);
      
    default:
      console.warn(`🎯 Strategy: Unknown strategy ${config.strategy}, falling back to internal algorithm`);
      return executeInternalStrategy(offers, config);
  }
}

/**
 * Execute AI optimization strategy
 */
async function executeAIStrategy(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): Promise<OptimizedRoute[]> {
  
  if (config.aiStatusCallback) {
    config.aiStatusCallback('🤖 AI аналізує пропозиції...');
  }
  
  try {
    const result = await buildAIOptimizedRoutes(
      offers,
      {
        maxEmptyRunPercent: config.maxEmptyRunPercent,
        homeBaseLat: config.homeBaseLat,
        homeBaseLon: config.homeBaseLon,
        departureFrom: config.departureFrom,
        departureTo: config.departureTo,
        returnFrom: config.returnFrom,
        returnTo: config.returnTo,
        averageSpeedKmh: config.averageSpeedKmh,
      },
      config.aiStatusCallback
    );
    
    if (config.aiStatusCallback) {
      config.aiStatusCallback('✅ AI оптимізація завершена');
    }
    
    return result;
    
  } catch (error) {
    console.error('🎯 Strategy: AI optimization failed:', error);
    
    if (config.aiStatusCallback) {
      config.aiStatusCallback(`❌ AI оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
    }
    
    throw error;
  }
}

/**
 * Execute internal algorithm strategy
 */
function executeInternalStrategy(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): OptimizedRoute[] {
  
  return buildOptimizedRoutes(
    offers,
    {
      daysOnRoad: config.daysOnRoad || 7,
      maxEmptyRunPercent: config.maxEmptyRunPercent,
      minPricePerKm: config.minPricePerKm || 0,
      homeBaseLat: config.homeBaseLat,
      homeBaseLon: config.homeBaseLon,
      departureFrom: config.departureFrom,
      departureTo: config.departureTo,
      returnFrom: config.returnFrom,
      returnTo: config.returnTo,
      averageSpeedKmh: config.averageSpeedKmh,
    }
  );
}

/**
 * Execute hybrid strategy (AI + Internal)
 * TODO: Implement hybrid approach
 */
async function executeHybridStrategy(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): Promise<OptimizedRoute[]> {
  
  console.log('🎯 Strategy: Hybrid strategy not implemented yet, falling back to AI');
  
  // For now, try AI first, fallback to internal if it fails
  try {
    return await executeAIStrategy(offers, config);
  } catch (error) {
    console.warn('🎯 Strategy: AI failed in hybrid mode, falling back to internal algorithm');
    return executeInternalStrategy(offers, config);
  }
}

/**
 * Execute greedy strategy
 * TODO: Implement greedy algorithm
 */
function executeGreedyStrategy(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): OptimizedRoute[] {
  
  console.log('🎯 Strategy: Greedy strategy not implemented yet, falling back to internal algorithm');
  return executeInternalStrategy(offers, config);
}

/**
 * Execute genetic algorithm strategy
 * TODO: Implement genetic algorithm
 */
function executeGeneticStrategy(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: StrategyConfig
): OptimizedRoute[] {
  
  console.log('🎯 Strategy: Genetic strategy not implemented yet, falling back to internal algorithm');
  return executeInternalStrategy(offers, config);
}

/**
 * Convert legacy boolean useAIOptimization to new strategy enum
 */
export function legacyToStrategy(useAIOptimization: boolean): RouteStrategy {
  return useAIOptimization ? RouteStrategy.AI_OPTIMIZATION : RouteStrategy.INTERNAL_ALGORITHM;
}

/**
 * Convert strategy enum to legacy boolean for backward compatibility
 */
export function strategyToLegacy(strategy: RouteStrategy): boolean {
  return strategy === RouteStrategy.AI_OPTIMIZATION;
}