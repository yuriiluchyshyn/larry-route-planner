/**
 * Redis Route Service
 * Сервіс для зберігання та отримання маршрутів з Redis
 */

import type { RouteData } from '../models/routeModels';
import type { 
  CachedRouteInfo, 
  RedisConfig, 
  RouteSearchCriteria, 
  CacheStats 
} from '../models/redisModels';

export class RedisRouteService {
  private config: Required<RedisConfig>;
  private client: any; // Redis client буде ініціалізований пізніше
  private isConnected: boolean = false;

  constructor(config?: RedisConfig) {
    this.config = {
      host: config?.host || 'localhost',
      port: config?.port || 6379,
      password: config?.password || '',
      db: config?.db || 0,
      keyPrefix: config?.keyPrefix || 'larry:routes:'
    };
  }

  /**
   * Ініціалізація підключення до Redis
   */
  async connect(): Promise<void> {
    try {
      // В реальному проекті тут буде підключення до Redis
      // Наприклад, з використанням ioredis або redis
      console.log(`🔌 Підключення до Redis: ${this.config.host}:${this.config.port}`);
      
      // Симуляція підключення для демонстрації
      this.client = {
        // Mock Redis client для демонстрації
        data: new Map<string, string>(),
        
        async set(key: string, value: string, ex?: number): Promise<void> {
          this.data.set(key, value);
          if (ex) {
            setTimeout(() => this.data.delete(key), ex * 1000);
          }
        },
        
        async get(key: string): Promise<string | null> {
          return this.data.get(key) || null;
        },
        
        async del(key: string): Promise<number> {
          const existed = this.data.has(key);
          this.data.delete(key);
          return existed ? 1 : 0;
        },
        
        async keys(pattern: string): Promise<string[]> {
          const keys = Array.from(this.data.keys()) as string[];
          if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return keys.filter((key: string) => key.startsWith(prefix));
          }
          return keys.filter((key: string) => key === pattern);
        },
        
        async flushdb(): Promise<void> {
          this.data.clear();
        },
        
        async exists(key: string): Promise<number> {
          return this.data.has(key) ? 1 : 0;
        }
      };

      this.isConnected = true;
      console.log('✅ Підключення до Redis успішне');
    } catch (error) {
      console.error('❌ Помилка підключення до Redis:', error);
      throw error;
    }
  }

  /**
   * Перевірити підключення
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * Зберегти маршрут в Redis
   */
  async cacheRoute(route: RouteData): Promise<void> {
    await this.ensureConnected();

    try {
      const routeInfo = this.extractRouteInfo(route);
      const key = this.getRouteKey(route.id);
      
      // Зберігаємо повну інформацію про маршрут
      await this.client.set(key, JSON.stringify(route), 3600 * 24); // TTL 24 години
      
      // Зберігаємо індексну інформацію для швидкого пошуку
      const indexKey = this.getRouteIndexKey(route.id);
      await this.client.set(indexKey, JSON.stringify(routeInfo), 3600 * 24);

      // Додаємо до загального індексу маршрутів
      await this.addToRouteIndex(route.id);

    } catch (error) {
      console.error(`❌ Помилка збереження маршруту ${route.id}:`, error);
      // НЕ кидаємо помилку далі - просто пропускаємо цей маршрут
      // throw error;
    }
  }

  /**
   * Отримати маршрут з Redis за ID
   */
  async getRoute(routeId: string): Promise<RouteData | null> {
    await this.ensureConnected();

    try {
      const key = this.getRouteKey(routeId);
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Помилка отримання маршруту ${routeId}:`, error);
      return null;
    }
  }

  /**
   * Отримати інформацію про маршрут (індекс)
   */
  async getRouteInfo(routeId: string): Promise<CachedRouteInfo | null> {
    await this.ensureConnected();

    try {
      const key = this.getRouteIndexKey(routeId);
      const data = await this.client.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Помилка отримання інформації про маршрут ${routeId}:`, error);
      return null;
    }
  }

  /**
   * Отримати всі кешовані маршрути
   */
  async getAllCachedRoutes(): Promise<RouteData[]> {
    await this.ensureConnected();

    try {
      const routeIds = await this.getRouteIds();
      
      console.log(`📦 Знайдено ${routeIds.length} кешованих маршрутів`);

      const routes: RouteData[] = [];
      
      // Отримуємо маршрути батчами для кращої продуктивності
      const batchSize = 50;
      for (let i = 0; i < routeIds.length; i += batchSize) {
        const batch = routeIds.slice(i, i + batchSize);
        const batchPromises = batch.map(id => this.getRoute(id));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(route => {
          if (route) routes.push(route);
        });

        console.log(`📥 Завантажено ${Math.min(i + batchSize, routeIds.length)}/${routeIds.length} маршрутів`);
      }

      return routes;
    } catch (error) {
      console.error('❌ Помилка отримання всіх маршрутів:', error);
      throw error;
    }
  }

  /**
   * Пошук маршрутів за критеріями
   */
  async searchRoutes(criteria: RouteSearchCriteria): Promise<CachedRouteInfo[]> {
    await this.ensureConnected();

    try {
      const routeIds = await this.getRouteIds();
      const matchingRoutes: CachedRouteInfo[] = [];

      // Отримуємо інформацію про всі маршрути та фільтруємо
      for (const routeId of routeIds) {
        const routeInfo = await this.getRouteInfo(routeId);
        if (!routeInfo) continue;

        // Застосовуємо фільтри
        if (criteria.origin && !routeInfo.origin.toLowerCase().includes(criteria.origin.toLowerCase())) {
          continue;
        }

        if (criteria.destination && !routeInfo.destination.toLowerCase().includes(criteria.destination.toLowerCase())) {
          continue;
        }

        if (criteria.minDistance && routeInfo.distance < criteria.minDistance) {
          continue;
        }

        if (criteria.maxDistance && routeInfo.distance > criteria.maxDistance) {
          continue;
        }

        if (criteria.minCapacity && routeInfo.capacity < criteria.minCapacity) {
          continue;
        }

        if (criteria.maxCapacity && routeInfo.capacity > criteria.maxCapacity) {
          continue;
        }

        if (criteria.minPrice && routeInfo.price && routeInfo.price < criteria.minPrice) {
          continue;
        }

        if (criteria.maxPrice && routeInfo.price && routeInfo.price > criteria.maxPrice) {
          continue;
        }

        matchingRoutes.push(routeInfo);
      }

      console.log(`🔍 Знайдено ${matchingRoutes.length} маршрутів за критеріями`);
      return matchingRoutes;
    } catch (error) {
      console.error('❌ Помилка пошуку маршрутів:', error);
      throw error;
    }
  }

  /**
   * Отримати статистику кешу
   */
  async getCacheStats(): Promise<CacheStats> {
    await this.ensureConnected();

    try {
      const routeIds = await this.getRouteIds();
      let oldestRoute = Date.now();
      let newestRoute = 0;

      // Перевіряємо час кешування маршрутів
      for (const routeId of routeIds.slice(0, 10)) { // Перевіряємо тільки перші 10 для швидкості
        const routeInfo = await this.getRouteInfo(routeId);
        if (routeInfo) {
          oldestRoute = Math.min(oldestRoute, routeInfo.cachedAt);
          newestRoute = Math.max(newestRoute, routeInfo.cachedAt);
        }
      }

      return {
        totalRoutes: routeIds.length,
        totalSize: `${(routeIds.length * 2).toFixed(1)} KB`, // Приблизна оцінка
        oldestRoute,
        newestRoute
      };
    } catch (error) {
      console.error('❌ Помилка отримання статистики:', error);
      throw error;
    }
  }

  /**
   * Очистити весь кеш маршрутів
   */
  async clearCache(): Promise<void> {
    await this.ensureConnected();

    try {
      console.log('🗑️ Очищення кешу маршрутів...');
      
      // Отримуємо всі ключі маршрутів
      const routeKeys = await this.client.keys(`${this.config.keyPrefix}*`);
      
      if (routeKeys.length > 0) {
        // Видаляємо всі ключі
        for (const key of routeKeys) {
          await this.client.del(key);
        }
      }

      console.log(`✅ Видалено ${routeKeys.length} записів з кешу`);
    } catch (error) {
      console.error('❌ Помилка очищення кешу:', error);
      throw error;
    }
  }

  /**
   * Видалити конкретний маршрут з кешу
   */
  async removeRoute(routeId: string): Promise<boolean> {
    await this.ensureConnected();

    try {
      const routeKey = this.getRouteKey(routeId);
      const indexKey = this.getRouteIndexKey(routeId);
      
      const deleted1 = await this.client.del(routeKey);
      const deleted2 = await this.client.del(indexKey);
      
      // Видаляємо з індексу
      await this.removeFromRouteIndex(routeId);

      return (deleted1 + deleted2) > 0;
    } catch (error) {
      console.error(`❌ Помилка видалення маршруту ${routeId}:`, error);
      return false;
    }
  }

  /**
   * Перевірити чи існує маршрут в кеші
   */
  async routeExists(routeId: string): Promise<boolean> {
    await this.ensureConnected();

    try {
      const key = this.getRouteKey(routeId);
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`❌ Помилка перевірки існування маршруту ${routeId}:`, error);
      return false;
    }
  }

  // Приватні методи

  private getRouteKey(routeId: string): string {
    return `${this.config.keyPrefix}route:${routeId}`;
  }

  private getRouteIndexKey(routeId: string): string {
    return `${this.config.keyPrefix}index:${routeId}`;
  }

  private getRoutesIndexKey(): string {
    return `${this.config.keyPrefix}routes_index`;
  }

  private extractRouteInfo(route: RouteData): CachedRouteInfo {
    // Спочатку перевіряємо route.spots, потім freight.spots як fallback
    let spots = route.spots;
    
    if (!spots || spots.length === 0) {
      // Пробуємо freight.spots як fallback
      spots = (route.freight as any)?.spots;
      
      if (!spots || spots.length === 0) {
        console.warn(`⚠️ Маршрут ${route.id} не має spots ні на верхньому рівні, ні в freight:`, {
          id: route.id,
          hasSpots: !!route.spots,
          spotsLength: route.spots?.length || 0,
          hasFreight: !!route.freight,
          freightHasSpots: !!(route.freight as any)?.spots,
          freightSpotsLength: (route.freight as any)?.spots?.length || 0,
          routeKeys: Object.keys(route),
          freightKeys: route.freight ? Object.keys(route.freight) : []
        });
        throw new Error(`Маршрут ${route.id} не має валідних spots`);
      } else {
        console.log(`✅ Маршрут ${route.id} використовує freight.spots (${spots.length} точок)`);
      }
    }

    const origin = spots[0];
    const destination = spots[spots.length - 1];

    // Перевіряємо структуру origin та destination
    if (!origin?.place?.address || !destination?.place?.address) {
      console.warn(`⚠️ Маршрут ${route.id} має невалідну структуру spots:`, { 
        origin: {
          hasPlace: !!origin?.place,
          hasAddress: !!origin?.place?.address,
          address: origin?.place?.address
        }, 
        destination: {
          hasPlace: !!destination?.place,
          hasAddress: !!destination?.place?.address,
          address: destination?.place?.address
        },
        allSpots: spots.map((spot, i) => ({
          index: i,
          hasPlace: !!spot.place,
          hasAddress: !!spot.place?.address,
          locality: spot.place?.address?.locality
        }))
      });
      throw new Error(`Маршрут ${route.id} має невалідну структуру spots`);
    }

    // Перевіряємо координати
    if (!origin?.place?.coordinates || !destination?.place?.coordinates) {
      console.warn(`⚠️ Маршрут ${route.id} не має координат:`, { 
        originCoords: origin?.place?.coordinates, 
        destCoords: destination?.place?.coordinates,
        originPlace: origin?.place,
        destPlace: destination?.place
      });
      throw new Error(`Маршрут ${route.id} не має валідних координат`);
    }

    return {
      id: route.id,
      origin: `${origin.place.address.locality}, ${origin.place.address.country}`,
      destination: `${destination.place.address.locality}, ${destination.place.address.country}`,
      distance: route.route?.distance || 0,
      capacity: route.freight?.capacity || 0,
      price: route.price?.value || null,
      currency: route.price?.currency || 'EUR',
      company: route.company?.legal_name || 'Unknown',
      cachedAt: Date.now(),
      coordinates: {
        origin: {
          lat: origin.place.coordinates.latitude,
          lng: origin.place.coordinates.longitude
        },
        destination: {
          lat: destination.place.coordinates.latitude,
          lng: destination.place.coordinates.longitude
        }
      }
    };
  }

  private async addToRouteIndex(routeId: string): Promise<void> {
    const indexKey = this.getRoutesIndexKey();
    const existingIds = await this.getRouteIds();
    
    if (!existingIds.includes(routeId)) {
      existingIds.push(routeId);
      await this.client.set(indexKey, JSON.stringify(existingIds));
    }
  }

  private async removeFromRouteIndex(routeId: string): Promise<void> {
    const indexKey = this.getRoutesIndexKey();
    const existingIds = await this.getRouteIds();
    
    const filteredIds = existingIds.filter(id => id !== routeId);
    await this.client.set(indexKey, JSON.stringify(filteredIds));
  }

  private async getRouteIds(): Promise<string[]> {
    const indexKey = this.getRoutesIndexKey();
    const data = await this.client.get(indexKey);
    
    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}