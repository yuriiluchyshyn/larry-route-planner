/**
 * API Models - Моделі для роботи з API
 */

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface ApiRequestParams {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

export interface RouteSearchParams {
  origin?: string;
  destination?: string;
  minDistance?: number;
  maxDistance?: number;
  minCapacity?: number;
  maxCapacity?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ApiStats {
  total: number;
  counters: {
    all: number;
    direct: number;
    private: number;
    multi_ftl: number;
  };
}

export interface SystemStats {
  api: ApiStats;
  cache: {
    totalRoutes: number;
    totalSize: string;
    oldestRoute: number;
    newestRoute: number;
  };
  timestamp: string;
}