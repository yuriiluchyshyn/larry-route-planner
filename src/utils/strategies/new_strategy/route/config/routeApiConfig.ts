/**
 * Route API Configuration
 * Конфігурація для RouteApiService
 */

export interface RouteApiConfig {
  // API Endpoints
  endpoints: {
    freightOffers: string;
    health: string;
  };
  
  // Default Request Parameters
  defaults: {
    limit: number;
    batchSize: number;
    defaultRadius: number;
    placesMatchingType: 'cross' | 'exact';
    excludeSuspended: boolean;
  };
  
  // Sort Configuration
  sort: {
    field: string;
    order: 'asc' | 'desc';
  };
  
  // Proxy Configuration
  proxy: {
    defaultPort: number;
    baseUrl: string;
    healthCheckTimeout: number;
    requestTimeout: number;
  };
  
  // Request Configuration
  request: {
    counters: string[];
    headers: {
      accept: string;
    };
  };
  
  // Error Messages
  messages: {
    proxyUnavailable: string;
    connectionError: string;
    proxyStartCommand: string;
    proxyNotAvailable: string;
    failedToFetch: string;
    failedToSearch: string;
    failedToScan: string;
  };
  
  // Logging Configuration
  logging: {
    enableDebug: boolean;
    logRequests: boolean;
    logResponses: boolean;
  };
}

/**
 * Default Route API Configuration
 */
export const DEFAULT_ROUTE_API_CONFIG: RouteApiConfig = {
  // API Endpoints
  endpoints: {
    freightOffers: '/app/exchange/api/rest/v2/freight-offers',
    health: '/health'
  },
  
  // Default Request Parameters
  defaults: {
    limit: 1000,           // Максимальна кількість результатів
    batchSize: 100,        // Розмір батчу для сканування
    defaultRadius: 50,     // Радіус пошуку за замовчуванням (км)
    placesMatchingType: 'cross',  // Тип співставлення місць
    excludeSuspended: true // Виключати призупинені пропозиції
  },
  
  // Sort Configuration
  sort: {
    field: 'index',        // Поле для сортування
    order: 'desc'          // Порядок сортування
  },
  
  // Proxy Configuration
  proxy: {
    defaultPort: 8848,                    // Порт проксі за замовчуванням
    baseUrl: 'http://localhost:8848',     // Базовий URL проксі
    healthCheckTimeout: 5000,             // Таймаут перевірки здоров'я (мс)
    requestTimeout: 30000                 // Таймаут запиту (мс)
  },
  
  // Request Configuration
  request: {
    counters: ['all'],     // Лічильники для запиту
    headers: {
      accept: 'application/json'
    }
  },
  
  // Error Messages
  messages: {
    proxyUnavailable: '❌ Проксі-сервер недоступний. Запустіть його командою: npm run start:proxy',
    connectionError: '❌ Помилка перевірки підключення',
    proxyStartCommand: 'npm run start:proxy',
    proxyNotAvailable: 'Proxy server is not available',
    failedToFetch: 'Failed to fetch routes',
    failedToSearch: 'Failed to search routes',
    failedToScan: 'Failed to scan routes'
  },
  
  // Logging Configuration
  logging: {
    enableDebug: true,     // Увімкнути debug логування
    logRequests: true,     // Логувати запити
    logResponses: false    // Логувати відповіді (може бути багато даних)
  }
};

/**
 * Отримати конфігурацію Route API
 */
export function getRouteApiConfig(customConfig?: Partial<RouteApiConfig>): RouteApiConfig {
  if (!customConfig) {
    return DEFAULT_ROUTE_API_CONFIG;
  }
  
  return {
    endpoints: {
      ...DEFAULT_ROUTE_API_CONFIG.endpoints,
      ...customConfig.endpoints
    },
    defaults: {
      ...DEFAULT_ROUTE_API_CONFIG.defaults,
      ...customConfig.defaults
    },
    sort: {
      ...DEFAULT_ROUTE_API_CONFIG.sort,
      ...customConfig.sort
    },
    proxy: {
      ...DEFAULT_ROUTE_API_CONFIG.proxy,
      ...customConfig.proxy
    },
    request: {
      ...DEFAULT_ROUTE_API_CONFIG.request,
      ...customConfig.request
    },
    messages: {
      ...DEFAULT_ROUTE_API_CONFIG.messages,
      ...customConfig.messages
    },
    logging: {
      ...DEFAULT_ROUTE_API_CONFIG.logging,
      ...customConfig.logging
    }
  };
}

/**
 * Валідація конфігурації
 */
export function validateRouteApiConfig(config: RouteApiConfig): boolean {
  // Перевіряємо обов'язкові поля
  if (!config.endpoints.freightOffers) {
    console.error('❌ RouteApiConfig: freightOffers endpoint is required');
    return false;
  }
  
  if (config.defaults.limit <= 0) {
    console.error('❌ RouteApiConfig: limit must be greater than 0');
    return false;
  }
  
  if (config.defaults.batchSize <= 0) {
    console.error('❌ RouteApiConfig: batchSize must be greater than 0');
    return false;
  }
  
  if (config.proxy.defaultPort <= 0 || config.proxy.defaultPort > 65535) {
    console.error('❌ RouteApiConfig: proxy port must be between 1 and 65535');
    return false;
  }
  
  return true;
}

/**
 * Приклад кастомної конфігурації
 */
export const EXAMPLE_CUSTOM_CONFIG: Partial<RouteApiConfig> = {
  defaults: {
    limit: 500,           // Менший ліміт для швидших запитів
    batchSize: 50,        // Менший батч для економії пам'яті
    defaultRadius: 30,    // Менший радіус для точнішого пошуку
    placesMatchingType: 'exact',  // Точне співставлення
    excludeSuspended: true
  },
  proxy: {
    defaultPort: 9000,    // Інший порт
    baseUrl: 'http://localhost:9000',
    healthCheckTimeout: 3000,
    requestTimeout: 20000
  },
  logging: {
    enableDebug: false,   // Вимкнути debug в продакшені
    logRequests: false,
    logResponses: false
  }
};