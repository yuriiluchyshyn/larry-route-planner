/**
 * Redis Inspector
 * Утиліта для перевірки та аналізу Redis кешу маршрутів
 */

import { RedisRouteService } from './redisRouteService';

export class RedisInspector {
  private redisService: RedisRouteService;

  constructor() {
    this.redisService = new RedisRouteService();
  }

  /**
   * Підключитися до Redis та показати загальну статистику
   */
  async inspectCache(): Promise<void> {
    try {
      console.log('🔍 Підключення до Redis для інспекції...');
      await this.redisService.connect();

      // Отримуємо статистику
      const stats = await this.redisService.getCacheStats();
      
      console.log('\n📊 СТАТИСТИКА REDIS КЕШУ:');
      console.log('═'.repeat(50));
      console.log(`📦 Всього маршрутів: ${stats.totalRoutes}`);
      console.log(`💾 Розмір кешу: ${stats.totalSize}`);
      
      if (stats.totalRoutes > 0) {
        console.log(`⏰ Найстаріший запис: ${new Date(stats.oldestRoute).toLocaleString()}`);
        console.log(`🆕 Найновіший запис: ${new Date(stats.newestRoute).toLocaleString()}`);
      }

      if (stats.totalRoutes === 0) {
        console.log('\n⚠️ Кеш порожній. Запустіть пошук маршрутів для заповнення кешу.');
        return;
      }

      // Показуємо приклади маршрутів
      await this.showSampleRoutes();

    } catch (error) {
      console.error('❌ Помилка інспекції Redis:', error);
    }
  }

  /**
   * Показати приклади збережених маршрутів
   */
  async showSampleRoutes(limit: number = 5): Promise<void> {
    try {
      const allRoutes = await this.redisService.getAllCachedRoutes();
      
      if (allRoutes.length === 0) {
        console.log('\n📭 Немає збережених маршрутів');
        return;
      }

      console.log(`\n🗂️ ПРИКЛАДИ МАРШРУТІВ (показано ${Math.min(limit, allRoutes.length)} з ${allRoutes.length}):`);
      console.log('═'.repeat(80));

      for (let i = 0; i < Math.min(limit, allRoutes.length); i++) {
        const route = allRoutes[i];
        const origin = route.spots[0];
        const destination = route.spots[route.spots.length - 1];

        console.log(`\n${i + 1}. 🚛 Маршрут ID: ${route.id}`);
        console.log(`   📍 Від: ${origin.place.address.locality}, ${origin.place.address.country}`);
        console.log(`   🎯 До: ${destination.place.address.locality}, ${destination.place.address.country}`);
        console.log(`   📏 Відстань: ${route.route.distance} км`);
        console.log(`   📦 Вантажопідйомність: ${route.freight.capacity} кг`);
        console.log(`   💰 Ціна: ${route.price.value} ${route.price.currency}`);
        console.log(`   🏢 Компанія: ${route.company.legal_name}`);
      }

      if (allRoutes.length > limit) {
        console.log(`\n... та ще ${allRoutes.length - limit} маршрутів`);
      }

    } catch (error) {
      console.error('❌ Помилка показу маршрутів:', error);
    }
  }

  /**
   * Пошук маршрутів за критеріями
   */
  async searchCachedRoutes(origin?: string, destination?: string): Promise<void> {
    try {
      console.log(`\n🔍 Пошук маршрутів в кеші...`);
      if (origin) console.log(`   📍 Від: ${origin}`);
      if (destination) console.log(`   🎯 До: ${destination}`);

      const results = await this.redisService.searchRoutes({
        origin,
        destination
      });

      console.log(`\n📋 РЕЗУЛЬТАТИ ПОШУКУ: знайдено ${results.length} маршрутів`);
      console.log('═'.repeat(80));

      results.forEach((route, index) => {
        console.log(`\n${index + 1}. 🚛 ${route.id}`);
        console.log(`   📍 ${route.origin} → 🎯 ${route.destination}`);
        console.log(`   📏 ${route.distance} км | 📦 ${route.capacity} кг | 💰 ${route.price} ${route.currency}`);
        console.log(`   🏢 ${route.company}`);
        console.log(`   ⏰ Кешовано: ${new Date(route.cachedAt).toLocaleString()}`);
      });

    } catch (error) {
      console.error('❌ Помилка пошуку:', error);
    }
  }

