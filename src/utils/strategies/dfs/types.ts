/**
 * DFS Route Optimization Strategy - Types and Interfaces
 * 
 * Defines all data structures used in the DFS optimization algorithm
 */

export interface Point {
  lat: number;
  lon: number;
}

export interface DFSOffer {
  id: string;
  loadPoint: Point;
  unloadPoint: Point;
  loadStart: Date;
  loadEnd: Date;
  unloadStart: Date;
  unloadEnd: Date;
  distanceKm: number;
  price: number;
  // Additional metadata
  weight?: number;
  currency?: string;
  originalOffer?: any; // Reference to original FreightOffer
}

export interface RouteContext {
  chain: DFSOffer[];
  totalDistanceKm: number;
  loadedDistanceKm: number;
  emptyDistanceKm: number;
  score: number;
  risks: string[];
  euViolations: number;
  endTime: Date; // Час розвантаження останнього вантажу
  // Performance metrics
  totalDrivingHours: number;
  totalRestHours: number;
  emptyRunPercent: number;
}

export interface DFSConfig {
  basePoint: Point;
  maxEmptyPercent: number;
  avgSpeed: number;
  maxChainLength: number;
  minChainLength: number;
  maxSearchRadius: number; // km from base to consider offers
  departureTimeWindow: {
    from: Date;
    to: Date;
  };
  returnTimeWindow: {
    from: Date;
    to: Date;
  };
  // EU compliance settings
  maxDailyDrivingHours: number;
  maxWeeklyDrivingHours: number;
  // Scoring weights
  scoreWeights: {
    loadedKmBonus: number;
    emptyKmPenalty: number;
    euViolationPenalty: number;
    riskPenalty: number;
    chainLengthBonus: number;
  };
}

export interface DFSResult {
  routes: RouteContext[];
  statistics: {
    totalOffersConsidered: number;
    validChainsFound: number;
    branchesPruned: number;
    executionTimeMs: number;
    averageChainLength: number;
    bestScore: number;
  };
}

// Risk types that can be detected during optimization
export enum RiskType {
  LATE_ARRIVAL = 'LATE_ARRIVAL',
  TIME_OVERLAP = 'TIME_OVERLAP',
  WEEKEND_DELIVERY = 'WEEKEND_DELIVERY',
  NIGHT_ARRIVAL = 'NIGHT_ARRIVAL',
  EU_VIOLATION = 'EU_VIOLATION',
  HIGH_EMPTY_RUN = 'HIGH_EMPTY_RUN',
  TIGHT_SCHEDULE = 'TIGHT_SCHEDULE'
}

// Branch pruning reasons for debugging
export enum PruningReason {
  CHRONOLOGY_VIOLATION = 'CHRONOLOGY_VIOLATION',
  EMPTY_RUN_EXCEEDED = 'EMPTY_RUN_EXCEEDED',
  MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED',
  EU_HOURS_EXCEEDED = 'EU_HOURS_EXCEEDED',
  DUPLICATE_OFFER = 'DUPLICATE_OFFER',
  OUT_OF_TIME_WINDOW = 'OUT_OF_TIME_WINDOW',
  DISTANCE_TOO_FAR = 'DISTANCE_TOO_FAR'
}