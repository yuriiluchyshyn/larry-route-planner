/**
 * Route Analyzer - Аналізатор маршрутів для детального розбору сегментів
 * База → Loading Points → Uploading Points → База
 */

import type { RouteData, RouteSpot } from '../models/routeModels';
import { getOptimizationConfig, type OptimizationConfig, type DeepPartial } from './config/optimizationConfig';

export interface RouteSegmentAnalysis {
  // Основна інформація
  routeId: string;
  totalDistance: number;
  
  // Сегменти маршруту
  segments: {
    baseToLoading: RouteSegment;
    loadingToUnloading: RouteSegment;
    unloadingToBase: RouteSegment;
  };
  
  // Точки маршруту
  loadingPoints: RoutePointInfo[];
  unloadingPoints: RoutePointInfo[];
  
  // Аналітика
  complexity: RouteComplexity;
  recommendations: string[];
  estimatedTiming: RouteTiming;
}

export interface RouteSegment {
  name: string;
  estimatedDistance: number; // км
  estimatedDuration: number; // години
  countries: string[];
  points: RoutePointInfo[];
}

export interface RoutePointInfo {
  type: 'loading' | 'unloading';
  location: {
    city: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  timeWindow?: {
    start: string;
    end: string;
    timezone: string;
  };
  estimatedServiceTime: number; // години на завантаження/розвантаження
}

export interface RouteComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'very_complex';
  score: number; // 1-10
  factors: {
    multipleLoadingPoints: boolean;
    multipleUnloadingPoints: boolean;
    crossBorderCount: number;
    totalPoints: number;
  };
}

export interface RouteTiming {
  totalDuration: number; // години
  drivingTime: number; // години
  serviceTime: number; // години на завантаження/розвантаження
  restTime: number; // години відпочинку
  bufferTime: number; // буферний час
}

export class RouteAnalyzer {
  private static config: OptimizationConfig = getOptimizationConfig();

  /**
   * Встановити кастомну конфігурацію
   */
  static setConfig(customConfig: DeepPartial<OptimizationConfig>) {
    this.config = getOptimizationConfig(customConfig);
  }
  
  /**
   * Проаналізувати маршрут та розбити на сегменти
   */
  static analyzeRoute(route: RouteData): RouteSegmentAnalysis {
    // Розділяємо точки за типом
    const loadingPoints = this.extractLoadingPoints(route);
    const unloadingPoints = this.extractUnloadingPoints(route);
    
    // Аналізуємо складність
    const complexity = this.analyzeComplexity(loadingPoints, unloadingPoints);
    
    // Розраховуємо сегменти
    const segments = this.calculateSegments(route, loadingPoints, unloadingPoints);
    
    // Розраховуємо час
    const estimatedTiming = this.calculateTiming(route, loadingPoints, unloadingPoints);
    
    // Генеруємо рекомендації
    const recommendations = this.generateDetailedRecommendations(
      complexity, 
      segments, 
      estimatedTiming
    );

    return {
      routeId: route.id,
      totalDistance: route.route.distance / 1000, // конвертуємо в км
      segments,
      loadingPoints,
      unloadingPoints,
      complexity,
      recommendations,
      estimatedTiming
    };
  }

  /**
   * Витягти точки завантаження
   */
  private static extractLoadingPoints(route: RouteData): RoutePointInfo[] {
    return route.spots
      .filter(spot => spot.operations.some(op => op.type === 'loading'))
      .map(spot => this.convertSpotToPointInfo(spot, 'loading'));
  }

  /**
   * Витягти точки розвантаження
   */
  private static extractUnloadingPoints(route: RouteData): RoutePointInfo[] {
    return route.spots
      .filter(spot => spot.operations.some(op => op.type === 'unloading'))
      .map(spot => this.convertSpotToPointInfo(spot, 'unloading'));
  }

