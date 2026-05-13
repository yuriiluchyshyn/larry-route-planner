/**
 * Proxy Configuration
 * Конфігурація проксі-сервера для усунення CORS та 502 помилок
 */

import { API_CONFIG } from '../config/apiConfig';

export interface ProxyConfig {
  port: number;
  target: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
  bearerToken?: string; // Додаємо поле для токена
  cors: {
    origin: string[];
    methods: string[];
    allowedHeaders: string[];
  };
}

export interface ProxyRoute {
  path: string;
  target: string;
  changeOrigin: boolean;
  pathRewrite?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Дефолтна конфігурація проксі
 */
export const defaultProxyConfig: ProxyConfig = {
  port: 8848, // Змінено з 7740 на 8848
  target: 'https://api-platform.trans.eu', // Виправлено домен!
  timeout: 30000, // 30 секунд
  retries: 3,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru,de=0.9,en=0.8,it=0.7,pl=0.6,uk=0.5',
    'Cache-Control': 'no-cache'
  },
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:7740', // Додано порт для Vite
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:7740' // Додано порт для Vite
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control'
    ]
  }
};

/**
 * Маршрути проксі для Trans.eu API
 */
export const proxyRoutes: ProxyRoute[] = [
  {
    path: '/api/trans',
    target: API_CONFIG.GEOCODER_BASE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/trans': ''
    },
    headers: {
      'Host': 'api-platform.trans.eu',
      'Origin': 'https://platform.trans.eu',
      'Referer': 'https://platform.trans.eu/'
    }
  },
  {
    path: '/api/freight-offers',
    target: `${API_CONFIG.GEOCODER_BASE_URL}/app/exchange/api/rest/v2`,
    changeOrigin: true,
    pathRewrite: {
      '^/api/freight-offers': '/freight-offers'
    }
  }
];

/**
 * Конфігурація для різних середовищ
 */
export const environmentConfigs = {
  development: {
    ...defaultProxyConfig,
    port: 8848, // Змінено з 7740 на 8848
    target: 'https://api-platform.trans.eu' // Виправлено домен!
  },
  
  production: {
    ...defaultProxyConfig,
    port: 8080,
    target: 'https://api-platform.trans.eu', // Виправлено домен!
    timeout: 60000
  },
  
  testing: {
    ...defaultProxyConfig,
    port: 7741,
    target: 'http://localhost:3001' // Mock server для тестів
  }
};

/**
 * Отримати конфігурацію для поточного середовища
 */
export function getProxyConfig(env: 'development' | 'production' | 'testing' = 'development'): ProxyConfig {
  return environmentConfigs[env];
}

/**
 * Валідація конфігурації проксі
 */
export function validateProxyConfig(config: ProxyConfig): boolean {
  if (!config.port || config.port < 1000 || config.port > 65535) {
    console.error('❌ Невірний порт проксі:', config.port);
    return false;
  }

  if (!config.target || !config.target.startsWith('http')) {
    console.error('❌ Невірний target URL:', config.target);
    return false;
  }

  if (!config.timeout || config.timeout < 1000) {
    console.error('❌ Невірний timeout:', config.timeout);
    return false;
  }

  return true;
}

/**
 * Створити URL для проксі запиту
 */
export function createProxyUrl(
  endpoint: string, 
  params?: Record<string, any>,
  proxyHost: string = API_CONFIG.PROXY_BASE_URL
): string {
  const baseUrl = `${proxyHost}/api/trans`;
  const url = new URL(endpoint, baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          url.searchParams.append(key, JSON.stringify(value));
        } else {
          url.searchParams.append(key, value.toString());
        }
      }
    });
  }
  
  return url.toString();
}

/**
 * Створити фільтр для Trans.eu API з покращеною фільтрацією
 */
