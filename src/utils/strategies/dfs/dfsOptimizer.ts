/**
 * DFS Route Optimization Strategy - Core DFS Algorithm
 * 
 * Implements the Depth-First Search algorithm with Branch and Bound optimization
 */

import type { DFSOffer, RouteContext, DFSConfig, DFSResult, PruningReason } from './types';
import { calculateDistance, estimateDrivingTimeHours } from './geometry';
import { isChronologyValid, calculateTotalDrivingHours, calculateMandatoryRestHours } from './timeUtils';
import { calculateRouteScore } from './scoring';

export class DFSRouteOptimizer {
  private config: DFSConfig;
  private validRoutes: RouteContext[] = [];
  private statistics = {
    totalOffersConsidered: 0,
    validChainsFound: 0,
    branchesPruned: 0,
    executionTimeMs: 0,
    averageChainLength: 0,
    bestScore: 0,
    pruningReasons: new Map<PruningReason, number>()
  };

  constructor(config: DFSConfig) {
    this.config = config;
  }

  /**
   * Main optimization method
   */
  public optimize(offers: DFSOffer[]): DFSResult {
    const startTime = Date.now();
    
    console.log(`🔍 DFS: Starting optimization with ${offers.length} offers`);
    
    // Reset state
    this.validRoutes = [];
    this.statistics = {
      totalOffersConsidered: offers.length,
      validChainsFound: 0,
      branchesPruned: 0,
      executionTimeMs: 0,
      averageChainLength: 0,
      bestScore: 0,
      pruningReasons: new Map()
    };

    // Filter offers that are within reasonable distance from base
    const nearbyOffers = offers.filter(offer => 
      calculateDistance(this.config.basePoint, offer.loadPoint) <= this.config.maxSearchRadius
    );
    
    console.log(`🔍 DFS: Filtered to ${nearbyOffers.length} offers within ${this.config.maxSearchRadius}km of base`);

    // Start DFS from each potential starting offer
    for (const startOffer of nearbyOffers) {
      // Check if offer is within departure time window
      if (!this.isWithinTimeWindow(startOffer.loadStart, this.config.departureTimeWindow)) {
        continue;
      }

      const emptyFromBase = calculateDistance(this.config.basePoint, startOffer.loadPoint);
      const drivingHoursFromBase = estimateDrivingTimeHours(emptyFromBase, this.config.avgSpeed);
      const drivingHoursLoaded = estimateDrivingTimeHours(startOffer.distanceKm, this.config.avgSpeed);

      const initialContext: RouteContext = {
        chain: [startOffer],
        totalDistanceKm: emptyFromBase + startOffer.distanceKm,
        loadedDistanceKm: startOffer.distanceKm,
        emptyDistanceKm: emptyFromBase,
        score: 0,
        risks: [],
        euViolations: 0,
        endTime: new Date(startOffer.unloadEnd.getTime() + 2 * 60 * 60 * 1000), // +2h for unloading
        totalDrivingHours: drivingHoursFromBase + drivingHoursLoaded,
        totalRestHours: 0,
        emptyRunPercent: 0
      };

      // Calculate initial empty run percentage
      initialContext.emptyRunPercent = this.calculateEmptyRunPercent(initialContext);

      this.dfs(initialContext, nearbyOffers);
    }

    // Calculate final statistics
    this.statistics.executionTimeMs = Date.now() - startTime;
    this.statistics.validChainsFound = this.validRoutes.length;
    
    if (this.validRoutes.length > 0) {
      this.statistics.averageChainLength = this.validRoutes.reduce((sum, route) => sum + route.chain.length, 0) / this.validRoutes.length;
      this.statistics.bestScore = Math.max(...this.validRoutes.map(route => route.score));
    }

    console.log(`🔍 DFS: Completed in ${this.statistics.executionTimeMs}ms`);
    console.log(`🔍 DFS: Found ${this.statistics.validChainsFound} valid routes`);
    console.log(`🔍 DFS: Pruned ${this.statistics.branchesPruned} branches`);

    return {
      routes: this.validRoutes.sort((a, b) => b.score - a.score),
      statistics: this.statistics
    };
  }

