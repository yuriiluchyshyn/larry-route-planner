/**
 * New Strategy - Route Optimization System
 * Головний файл для нової стратегії оптимізації маршрутів
 * Враховує логіку: База → Loading Points → Uploading Points → База
 */

import { RouteApiService } from './route/routeApiService';
import { RedisRouteService } from './redis/redisRouteService';
import { RoadOptimizer } from './route/roadOptimizer';
import { RouteAnalyzer } from './route/routeAnalyzer';
import { getOptimizationConfig, type OptimizationConfig, type DeepPartial } from './route/config/optimizationConfig';

// Експортуємо всі моделі
export * from './models';

// Експортуємо конфігурації
export * from './route/config/optimizationConfig';
export * from './route/config/routeApiConfig';
export * from './route/config/apiConfig';
export * from './redis/config/redisConfig';

// Експортуємо сервіси
export * from './route/routeApiService';
export * from './redis/redisRouteService';
export * from './route/roadOptimizer';
export * from './route/routeAnalyzer';

// Імпортуємо типи з моделей
import type { 
  OptimizationParams,
  RouteFilters 
} from './models/optimizationModels';
import type { 
  SystemStats, 
  RouteSearchParams 
} from './models/apiModels';
import type { 
  RouteOptimizationConfig,
  DefaultConfig 
} from './models/configModels';


/**
 * Головний клас для роботи з системою оптимізації маршрутів
 */
export class RouteOptimizationSystem {
  private apiService: RouteApiService;
  private redisService: RedisRouteService;
  private optimizer: RoadOptimizer;
  private optimizationConfig: OptimizationConfig;

  constructor(config: RouteOptimizationConfig) {
    // Ініціалізуємо конфігурацію оптимізації
    this.optimizationConfig = getOptimizationConfig(config.optimizationConfig);
    
    // Встановлюємо конфігурацію для RouteAnalyzer
    RouteAnalyzer.setConfig(config.optimizationConfig || {});
    
    // Ініціалізуємо сервіси
    this.apiService = new RouteApiService(config.api.baseUrl, config.api.apiKey);
    this.redisService = new RedisRouteService(config.redis);
    this.optimizer = new RoadOptimizer(
      this.apiService,
      this.redisService,
      config.optimization,
      config.optimizationConfig // Передаємо конфігурацію оптимізації
    );
  }

  /**
   * Ініціалізація системи
   */
  async initialize(): Promise<void> {
    console.log('🚀 Ініціалізація системи оптимізації маршрутів...');
    
    try {
      await this.redisService.connect();
      console.log('✅ Система готова до роботи!');
    } catch (error) {
      console.error('❌ Помилка ініціалізації:', error);
      throw error;
    }
  }

  /**
   * Сканувати всі маршрути та зберегти в Redis
   */
  async scanRoutes() {
    console.log('🔍 Запуск сканування маршрутів...');
    return await this.optimizer.scanAndCacheRoutes();
  }

  /**
   * Оптимізувати маршрути
   */
  async optimizeRoutes(params?: OptimizationParams) {
    console.log('🎯 Запуск оптимізації маршрутів...');
    return await this.optimizer.optimizeRoutes(params);
  }

  /**
   * Отримати поточну конфігурацію оптимізації
   */
  getOptimizationConfig(): OptimizationConfig {
    return this.optimizationConfig;
  }

  /**
   * Оновити конфігурацію оптимізації
   */
  updateOptimizationConfig(newConfig: DeepPartial<OptimizationConfig>): void {
    this.optimizationConfig = getOptimizationConfig(newConfig);
    RouteAnalyzer.setConfig(newConfig);
    // Потрібно буде пересоздати optimizer з новою конфігурацією
    console.log('⚙️ Конфігурація оптимізації оновлена');
  }

  /**
   * Детальний аналіз маршруту з розбивкою на сегменти
   */
  async analyzeRoute(routeId: string) {
    console.log(`🔍 Аналіз маршруту ${routeId}...`);
    
    try {
      // Отримуємо маршрут з кешу
      const route = await this.redisService.getRoute(routeId);
      if (!route) {
        throw new Error(`Маршрут ${routeId} не знайдено в кеші`);
      }

      // Проводимо детальний аналіз
      const analysis = RouteAnalyzer.analyzeRoute(route);
      
      console.log(`✅ Аналіз завершено:`);
      console.log(`📊 Складність: ${analysis.complexity.level} (${analysis.complexity.score}/10)`);
      console.log(`🛣️ Відстань: ${Math.round(analysis.totalDistance)} км`);
      console.log(`⏰ Час: ${Math.round(analysis.estimatedTiming.totalDuration)} год`);
      console.log(`📍 Точки: ${analysis.loadingPoints.length} завантаження + ${analysis.unloadingPoints.length} розвантаження`);
      
      return analysis;
    } catch (error) {
      console.error('❌ Помилка аналізу маршруту:', error);
      throw error;
    }
  }

  /**
   * Отримати кешовані маршрути з фільтрацією
   */
  async getCachedRoutes(filters?: RouteFilters) {
    return await this.optimizer.getCachedRoutes(filters);
  }

  /**
   * Пошук маршрутів за критеріями
   */
  async searchRoutes(criteria: RouteSearchParams) {
    return await this.redisService.searchRoutes(criteria);
  }

