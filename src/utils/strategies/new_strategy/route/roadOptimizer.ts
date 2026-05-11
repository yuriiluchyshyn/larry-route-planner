/**
 * Road Optimizer
 * Основний файл для оптимізації маршрутів
 */

import { RouteApiService } from './routeApiService';
import { RedisRouteService } from '../redis/redisRouteService';
import { getOptimizationConfig, type OptimizationConfig, type DeepPartial } from './config/optimizationConfig';
import type { 
  RouteData,
  RouteSpot
} from '../models/routeModels';
import { validateAndNormalizeRoute, isRouteOptimizable } from '../models/routeModels';
import type { 
  OptimizationParams, 
  OptimizedRoute, 
  OptimizationResult, 
  RouteMetrics, 
  RouteFilters 
} from '../models/optimizationModels';
import type { 
  ScanResult 
} from '../models/redisModels';

export class RoadOptimizer {
  private apiService: RouteApiService;
  private redisService: RedisRouteService;
  private defaultParams: OptimizationParams;
  private config: OptimizationConfig;

  constructor(
    apiService: RouteApiService,
    redisService: RedisRouteService,
    defaultParams?: OptimizationParams,
    customConfig?: DeepPartial<OptimizationConfig>
  ) {
    this.apiService = apiService;
    this.redisService = redisService;
    this.config = getOptimizationConfig(customConfig);
    
    this.defaultParams = {
      maxDistance: this.config.defaults.maxDistance,
      minCapacity: this.config.defaults.minCapacity,
      maxCapacity: this.config.defaults.maxCapacity,
      costPerKm: this.config.defaults.costPerKm,
      fuelConsumption: this.config.defaults.fuelConsumption,
      fuelPrice: this.config.defaults.fuelPrice,
      maxEmptyRoad: this.config.defaults.maxEmptyRoad,
      ...defaultParams
    };
  }

