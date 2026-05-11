/**
 * Optimization Models - Моделі для оптимізації маршрутів
 */

import type { RouteData, RouteSpot } from './routeModels';

export interface OptimizationParams {
  maxDistance?: number;
  minCapacity?: number;
  maxCapacity?: number;
  preferredRegions?: string[];
  excludeRegions?: string[];
  timeWindow?: {
    start: string;
    end: string;
  };
  costPerKm?: number;
  fuelConsumption?: number; // л/100км
  fuelPrice?: number; // ціна за літр
  maxEmptyRoad?: number; // НОВИЙ: максимальний відсоток порожнього проїзду (0-100)
}

export interface OptimizedRoute {
  id: string;
  originalRoute: RouteData;
  optimizationScore: number;
  estimatedCost: number;
  estimatedProfit: number;
  distance: number;
  duration: number; // в годинах
  fuelCost: number;
  efficiency: number; // прибуток на км
  recommendations: string[];
  emptyRoadPercentage?: number; // НОВИЙ: відсоток порожнього проїзду
  routeSegments?: {
    loadingPoints: RouteSpot[];
    unloadingPoints: RouteSpot[];
    totalLoadingPoints: number;
    totalUnloadingPoints: number;
    hasMultipleLoadingPoints: boolean;
    hasMultipleUnloadingPoints: boolean;
    loadingCountries: string[];
    unloadingCountries: string[];
  };
}

export interface OptimizationResult {
  routes: OptimizedRoute[];
  totalRoutes: number;
  averageScore: number;
  bestRoute?: OptimizedRoute;
  statistics: {
    totalDistance: number;
    totalProfit: number;
    averageDistance: number;
    averageProfit: number;
  };
}

export interface RouteMetrics {
  distance: number;
  duration: number;
  estimatedProfit: number;
  efficiency: number;
  fuelCost: number;
  emptyRoadPercentage?: number; // НОВИЙ: відсоток порожнього проїзду
}

export interface RouteFilters {
  minScore?: number;
  maxDistance?: number;
  minProfit?: number;
}