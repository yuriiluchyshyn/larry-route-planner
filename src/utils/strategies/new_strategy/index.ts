/**
 * New Strategy - Route Optimization System
 * Головний файл для нової стратегії оптимізації маршрутів
 * Враховує логіку: База → Loading Points → Uploading Points → База
 */

import { RedisRouteService } from './redis/redisRouteService';
// import { getOptimizationConfig, type OptimizationConfig, type DeepPartial } from './route/config/optimizationConfig';

// Експортуємо всі моделі
export * from './models';

// Експортуємо конфігурації
export * from './route/config/optimizationConfig';
export * from './route/config/routeApiConfig';
export * from './route/config/apiConfig';
export * from './redis/config/redisConfig';

// Експортуємо сервіси
export * from './redis/redisRouteService';
export * from './route/roadOptimizer';

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
  private redisService: RedisRouteService;
  private optimizationConfig: OptimizationConfig;

  constructor(config: RouteOptimizationConfig) {
    // Ініціалізуємо конфігурацію оптимізації
    // this.optimizationConfig = getOptimizationConfig(config.optimizationConfig);
    
    // Ініціалізуємо сервіси
    this.redisService = new RedisRouteService(config.redis);
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
    // TODO: Реалізувати сканування через API
    return { message: 'Сканування не реалізовано' };
  }

  /**
   * Оптимізувати маршрути
   */
  async optimizeRoutes(params?: OptimizationParams) {
    console.log('🎯 Запуск оптимізації маршрутів...');
    // TODO: Реалізувати оптимізацію
    return { message: 'Оптимізація не реалізована' };
  }

  /**
   * Отримати поточну конфігурацію оптимізації
   */
  // getOptimizationConfig(): OptimizationConfig {
  //   return this.optimizationConfig;
  // }

  /**
   * Оновити конфігурацію оптимізації
   */
  // updateOptimizationConfig(newConfig: DeepPartial<OptimizationConfig>): void {
    // this.optimizationConfig = getOptimizationConfig(newConfig);
    // console.log('⚙️ Конфігурація оптимізації оновлена');
  // }

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

      // TODO: Реалізувати детальний аналіз
      const analysis = {
        routeId,
        complexity: { level: 'medium', score: 5 },
        totalDistance: 500,
        estimatedTiming: { totalDuration: 8 },
        loadingPoints: [],
        unloadingPoints: []
      };
      
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
    // TODO: Реалізувати отримання кешованих маршрутів
    return [];
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
    const cacheStats = await this.redisService.getCacheStats();

    return {
      api: { message: 'API stats not available' },
      cache: cacheStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Оновити дані (очистити кеш та пересканувати)
   */
  async refreshData(): Promise<void> {
    console.log('🔄 Оновлення даних...');
    // TODO: Реалізувати оновлення даних
  }

  /**
   * Очистити кеш
   */
  async clearCache(): Promise<void> {
    console.log('🗑️ Очищення кешу...');
    await this.redisService.clearCache();
  }

  // Геттери для прямого доступу до сервісів (якщо потрібно)
  get redis(): RedisRouteService {
    return this.redisService;
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
    optimizationConfig: config.optimizationConfig
  };

  return new RouteOptimizationSystem(finalConfig);
}

/**
 * Приклад використання системи з урахуванням складних маршрутів (з домашньою базою або без)
 */
export async function exampleUsage() {
  console.log('📋 Приклад використання системи оптимізації маршрутів:');
  console.log('🎯 Підтримувані типи маршрутів:');
  console.log('   • Простий з базою: База → Loading → Unloading → База');
  console.log('   • Точка-точка: Loading → Unloading (без домашньої бази)');
  console.log('   • Складний з базою: База → Loading1 → Unloading1 → Loading2 → Unloading2 → База');
  console.log('   • Змішаний з базою: База → Loading1 → Unloading1 → База → Loading2 → Unloading2 → База');
  console.log('   • Множинні точки без бази: Loading1 → Unloading1 → Loading2 → Unloading2');
  
  // Створюємо систему
  const system = createRouteOptimizationSystem({
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

    // Оптимізуємо маршрути з урахуванням складних сегментів
    console.log('\n🎯 Крок 2: Оптимізація маршрутів з аналізом складних сегментів...');
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
      console.log(`   Відстань: ${Math.round(analysis.totalDistance)} км`);
      console.log(`   Час: ${Math.round(analysis.estimatedTiming.totalDuration)} год`);
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