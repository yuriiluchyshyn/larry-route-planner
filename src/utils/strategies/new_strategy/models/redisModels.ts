/**
 * Redis Models - Моделі для роботи з Redis
 */

export interface CachedRouteInfo {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  capacity: number;
  price: number | null;
  currency: string;
  company: string;
  cachedAt: number;
  coordinates: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  };
}

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RouteSearchCriteria {
  origin?: string;
  destination?: string;
  minDistance?: number;
  maxDistance?: number;
  minCapacity?: number;
  maxCapacity?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface CacheStats {
  totalRoutes: number;
  totalSize: string;
  oldestRoute: number;
  newestRoute: number;
}

export interface ScanResult {
  scanned: number;
  cached: number;
  errors: number;
}