  /**
   * Конвертувати RouteSpot в RoutePointInfo
   */
  private static convertSpotToPointInfo(spot: RouteSpot, type: 'loading' | 'unloading'): RoutePointInfo {
    const operation = spot.operations.find(op => op.type === type);
    
    return {
      type,
      location: {
        city: spot.place.address.locality,
        country: spot.place.address.country,
        coordinates: {
          lat: spot.place.coordinates.latitude,
          lng: spot.place.coordinates.longitude
        }
      },
      timeWindow: operation ? {
        start: operation.timespan.begin,
        end: operation.timespan.end,
        timezone: operation.timespan.timezone
      } : undefined,
      estimatedServiceTime: type === 'loading' ? this.config.timing.loadingTimePerPoint : this.config.timing.unloadingTimePerPoint
    };
  }

  /**
   * Аналізувати складність маршруту
   */
  private static analyzeComplexity(
    loadingPoints: RoutePointInfo[], 
    unloadingPoints: RoutePointInfo[]
  ): RouteComplexity {
    const totalPoints = loadingPoints.length + unloadingPoints.length;
    const multipleLoadingPoints = loadingPoints.length > 1;
    const multipleUnloadingPoints = unloadingPoints.length > 1;
    
    // Рахуємо кількість країн
    const allCountries = new Set([
      ...loadingPoints.map(p => p.location.country),
      ...unloadingPoints.map(p => p.location.country)
    ]);
    const crossBorderCount = allCountries.size;

    // Розраховуємо скор складності (1-10)
    let score = this.config.complexity.scoring.baseScore;
    score += Math.min(totalPoints - 2, this.config.complexity.scoring.maxPointsBonus);
    score += Math.min(crossBorderCount - 1, this.config.complexity.scoring.maxCountriesBonus);
    if (multipleLoadingPoints) score += this.config.complexity.scoring.multipleLoadingBonus;
    if (multipleUnloadingPoints) score += this.config.complexity.scoring.multipleUnloadingBonus;

    // Визначаємо рівень складності
    let level: RouteComplexity['level'];
    if (score <= this.config.complexity.thresholds.simple) level = 'simple';
    else if (score <= this.config.complexity.thresholds.moderate) level = 'moderate';
    else if (score <= this.config.complexity.thresholds.complex) level = 'complex';
    else level = 'very_complex';

    return {
      level,
      score: Math.min(score, this.config.complexity.scoring.maxScore),
      factors: {
        multipleLoadingPoints,
        multipleUnloadingPoints,
        crossBorderCount,
        totalPoints
      }
    };
  }

  /**
   * Розрахувати сегменти маршруту
   */
  private static calculateSegments(
    route: RouteData,
    loadingPoints: RoutePointInfo[],
    unloadingPoints: RoutePointInfo[]
  ): RouteSegmentAnalysis['segments'] {
    const totalDistance = route.route.distance / 1000; // км
    
    // Приблизний розподіл відстані між сегментами
    const baseToLoadingDistance = totalDistance * this.config.segments.baseToLoadingPercentage;
    const loadingToUnloadingDistance = totalDistance * this.config.segments.loadingToUnloadingPercentage;
    const unloadingToBaseDistance = totalDistance * this.config.segments.unloadingToBasePercentage;

    return {
      baseToLoading: {
        name: 'База → Точки завантаження',
        estimatedDistance: baseToLoadingDistance,
        estimatedDuration: baseToLoadingDistance / this.config.timing.averageSpeed,
        countries: [...new Set(loadingPoints.map(p => p.location.country))],
        points: loadingPoints
      },
      loadingToUnloading: {
        name: 'Завантаження → Розвантаження',
        estimatedDistance: loadingToUnloadingDistance,
        estimatedDuration: loadingToUnloadingDistance / this.config.timing.averageSpeed,
        countries: [...new Set([
          ...loadingPoints.map(p => p.location.country),
          ...unloadingPoints.map(p => p.location.country)
        ])],
        points: [...loadingPoints, ...unloadingPoints]
      },
      unloadingToBase: {
        name: 'Розвантаження → База',
        estimatedDistance: unloadingToBaseDistance,
        estimatedDuration: unloadingToBaseDistance / this.config.timing.averageSpeed,
        countries: [...new Set(unloadingPoints.map(p => p.location.country))],
        points: unloadingPoints
      }
    };
  }