  /**
   * Recursive DFS implementation with branch and bound
   */
  private dfs(context: RouteContext, allOffers: DFSOffer[]): void {
    // If chain is within valid length range, evaluate and store it
    if (context.chain.length >= this.config.minChainLength && context.chain.length <= this.config.maxChainLength) {
      const finalContext = this.finalizRoute(context);
      
      // Only store if it meets quality thresholds
      if (this.isRouteValid(finalContext)) {
        finalContext.score = calculateRouteScore(finalContext, this.config);
        this.validRoutes.push(finalContext);
      }
    }

    // Stop if we've reached maximum chain length
    if (context.chain.length >= this.config.maxChainLength) {
      return;
    }

    const currentOffer = context.chain[context.chain.length - 1];

    // Try to extend the chain with each remaining offer
    for (const nextOffer of allOffers) {
      const pruningReason = this.shouldPruneBranch(context, nextOffer);
      
      if (pruningReason) {
        this.statistics.branchesPruned++;
        this.incrementPruningReason(pruningReason);
        continue;
      }

      // Calculate metrics for the extended chain
      const emptyToNext = calculateDistance(currentOffer.unloadPoint, nextOffer.loadPoint);
      const drivingHoursToNext = estimateDrivingTimeHours(emptyToNext, this.config.avgSpeed);
      const drivingHoursLoaded = estimateDrivingTimeHours(nextOffer.distanceKm, this.config.avgSpeed);

      // Create new context for the extended chain
      const newContext: RouteContext = {
        chain: [...context.chain, nextOffer],
        totalDistanceKm: context.totalDistanceKm + emptyToNext + nextOffer.distanceKm,
        loadedDistanceKm: context.loadedDistanceKm + nextOffer.distanceKm,
        emptyDistanceKm: context.emptyDistanceKm + emptyToNext,
        score: 0,
        risks: [...context.risks],
        euViolations: context.euViolations,
        endTime: new Date(Math.max(
          context.endTime.getTime() + drivingHoursToNext * 60 * 60 * 1000,
          nextOffer.loadStart.getTime()
        ) + drivingHoursLoaded * 60 * 60 * 1000),
        totalDrivingHours: context.totalDrivingHours + drivingHoursToNext + drivingHoursLoaded,
        totalRestHours: 0,
        emptyRunPercent: 0
      };

      // Calculate empty run percentage
      newContext.emptyRunPercent = this.calculateEmptyRunPercent(newContext);
      newContext.totalRestHours = calculateMandatoryRestHours(newContext.totalDrivingHours);

      // Continue DFS recursively
      this.dfs(newContext, allOffers);
    }
  }

  /**
   * Check if a branch should be pruned (Branch and Bound)
   */
  private shouldPruneBranch(context: RouteContext, nextOffer: DFSOffer): PruningReason | null {
    const currentOffer = context.chain[context.chain.length - 1];

    // 1. Check for duplicate offers
    if (context.chain.some(offer => offer.id === nextOffer.id)) {
      return PruningReason.DUPLICATE_OFFER;
    }

    // 2. Check chronology (no time travel)
    const emptyDistance = calculateDistance(currentOffer.unloadPoint, nextOffer.loadPoint);
    if (!isChronologyValid(currentOffer.unloadEnd, nextOffer.loadStart, emptyDistance, this.config.avgSpeed)) {
      return PruningReason.CHRONOLOGY_VIOLATION;
    }

    // 3. Check if next offer is within return time window (with some flexibility)
    const flexibleReturnEnd = new Date(this.config.returnTimeWindow.to.getTime() + 24 * 60 * 60 * 1000); // +1 day flexibility
    if (nextOffer.unloadEnd > flexibleReturnEnd) {
      return PruningReason.OUT_OF_TIME_WINDOW;
    }

    // 4. Check empty run percentage (optimistic calculation)
    const tempEmptyDistance = context.emptyDistanceKm + emptyDistance;
    const tempTotalDistance = context.totalDistanceKm + emptyDistance + nextOffer.distanceKm;
    const tempEmptyPercent = tempTotalDistance > 0 ? (tempEmptyDistance / tempTotalDistance) * 100 : 0;
    
    if (tempEmptyPercent > this.config.maxEmptyPercent * 1.5) { // Allow some flexibility
      return PruningReason.EMPTY_RUN_EXCEEDED;
    }

    // 5. Check EU driving hours (optimistic calculation)
    const tempDrivingHours = context.totalDrivingHours + 
      estimateDrivingTimeHours(emptyDistance, this.config.avgSpeed) +
      estimateDrivingTimeHours(nextOffer.distanceKm, this.config.avgSpeed);
    
    if (tempDrivingHours > this.config.maxWeeklyDrivingHours * 1.2) { // Allow some flexibility
      return PruningReason.EU_HOURS_EXCEEDED;
    }

    // 6. Check if too far from base (avoid getting lost)
    const distanceFromBase = calculateDistance(this.config.basePoint, nextOffer.unloadPoint);
    if (distanceFromBase > this.config.maxSearchRadius * 1.5) {
      return PruningReason.DISTANCE_TOO_FAR;
    }

    return null; // No pruning needed
  }

