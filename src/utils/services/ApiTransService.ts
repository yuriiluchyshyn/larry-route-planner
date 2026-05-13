/**
 * ApiTransService
 * Сервіс для комунікації зі всіма ендпоінтами Trans API
 * Не містить бізнес-логіки, тільки додає auth токен і викликає проксі для запитів
 */

import { ProxyClient, createProxyClient } from '../strategies/new_strategy/route/proxy/proxyClient';
import { API_CONFIG, TRANSEU_CONFIG } from '../strategies/new_strategy/route/config/apiConfig';
import { getBearerTokenFromStorage } from '../../services/tokenService';
// import { getOptimizationConfig } from '../strategies/new_strategy/route/config/optimizationConfig';
import { getRouteApiConfig, type RouteApiConfig } from '../strategies/new_strategy/route/config/routeApiConfig';
import type { 
  RouteData, 
  FreightOffersResponse 
} from '../strategies/new_strategy/models/routeModels';
import type { 
  ApiRequestParams, 
  RouteSearchParams, 
  ApiStats 
} from '../strategies/new_strategy/models/apiModels';

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
  private geocodeCache: Map<string, any> = new Map(); // Кеш для геокодування

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

  // ============================================================
  // FREIGHT OFFERS API (перенесено з routeApiService.ts)
  // ============================================================

  /**
   * Отримати всі доступні маршрути з покращеною фільтрацією та автоматичною пагінацією
  //  */
  // async getAllRoutes(params?: ApiRequestParams & { 
  //   vehicleTypes?: string[]; 
  //   placesMatchingType?: 'cross' | 'exact' 
  // }): Promise<FreightOffersResponse> {
  //   try {
  //     // Перевіряємо підключення до проксі
  //     const isConnected = await this.checkHealth();
  //     if (!isConnected) {
  //       throw new Error(this.config.messages.proxyNotAvailable);
  //     }

  //     // Перевіряємо токен
  //     if (!this.authToken) {
  //       console.warn('⚠️ Токен відсутній, спробуємо завантажити з localStorage');
  //       this.loadTokenFromStorage();
  //     }
      
  //     if (!this.authToken) {
  //       throw new Error('Відсутній токен автентифікації. Увійдіть через розширення браузера.');
  //     }
      
  //     console.log('🔑 Використовуємо токен:', this.authToken.substring(0, 20) + '...');

  //     if (this.config.logging.logRequests) {
  //       console.log('🔍 ApiTransService.getAllRoutes - отримані параметри:', params);
  //     }

  //     // БЕЗПЕЧНА ПЕРЕВІРКА: вимагаємо фільтри місць
  //     if (!params?.filters?.loadingPlace && !params?.filters?.unloadingPlace) {
  //       console.warn('⚠️ УВАГА: Запит без фільтрів місць! Використовуємо обмежений пошук');
  //       return await this.getSafeDefaultRoutes();
  //     }

  //     // Отримуємо конфігурацію оптимізації для параметрів транспорту
  //     const optimizationConfig = getOptimizationConfig();

  //     // ФОРМУЄМО ПОВНИЙ ЗАПИТ ТУТ (не в проксі) - ТОЧНА КОПІЯ ОРИГІНАЛУ
  //     const filter = await this.createApiFilter({
  //       loadingPlace: params?.filters?.loadingPlace,
  //       unloadingPlace: params?.filters?.unloadingPlace,
  //       vehicleSizes: params?.vehicleTypes || optimizationConfig.vehicle.defaultSizes,
  //       requiredVehicleSizes: params?.vehicleTypes || optimizationConfig.vehicle.requiredSizes,
  //       placesMatchingType: params?.placesMatchingType || this.config.defaults.placesMatchingType
  //     });

  //     console.log('🔍 DEBUG: Параметри для createApiFilter:');
  //     console.log('  - loadingPlace:', params?.filters?.loadingPlace);
  //     console.log('  - unloadingPlace:', params?.filters?.unloadingPlace);
  //     console.log('  - vehicleTypes з params:', params?.vehicleTypes);
  //     console.log('  - defaultSizes з config:', optimizationConfig.vehicle.defaultSizes);
  //     console.log('  - requiredSizes з config:', optimizationConfig.vehicle.requiredSizes);
  //     console.log('🔍 DEBUG: Сформований фільтр для API:', filter);

  //     const sort = JSON.stringify({
  //       field: this.config.sort.field,
  //       order: this.config.sort.order
  //     });

  //     // Готові параметри для проксі (проксі тільки передає їх)
  //     const baseRequestParams = {
  //       filter,
  //       sort,
  //       counters: JSON.stringify(this.config.request.counters)
  //     };

  //     if (this.config.logging.logRequests) {
  //       console.log('🔧 ApiTransService - сформований запит для проксі:', baseRequestParams);
  //     }

  //     // Завантажуємо всі сторінки автоматично
  //     return await this.fetchAllPages(baseRequestParams);

  //   } catch (error) {
  //     console.error('Error fetching routes:', error);
  //     throw error;
  //   }
  // }

  /**
   * Отримати безпечні дефолтні маршрути (обмежена кількість)
   */
  // private async getSafeDefaultRoutes(): Promise<FreightOffersResponse> {
  //   console.log('🔒 Завантаження безпечних дефолтних маршрутів...');
    
  //   const baseRequestParams = {
  //     filter: JSON.stringify({
  //       exclude_suspended: this.config.defaults.excludeSuspended,
  //       size: ["2_double_trailer", "3_lorry", "5_solo"],
  //       required_vehicle_size: ["2_double_trailer", "3_lorry", "5_solo"]
  //     }),
  //     sort: JSON.stringify({
  //       field: this.config.sort.field,
  //       order: this.config.sort.order
  //     }),
  //     counters: JSON.stringify(this.config.request.counters)
  //   };

  //   return await this.fetchLimitedResults(baseRequestParams, 500);
  // }

  /**
   * Завантажити всі сторінки результатів автоматично з обмеженнями безпеки
   */
  private async fetchAllPages(baseParams: any): Promise<FreightOffersResponse> {
    const allOffers: any[] = [];
    let currentPage = 0;
    let totalResults = 0;
    let hasMorePages = true;
    const pageSize = 20; // Стандартний розмір сторінки Trans.eu
    const MAX_PAGES = 500; // ОБМЕЖЕННЯ: максимум 500 сторінок (10,000 результатів)
    const MAX_RESULTS = 10000; // ОБМЕЖЕННЯ: максимум 10,000 результатів

    console.log('📄 Початок автоматичного завантаження сторінок з обмеженнями безпеки...');
    console.log(`⚠️ Максимум: ${MAX_PAGES} сторінок або ${MAX_RESULTS} результатів`);

    // ПЕРЕВІРКА БЕЗПЕКИ: чи є конкретні фільтри місць
    const filterObj = JSON.parse(baseParams.filter || '{}');
    const hasLocationFilters = filterObj.loading_place || filterObj.unloading_place;
    
    console.log('🔍 DEBUG: Перевірка фільтрів безпеки:');
    console.log('  - baseParams.filter:', baseParams.filter);
    console.log('  - filterObj:', filterObj);
    console.log('  - hasLocationFilters:', hasLocationFilters);
    console.log('  - loading_place:', filterObj.loading_place);
    console.log('  - unloading_place:', filterObj.unloading_place);
    
    if (!hasLocationFilters) {
      console.warn('⚠️ УВАГА: Запит без фільтрів місць! Обмежуємо до 100 результатів для безпеки');
      const limitedResponse = await this.fetchLimitedResults(baseParams, 100);
      return limitedResponse;
    }
    
    console.log('✅ Фільтри місць знайдено, продовжуємо з повним завантаженням...');

    while (hasMorePages && currentPage < MAX_PAGES) {
      try {
        // Додаємо параметри пагінації
        const requestParams = {
          ...baseParams,
          limit: pageSize,
          offset: currentPage * pageSize
        };

        if (this.config.logging.logRequests) {
          console.log(`📄 Завантажуємо сторінку ${currentPage + 1} (offset: ${currentPage * pageSize})`);
        }

        // Проксі тільки передає готовий запит до Trans.eu
        const response = await this.proxyClient.makeRequest(`/api${this.config.endpoints.freightOffers}`, requestParams);

        if (!response.success) {
          throw new Error(response.error || this.config.messages.failedToFetch);
        }

        const pageData = response.data;
        const pageOffers = pageData._embedded?.['freight-offers'] || [];
        
        // Додаємо пропозиції з поточної сторінки
        allOffers.push(...pageOffers);
        
        // Оновлюємо загальну кількість з першої сторінки
        if (currentPage === 0) {
          totalResults = Math.min(pageData.total || 0, MAX_RESULTS);
          console.log(`📊 Загальна кількість результатів: ${pageData.total || 0} (обмежено до ${totalResults})`);
        }

        console.log(`✅ Сторінка ${currentPage + 1}: завантажено ${pageOffers.length} пропозицій (всього: ${allOffers.length}/${totalResults})`);

        // Перевіряємо чи є ще сторінки та чи не досягли ліміту
        const hasMore = pageOffers.length === pageSize && 
                       allOffers.length < totalResults && 
                       allOffers.length < MAX_RESULTS;
        
        if (!hasMore || pageOffers.length === 0) {
          hasMorePages = false;
          console.log(`🎉 Завантаження завершено! Отримано ${allOffers.length} з ${totalResults} пропозицій`);
        } else {
          currentPage++;
          // Невелика затримка між запитами щоб не перевантажити API
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`❌ Помилка завантаження сторінки ${currentPage + 1}:`, error);
        
        // Якщо це перша сторінка - кидаємо помилку
        if (currentPage === 0) {
          throw error;
        }
        
        // Якщо це не перша сторінка - зупиняємо завантаження і повертаємо що є
        console.warn(`⚠️ Зупиняємо завантаження на сторінці ${currentPage + 1}, повертаємо ${allOffers.length} пропозицій`);
        hasMorePages = false;
      }
    }

    // Попередження якщо досягли ліміту
    if (currentPage >= MAX_PAGES) {
      console.warn(`⚠️ Досягнуто ліміт сторінок (${MAX_PAGES}). Завантажено ${allOffers.length} пропозицій`);
    }

    // Повертаємо результат у форматі FreightOffersResponse
    const firstPageResponse = await this.proxyClient.makeRequest(`/api${this.config.endpoints.freightOffers}`, {
      ...baseParams,
      limit: 1
    });

    const baseResponse = firstPageResponse.success ? firstPageResponse.data : {};

    return {
      ...baseResponse,
      _embedded: {
        'freight-offers': allOffers
      },
      total: Math.min(totalResults, allOffers.length),
      // Оновлюємо лічильники
      counters: {
        ...baseResponse.counters,
        all: allOffers.length
      }
    };
  }

  /**
   * Завантажити обмежену кількість результатів для безпеки
   */
  private async fetchLimitedResults(baseParams: any, maxResults: number): Promise<FreightOffersResponse> {
    console.log(`🔒 Завантаження обмеженої кількості результатів: ${maxResults}`);
    
    const requestParams = {
      ...baseParams,
      limit: Math.min(maxResults, 100), // Максимум 100 за раз
      offset: 0
    };

    const response = await this.proxyClient.makeRequest(`/api${this.config.endpoints.freightOffers}`, requestParams);

    if (!response.success) {
      throw new Error(response.error || this.config.messages.failedToFetch);
    }

    const pageData = response.data;
    const offers = pageData._embedded?.['freight-offers'] || [];
    
    console.log(`🔒 Завантажено ${offers.length} обмежених результатів`);

    return {
      ...pageData,
      _embedded: {
        'freight-offers': offers
      },
      total: offers.length,
      counters: {
        ...pageData.counters,
        all: offers.length
      }
    };
  }

  /**
   * Пошук маршрутів за критеріями з покращеною фільтрацією та автоматичною пагінацією
   */
  // async searchRoutes(searchParams: RouteSearchParams & { 
  //   vehicleTypes?: string[]; 
  //   placesMatchingType?: 'cross' | 'exact' 
  // }): Promise<FreightOffersResponse> {
  //   try {
  //     if (this.config.logging.logRequests) {
  //       console.log('🔍 Пошук маршрутів з параметрами:', searchParams);
  //     }
      
  //     // Отримуємо конфігурацію оптимізації для параметрів транспорту
  //     const optimizationConfig = getOptimizationConfig();
      
  //     // ФОРМУЄМО ПОВНИЙ ЗАПИТ ТУТ - ТОЧНА КОПІЯ ОРИГІНАЛУ
  //     const filter = await this.createApiFilter({
  //       loadingPlace: searchParams.origin ? {
  //         locality: searchParams.origin
  //       } : undefined,
  //       unloadingPlace: searchParams.destination ? {
  //         locality: searchParams.destination
  //       } : undefined,
  //       vehicleSizes: searchParams.vehicleTypes || optimizationConfig.vehicle.defaultSizes,
  //       requiredVehicleSizes: searchParams.vehicleTypes || optimizationConfig.vehicle.requiredSizes,
  //       placesMatchingType: searchParams.placesMatchingType || this.config.defaults.placesMatchingType
  //     });

  //     const sort = JSON.stringify({
  //       field: this.config.sort.field,
  //       order: this.config.sort.order
  //     });

  //     // Готові параметри для проксі
  //     const baseRequestParams = {
  //       filter,
  //       sort,
  //       counters: JSON.stringify(this.config.request.counters)
  //     };

  //     if (this.config.logging.logRequests) {
  //       console.log('🔧 ApiTransService.searchRoutes - сформований запит для проксі:', baseRequestParams);
  //     }

  //     // Завантажуємо всі сторінки автоматично
  //     return await this.fetchAllPages(baseRequestParams);

  //   } catch (error) {
  //     console.error('Error searching routes:', error);
  //     throw error;
  //   }
  // }

  /**
   * Отримати маршрути для сканування (обмежена кількість) з автоматичною пагінацією
   */
  async scanAllRoutes(): Promise<RouteData[]> {
    console.log('🔍 Початок сканування маршрутів через проксі (з обмеженнями безпеки)...');

    try {
      // Перевіряємо підключення до проксі
      const isConnected = await this.checkHealth();
      if (!isConnected) {
        throw new Error(this.config.messages.proxyNotAvailable + '. Please start it first.');
      }

      // БЕЗПЕЧНИЙ запит з обмеженнями - НЕ завантажуємо всі пропозиції
      const baseRequestParams = {
        filter: JSON.stringify({
          exclude_suspended: this.config.defaults.excludeSuspended,
          // Додаємо базові фільтри щоб не завантажувати ВСЕ
          size: ["2_double_trailer", "3_lorry", "5_solo"],
          required_vehicle_size: ["2_double_trailer", "3_lorry", "5_solo"]
        }),
        sort: JSON.stringify({
          field: this.config.sort.field,
          order: this.config.sort.order
        }),
        counters: JSON.stringify(this.config.request.counters)
      };

      console.log('⚠️ УВАГА: Сканування обмежено до 1000 результатів для безпеки');
      
      // Завантажуємо тільки обмежену кількість для сканування
      const response = await this.fetchLimitedResults(baseRequestParams, 1000);
      const routes = response._embedded?.['freight-offers'] || [];
      
      console.log(`🎉 Сканування завершено! Знайдено ${routes.length} маршрутів (обмежено для безпеки)`);
      
      return routes;
    } catch (error) {
      console.error('❌ Помилка під час сканування маршрутів:', error);
      throw error;
    }
  }

  /**
   * Отримати статистику маршрутів
   */
  // async getRoutesStats(): Promise<ApiStats> {
  //   try {
  //     const response = await this.getAllRoutes({ limit: 1 });
  //     return {
  //       total: response.total,
  //       counters: response.counters
  //     };
  //   } catch (error) {
  //     console.error('Error getting routes stats:', error);
  //     throw error;
  //   }
  // }

  /**
   * Отримати пропозицію вантажу за ID
   */
  async getFreightOfferById(offerId: string): Promise<ApiTransResponse> {
    return this.makeRequest(`/api${API_CONFIG.ENDPOINTS.FREIGHT_OFFERS}/${offerId}`, {
      method: 'GET'
    });
  }

  // ============================================================
  // GEOCODER API (перенесено з geocoderService.ts)
  // ============================================================

  /**
   * Пошук локацій за запитом
   */
  async searchLocations(request: LocationSearchRequest): Promise<LocationSearchResponse | null> {
    try {
      console.log('🔍 Пошук локацій:', request);

      // Формуємо параметри запиту відповідно до API Trans.eu
      const params: Record<string, string> = {
        search: request.search, // Використовуємо 'search' замість 'q'
        lang: request.lang || TRANSEU_CONFIG.GEOCODER.DEFAULT_LANG,
        offset: (request.offset || TRANSEU_CONFIG.GEOCODER.DEFAULT_OFFSET).toString(),
        limit: (request.limit || TRANSEU_CONFIG.GEOCODER.DEFAULT_LIMIT).toString()
      };

      // Додаємо фільтр якщо є
      if (request.filter) {
        params.filter = JSON.stringify(request.filter);
      } else {
        // Використовуємо дефолтний фільтр з конфігурації
        params.filter = JSON.stringify({
          type: TRANSEU_CONFIG.GEOCODER.LOCATION_TYPES
        });
      }

      console.log('🔧 Параметри запиту для пошуку локацій:', params);

      // Виконуємо запит через проксі до геокодера
      const response = await this.proxyClient.makeRequest(
        `/api${API_CONFIG.ENDPOINTS.GEOCODER_LOCATIONS}`, 
        params,
        'GET',
        API_CONFIG.GEOCODER_BASE_URL // Використовуємо правильний базовий URL для геокодера
      );

      console.log('🔍 Відповідь пошуку локацій (raw):', response);

      if (!response.success) {
        console.error('❌ Помилка пошуку локацій:', response.error);
        return null;
      }

      console.log('🔍 Відповідь пошуку локацій (data):', response.data);

      // Повертаємо відповідь як є, оскільки вона вже в правильному форматі
      return response.data as LocationSearchResponse;

    } catch (error) {
      console.error('❌ Помилка під час пошуку локацій:', error);
      return null;
    }
  }

  /**
   * Геокодування адреси
   */
  async geocodeAddress(request: GeocodeRequest): Promise<GeocodeResponse | null> {
    try {
      // Формуємо пошуковий запит
      const searchQuery = this.buildSearchQuery(request);
      
      if (!searchQuery) {
        console.warn('⚠️ Неможливо сформувати пошуковий запит з:', request);
        return null;
      }

      console.log('🔍 Геокодування адреси:', searchQuery);

      const params = {
        search: searchQuery, // Використовуємо 'search' замість 'q'
        lang: TRANSEU_CONFIG.GEOCODER.DEFAULT_LANG,
        limit: TRANSEU_CONFIG.GEOCODER.DEFAULT_LIMIT.toString(),
        offset: TRANSEU_CONFIG.GEOCODER.DEFAULT_OFFSET.toString(),
        filter: JSON.stringify({
          type: TRANSEU_CONFIG.GEOCODER.LOCATION_TYPES
        })
      };

      // Виконуємо запит через проксі до геокодера використовуючи ендпоінт з конфігурації
      const response = await this.proxyClient.makeRequest(
        `/api${API_CONFIG.ENDPOINTS.GEOCODER_LOCATIONS}`, 
        params,
        'GET',
        API_CONFIG.GEOCODER_BASE_URL // Передаємо правильний базовий URL для геокодера
      );

      console.log('🔍 Відповідь геокодера (raw):', response);

      if (!response.success) {
        console.error('❌ Помилка геокодування:', response.error);
        return null;
      }

      console.log('🔍 Відповідь геокодера (data):', response.data);

      // Обробляємо відповідь відповідно до формату Trans.eu API
      const locations = response.data?._embedded?.locations || [];
      
      if (locations.length === 0) {
        console.warn('⚠️ Локацію не знайдено для:', searchQuery);
        return null;
      }

      // Беремо першу знайдену локацію
      const location = locations[0];
      
      // В Trans.eu API координати знаходяться безпосередньо в об'єкті location
      if (!location.latitude || !location.longitude) {
        console.warn('⚠️ Координати відсутні в відповіді геокодера:', location);
        return null;
      }

      const result: GeocodeResponse = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: {
          country: location.country,
          postalCode: location.postalCode,
          locality: location.locality
        }
      };

      console.log('✅ Геокодування успішне:', result);
      return result;

    } catch (error) {
      console.error('❌ Помилка під час геокодування:', error);
      return null;
    }
  }

  // ============================================================
  // ДОПОМІЖНІ МЕТОДИ (перенесено з routeApiService.ts та geocoderService.ts)
  // ============================================================

  /**
   * Формування пошукового запиту для геокодування
   */
  private buildSearchQuery(request: GeocodeRequest): string | null {
    // Для Trans.eu API краще шукати за повною адресою в одному рядку
    if (request.country && request.postalCode && request.locality) {
      // Формат: "PL, 80-001, Gdańsk" (як в прикладі користувача)
      return `${request.country}, ${request.postalCode}, ${request.locality}`;
    }

    // Якщо є тільки поштовий код і місто
    if (request.postalCode && request.locality) {
      return `${request.postalCode}, ${request.locality}`;
    }

    // Якщо є тільки місто і країна
    if (request.locality && request.country) {
      return `${request.locality}, ${request.country}`;
    }

    // Якщо є тільки місто
    if (request.locality) {
      return request.locality;
    }

    return null;
  }

  /**
   * Створити ключ для кешу геокодування
   */
  private createGeocodeKey(request: GeocodeRequest): string {
    return `${request.country || ''}:${request.postalCode || ''}:${request.locality || ''}`;
  }

  /**
   * Автоматичне геокодування адреси, якщо координати відсутні
   */
  private async ensureCoordinates(place: any): Promise<any> {
    console.log('🔍 ensureCoordinates: Вхідні дані:', JSON.stringify(place, null, 2));
    
    // Якщо координати вже є, повертаємо як є
    if (place?.coordinates?.latitude && place?.coordinates?.longitude) {
      if (this.config.logging.logRequests) {
        console.log('✅ Координати вже присутні:', place.coordinates);
      }
      return place;
    }

    console.log('⚠️ Координати відсутні, потрібне геокодування');

    // Перевіряємо, чи увімкнено автоматичне геокодування
    if (!TRANSEU_CONFIG.GEOCODER.ENABLE_AUTO_GEOCODING) {
      console.warn('⚠️ Автоматичне геокодування вимкнено в конфігурації');
      return place;
    }

    // Якщо немає адреси, не можемо геокодувати
    if (!place?.address && !place?.extensionAddress && !place?.locality && !place?.country) {
      console.warn('⚠️ Неможливо геокодувати: відсутня адреса');
      return place;
    }

    // Спеціальна обробка для випадку коли є тільки країна (без міста)
    if (!place?.locality && !place?.postalCode && place?.country) {
      console.log('🌍 Використовуємо координати центру країни для:', place.country);
      const countryCoords = this.getCountryCoordinates(place.country);
      const finalRange = place.range || TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;
      
      const coordinatesWithRange = {
        latitude: countryCoords.lat,
        longitude: countryCoords.lon,
        range: finalRange
      };

      // Зберігаємо в кеш
      const cacheKey = this.createGeocodeKey(place);
      this.geocodeCache.set(cacheKey, coordinatesWithRange);
      
      const result = {
        ...place,
        coordinates: coordinatesWithRange
      };
      
      console.log('🎉 Результат ensureCoordinates (центр країни):', JSON.stringify(result, null, 2));
      return result;
    }

    // Створюємо ключ для кешу
    const cacheKey = this.createGeocodeKey(place);
    
    // Перевіряємо кеш
    if (this.geocodeCache.has(cacheKey)) {
      console.log('💾 Використовуємо закешовані координати для:', cacheKey);
      const cachedResult = this.geocodeCache.get(cacheKey);
      return {
        ...place,
        coordinates: cachedResult
      };
    }

    try {
      console.log('🌍 Автоматичне геокодування для:', place);

      let geocodeRequest: GeocodeRequest;

      // Якщо є extensionAddress (формат "PL, 30-001, Kraków")
      if (place.extensionAddress) {
        const parsed = this.parseExtensionAddress(place.extensionAddress);
        if (parsed) {
          geocodeRequest = parsed;
          console.log('📍 Парсинг Extension адреси:', parsed);
        } else {
          throw new Error(`Не вдалося парсити адресу Extension: ${place.extensionAddress}`);
        }
      } 
      // Якщо є стандартна адреса
      else if (place.address) {
        geocodeRequest = {
          country: this.extractCountryCode(place.address.country),
          postalCode: place.address.postal_code,
          locality: place.address.locality
        };
        console.log('📍 Використання стандартної адреси:', geocodeRequest);
      } 
      // Якщо є окремі поля
      else if (place.country || place.locality || place.postalCode) {
        geocodeRequest = {
          country: this.extractCountryCode(place.country),
          postalCode: place.postalCode,
          locality: place.locality
        };
        console.log('📍 Використання окремих полів:', geocodeRequest);
      } else {
        throw new Error('Відсутня адреса для геокодування');
      }

      console.log('🚀 Виконуємо геокодування з запитом:', geocodeRequest);

      // Виконуємо геокодування
      const coordinates = await this.geocodeAddress(geocodeRequest);

      if (coordinates) {
        console.log('✅ Координати отримано через геокодування:', coordinates);
        
        // Використовуємо радіус з place або дефолтний
        const finalRange = place.range || TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;
        console.log('📏 Використовуємо радіус:', finalRange, 'км');
        
        const coordinatesWithRange = {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          range: finalRange
        };

        // Зберігаємо в кеш
        this.geocodeCache.set(cacheKey, coordinatesWithRange);
        
        // Додаємо координати до місця
        const result = {
          ...place,
          coordinates: coordinatesWithRange
        };
        
        console.log('🎉 Результат ensureCoordinates:', JSON.stringify(result, null, 2));
        return result;
      } else {
        const errorMsg = `Не вдалося отримати координати для: ${JSON.stringify(geocodeRequest)}`;
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Помилка геокодування: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Парсинг адреси з Chrome Extension формату "PL, 30-001, Kraków" або "DE, Німеччина"
   */
  private parseExtensionAddress(addressString: string): GeocodeRequest | null {
    if (!addressString || typeof addressString !== 'string') {
      return null;
    }

    // Розділяємо по комі та очищуємо пробіли
    const parts = addressString.split(',').map(part => part.trim());
    
    // Підтримуємо різні формати:
    // "PL, 30-001, Kraków" - повний формат (3 частини)
    // "DE, Німеччина" - тільки країна (2 частини)
    if (parts.length < 2 || parts.length > 3) {
      console.warn('⚠️ Неправильний формат адреси з Extension:', addressString);
      return null;
    }

    let country: string;
    let postalCode: string = '';
    let locality: string = '';

    if (parts.length === 3) {
      // Повний формат: "PL, 30-001, Kraków"
      [country, postalCode, locality] = parts;
    } else {
      // Формат тільки з країною: "DE, Німеччина"
      [country, locality] = parts;
      
      // Перевіряємо чи locality це назва країни
      const countryNames = [
        'Німеччина', 'Germany', 'Deutschland',
        'Польща', 'Poland', 'Polen',
        'Франція', 'France', 'Frankreich',
        'Чехія', 'Czech Republic', 'Tschechien',
        'Австрія', 'Austria', 'Österreich',
        'Словаччина', 'Slovakia', 'Slowakei',
        'Угорщина', 'Hungary', 'Ungarn',
        'Італія', 'Italy', 'Italien',
        'Іспанія', 'Spain', 'Spanien',
        'Нідерланди', 'Netherlands', 'Niederlande',
        'Бельгія', 'Belgium', 'Belgien'
      ];
      
      if (countryNames.includes(locality)) {
        // Якщо це назва країни, очищуємо locality (пошук по всій країні)
        locality = '';
        postalCode = '';
        console.log(`🌍 Extension адреса містить тільки країну: ${country}`);
      }
    }
    
    return {
      country,
      postalCode,
      locality
    };
  }

  /**
   * Витягує код країни з формату Trans.eu
   */
  private extractCountryCode(country?: string | string[]): string | undefined {
    if (!country) return undefined;
    
    // Якщо це масив, беремо перший елемент
    const countryStr = Array.isArray(country) ? country[0] : country;
    
    console.log('🔧 extractCountryCode - вхідний код:', countryStr);
    
    // Якщо це вже двобуквенний код (PL, DE, UA), конвертуємо в Trans.eu формат
    if (countryStr.length === 2 && /^[A-Z]{2}$/.test(countryStr)) {
      const countryMap: { [key: string]: string } = {
        'PL': '47_poland',
        'DE': '21_germany', 
        'UA': '380_ukraine',
        'FR': '19_france', // ВИПРАВЛЕНО
        'CZ': '420_czech_republic',
        'AT': '43_austria',
        'SK': '421_slovakia',
        'HU': '36_hungary',
        'IT': '39_italy',
        'ES': '34_spain',
        'NL': '31_netherlands',
        'BE': '32_belgium'
      };
      const result = countryMap[countryStr] || countryStr;
      console.log('🔧 extractCountryCode - конвертовано з двобуквенного:', countryStr, '→', result);
      return result;
    }
    
    // Якщо це вже формат Trans.eu, повертаємо як є
    if (countryStr.includes('_')) {
      console.log('🔧 extractCountryCode - вже Trans.eu формат:', countryStr);
      return countryStr;
    }
    
    console.log('🔧 extractCountryCode - повертаємо як є:', countryStr);
    return countryStr;
  }

  /**
   * Отримати координати центру країни
   */
  private getCountryCoordinates(countryCode: string): { lat: number; lon: number } {
    // Спочатку конвертуємо в двобуквенний код якщо потрібно
    const twoLetterCode = this.extractCountryCode(countryCode) || countryCode;
    
    const coordinates: { [key: string]: { lat: number; lon: number } } = {
      'PL': { lat: 52.0693, lon: 19.4803 }, // Poland center
      'DE': { lat: 51.1657, lon: 10.4515 }, // Germany center  
      'FR': { lat: 46.6034, lon: 1.8883 },  // France center
      'CZ': { lat: 49.8175, lon: 15.4730 }, // Czech Republic center
      'AT': { lat: 47.5162, lon: 14.5501 }, // Austria center
      'SK': { lat: 48.6690, lon: 19.6990 }, // Slovakia center
      'HU': { lat: 47.1625, lon: 19.5033 }, // Hungary center
      'IT': { lat: 41.8719, lon: 12.5674 }, // Italy center
      'ES': { lat: 40.4637, lon: -3.7492 }, // Spain center
      'NL': { lat: 52.1326, lon: 5.2913 },  // Netherlands center
      'BE': { lat: 50.5039, lon: 4.4699 },  // Belgium center
      'LT': { lat: 55.1694, lon: 23.8813 }, // Lithuania center
      'LV': { lat: 56.8796, lon: 24.6032 }, // Latvia center
      'EE': { lat: 58.5953, lon: 25.0136 }, // Estonia center
      'RO': { lat: 45.9432, lon: 24.9668 }, // Romania center
      'BG': { lat: 42.7339, lon: 25.4858 }, // Bulgaria center
      'HR': { lat: 45.1000, lon: 15.2000 }, // Croatia center
      'SI': { lat: 46.1512, lon: 14.9955 }, // Slovenia center
      'RS': { lat: 44.0165, lon: 21.0059 }, // Serbia center
      'BA': { lat: 43.9159, lon: 17.6791 }, // Bosnia center
      'MK': { lat: 41.6086, lon: 21.7453 }, // North Macedonia center
      'AL': { lat: 41.1533, lon: 20.1683 }, // Albania center
      'ME': { lat: 42.7087, lon: 19.3744 }, // Montenegro center
      'XK': { lat: 42.6026, lon: 20.9030 }  // Kosovo center
    };
    
    return coordinates[twoLetterCode] || { lat: 50.0, lon: 10.0 };
  }

  /**
   * Створити фільтр для API запиту - ТОЧНА КОПІЯ ОРИГІНАЛЬНОГО ЗАПИТУ
   */
  private async createApiFilter(params: {
    loadingPlace?: any;
    unloadingPlace?: any;
    vehicleSizes?: string[];
    requiredVehicleSizes?: string[];
    placesMatchingType?: 'cross' | 'exact';
  }): Promise<string> {
    // Логування вхідних параметрів
    if (this.config.logging.logRequests) {
      console.log('🔧 createApiFilter - вхідні параметри:', {
        loadingPlace: params.loadingPlace,
        unloadingPlace: params.unloadingPlace,
        vehicleSizes: params.vehicleSizes,
        requiredVehicleSizes: params.requiredVehicleSizes
      });
    }

    // Отримуємо радіус пошуку з конфігурації API
    const defaultRadius = TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;

    // Створюємо фільтр в точному порядку як в оригіналі
    const filter: any = {};

    // 1. loading_place (якщо є)
    if (params.loadingPlace) {
      const loadingFilter: any = {
        address: {}
      };

      // address
      if (params.loadingPlace.country) {
        const countryCode = this.extractCountryCode(params.loadingPlace.country);
        loadingFilter.address.country = [countryCode];
      }
      if (params.loadingPlace.locality) {
        loadingFilter.address.locality = params.loadingPlace.locality;
      }
      if (params.loadingPlace.postalCode) {
        loadingFilter.address.postal_code = params.loadingPlace.postalCode;
      }

      // coordinates - тільки якщо є конкретна адреса (не тільки країна)
      if (params.loadingPlace.latitude && params.loadingPlace.longitude) {
        loadingFilter.coordinates = {
          latitude: params.loadingPlace.latitude,
          longitude: params.loadingPlace.longitude,
          range: params.loadingPlace.range || defaultRadius
        };
      } else if (params.loadingPlace.locality || params.loadingPlace.postalCode) {
        // Геокодуємо тільки якщо є місто або поштовий код
        try {
          console.log('🌍 Геокодування loading place...');
          const geocoded = await this.ensureCoordinates(params.loadingPlace);
          if (geocoded.coordinates) {
            loadingFilter.coordinates = geocoded.coordinates;
          }
        } catch (error) {
          console.warn('⚠️ Не вдалося геокодувати loading place:', error);
        }
      }

      filter.loading_place = [loadingFilter];
    }

    // 2. unloading_place (якщо є)
    if (params.unloadingPlace) {
      const unloadingFilter: any = {
        address: {}
      };

      // address
      if (params.unloadingPlace.country) {
        const countryCode = this.extractCountryCode(params.unloadingPlace.country);
        unloadingFilter.address.country = [countryCode];
      }
      if (params.unloadingPlace.locality) {
        unloadingFilter.address.locality = params.unloadingPlace.locality;
      }
      if (params.unloadingPlace.postalCode) {
        unloadingFilter.address.postal_code = params.unloadingPlace.postalCode;
      }

      // КЛЮЧОВА ЛОГІКА: якщо тільки країна без міста - додаємо isCountry: true
      const isCountryOnly = params.unloadingPlace.country && 
                           !params.unloadingPlace.locality && 
                           !params.unloadingPlace.postalCode &&
                           !params.unloadingPlace.latitude &&
                           !params.unloadingPlace.longitude;

      if (isCountryOnly) {
        unloadingFilter.isCountry = true;
        console.log('🌍 Unloading place: тільки країна, додаємо isCountry: true');
      } else {
        // coordinates - тільки якщо є конкретна адреса
        if (params.unloadingPlace.latitude && params.unloadingPlace.longitude) {
          unloadingFilter.coordinates = {
            latitude: params.unloadingPlace.latitude,
            longitude: params.unloadingPlace.longitude,
            range: params.unloadingPlace.range || defaultRadius
          };
        } else if (params.unloadingPlace.locality || params.unloadingPlace.postalCode) {
          // Геокодуємо тільки якщо є місто або поштовий код
          try {
            console.log('🌍 Геокодування unloading place...');
            const geocoded = await this.ensureCoordinates(params.unloadingPlace);
            if (geocoded.coordinates) {
              unloadingFilter.coordinates = geocoded.coordinates;
            }
          } catch (error) {
            console.warn('⚠️ Не вдалося геокодувати unloading place:', error);
          }
        }
      }

      filter.unloading_place = [unloadingFilter];
    }

    // 3. places_matching_type
    filter.places_matching_type = params.placesMatchingType || 'cross';

    // 4. size (ОБОВ'ЯЗКОВО) - ВИПРАВЛЕНІ ТИПИ ТРАНСПОРТУ
    if (params.vehicleSizes && params.vehicleSizes.length > 0) {
      filter.size = params.vehicleSizes;
    } else {
      // Дефолтні типи транспорту як в правильному запиті
      filter.size = ["2_double_trailer", "3_lorry", "5_solo"];
    }

    // 5. required_vehicle_size (ОБОВ'ЯЗКОВО) - ВИПРАВЛЕНІ ТИПИ ТРАНСПОРТУ
    if (params.requiredVehicleSizes && params.requiredVehicleSizes.length > 0) {
      filter.required_vehicle_size = params.requiredVehicleSizes;
    } else {
      // Дефолтні типи транспорту як в правильному запиті
      filter.required_vehicle_size = ["2_double_trailer", "3_lorry", "5_solo"];
    }

    // 6. exclude_suspended (завжди true)
    filter.exclude_suspended = true;

    const filterString = JSON.stringify(filter);
    
    if (this.config.logging.logRequests) {
      console.log('🔧 ApiTransService - створений фільтр (точна копія оригіналу):', filterString);
    }
    
    return filterString;
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