  /**
   * Розрахувати детальний час маршруту
   */
  private static calculateTiming(
    route: RouteData,
    loadingPoints: RoutePointInfo[],
    unloadingPoints: RoutePointInfo[]
  ): RouteTiming {
    const distance = route.route.distance / 1000; // км
    const drivingTime = distance / this.config.timing.averageSpeed;
    
    // Час на обслуговування
    const loadingTime = loadingPoints.reduce((sum, point) => sum + point.estimatedServiceTime, 0);
    const unloadingTime = unloadingPoints.reduce((sum, point) => sum + point.estimatedServiceTime, 0);
    const serviceTime = loadingTime + unloadingTime;
    
    // Час відпочинку
    const restTime = Math.floor(drivingTime / 4.5) * this.config.timing.restTimeDuration;
    
    // Буферний час
    const bufferTime = (drivingTime + serviceTime + restTime) * this.config.timing.bufferTimePercentage;
    
    const totalDuration = drivingTime + serviceTime + restTime + bufferTime;

    return {
      totalDuration,
      drivingTime,
      serviceTime,
      restTime,
      bufferTime
    };
  }

  /**
   * Генерувати детальні рекомендації
   */
  private static generateDetailedRecommendations(
    complexity: RouteComplexity,
    segments: RouteSegmentAnalysis['segments'],
    timing: RouteTiming
  ): string[] {
    const recommendations: string[] = [];

    // Рекомендації за складністю
    switch (complexity.level) {
      case 'simple':
        recommendations.push('✅ Простий маршрут - ідеальний для початківців');
        break;
      case 'moderate':
        recommendations.push('👍 Помірно складний маршрут - потребує базового досвіду');
        break;
      case 'complex':
        recommendations.push('⚠️ Складний маршрут - рекомендується досвідченим водіям');
        break;
      case 'very_complex':
        recommendations.push('🚨 Дуже складний маршрут - потребує детального планування');
        break;
    }

    // Рекомендації за сегментами
    if (segments.baseToLoading.countries.length > 1) {
      recommendations.push(`🌍 Завантаження в ${segments.baseToLoading.countries.length} країнах - підготуйте документи`);
    }

    if (segments.unloadingToBase.countries.length > 1) {
      recommendations.push(`🌍 Розвантаження в ${segments.unloadingToBase.countries.length} країнах - врахуйте митні процедури`);
    }

    // Рекомендації за часом
    if (timing.totalDuration > this.config.recommendations.thresholds.longTotalDuration) {
      recommendations.push('⏰ Довгий маршрут - плануйте нічний відпочинок');
    }

    if (timing.serviceTime > this.config.recommendations.thresholds.longServiceTime) {
      recommendations.push('📦 Багато часу на завантаження/розвантаження - врахуйте в плануванні');
    }

    // Рекомендації за відстанню
    const totalDistance = segments.baseToLoading.estimatedDistance + 
                         segments.loadingToUnloading.estimatedDistance + 
                         segments.unloadingToBase.estimatedDistance;
    
    if (totalDistance > this.config.recommendations.thresholds.longTotalDistance) {
      recommendations.push('🛣️ Довга відстань - перевірте обмеження для водіїв');
    }

    return recommendations;
  }

  /**
   * Отримати короткий опис маршруту
   */
  static getRouteDescription(analysis: RouteSegmentAnalysis): string {
    const { loadingPoints, unloadingPoints, complexity } = analysis;
    
    const loadingCities = loadingPoints.map(p => `${p.location.city} (${p.location.country})`);
    const unloadingCities = unloadingPoints.map(p => `${p.location.city} (${p.location.country})`);
    
    return `${complexity.level.toUpperCase()}: ${loadingCities.join(' + ')} → ${unloadingCities.join(' + ')} (${Math.round(analysis.totalDistance)}км, ${Math.round(analysis.estimatedTiming.totalDuration)}год)`;
  }

  /**
   * Порівняти два маршрути за складністю
   */
  static compareRoutes(route1: RouteSegmentAnalysis, route2: RouteSegmentAnalysis): number {
    // Повертає -1 якщо route1 простіший, 1 якщо складніший, 0 якщо однакові
    if (route1.complexity.score < route2.complexity.score) return -1;
    if (route1.complexity.score > route2.complexity.score) return 1;
    return 0;
  }
}