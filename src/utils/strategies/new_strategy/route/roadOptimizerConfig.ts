/**
 * Road Optimizer Configuration
 * Конфігураційні константи для оптимізатора маршрутів
 */

/**
 * Константи для розрахунку відстаней
 */
export const DISTANCE_CONFIG = {
  /** Радіус Землі в кілометрах для формули Haversine */
  EARTH_RADIUS_KM: 6371,
  /** Конвертація градусів в радіани */
  DEG_TO_RAD: Math.PI / 180,
} as const;

/**
 * Лімити для пошуку маршрутів
 */
export const SEARCH_LIMITS = {
  /** Максимальна відстань від домашньої бази до стартового офера (км) */
  MAX_HOME_TO_START_DISTANCE_KM: 300,
  /** Максимальна кількість стартових оферів для розгляду */
  MAX_STARTING_OFFERS: 20,
  /** Максимальна порожня відстань між оферами (км) */
  DEFAULT_MAX_EMPTY_DISTANCE_KM: 200,
  /** Максимальна відстань для завершення маршруту (повернення додому) */
  MAX_RETURN_HOME_DISTANCE_KM: 300,
} as const;

/**
 * Параметри оптимізації пошуку
 */
export const OPTIMIZATION_PARAMS = {
  /** Розмір батча для паралельного геокодування */
  GEOCODING_BATCH_SIZE: 10,
  /** Максимальна кількість кандидатів на кожному рівні рекурсії */
  BASE_MAX_CANDIDATES: 50,
  /** Мінімальна кількість кандидатів незалежно від глибини */
  MIN_CANDIDATES_PER_LEVEL: 10,
  /** Максимальний час пошуку за замовчуванням (мс) */
  DEFAULT_MAX_SEARCH_TIME_MS: 30000,
  /** Максимальна глибина маршруту за замовчуванням */
  DEFAULT_MAX_ROUTE_DEPTH: 10,
  /** Максимальна кількість результатів за замовчуванням */
  DEFAULT_MAX_RESULTS: 50,
} as const;

/**
 * Параметри скорингу маршрутів
 */
export const SCORING_WEIGHTS = {
  /** Вага завантаженої відстані в скорі */
  LOADED_DISTANCE_WEIGHT: 10,
  /** Штраф за порожню відстань */
  EMPTY_DISTANCE_PENALTY: 3,
  /** Вага прибутку в скорі */
  EARNINGS_WEIGHT: 0.1,
  /** Вага відстані від дому для стартових оферів */
  HOME_DISTANCE_PENALTY: 0.5,
  /** Вага ціни за км для стартових оферів */
  PRICE_PER_KM_WEIGHT: 10,
} as const;

/**
 * Параметри часу та водіння
 */
export const DRIVING_PARAMS = {
  /** Максимальні години безперервного водіння перед обов'язковою перервою */
  MAX_CONTINUOUS_DRIVING_HOURS: 4.5,
  /** Тривалість обов'язкової перерви (години) */
  MANDATORY_BREAK_HOURS: 0.75,
  /** Середня кількість робочих годин на день */
  AVERAGE_WORK_HOURS_PER_DAY: 8,
  /** Мінімальний щоденний відпочинок (години) */
  MIN_DAILY_REST_HOURS: 11,
  /** Кількість днів перед тижневим відпочинком */
  DAYS_BEFORE_WEEKLY_REST: 7,
  /** Максимальні години водіння на день (EU регуляції) */
  MAX_DAILY_DRIVING_HOURS_EU: 9,
} as const;

/**
 * Значення за замовчуванням для конфігурації
 */
export const DEFAULT_CONFIG = {
  /** Максимальний відсоток порожнього пробігу за замовчуванням */
  MAX_EMPTY_RUN_PERCENT: 10,
  /** Ціна за км за замовчуванням (EUR) */
  PRICE_PER_KM: 1.5,
  /** Середня швидкість вантажівки за замовчуванням (км/год) */
  AVERAGE_SPEED_KMH: 80,
  /** Мінімальна завантажена відстань для валідного офера (км) */
  MIN_LOADED_DISTANCE_KM: 50,
} as const;

/**
 * Параметри геокодування
 */
export const GEOCODING_CONFIG = {
  /** Мова для пошуку локацій */
  DEFAULT_LANGUAGE: 'en' as const,
  /** Ліміт результатів пошуку локацій */
  LOCATION_SEARCH_LIMIT: 1,
  /** Таймаут для геокодування (мс) */
  GEOCODING_TIMEOUT_MS: 5000,
} as const;

/**
 * Функція для розрахунку максимальної кількості кандидатів на рівні
 */
export function calculateMaxCandidatesForLevel(routeDepth: number): number {
  return Math.max(
    OPTIMIZATION_PARAMS.MIN_CANDIDATES_PER_LEVEL,
    Math.floor(OPTIMIZATION_PARAMS.BASE_MAX_CANDIDATES / (routeDepth + 1))
  );
}

/**
 * Функція для валідації конфігурації оптимізації
 */
export function validateOptimizationConfig(config: {
  maxEmptyRunPercent?: number;
  pricePerKm?: number;
  averageSpeedKmh?: number;
  maxResults?: number;
  maxRouteDepth?: number;
  maxEmptyDistanceKm?: number;
  maxSearchTimeMs?: number;
}): void {
  if (config.maxEmptyRunPercent !== undefined && (config.maxEmptyRunPercent < 0 || config.maxEmptyRunPercent > 100)) {
    throw new Error('maxEmptyRunPercent повинен бути між 0 та 100');
  }
  
  if (config.pricePerKm !== undefined && config.pricePerKm <= 0) {
    throw new Error('pricePerKm повинен бути більше 0');
  }
  
  if (config.averageSpeedKmh !== undefined && (config.averageSpeedKmh <= 0 || config.averageSpeedKmh > 200)) {
    throw new Error('averageSpeedKmh повинен бути між 0 та 200');
  }
  
  if (config.maxResults !== undefined && config.maxResults <= 0) {
    throw new Error('maxResults повинен бути більше 0');
  }
  
  if (config.maxRouteDepth !== undefined && config.maxRouteDepth <= 0) {
    throw new Error('maxRouteDepth повинен бути більше 0');
  }
  
  if (config.maxEmptyDistanceKm !== undefined && config.maxEmptyDistanceKm <= 0) {
    throw new Error('maxEmptyDistanceKm повинен бути більше 0');
  }
  
  if (config.maxSearchTimeMs !== undefined && config.maxSearchTimeMs <= 0) {
    throw new Error('maxSearchTimeMs повинен бути більше 0');
  }
}