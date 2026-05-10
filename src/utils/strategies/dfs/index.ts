/**
 * DFS Route Optimization Strategy - Main Interface
 * 
 * Public API for the DFS optimization strategy
 */

import type { FreightOffer, OptimizedRoute } from '../../../types';
import type { DFSConfig, DFSResult } from './types';
import { DFSRouteOptimizer } from './dfsOptimizer';
import { 
  convertFreightOffersToDFS, 
  convertDFSToOptimizedRoutes, 
  createDFSConfig,
  validateDFSOffer 
} from './dataConverter';
import { filterAndRankRoutes } from './scoring';

/**
 * Main entry point for DFS route optimization
 */
export async function buildDFSOptimizedRoutes(
  offers: FreightOffer[] | { mainOffers: FreightOffer[]; returnOffers: FreightOffer[] },
  config: {
    homeBaseLat: number;
    homeBaseLon: number;
    maxEmptyRunPercent: number;
    averageSpeedKmh: number;
    departureFrom: string;
    departureTo: string;
    returnFrom: string;
    returnTo: string;
    daysOnRoad?: number;
  },
  statusCallback?: (status: string) => void
): Promise<OptimizedRoute[]> {
  
  const startTime = Date.now();
  
  try {
    // Normalize input offers
    let allOffers: FreightOffer[];
    if (Array.isArray(offers)) {
      allOffers = offers;
    } else {
      const { mainOffers, returnOffers } = offers;
      const seen = new Set<string>();
      allOffers = [];
      
      // Merge and deduplicate offers
      for (const offer of [...mainOffers, ...returnOffers]) {
        if (!seen.has(offer.id)) {
          seen.add(offer.id);
          allOffers.push(offer);
        }
      }
    }
    
    if (statusCallback) {
      statusCallback(`🔍 DFS: Аналізую ${allOffers.length} пропозицій...`);
    }
    
    console.log(`🔍 DFS: Starting optimization with ${allOffers.length} offers`);
    
    // Convert to DFS format
    const dfsOffers = convertFreightOffersToDFS(allOffers);
    
    // Validate offers
    const validOffers = dfsOffers.filter(validateDFSOffer);
    const invalidCount = dfsOffers.length - validOffers.length;
    
    if (invalidCount > 0) {
      console.warn(`🔍 DFS: Filtered out ${invalidCount} invalid offers`);
    }
    
    if (validOffers.length === 0) {
      console.warn('🔍 DFS: No valid offers to optimize');
      return [];
    }
    
    if (statusCallback) {
      statusCallback(`🔍 DFS: Обробляю ${validOffers.length} валідних пропозицій...`);
    }
    
    // Create DFS configuration
    const dfsConfig = createDFSConfig(config);
    
    // Run optimization
    const optimizer = new DFSRouteOptimizer(dfsConfig);
    const result: DFSResult = optimizer.optimize(validOffers);
    
    if (statusCallback) {
      statusCallback(`🔍 DFS: Знайдено ${result.routes.length} маршрутів...`);
    }
    
    // Filter and rank results
    const filteredRoutes = filterAndRankRoutes(result.routes, dfsConfig, {
      maxEmptyPercent: config.maxEmptyRunPercent,
      maxResults: 50 // Limit to top 50 routes
    });
    
    // Convert back to OptimizedRoute format
    const optimizedRoutes = convertDFSToOptimizedRoutes(filteredRoutes, dfsConfig);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`🔍 DFS: Optimization completed in ${executionTime}ms`);
    console.log(`🔍 DFS: Generated ${optimizedRoutes.length} optimized routes`);
    console.log(`🔍 DFS: Statistics:`, optimizer.getDetailedStatistics());
    
    if (statusCallback) {
      statusCallback(`✅ DFS: Знайдено ${optimizedRoutes.length} оптимальних маршрутів`);
    }
    
    return optimizedRoutes;
    
  } catch (error) {
    console.error('🔍 DFS: Optimization failed:', error);
    
    if (statusCallback) {
      statusCallback(`❌ DFS: Помилка оптимізації: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
    }
    
    throw new Error(`DFS оптимізація не вдалася: ${error instanceof Error ? error.message : 'Невідома помилка'}`);
  }
}

/**
 * Get DFS strategy information
 */
export function getDFSStrategyInfo() {
  return {
    name: 'DFS Branch & Bound',
    description: 'Детермінований алгоритм пошуку в глибину з відсіканням гілок',
    advantages: [
      'Швидкий та ефективний',
      'Детермінований результат',
      'Не потребує API ключів',
      'Працює офлайн',
      'Оптимальне відсікання неперспективних варіантів'
    ],
    disadvantages: [
      'Обмежена складність комбінацій',
      'Може пропустити деякі креативні рішення',
      'Залежить від якості евристик'
    ],
    bestFor: [
      'Швидка оптимізація великої кількості пропозицій',
      'Ситуації з чіткими обмеженнями',
      'Коли потрібен передбачуваний результат'
    ]
  };
}

/**
 * Validate DFS strategy configuration
 */
export function validateDFSConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.homeBaseLat || Math.abs(config.homeBaseLat) > 90) {
    errors.push('Invalid home base latitude');
  }
  
  if (!config.homeBaseLon || Math.abs(config.homeBaseLon) > 180) {
    errors.push('Invalid home base longitude');
  }
  
  if (!config.maxEmptyRunPercent || config.maxEmptyRunPercent <= 0 || config.maxEmptyRunPercent > 100) {
    errors.push('Invalid max empty run percentage');
  }
  
  if (!config.averageSpeedKmh || config.averageSpeedKmh <= 0 || config.averageSpeedKmh > 200) {
    errors.push('Invalid average speed');
  }
  
  try {
    new Date(config.departureFrom);
    new Date(config.departureTo);
    new Date(config.returnFrom);
    new Date(config.returnTo);
  } catch {
    errors.push('Invalid date format in time windows');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export types for external use
export type { DFSConfig, DFSResult } from './types';
export { DFSRouteOptimizer } from './dfsOptimizer';