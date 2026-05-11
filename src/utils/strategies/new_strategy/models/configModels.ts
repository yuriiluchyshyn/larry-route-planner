/**
 * Config Models - Моделі конфігурації системи
 */

import type { OptimizationParams } from './optimizationModels';
import type { RedisConfig } from './redisModels';
import type { ApiConfig } from './apiModels';
import type { OptimizationConfig, DeepPartial } from '../route/config/optimizationConfig';

export interface RouteOptimizationConfig {
  api: ApiConfig;
  redis: RedisConfig;
  optimization?: OptimizationParams;
  optimizationConfig?: DeepPartial<OptimizationConfig>; // НОВИЙ: конфігурація оптимізації
}

export interface DefaultConfig {
  api: {
    baseUrl: string;
    apiKey?: string;
  };
  redis: {
    host: string;
    port: number;
    db: number;
    keyPrefix: string;
  };
  optimization: {
    maxDistance: number;
    minCapacity: number;
    maxCapacity: number;
    costPerKm: number;
    fuelConsumption: number;
    fuelPrice: number;
    maxEmptyRoad: number; // НОВИЙ: максимальний відсоток порожнього проїзду
  };
}