  /**
   * Finalize route by adding return journey to base
   */
  private finalizRoute(context: RouteContext): RouteContext {
    const lastOffer = context.chain[context.chain.length - 1];
    const returnDistance = calculateDistance(lastOffer.unloadPoint, this.config.basePoint);
    const returnDrivingHours = estimateDrivingTimeHours(returnDistance, this.config.avgSpeed);

    const finalContext: RouteContext = {
      ...context,
      totalDistanceKm: context.totalDistanceKm + returnDistance,
      emptyDistanceKm: context.emptyDistanceKm + returnDistance,
      totalDrivingHours: context.totalDrivingHours + returnDrivingHours,
      emptyRunPercent: 0
    };

    // Recalculate empty run percentage with return journey
    finalContext.emptyRunPercent = this.calculateEmptyRunPercent(finalContext);
    finalContext.totalRestHours = calculateMandatoryRestHours(finalContext.totalDrivingHours);

    return finalContext;
  }

  /**
   * Check if a route meets minimum quality standards
   */
  private isRouteValid(context: RouteContext): boolean {
    // Must have minimum chain length
    if (context.chain.length < this.config.minChainLength) {
      return false;
    }

    // Empty run must be within limits
    if (context.emptyRunPercent > this.config.maxEmptyPercent) {
      return false;
    }

    // Must have positive loaded distance
    if (context.loadedDistanceKm <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Calculate empty run percentage
   */
  private calculateEmptyRunPercent(context: RouteContext): number {
    return context.totalDistanceKm > 0 ? (context.emptyDistanceKm / context.totalDistanceKm) * 100 : 0;
  }

  /**
   * Check if a date is within a time window
   */
  private isWithinTimeWindow(date: Date, window: { from: Date; to: Date }): boolean {
    return date >= window.from && date <= window.to;
  }

  /**
   * Increment pruning reason counter for statistics
   */
  private incrementPruningReason(reason: PruningReason): void {
    const current = this.statistics.pruningReasons.get(reason) || 0;
    this.statistics.pruningReasons.set(reason, current + 1);
  }

  /**
   * Get detailed statistics about the optimization process
   */
  public getDetailedStatistics(): any {
    const pruningStats: Record<string, number> = {};
    this.statistics.pruningReasons.forEach((count, reason) => {
      pruningStats[reason] = count;
    });

    return {
      ...this.statistics,
      pruningReasons: pruningStats,
      efficiency: {
        routesPerSecond: this.statistics.validChainsFound / (this.statistics.executionTimeMs / 1000),
        pruningEfficiency: this.statistics.branchesPruned / this.statistics.totalOffersConsidered,
        averageScore: this.validRoutes.length > 0 
          ? this.validRoutes.reduce((sum, route) => sum + route.score, 0) / this.validRoutes.length 
          : 0
      }
    };
  }
}