  /**
   * Сканувати та зберегти всі маршрути в Redis
   */
  async scanAndCacheRoutes(): Promise<ScanResult> {
    console.log('🚀 Початок сканування та кешування маршрутів...');
    
    let scanned = 0;
    let cached = 0;
    let errors = 0;

    try {
      // Отримуємо всі маршрути через API
      const routes = await this.apiService.scanAllRoutes();
      scanned = routes.length;

      console.log(`📊 Сканування завершено. Знайдено ${scanned} маршрутів`);
      console.log('💾 Початок збереження в Redis...');

      // Зберігаємо кожен маршрут в Redis
      for (const route of routes) {
        try {
          await this.redisService.cacheRoute(route);
          cached++;
          
          if (cached % this.config.caching.progressReportInterval === 0) {
            console.log(`💾 Збережено ${cached}/${scanned} маршрутів...`);
          }
        } catch (error) {
          console.error(`❌ Помилка збереження маршруту ${route.id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Кешування завершено! Збережено: ${cached}, Помилок: ${errors}`);
      
      return { scanned, cached, errors };
    } catch (error) {
      console.error('❌ Критична помилка під час сканування:', error);
      throw error;
    }
  }

  /**
   * Оптимізувати маршрути за заданими параметрами
   */
  async optimizeRoutes(params?: OptimizationParams): Promise<OptimizationResult> {
    const optimizationParams = { ...this.defaultParams, ...params };
    
    console.log('🎯 Початок оптимізації маршрутів...');
    console.log('📋 Параметри оптимізації:', optimizationParams);

    try {
      // Отримуємо маршрути з Redis
      const cachedRoutes = await this.redisService.getAllCachedRoutes();
      console.log(`📦 Знайдено ${cachedRoutes.length} кешованих маршрутів`);

      if (cachedRoutes.length === 0) {
        console.log('⚠️ Немає кешованих маршрутів. Запускаємо сканування...');
        await this.scanAndCacheRoutes();
        return this.optimizeRoutes(params);
      }

      // Валідуємо та нормалізуємо маршрути перед обробкою
      const validRoutes = cachedRoutes
        .map(route => validateAndNormalizeRoute(route))
        .filter((route): route is RouteData => route !== null)
        .filter(route => isRouteOptimizable(route));

      console.log(`✅ Валідних та оптимізованих маршрутів: ${validRoutes.length} з ${cachedRoutes.length}`);

      // Фільтруємо маршрути за параметрами
      const filteredRoutes = this.filterRoutes(validRoutes, optimizationParams);
      console.log(`🔍 Після фільтрації залишилось ${filteredRoutes.length} маршрутів`);

      // Оптимізуємо кожен маршрут
      const optimizedRoutes: OptimizedRoute[] = [];
      
      for (const route of filteredRoutes) {
        const optimized = this.optimizeRoute(route, optimizationParams);
        optimizedRoutes.push(optimized);
      }

      // Сортуємо за оптимізаційним скором
      optimizedRoutes.sort((a, b) => b.optimizationScore - a.optimizationScore);

      // Обчислюємо статистику
      const statistics = this.calculateStatistics(optimizedRoutes);
      const averageScore = optimizedRoutes.reduce((sum, route) => sum + route.optimizationScore, 0) / optimizedRoutes.length;

      const result: OptimizationResult = {
        routes: optimizedRoutes,
        totalRoutes: optimizedRoutes.length,
        averageScore,
        bestRoute: optimizedRoutes[0],
        statistics
      };

      console.log('🎉 Оптимізація завершена!');
      console.log(`📊 Кращий маршрут: ${result.bestRoute?.id} (скор: ${result.bestRoute?.optimizationScore.toFixed(2)})`);

      return result;
    } catch (error) {
      console.error('❌ Помилка під час оптимізації:', error);
      throw error;
    }
  }

  /**
   * Фільтрувати маршрути за параметрами з урахуванням Max Empty Road
   */
  private filterRoutes(routes: RouteData[], params: OptimizationParams): RouteData[] {
    return routes.filter(route => {
      // Перевіряємо базову структуру маршруту
      if (!isRouteOptimizable(route)) {
        console.warn('⚠️ Route not optimizable:', route.id);
        return false;
      }

      // Фільтр за відстанню
      if (params.maxDistance && route.route?.distance && route.route.distance > params.maxDistance) {
        return false;
      }

      // Фільтр за вантажопідйомністю
      if (params.minCapacity && route.freight?.capacity && route.freight.capacity < params.minCapacity) {
        return false;
      }
      if (params.maxCapacity && route.freight?.capacity && route.freight.capacity > params.maxCapacity) {
        return false;
      }

      // НОВИЙ: Фільтр за максимальним порожнім проїздом
      if (params.maxEmptyRoad !== undefined) {
        try {
          const emptyRoadPercentage = this.calculateEmptyRoadPercentage(route);
          if (emptyRoadPercentage > params.maxEmptyRoad) {
            return false;
          }
        } catch (error) {
          console.warn('⚠️ Error calculating empty road percentage for route:', route.id, error);
          // Якщо не можемо розрахувати, пропускаємо цей фільтр
        }
      }

      // Фільтр за регіонами
      if (params.preferredRegions && params.preferredRegions.length > 0) {
        if (!route.spots || !Array.isArray(route.spots)) {
          console.warn('⚠️ Route has no spots array:', route.id);
          return false;
        }
        
        const hasPreferredRegion = route.spots.some(spot => 
          params.preferredRegions!.some(region => 
            spot.place?.address?.country?.includes(region) ||
            spot.place?.address?.locality?.toLowerCase().includes(region.toLowerCase())
          )
        );
        if (!hasPreferredRegion) {
          return false;
        }
      }

      // Фільтр за виключеними регіонами
      if (params.excludeRegions && params.excludeRegions.length > 0) {
        if (!route.spots || !Array.isArray(route.spots)) {
          return true; // Якщо немає spots, не можемо перевірити регіони
        }
        
        const hasExcludedRegion = route.spots.some(spot => 
          params.excludeRegions!.some(region => 
            spot.place?.address?.country?.includes(region) || 
            spot.place?.address?.locality?.toLowerCase().includes(region.toLowerCase())
          )
        );
        if (hasExcludedRegion) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Розрахувати відсоток порожнього проїзду
   */
  private calculateEmptyRoadPercentage(route: RouteData): number {
    // Перевіряємо наявність необхідних даних
    if (!route?.route?.distance) {
      console.warn('⚠️ Route missing distance data:', route?.id);
      return 0; // Повертаємо 0% якщо немає даних про відстань
    }

    const totalDistance = route.route.distance / 1000; // км
    
    if (totalDistance === 0) return 100;
    
    // Спрощений розрахунок: приблизно 30% на початок + 20% на кінець = 50% порожнього проїзду
    // В реальності це потрібно розраховувати через API маршрутизації
    const segments = this.calculateRouteSegments(route);
    
    // Приблизний розрахунок порожнього проїзду
    // База → Loading + Unloading → База
    const estimatedEmptyDistance = totalDistance * this.config.emptyRoad.baseEmptyPercentage;
    
    const emptyPercentage = (estimatedEmptyDistance / totalDistance) * 100;
    
    // Коригуємо залежно від кількості точок
    let adjustment = 0;
    if (segments.totalLoadingPoints === 1 && segments.totalUnloadingPoints === 1) {
      adjustment = this.config.emptyRoad.idealRouteAdjustment; // Ідеальний маршрут
    } else if (segments.totalLoadingPoints > 2 || segments.totalUnloadingPoints > 2) {
      adjustment = this.config.emptyRoad.complexRouteAdjustment; // Складний маршрут
    }
    
    const finalPercentage = Math.max(0, Math.min(100, emptyPercentage + adjustment));
    return Math.round(finalPercentage * 100) / 100; // Округлюємо до 2 знаків
  }

  /**
   * Оптимізувати окремий маршрут
   * Враховує три сегменти: База → Loading Points → Uploading Points → База
   */
  private optimizeRoute(route: RouteData, params: OptimizationParams): OptimizedRoute {
    // Розділяємо точки на loading та unloading
    const routeSegments = this.calculateRouteSegments(route);
    
    // Перевіряємо наявність даних про відстань
    if (!route.route?.distance) {
      console.warn('⚠️ Route missing distance data, using default:', route.id);
      // Повертаємо базовий оптимізований маршрут з мінімальними даними
      return {
        id: route.id,
        originalRoute: route,
        optimizationScore: 0,
        distance: 0,
        duration: 0,
        estimatedCost: 0,
        estimatedProfit: 0,
        fuelCost: 0,
        efficiency: 0,
        recommendations: ['⚠️ Недостатньо даних для оптимізації маршруту'],
        emptyRoadPercentage: 0
      };
    }

    const distance = route.route.distance / 1000; // конвертуємо в км
    const duration = this.calculateDuration(distance);
    
    // НОВИЙ: Розраховуємо відсоток порожнього проїзду
    const emptyRoadPercentage = this.calculateEmptyRoadPercentage(route);
    
    // Розрахунок витрат з урахуванням сегментів
    const fuelCost = this.calculateFuelCost(distance, params.fuelConsumption!, params.fuelPrice!);
    const driverCost = duration * this.config.costs.driverHourlyRate;
    const otherCosts = distance * this.config.costs.otherCostsPerKm;
    
    // Додаткові витрати на завантаження/розвантаження
    const loadingCosts = routeSegments.loadingPoints.length * this.config.costs.loadingCostPerPoint;
    const unloadingCosts = routeSegments.unloadingPoints.length * this.config.costs.unloadingCostPerPoint;
    
    const estimatedCost = fuelCost + driverCost + otherCosts + loadingCosts + unloadingCosts;

    // Розрахунок прибутку (якщо є ціна)
    const routePrice = route.price?.value || this.estimatePrice(distance, route.freight?.capacity || 0);
    const estimatedProfit = routePrice - estimatedCost;
    const efficiency = distance > 0 ? estimatedProfit / distance : 0;

    // Розрахунок оптимізаційного скору з урахуванням сегментів та порожнього проїзду
    const optimizationScore = this.calculateOptimizationScore(route, {
      distance,
      duration,
      estimatedProfit,
      efficiency,
      fuelCost,
      emptyRoadPercentage // НОВИЙ параметр
    }, routeSegments);

    // Генерація рекомендацій з урахуванням сегментів та порожнього проїзду
    const recommendations = this.generateRecommendations(route, {
      distance,
      duration,
      estimatedProfit,
      efficiency,
      emptyRoadPercentage // НОВИЙ параметр
    }, routeSegments);

    return {
      id: route.id,
      originalRoute: route,
      optimizationScore,
      estimatedCost,
      estimatedProfit,
      distance,
      duration,
      fuelCost,
      efficiency,
      recommendations,
      routeSegments, // додаємо інформацію про сегменти
      emptyRoadPercentage // НОВИЙ: додаємо відсоток порожнього проїзду
    };
  }

  /**
   * Розрахувати сегменти маршруту: База → Loading → Unloading → База
   */
  private calculateRouteSegments(route: RouteData) {
    const loadingPoints: RouteSpot[] = [];
    const unloadingPoints: RouteSpot[] = [];
    
    // Перевіряємо наявність spots
    if (!route.spots || !Array.isArray(route.spots)) {
      console.warn('⚠️ Route missing spots data:', route.id);
      return {
        loadingPoints: [],
        unloadingPoints: [],
        totalLoadingPoints: 0,
        totalUnloadingPoints: 0,
        hasMultipleLoadingPoints: false,
        hasMultipleUnloadingPoints: false,
        loadingCountries: [],
        unloadingCountries: [],
      };
    }
    
    // Розділяємо точки за типом операцій
    route.spots.forEach(spot => {
      // Перевіряємо наявність операцій
      if (!spot.operations || !Array.isArray(spot.operations)) {
        console.warn('⚠️ Spot missing operations:', spot);
        return;
      }

      const hasLoading = spot.operations.some(op => op.type === 'loading');
      const hasUnloading = spot.operations.some(op => op.type === 'unloading');
      
      if (hasLoading) {
        loadingPoints.push(spot);
      }
      if (hasUnloading) {
        unloadingPoints.push(spot);
      }
    });

    // Розраховуємо відстані для кожного сегменту
    const segments = {
      loadingPoints,
      unloadingPoints,
      totalLoadingPoints: loadingPoints.length,
      totalUnloadingPoints: unloadingPoints.length,
      // Додаткова інформація для аналізу
      hasMultipleLoadingPoints: loadingPoints.length > 1,
      hasMultipleUnloadingPoints: unloadingPoints.length > 1,
      // Географічний розподіл
      loadingCountries: [...new Set(loadingPoints.map(p => p.place?.address?.country).filter((country): country is string => Boolean(country)))],
      unloadingCountries: [...new Set(unloadingPoints.map(p => p.place?.address?.country).filter((country): country is string => Boolean(country)))],
    };

    return segments;
  }

  /**
   * Розрахувати тривалість поїздки
   */
  private calculateDuration(distanceKm: number): number {
    const averageSpeed = this.config.timing.averageSpeed;
    const restTime = Math.floor(distanceKm / this.config.timing.restTimeInterval) * this.config.timing.restTimeDuration;
    return (distanceKm / averageSpeed) + restTime;
  }

  /**
   * Розрахувати витрати на паливо
   */
  private calculateFuelCost(distanceKm: number, consumption: number, fuelPrice: number): number {
    return (distanceKm / 100) * consumption * fuelPrice;
  }

  /**
   * Оцінити ціну маршруту якщо вона не вказана
   */
  private estimatePrice(distanceKm: number, capacity: number): number {
    const baseRate = this.config.pricing.baseRate;
    const capacityMultiplier = Math.min(capacity / this.config.pricing.capacityThreshold, this.config.pricing.maxCapacityMultiplier);
    return distanceKm * baseRate * capacityMultiplier;
  }

  /**
   * Розрахувати оптимізаційний скор з урахуванням сегментів маршруту та порожнього проїзду
   */
  private calculateOptimizationScore(
    _route: RouteData, 
    metrics: RouteMetrics, 
    segments: ReturnType<typeof this.calculateRouteSegments>
  ): number {
    let score = 0;

    // Прибутковість
    score += Math.max(0, metrics.estimatedProfit) * this.config.scoring.profitabilityWeight;

    // Ефективність
    score += Math.max(0, metrics.efficiency * 100) * this.config.scoring.efficiencyWeight;

    // Відстань
    const distanceScore = Math.max(0, 1000 - metrics.distance) / 10;
    score += distanceScore * this.config.scoring.distanceWeight;

    // Час
    const timeScore = Math.max(0, 24 - metrics.duration) * 10;
    score += timeScore * this.config.scoring.timeWeight;

    // Порожній проїзд - чим менше, тим краще
    if (metrics.emptyRoadPercentage !== undefined) {
      const emptyRoadScore = Math.max(0, 100 - metrics.emptyRoadPercentage);
      score += emptyRoadScore * this.config.scoring.emptyRoadWeight;
    }

    // Бонус за оптимальну структуру маршруту
    let routeStructureBonus = 0;
    
    // Бонус за простоту маршруту
    if (segments.totalLoadingPoints === 1 && segments.totalUnloadingPoints === 1) {
      routeStructureBonus += this.config.structureBonuses.idealRouteBonus;
    } else if (segments.totalLoadingPoints <= 2 && segments.totalUnloadingPoints <= 2) {
      routeStructureBonus += this.config.structureBonuses.goodRouteBonus;
    } else {
      routeStructureBonus += this.config.structureBonuses.complexRouteBonus;
    }

    // Бонус за географічну концентрацію
    if (segments.loadingCountries.length === 1 && segments.unloadingCountries.length === 1) {
      routeStructureBonus += this.config.structureBonuses.geographicConcentrationBonus;
    }

    // Штраф за надто складні маршрути
    const totalPoints = segments.totalLoadingPoints + segments.totalUnloadingPoints;
    if (totalPoints > this.config.structureBonuses.complexityThreshold) {
      routeStructureBonus -= (totalPoints - this.config.structureBonuses.complexityThreshold) * this.config.structureBonuses.complexityPenaltyPerPoint;
    }

    score += Math.max(0, routeStructureBonus) * this.config.scoring.routeStructureWeight;

    return Math.round(score * 100) / 100;
  }

  /**
   * Генерувати рекомендації для маршруту з урахуванням сегментів та порожнього проїзду
   */
  private generateRecommendations(
    _route: RouteData, 
    metrics: {
      distance: number;
      duration: number;
      estimatedProfit: number;
      efficiency: number;
      emptyRoadPercentage?: number; // НОВИЙ параметр
    },
    segments: ReturnType<typeof this.calculateRouteSegments>
  ): string[] {
    const recommendations: string[] = [];

    // Рекомендації щодо прибутковості
    if (metrics.estimatedProfit < this.config.recommendations.thresholds.lowProfit) {
      recommendations.push('⚠️ Низька прибутковість - розгляньте інші варіанти');
    }

    if (metrics.efficiency < this.config.recommendations.thresholds.lowEfficiency) {
      recommendations.push('📉 Низька ефективність на км - можливо занадто дорогий маршрут');
    }

    // Рекомендації щодо порожнього проїзду
    if (metrics.emptyRoadPercentage !== undefined) {
      if (metrics.emptyRoadPercentage > this.config.recommendations.thresholds.highEmptyRoad) {
        recommendations.push(`🚛 Високий порожній проїзд (${metrics.emptyRoadPercentage.toFixed(1)}%) - шукайте додатковий вантаж`);
      } else if (metrics.emptyRoadPercentage > this.config.recommendations.thresholds.moderateEmptyRoad) {
        recommendations.push(`⚠️ Помірний порожній проїзд (${metrics.emptyRoadPercentage.toFixed(1)}%) - можна оптимізувати`);
      } else if (metrics.emptyRoadPercentage <= this.config.recommendations.thresholds.excellentEmptyRoad) {
        recommendations.push(`✅ Відмінний коефіцієнт завантаження (${metrics.emptyRoadPercentage.toFixed(1)}% порожнього проїзду)`);
      }
    }

    // Рекомендації щодо відстані та часу
    if (metrics.distance > this.config.recommendations.thresholds.longDistance) {
      recommendations.push('🛣️ Довгий маршрут - врахуйте додатковий відпочинок водія');
    }

    if (metrics.duration > this.config.recommendations.thresholds.longDuration) {
      recommendations.push('⏰ Тривалий маршрут - можливо потрібен другий водій');
    }

    // Рекомендації щодо структури маршруту
    if (segments.totalLoadingPoints > this.config.recommendations.thresholds.manyLoadingPoints) {
      recommendations.push(`📦 Багато точок завантаження (${segments.totalLoadingPoints}) - врахуйте додатковий час на оформлення`);
    }

    if (segments.totalUnloadingPoints > this.config.recommendations.thresholds.manyUnloadingPoints) {
      recommendations.push(`📍 Багато точок розвантаження (${segments.totalUnloadingPoints}) - плануйте додатковий час на доставку`);
    }

    // Рекомендації щодо географії
    if (segments.loadingCountries.length > this.config.recommendations.thresholds.manyCountries) {
      recommendations.push(`🌍 Завантаження в ${segments.loadingCountries.length} країнах: ${segments.loadingCountries.join(', ')} - врахуйте митні процедури`);
    }

    if (segments.unloadingCountries.length > this.config.recommendations.thresholds.manyCountries) {
      recommendations.push(`🌍 Розвантаження в ${segments.unloadingCountries.length} країнах: ${segments.unloadingCountries.join(', ')} - врахуйте митні процедури`);
    }

    // Рекомендації для оптимальних маршрутів
    if (segments.totalLoadingPoints === 1 && segments.totalUnloadingPoints === 1) {
      recommendations.push('✅ Оптимальна структура: База → Завантаження → Розвантаження → База');
    } else if (segments.totalLoadingPoints <= 2 && segments.totalUnloadingPoints <= 2) {
      recommendations.push('👍 Прийнятна структура маршруту з мінімальними зупинками');
    }

    // Рекомендації щодо планування
    const totalPoints = segments.totalLoadingPoints + segments.totalUnloadingPoints;
    if (totalPoints > this.config.recommendations.thresholds.complexRoute) {
      recommendations.push(`⚠️ Складний маршрут з ${totalPoints} точками - детально плануйте час на кожну зупинку`);
    }

    // Якщо немає негативних рекомендацій і маршрут простий
    if (recommendations.length === 0 || 
        (recommendations.length === 1 && recommendations[0].startsWith('✅'))) {
      recommendations.push('🎯 Рекомендований маршрут для виконання');
    }

    return recommendations;
  }

  /**
   * Розрахувати статистику оптимізації
   */
  private calculateStatistics(routes: OptimizedRoute[]): OptimizationResult['statistics'] {
    if (routes.length === 0) {
      return {
        totalDistance: 0,
        totalProfit: 0,
        averageDistance: 0,
        averageProfit: 0
      };
    }

    const totalDistance = routes.reduce((sum, route) => sum + route.distance, 0);
    const totalProfit = routes.reduce((sum, route) => sum + route.estimatedProfit, 0);

    return {
      totalDistance,
      totalProfit,
      averageDistance: totalDistance / routes.length,
      averageProfit: totalProfit / routes.length
    };
  }

  /**
   * Отримати кешовані маршрути з можливістю фільтрації
   */
  async getCachedRoutes(filters?: RouteFilters): Promise<OptimizedRoute[]> {
    const cachedRoutes = await this.redisService.getAllCachedRoutes();
    
    if (cachedRoutes.length === 0) {
      return [];
    }

    // Швидка оптимізація для отримання скорів
    const optimizedRoutes = cachedRoutes.map(route => 
      this.optimizeRoute(route, this.defaultParams)
    );

    // Застосовуємо фільтри якщо є
    let filteredRoutes = optimizedRoutes;

    if (filters?.minScore) {
      filteredRoutes = filteredRoutes.filter(route => route.optimizationScore >= filters.minScore!);
    }

    if (filters?.maxDistance) {
      filteredRoutes = filteredRoutes.filter(route => route.distance <= filters.maxDistance!);
    }

    if (filters?.minProfit) {
      filteredRoutes = filteredRoutes.filter(route => route.estimatedProfit >= filters.minProfit!);
    }

    return filteredRoutes.sort((a, b) => b.optimizationScore - a.optimizationScore);
  }

  /**
   * Очистити кеш та пересканувати маршрути
   */
  async refreshRoutes(): Promise<void> {
    console.log('🔄 Оновлення маршрутів...');
    
    await this.redisService.clearCache();
    await this.scanAndCacheRoutes();
    
    console.log('✅ Маршрути оновлено!');
  }
}