  /**
   * Отримати статистику системи
   */
  async getSystemStats(): Promise<SystemStats> {
    const [apiStats, cacheStats] = await Promise.all([
      this.apiService.getRoutesStats(),
      this.redisService.getCacheStats()
    ]);

    return {
      api: apiStats,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Оновити дані (очистити кеш та пересканувати)
   */
  async refreshData(): Promise<void> {
    console.log('🔄 Оновлення даних...');
    await this.optimizer.refreshRoutes();
  }

  /**
   * Очистити кеш
   */
  async clearCache(): Promise<void> {
    console.log('🗑️ Очищення кешу...');
    await this.redisService.clearCache();
  }

  // Геттери для прямого доступу до сервісів (якщо потрібно)
  get api(): RouteApiService {
    return this.apiService;
  }

  get redis(): RedisRouteService {
    return this.redisService;
  }

  get routeOptimizer(): RoadOptimizer {
    return this.optimizer;
  }
}

/**
 * Фабрика для створення системи оптимізації з дефолтними налаштуваннями
 */
export function createRouteOptimizationSystem(config: Partial<RouteOptimizationConfig> = {}): RouteOptimizationSystem {
  const defaultConfig: DefaultConfig = {
    api: {
      baseUrl: config.api?.baseUrl || 'https://api.trans.eu',
      apiKey: config.api?.apiKey
    },
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'larry:routes:'
    },
    optimization: {
      maxDistance: 1000000, // 1000 км
      minCapacity: 1,
      maxCapacity: 50,
      costPerKm: 1.2,
      fuelConsumption: 35,
      fuelPrice: 1.4,
      maxEmptyRoad: 30 // максимум 30% порожнього проїзду
    }
  };

  const finalConfig: RouteOptimizationConfig = {
    api: {
      ...defaultConfig.api,
      ...config.api
    },
    redis: {
      ...defaultConfig.redis,
      ...config.redis
    },
    optimization: {
      ...defaultConfig.optimization,
      ...config.optimization
    },
    optimizationConfig: config.optimizationConfig // НОВИЙ: передаємо конфігурацію оптимізації
  };

  return new RouteOptimizationSystem(finalConfig);
}

/**
 * Приклад використання системи з урахуванням сегментів маршруту
 */
export async function exampleUsage() {
  console.log('📋 Приклад використання системи оптимізації маршрутів:');
  console.log('🎯 Логіка: База → Loading Points → Uploading Points → База');
  
  // Створюємо систему
  const system = createRouteOptimizationSystem({
    api: {
      baseUrl: 'https://api.trans.eu',
      apiKey: 'your-api-key'
    },
    redis: {
      host: 'localhost',
      port: 6379
    }
  });

  try {
    // Ініціалізуємо
    await system.initialize();

    // Сканируємо маршрути (це робиться один раз при натисканні "Scan")
    console.log('\n🔍 Крок 1: Сканування маршрутів...');
    const scanResult = await system.scanRoutes();
    console.log(`✅ Результат сканування:`, scanResult);

    // Оптимізуємо маршрути з урахуванням сегментів
    console.log('\n🎯 Крок 2: Оптимізація маршрутів з аналізом сегментів...');
    const optimization = await system.optimizeRoutes({
      maxDistance: 800000, // 800 км
      minCapacity: 10,
      costPerKm: 1.5
    });
    
    console.log(`✅ Знайдено ${optimization.totalRoutes} оптимізованих маршрутів`);
    console.log(`🏆 Кращий маршрут: ${optimization.bestRoute?.id} (скор: ${optimization.bestRoute?.optimizationScore})`);

    // Детальний аналіз кращого маршруту
    if (optimization.bestRoute) {
      console.log('\n🔬 Крок 3: Детальний аналіз кращого маршруту...');
      const analysis = await system.analyzeRoute(optimization.bestRoute.id);
      
      console.log(`📊 Аналіз маршруту ${analysis.routeId}:`);
      console.log(`   Складність: ${analysis.complexity.level} (${analysis.complexity.score}/10)`);
      console.log(`   Сегменти:`);
      console.log(`     • ${analysis.segments.baseToLoading.name}: ${Math.round(analysis.segments.baseToLoading.estimatedDistance)}км`);
      console.log(`     • ${analysis.segments.loadingToUnloading.name}: ${Math.round(analysis.segments.loadingToUnloading.estimatedDistance)}км`);
      console.log(`     • ${analysis.segments.unloadingToBase.name}: ${Math.round(analysis.segments.unloadingToBase.estimatedDistance)}км`);
      console.log(`   Точки завантаження: ${analysis.loadingPoints.length}`);
      console.log(`   Точки розвантаження: ${analysis.unloadingPoints.length}`);
      console.log(`   Рекомендації: ${analysis.recommendations.join(', ')}`);
    }

    // Пошук конкретних маршрутів
    console.log('\n🔍 Крок 4: Пошук маршрутів...');
    const searchResults = await system.searchRoutes({
      origin: 'Gdansk',
      maxDistance: 600000,
      minCapacity: 20
    });
    
    console.log(`🎯 Знайдено ${searchResults.length} маршрутів за критеріями`);

    // Статистика
    console.log('\n📊 Крок 5: Статистика системи...');
    const stats = await system.getSystemStats();
    console.log('📈 Статистика:', stats);

  } catch (error) {
    console.error('❌ Помилка:', error);
  }
}