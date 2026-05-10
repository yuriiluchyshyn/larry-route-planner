/**
 * DFS Route Optimization Strategy - Scoring System
 * 
 * Implements the scoring algorithm for route evaluation and ranking
 */

import type { RouteContext, DFSConfig, RiskType } from './types';
import { checkEUCompliance, detectTimeRisks } from './timeUtils';

/**
 * Calculate comprehensive score for a route context
 */
export function calculateRouteScore(context: RouteContext, config: DFSConfig): number {
  let score = 100; // Base score
  
  const { scoreWeights } = config;
  
  // 1. Loaded distance bonus (+1 point per 100km of loaded distance)
  const loadedBonus = Math.floor(context.loadedDistanceKm / 100) * scoreWeights.loadedKmBonus;
  score += loadedBonus;
  
  // 2. Empty run penalty (-2 points per 1% of empty run)
  const emptyPenalty = context.emptyRunPercent * scoreWeights.emptyKmPenalty;
  score -= emptyPenalty;
  
  // 3. Chain length bonus (reward longer chains)
  const chainBonus = (context.chain.length - 1) * scoreWeights.chainLengthBonus;
  score += chainBonus;
  
  // 4. EU compliance check
  const euCompliance = checkEUCompliance(context, config.avgSpeed);
  if (!euCompliance.isCompliant) {
    const euPenalty = euCompliance.violations.length * scoreWeights.euViolationPenalty;
    score -= euPenalty;
  }
  
  // 5. Risk penalties
  const risks = detectTimeRisks(context);
  const riskPenalty = risks.length * scoreWeights.riskPenalty;
  score -= riskPenalty;
  
  // 6. Time window compliance bonus
  const timeWindowBonus = calculateTimeWindowBonus(context, config);
  score += timeWindowBonus;
  
  // 7. Price efficiency bonus
  const priceBonus = calculatePriceEfficiencyBonus(context);
  score += priceBonus;
  
  return Math.round(score);
}

/**
 * Calculate bonus for staying within preferred time windows
 */
function calculateTimeWindowBonus(context: RouteContext, config: DFSConfig): number {
  if (context.chain.length === 0) return 0;
  
  let bonus = 0;
  
  // Check if first loading is within departure window
  const firstLoad = new Date(context.chain[0].loadStart);
  if (firstLoad >= config.departureTimeWindow.from && firstLoad <= config.departureTimeWindow.to) {
    bonus += 50; // Good departure timing
  }
  
  // Check if last unloading is within return window
  const lastUnload = new Date(context.chain[context.chain.length - 1].unloadEnd);
  if (lastUnload >= config.returnTimeWindow.from && lastUnload <= config.returnTimeWindow.to) {
    bonus += 50; // Good return timing
  }
  
  return bonus;
}

/**
 * Calculate bonus based on price efficiency (EUR per km)
 */
function calculatePriceEfficiencyBonus(context: RouteContext): number {
  if (context.loadedDistanceKm === 0) return 0;
  
  const totalRevenue = context.chain.reduce((sum, offer) => sum + offer.price, 0);
  const pricePerKm = totalRevenue / context.loadedDistanceKm;
  
  // Bonus for high price per km (above 1.5 EUR/km is good)
  if (pricePerKm > 2.0) return 100;
  if (pricePerKm > 1.5) return 50;
  if (pricePerKm > 1.0) return 25;
  
  return 0;
}

/**
 * Calculate detailed scoring breakdown for analysis
 */
export function calculateScoringBreakdown(context: RouteContext, config: DFSConfig): {
  totalScore: number;
  breakdown: {
    baseScore: number;
    loadedBonus: number;
    emptyPenalty: number;
    chainBonus: number;
    euPenalty: number;
    riskPenalty: number;
    timeWindowBonus: number;
    priceBonus: number;
  };
  risks: RiskType[];
  euCompliance: {
    isCompliant: boolean;
    violations: string[];
  };
} {
  const baseScore = 100;
  const { scoreWeights } = config;
  
  // Calculate each component
  const loadedBonus = Math.floor(context.loadedDistanceKm / 100) * scoreWeights.loadedKmBonus;
  const emptyPenalty = context.emptyRunPercent * scoreWeights.emptyKmPenalty;
  const chainBonus = (context.chain.length - 1) * scoreWeights.chainLengthBonus;
  
  const euCompliance = checkEUCompliance(context, config.avgSpeed);
  const euPenalty = euCompliance.isCompliant ? 0 : euCompliance.violations.length * scoreWeights.euViolationPenalty;
  
  const risks = detectTimeRisks(context);
  const riskPenalty = risks.length * scoreWeights.riskPenalty;
  
  const timeWindowBonus = calculateTimeWindowBonus(context, config);
  const priceBonus = calculatePriceEfficiencyBonus(context);
  
  const totalScore = baseScore + loadedBonus - emptyPenalty + chainBonus - euPenalty - riskPenalty + timeWindowBonus + priceBonus;
  
  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      baseScore,
      loadedBonus,
      emptyPenalty,
      chainBonus,
      euPenalty,
      riskPenalty,
      timeWindowBonus,
      priceBonus
    },
    risks,
    euCompliance
  };
}

/**
 * Compare two routes and return the better one
 */
export function compareRoutes(route1: RouteContext, route2: RouteContext): number {
  // Primary: higher score wins
  if (route1.score !== route2.score) {
    return route2.score - route1.score;
  }
  
  // Secondary: more loaded distance wins
  if (route1.loadedDistanceKm !== route2.loadedDistanceKm) {
    return route2.loadedDistanceKm - route1.loadedDistanceKm;
  }
  
  // Tertiary: less empty distance wins
  if (route1.emptyDistanceKm !== route2.emptyDistanceKm) {
    return route1.emptyDistanceKm - route2.emptyDistanceKm;
  }
  
  // Quaternary: longer chain wins
  return route2.chain.length - route1.chain.length;
}

/**
 * Filter and rank routes based on quality thresholds
 */
export function filterAndRankRoutes(
  routes: RouteContext[],
  config: DFSConfig,
  options: {
    minScore?: number;
    maxEmptyPercent?: number;
    requireEUCompliance?: boolean;
    maxResults?: number;
  } = {}
): RouteContext[] {
  const {
    minScore = 0,
    maxEmptyPercent = config.maxEmptyPercent,
    requireEUCompliance = false,
    maxResults = 100
  } = options;
  
  let filtered = routes.filter(route => {
    // Score threshold
    if (route.score < minScore) return false;
    
    // Empty run threshold
    if (route.emptyRunPercent > maxEmptyPercent) return false;
    
    // EU compliance requirement
    if (requireEUCompliance) {
      const compliance = checkEUCompliance(route, config.avgSpeed);
      if (!compliance.isCompliant) return false;
    }
    
    return true;
  });
  
  // Sort by comparison function
  filtered.sort(compareRoutes);
  
  // Limit results
  if (maxResults > 0) {
    filtered = filtered.slice(0, maxResults);
  }
  
  return filtered;
}