  /**
   * Очистити весь кеш
   */
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️ Очищення кешу...');
      await this.redisService.clearCache();
      console.log('✅ Кеш очищено');
    } catch (error) {
      console.error('❌ Помилка очищення кешу:', error);
    }
  }

  /**
   * Показати детальну інформацію про конкретний маршрут
   */
  async inspectRoute(routeId: string): Promise<void> {
    try {
      console.log(`\n🔍 Інспекція маршруту ${routeId}...`);
      
      const route = await this.redisService.getRoute(routeId);
      const routeInfo = await this.redisService.getRouteInfo(routeId);

      if (!route || !routeInfo) {
        console.log(`❌ Маршрут ${routeId} не знайдено в кеші`);
        return;
      }

      console.log('\n📋 ДЕТАЛЬНА ІНФОРМАЦІЯ:');
      console.log('═'.repeat(50));
      console.log(`🆔 ID: ${route.id}`);
      console.log(`📍 Маршрут: ${routeInfo.origin} → ${routeInfo.destination}`);
      console.log(`📏 Відстань: ${routeInfo.distance} км`);
      console.log(`📦 Вантажопідйомність: ${routeInfo.capacity} кг`);
      console.log(`💰 Ціна: ${routeInfo.price} ${routeInfo.currency}`);
      console.log(`🏢 Компанія: ${routeInfo.company}`);
      console.log(`⏰ Кешовано: ${new Date(routeInfo.cachedAt).toLocaleString()}`);
      
      console.log('\n📍 КООРДИНАТИ:');
      console.log(`   Початок: ${routeInfo.coordinates.origin.lat}, ${routeInfo.coordinates.origin.lng}`);
      console.log(`   Кінець: ${routeInfo.coordinates.destination.lat}, ${routeInfo.coordinates.destination.lng}`);

      console.log('\n🚛 ТОЧКИ МАРШРУТУ:');
      route.spots.forEach((spot, index) => {
        const operation = spot.operations[0];
        const timespan = operation?.timespan || operation?.local_timespan;
        console.log(`   ${index + 1}. ${spot.place.address.locality}, ${spot.place.address.country}`);
        console.log(`      📅 ${timespan?.begin || 'Не вказано'}`);
        console.log(`      📍 ${spot.place.coordinates.latitude}, ${spot.place.coordinates.longitude}`);
      });

    } catch (error) {
      console.error('❌ Помилка інспекції маршруту:', error);
    }
  }
}

/**
 * Функції для швидкого доступу з консолі
 */

// Глобальна змінна для інспектора
let inspector: RedisInspector | null = null;

/**
 * Ініціалізувати інспектор Redis
 */
export async function initRedisInspector(): Promise<RedisInspector> {
  if (!inspector) {
    inspector = new RedisInspector();
  }
  return inspector;
}

/**
 * Швидка перевірка кешу
 */
export async function quickInspect(): Promise<void> {
  const redisInspector = await initRedisInspector();
  await redisInspector.inspectCache();
}

/**
 * Пошук маршрутів в кеші
 */
export async function searchCache(origin?: string, destination?: string): Promise<void> {
  const redisInspector = await initRedisInspector();
  await redisInspector.searchCachedRoutes(origin, destination);
}

/**
 * Очистити кеш
 */
export async function clearRedisCache(): Promise<void> {
  const redisInspector = await initRedisInspector();
  await redisInspector.clearCache();
}

/**
 * Інспектувати конкретний маршрут
 */
export async function inspectRoute(routeId: string): Promise<void> {
  const redisInspector = await initRedisInspector();
  await redisInspector.inspectRoute(routeId);
}