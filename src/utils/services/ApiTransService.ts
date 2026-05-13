/**
 * ApiTransService
 * Сервіс для комунікації зі всіма ендпоінтами Trans API
 * Не містить бізнес-логіки, тільки додає auth токен і викликає проксі для запитів
 */

import { ProxyClient, createProxyClient } from '../strategies/new_strategy/route/proxy/proxyClient';
import { getBearerTokenFromStorage } from '../../services/tokenService';
import { getRouteApiConfig, type RouteApiConfig } from '../strategies/new_strategy/route/config/routeApiConfig';

export interface ApiTransResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface ApiTransRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  targetBaseUrl?: string; // Додаємо можливість вказати інший базовий URL
}

// Типи для геокодування
export interface GeocodeRequest {
  country?: string;
  postalCode?: string;
  locality?: string;
}

export interface GeocodeResponse {
  latitude: number;
  longitude: number;
  address: {
    country?: string;
    postalCode?: string;
    locality?: string;
  };
}

// Типи для пошуку локацій
export interface LocationSearchRequest {
  search: string;
  lang?: string;
  filter?: {
    type?: string[];
  };
  offset?: number;
  limit?: number;
}

export interface LocationItem {
  geocoderId: string;
  geocoderDetailedId?: string | null;
  country: string;
  type: string;
  countryName?: string | null;
  admin1?: string | null;
  locality?: string | null;
  district?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  originalNames?: {
    countryName?: string | null;
    admin1?: string | null;
    locality?: string | null;
    district?: string | null;
  };
  latitude: number;
  longitude: number;
  bbox?: number[][];
  radius?: number;
  locationId: number;
  detailedLocationId?: number | null;
  timezone?: string;
}

export interface LocationSearchResponse {
  page_count: number;
  total_items: number;
  page: number;
  page_size: number;
  _embedded: {
    locations: LocationItem[];
  };
}

/**
 * Сервіс для роботи з Trans API
 */
export class ApiTransService {
  private proxyClient: ProxyClient;
  private authToken?: string;
  private config: RouteApiConfig;

  constructor(proxyPort: number = 8848, authToken?: string, customConfig?: Partial<RouteApiConfig>) {
    // Ініціалізуємо конфігурацію
    this.config = getRouteApiConfig(customConfig);
    
    this.proxyClient = createProxyClient(proxyPort, authToken);
    this.authToken = authToken;
    
    console.log(`🔧 ApiTransService initialized with proxyPort: ${proxyPort}, hasAuthToken: ${!!authToken}`);
  }

  /**
   * Встановити токен автентифікації
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.proxyClient.setAuthToken(token);
  }

  /**
   * Отримати поточний токен автентифікації
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  /**
   * Автоматично отримати токен з localStorage
   */
  loadTokenFromStorage(): boolean {
    const token = getBearerTokenFromStorage();
    if (token) {
      this.setAuthToken(token);
      return true;
    }
    return false;
  }

  /**
   * Перевірити доступність проксі-сервера
   */
  async checkHealth(): Promise<boolean> {
    return await this.proxyClient.checkHealth();
  }

  /**
   * Базовий метод для виконання запитів до Trans API
   */
  async makeRequest<T = any>(
    endpoint: string, 
    options: ApiTransRequestOptions = {}
  ): Promise<ApiTransResponse<T>> {
    const { method = 'GET', params = {}, targetBaseUrl } = options;

    // Автоматично завантажуємо токен якщо він відсутній
    if (!this.authToken) {
      this.loadTokenFromStorage();
    }

    try {
      const response = await this.proxyClient.makeRequest(
        endpoint,
        params,
        method,
        targetBaseUrl // Передаємо targetBaseUrl до proxyClient
      );

      return response as ApiTransResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
   /**
   * Отримати поточну конфігурацію
   */
  getConfig(): RouteApiConfig {
    return this.config;
  }
}

/**
 * Створити екземпляр ApiTransService
 */
export function createApiTransService(proxyPort?: number, authToken?: string): ApiTransService {
  return new ApiTransService(proxyPort, authToken);
}

/**
 * Глобальний екземпляр ApiTransService (singleton)
 */
let globalApiTransService: ApiTransService | null = null;

/**
 * Отримати глобальний екземпляр ApiTransService
 */
export function getApiTransService(): ApiTransService {
  if (!globalApiTransService) {
    globalApiTransService = new ApiTransService();
    // Автоматично завантажуємо токен з localStorage
    globalApiTransService.loadTokenFromStorage();
  }
  return globalApiTransService;
}

/**
 * Встановити глобальний екземпляр ApiTransService
 */
export function setApiTransService(service: ApiTransService): void {
  globalApiTransService = service;
}