export function createTranseuFilter(params: {
  loadingPlace?: {
    country?: string;
    locality?: string;
    postalCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      range?: number;  // радіус в координатах
    };
  };
  unloadingPlace?: {
    country?: string;
    locality?: string;
    postalCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
      range?: number;  // радіус в координатах
    };
  };
  excludeSuspended?: boolean;
  placesMatchingType?: 'cross' | 'pairs';
  minCapacity?: number;
  maxCapacity?: number;
  minWeight?: number;
  maxWeight?: number;
  defaultRadius?: number;  // радіус за замовчуванням
  vehicleSizes?: string[];  // розміри транспорту
  requiredVehicleSizes?: string[];  // обов'язкові розміри транспорту
}): string {
  const filter: any = {
    exclude_suspended: params.excludeSuspended ?? true,
    places_matching_type: params.placesMatchingType ?? 'cross'
  };

  // Фільтр по місцю завантаження
  if (params.loadingPlace) {
    const loadingFilter: any = {
      address: {}
    };

    if (params.loadingPlace.country) {
      loadingFilter.address.country = [params.loadingPlace.country];
    }
    
    if (params.loadingPlace.locality) {
      loadingFilter.address.locality = params.loadingPlace.locality;
    }
    
    if (params.loadingPlace.postalCode) {
      loadingFilter.address.postal_code = params.loadingPlace.postalCode;
    }

    // Додаємо координати з радіусом (якщо є)
    if (params.loadingPlace.coordinates) {
      const radius = params.loadingPlace.coordinates.range || params.defaultRadius || 50;
      loadingFilter.coordinates = {
        latitude: params.loadingPlace.coordinates.latitude,
        longitude: params.loadingPlace.coordinates.longitude,
        range: radius
      };
    }

    // Тільки додаємо фільтр якщо є хоча б один параметр
    if (Object.keys(loadingFilter.address).length > 0 || loadingFilter.coordinates) {
      filter.loading_place = [loadingFilter];
    }
  }

  // Фільтр по місцю розвантаження
  if (params.unloadingPlace) {
    const unloadingFilter: any = {
      address: {}
    };

    if (params.unloadingPlace.country) {
      unloadingFilter.address.country = [params.unloadingPlace.country];
    }
    
    if (params.unloadingPlace.locality) {
      unloadingFilter.address.locality = params.unloadingPlace.locality;
    }
    
    if (params.unloadingPlace.postalCode) {
      unloadingFilter.address.postal_code = params.unloadingPlace.postalCode;
    }

    // Додаємо координати з радіусом (якщо є)
    if (params.unloadingPlace.coordinates) {
      const radius = params.unloadingPlace.coordinates.range || params.defaultRadius || 50;
      unloadingFilter.coordinates = {
        latitude: params.unloadingPlace.coordinates.latitude,
        longitude: params.unloadingPlace.coordinates.longitude,
        range: radius
      };
    }

    // Тільки додаємо фільтр якщо є хоча б один параметр
    if (Object.keys(unloadingFilter.address).length > 0 || unloadingFilter.coordinates) {
      filter.unloading_place = [unloadingFilter];
    }
  }

  // Фільтри по розмірах транспорту
  if (params.vehicleSizes && params.vehicleSizes.length > 0) {
    filter.size = params.vehicleSizes;
  }

  if (params.requiredVehicleSizes && params.requiredVehicleSizes.length > 0) {
    filter.required_vehicle_size = params.requiredVehicleSizes;
  }

  // Фільтри по вантажопідйомності
  if (params.minCapacity !== undefined || params.maxCapacity !== undefined) {
    filter.freight = {};
    
    if (params.minCapacity !== undefined) {
      filter.freight.capacity_from = params.minCapacity;
    }
    
    if (params.maxCapacity !== undefined) {
      filter.freight.capacity_to = params.maxCapacity;
    }
  }

  // Фільтри по вазі
  if (params.minWeight !== undefined || params.maxWeight !== undefined) {
    if (!filter.freight) filter.freight = {};
    
    if (params.minWeight !== undefined) {
      filter.freight.weight_from = params.minWeight;
    }
    
    if (params.maxWeight !== undefined) {
      filter.freight.weight_to = params.maxWeight;
    }
  }

  const filterString = JSON.stringify(filter);
  console.log('🔧 Створений фільтр:', filterString);
  
  return filterString;
}

/**
 * Створити параметри сортування
 */
export function createSortParams(field: string = 'index', order: 'asc' | 'desc' = 'desc'): string {
  return JSON.stringify({
    field,
    order
  });
}

/**
 * Обробник помилок проксі
 */
export class ProxyErrorHandler {
  static handle502Error(error: any): string {
    console.error('🚫 502 Bad Gateway Error:', error);
    
    const suggestions = [
      '1. Перевірте чи запущений проксі-сервер на порту 7740',
      '2. Перевірте підключення до інтернету',
      '3. Можливо Trans.eu API тимчасово недоступний',
      '4. Перевірте правильність API ключа',
      '5. Спробуйте перезапустити проксі-сервер'
    ];

    return `❌ Помилка проксі-сервера:\n${suggestions.join('\n')}`;
  }

  static handleCorsError(error: any): string {
    console.error('🚫 CORS Error:', error);
    
    return `❌ CORS помилка. Переконайтесь що:
1. Проксі-сервер запущений
2. Frontend додаток запущений на дозволеному домені
3. Правильно налаштовані CORS заголовки`;
  }

  static handleTimeoutError(error: any): string {
    console.error('⏰ Timeout Error:', error);
    
    return `⏰ Timeout помилка. Спробуйте:
1. Збільшити timeout в конфігурації
2. Перевірити швидкість інтернету
3. Повторити запит пізніше`;
  }
}

/**
 * Утиліти для роботи з проксі
 */
export class ProxyUtils {
  /**
   * Перевірити доступність проксі-сервера
   */
  static async checkProxyHealth(proxyUrl: string = 'http://localhost:8848'): Promise<boolean> { // Змінено з 7740 на 8848
    try {
      const response = await fetch(`${proxyUrl}/health`, {
        method: 'GET',
        timeout: 5000
      } as any);
      
      return response.ok;
    } catch (error) {
      console.error('❌ Проксі-сервер недоступний:', error);
      return false;
    }
  }

  /**
   * Отримати статус проксі-сервера
   */
  static async getProxyStatus(proxyUrl: string = 'http://localhost:8848'): Promise<{ // Змінено з 7740 на 8848
    status: 'online' | 'offline';
    uptime?: number;
    requests?: number;
    errors?: number;
  }> {
    try {
      const response = await fetch(`${proxyUrl}/status`, {
        method: 'GET',
        timeout: 5000
      } as any);
      
      if (response.ok) {
        const data = await response.json();
        return { status: 'online', ...data };
      }
      
      return { status: 'offline' };
    } catch (error) {
      return { status: 'offline' };
    }
  }

  /**
   * Перезапустити проксі-сервер (якщо підтримується)
   */
  static async restartProxy(proxyUrl: string = 'http://localhost:8848'): Promise<boolean> { // Змінено з 7740 на 8848
    try {
      const response = await fetch(`${proxyUrl}/restart`, {
        method: 'POST',
        timeout: 10000
      } as any);
      
      return response.ok;
    } catch (error) {
      console.error('❌ Не вдалося перезапустити проксі:', error);
      return false;
    }
  }
}