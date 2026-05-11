/**
 * Route API Service
 * Сервіс для роботи з API ендпойнтами маршрутів
 */

import type { 
  RouteData, 
  FreightOffersResponse 
} from '../models/routeModels';
import type { 
  ApiRequestParams, 
  RouteSearchParams, 
  ApiStats 
} from '../models/apiModels';
import { ProxyClient, createProxyClient } from './proxy/proxyClient';
import { getOptimizationConfig } from './config/optimizationConfig';
import { getRouteApiConfig, type RouteApiConfig } from './config/routeApiConfig';
import { TRANSEU_CONFIG } from './config/apiConfig';
import { GeocoderService, geocodeAddress } from './geocoderService';

export class RouteApiService {
  private proxyClient: ProxyClient;
  private config: RouteApiConfig;
  private geocoderService: GeocoderService;
  private geocodeCache: Map<string, any> = new Map(); // Кеш для геокодування

  constructor(baseUrl: string, apiKey?: string, customConfig?: Partial<RouteApiConfig>) {
    // Ініціалізуємо конфігурацію
    this.config = getRouteApiConfig(customConfig);
    
    console.log(`🔧 RouteApiService initialized with baseUrl: ${baseUrl}, hasApiKey: ${!!apiKey}`);
    
    // Ініціалізуємо простий проксі клієнт (тільки для проксування)
    this.proxyClient = createProxyClient(this.config.proxy.defaultPort);
    
    // Ініціалізуємо сервіс геокодування
    this.geocoderService = new GeocoderService(this.proxyClient);
  }

  /**
   * Перевірити доступність API через проксі
   */
  async checkConnection(): Promise<boolean> {
    try {
      const isHealthy = await this.proxyClient.checkHealth();
      if (!isHealthy) {
        console.error(this.config.messages.proxyUnavailable);
        return false;
      }
      return true;
    } catch (error) {
      console.error(this.config.messages.connectionError, error);
      return false;
    }
  }

  /**
   * Отримати всі доступні маршрути з покращеною фільтрацією та автоматичною пагінацією
   */
  async getAllRoutes(params?: ApiRequestParams & { 
    vehicleTypes?: string[]; 
    placesMatchingType?: 'cross' | 'exact' 
  }): Promise<FreightOffersResponse> {
    try {
      // Перевіряємо підключення до проксі
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        throw new Error(this.config.messages.proxyNotAvailable);
      }

      if (this.config.logging.logRequests) {
        console.log('🔍 RouteApiService.getAllRoutes - отримані параметри:', params);
      }

      // Отримуємо конфігурацію оптимізації для параметрів транспорту
      const optimizationConfig = getOptimizationConfig();

      // ФОРМУЄМО ПОВНИЙ ЗАПИТ ТУТ (не в проксі) - ТОЧНА КОПІЯ ОРИГІНАЛУ
      const filter = await this.createApiFilter({
        loadingPlace: params?.filters?.loadingPlace,
        unloadingPlace: params?.filters?.unloadingPlace,
        vehicleSizes: params?.vehicleTypes || optimizationConfig.vehicle.defaultSizes,
        requiredVehicleSizes: params?.vehicleTypes || optimizationConfig.vehicle.requiredSizes,
        placesMatchingType: params?.placesMatchingType || this.config.defaults.placesMatchingType
      });

      const sort = JSON.stringify({
        field: this.config.sort.field,
        order: this.config.sort.order
      });

      // Готові параметри для проксі (проксі тільки передає їх)
      const baseRequestParams = {
        filter,
        sort,
        counters: JSON.stringify(this.config.request.counters)
      };

      if (this.config.logging.logRequests) {
        console.log('🔧 RouteApiService - сформований запит для проксі:', baseRequestParams);
      }

      // Завантажуємо всі сторінки автоматично
      return await this.fetchAllPages(baseRequestParams);

    } catch (error) {
      console.error('Error fetching routes:', error);
      throw error;
    }
  }

  /**
   * Завантажити всі сторінки результатів автоматично
   */
  private async fetchAllPages(baseParams: any): Promise<FreightOffersResponse> {
    const allOffers: any[] = [];
    let currentPage = 0;
    let totalResults = 0;
    let hasMorePages = true;
    const pageSize = 20; // Стандартний розмір сторінки Trans.eu

    console.log('📄 Початок автоматичного завантаження всіх сторінок...');

    while (hasMorePages) {
      try {
        // Додаємо параметри пагінації
        const requestParams = {
          ...baseParams,
          limit: pageSize,
          offset: currentPage * pageSize
        };

        if (this.config.logging.logRequests) {
          console.log(`� Завантажуємо сторінку ${currentPage + 1} (offset: ${currentPage * pageSize})`);
        }

        // Проксі тільки передає готовий запит до Trans.eu
        const response = await this.proxyClient.makeRequest(this.config.endpoints.freightOffers, requestParams);

        if (!response.success) {
          throw new Error(response.error || this.config.messages.failedToFetch);
        }

        const pageData = response.data;
        const pageOffers = pageData._embedded?.['freight-offers'] || [];
        
        // Додаємо пропозиції з поточної сторінки
        allOffers.push(...pageOffers);
        
        // Оновлюємо загальну кількість з першої сторінки
        if (currentPage === 0) {
          totalResults = pageData.total || 0;
          console.log(`📊 Загальна кількість результатів: ${totalResults}`);
        }

        console.log(`✅ Сторінка ${currentPage + 1}: завантажено ${pageOffers.length} пропозицій (всього: ${allOffers.length}/${totalResults})`);

        // Перевіряємо чи є ще сторінки
        const hasMore = pageOffers.length === pageSize && allOffers.length < totalResults;
        
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

    // Повертаємо результат у форматі FreightOffersResponse
    const firstPageResponse = await this.proxyClient.makeRequest(this.config.endpoints.freightOffers, {
      ...baseParams,
      limit: 1
    });

    const baseResponse = firstPageResponse.success ? firstPageResponse.data : {};

    return {
      ...baseResponse,
      _embedded: {
        'freight-offers': allOffers
      },
      total: totalResults,
      // Оновлюємо лічильники
      counters: {
        ...baseResponse.counters,
        all: allOffers.length
      }
    };
  }

  /**
   * Отримати маршрут за ID
   */
  async getRouteById(routeId: string): Promise<RouteData> {
    try {
      const response = await this.proxyClient.makeRequest(`${this.config.endpoints.freightOffers}/${routeId}`, {});

      if (!response.success) {
        throw new Error(response.error || `Failed to fetch route ${routeId}`);
      }

      return response.data;
    } catch (error) {
      console.error(`Error fetching route ${routeId}:`, error);
      throw error;
    }
  }

  /**
   * Пошук маршрутів за критеріями з покращеною фільтрацією та автоматичною пагінацією
   */
  async searchRoutes(searchParams: RouteSearchParams & { 
    vehicleTypes?: string[]; 
    placesMatchingType?: 'cross' | 'exact' 
  }): Promise<FreightOffersResponse> {
    try {
      if (this.config.logging.logRequests) {
        console.log('🔍 Пошук маршрутів з параметрами:', searchParams);
      }
      
      // Отримуємо конфігурацію оптимізації для параметрів транспорту
      const optimizationConfig = getOptimizationConfig();
      
      // ФОРМУЄМО ПОВНИЙ ЗАПИТ ТУТ - ТОЧНА КОПІЯ ОРИГІНАЛУ
      const filter = await this.createApiFilter({
        loadingPlace: searchParams.origin ? {
          locality: searchParams.origin
        } : undefined,
        unloadingPlace: searchParams.destination ? {
          locality: searchParams.destination
        } : undefined,
        vehicleSizes: searchParams.vehicleTypes || optimizationConfig.vehicle.defaultSizes,
        requiredVehicleSizes: searchParams.vehicleTypes || optimizationConfig.vehicle.requiredSizes,
        placesMatchingType: searchParams.placesMatchingType || this.config.defaults.placesMatchingType
      });

      const sort = JSON.stringify({
        field: this.config.sort.field,
        order: this.config.sort.order
      });

      // Готові параметри для проксі
      const baseRequestParams = {
        filter,
        sort,
        counters: JSON.stringify(this.config.request.counters)
      };

      if (this.config.logging.logRequests) {
        console.log('🔧 RouteApiService.searchRoutes - сформований запит для проксі:', baseRequestParams);
      }

      // Завантажуємо всі сторінки автоматично
      return await this.fetchAllPages(baseRequestParams);

    } catch (error) {
      console.error('Error searching routes:', error);
      throw error;
    }
  }

  /**
   * Отримати маршрути для сканування (всі доступні) з автоматичною пагінацією
   */
  async scanAllRoutes(batchSize?: number): Promise<RouteData[]> {
    const actualBatchSize = batchSize || this.config.defaults.batchSize;
    console.log('🔍 Початок сканування всіх маршрутів через проксі...');

    try {
      // Перевіряємо підключення до проксі
      const isConnected = await this.checkConnection();
      if (!isConnected) {
        throw new Error(this.config.messages.proxyNotAvailable + '. Please start it first.');
      }

      // Використовуємо простий запит без фільтрів для сканування всіх маршрутів
      const baseRequestParams = {
        filter: JSON.stringify({
          exclude_suspended: this.config.defaults.excludeSuspended
        }),
        sort: JSON.stringify({
          field: this.config.sort.field,
          order: this.config.sort.order
        }),
        counters: JSON.stringify(this.config.request.counters)
      };

      // Завантажуємо всі сторінки автоматично
      const response = await this.fetchAllPages(baseRequestParams);
      const routes = response._embedded?.['freight-offers'] || [];
      
      console.log(`🎉 Сканування завершено! Знайдено ${routes.length} маршрутів`);
      
      // Логування структури першого маршруту для діагностики
      if (routes.length > 0) {
        const firstRoute = routes[0];
        console.log('🔍 Структура першого маршруту:', {
          id: firstRoute.id,
          hasRoute: !!firstRoute.route,
          routeKeys: firstRoute.route ? Object.keys(firstRoute.route) : 'N/A',
          hasSpots: !!firstRoute.spots,
          spotsLength: firstRoute.spots?.length || 0,
          hasFreight: !!firstRoute.freight,
          freightKeys: firstRoute.freight ? Object.keys(firstRoute.freight) : 'N/A',
          hasPrice: !!firstRoute.price,
          priceKeys: firstRoute.price ? Object.keys(firstRoute.price) : 'N/A'
        });
      }
      
      return routes;
    } catch (error) {
      console.error('❌ Помилка під час сканування маршрутів:', error);
      throw error;
    }
  }

  /**
   * Отримати статистику маршрутів
   */
  async getRoutesStats(): Promise<ApiStats> {
    try {
      const response = await this.getAllRoutes({ limit: 1 });
      return {
        total: response.total,
        counters: response.counters
      };
    } catch (error) {
      console.error('Error getting routes stats:', error);
      throw error;
    }
  }

  /**
   * Парсинг адреси з Chrome Extension формату "PL, 30-001, Kraków" або "DE, Німеччина"
   */
  private parseExtensionAddress(addressString: string): { country: string; postalCode: string; locality: string } | null {
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

    let countryCode: string;
    let postalCode: string = '';
    let locality: string = '';

    if (parts.length === 3) {
      // Повний формат: "PL, 30-001, Kraków"
      [countryCode, postalCode, locality] = parts;
    } else {
      // Формат тільки з країною: "DE, Німеччина"
      [countryCode, locality] = parts;
      
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
        console.log(`🌍 Extension адреса містить тільки країну: ${countryCode}`);
      }
    }
    
    // Конвертуємо двобуквенний код країни в формат Trans.eu якщо потрібно
    const countryMap: { [key: string]: string } = {
      'PL': 'PL',
      'DE': 'DE',
      'UA': 'UA',
      'FR': 'FR',
      'CZ': 'CZ',
      'AT': 'AT',
      'SK': 'SK',
      'HU': 'HU',
      'IT': 'IT',
      'ES': 'ES',
      'NL': 'NL',
      'BE': 'BE'
    };
    
    return {
      country: countryMap[countryCode] || countryCode,
      postalCode,
      locality
    };
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
      console.log('  place.address:', place?.address);
      console.log('  place.extensionAddress:', place?.extensionAddress);
      console.log('  place.locality:', place?.locality);
      console.log('  place.country:', place?.country);
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
      console.log('🔍 Радіус з place:', place.range);

      let geocodeRequest;

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
      const coordinates = await geocodeAddress(geocodeRequest, this.proxyClient);

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
   * Створити ключ для кешу геокодування
   */
  private createGeocodeKey(place: any): string {
    if (place.extensionAddress) {
      return `ext:${place.extensionAddress}`;
    }
    
    if (place.address) {
      return `addr:${place.address.country}:${place.address.postal_code}:${place.address.locality}`;
    }
    
    return `fields:${place.country}:${place.postalCode}:${place.locality}`;
  }

  /**
   * Витягує код країни з формату Trans.eu
   */
  private extractCountryCode(country?: string | string[]): string | undefined {
    if (!country) return undefined;
    
    // Якщо це масив, беремо перший елемент
    const countryStr = Array.isArray(country) ? country[0] : country;
    
    // Якщо це вже двобуквенний код (PL, DE, UA), повертаємо як є
    if (countryStr.length === 2 && /^[A-Z]{2}$/.test(countryStr)) {
      return countryStr;
    }
    
    // Витягуємо код країни з формату "47_poland" -> "PL"
    const countryMap: { [key: string]: string } = {
      '47_poland': 'PL',
      '21_germany': 'DE', 
      '47_ukraine': 'UA',
      '33_france': 'FR',
      '42_czech_republic': 'CZ',
      '43_austria': 'AT',
      '421_slovakia': 'SK',
      '36_hungary': 'HU',
      '39_italy': 'IT',
      '34_spain': 'ES',
      '31_netherlands': 'NL',
      '32_belgium': 'BE'
    };
    
    return countryMap[countryStr] || countryStr;
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
  getProxyStats() {
    return {
      message: 'Proxy client is simplified - only proxies requests',
      proxyUrl: this.config.proxy.baseUrl,
      config: {
        port: this.config.proxy.defaultPort,
        timeout: this.config.proxy.requestTimeout,
        healthCheckTimeout: this.config.proxy.healthCheckTimeout
      }
    };
  }

  /**
   * Отримати поточну конфігурацію
   */
  getConfig(): RouteApiConfig {
    return this.config;
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

    // Автоматично геокодуємо адреси, якщо координати відсутні
    let loadingPlaceWithCoords = params.loadingPlace;
    let unloadingPlaceWithCoords = params.unloadingPlace;

    console.log('🔍 ДІАГНОСТИКА: Вхідні дані для геокодування:');
    console.log('  Loading place:', JSON.stringify(params.loadingPlace, null, 2));
    console.log('  Unloading place:', JSON.stringify(params.unloadingPlace, null, 2));

    try {
      if (params.loadingPlace) {
        console.log('🌍 Геокодування loading place...');
        loadingPlaceWithCoords = await this.ensureCoordinates(params.loadingPlace);
        console.log('✅ Loading place після геокодування:', JSON.stringify(loadingPlaceWithCoords, null, 2));
      }

      if (params.unloadingPlace) {
        console.log('🌍 Геокодування unloading place...');
        unloadingPlaceWithCoords = await this.ensureCoordinates(params.unloadingPlace);
        console.log('✅ Unloading place після геокодування:', JSON.stringify(unloadingPlaceWithCoords, null, 2));
      }
    } catch (error) {
      const errorMsg = `Критична помилка геокодування: ${error.message}`;
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    // Створюємо фільтр в точному порядку як в оригіналі
    const filter: any = {};

    // 1. loading_place (якщо є)
    if (loadingPlaceWithCoords) {
      const loadingFilter: any = {
        address: {}
      };

      // address
      if (loadingPlaceWithCoords.country) {
        loadingFilter.address.country = [loadingPlaceWithCoords.country];
      }
      if (loadingPlaceWithCoords.locality) {
        loadingFilter.address.locality = loadingPlaceWithCoords.locality;
      }
      if (loadingPlaceWithCoords.postalCode) {
        loadingFilter.address.postal_code = loadingPlaceWithCoords.postalCode;
      }

      // coordinates (КРИТИЧНО ВАЖЛИВО для отримання 80 результатів!)
      if (loadingPlaceWithCoords.coordinates) {
        loadingFilter.coordinates = {
          latitude: loadingPlaceWithCoords.coordinates.latitude,
          longitude: loadingPlaceWithCoords.coordinates.longitude,
          range: loadingPlaceWithCoords.coordinates.range || defaultRadius
        };
        
        if (this.config.logging.logRequests) {
          console.log('✅ Loading coordinates додано:', loadingFilter.coordinates);
        }
      } else {
        if (this.config.logging.logRequests) {
          console.warn('⚠️ Loading coordinates ВІДСУТНІ! Це може обмежити результати.');
        }
      }

      filter.loading_place = [loadingFilter];
    }

    // 2. unloading_place (якщо є)
    if (unloadingPlaceWithCoords) {
      const unloadingFilter: any = {
        address: {}
      };

      // address
      if (unloadingPlaceWithCoords.country) {
        unloadingFilter.address.country = [unloadingPlaceWithCoords.country];
      }
      if (unloadingPlaceWithCoords.locality) {
        unloadingFilter.address.locality = unloadingPlaceWithCoords.locality;
      }
      if (unloadingPlaceWithCoords.postalCode) {
        unloadingFilter.address.postal_code = unloadingPlaceWithCoords.postalCode;
      }

      // coordinates (КРИТИЧНО ВАЖЛИВО для отримання 80 результатів!)
      if (unloadingPlaceWithCoords.coordinates) {
        unloadingFilter.coordinates = {
          latitude: unloadingPlaceWithCoords.coordinates.latitude,
          longitude: unloadingPlaceWithCoords.coordinates.longitude,
          range: unloadingPlaceWithCoords.coordinates.range || defaultRadius
        };
        
        if (this.config.logging.logRequests) {
          console.log('✅ Unloading coordinates додано:', unloadingFilter.coordinates);
        }
      } else {
        if (this.config.logging.logRequests) {
          console.warn('⚠️ Unloading coordinates ВІДСУТНІ! Це може обмежити результати.');
        }
      }

      filter.unloading_place = [unloadingFilter];
    }

    // 3. places_matching_type
    filter.places_matching_type = params.placesMatchingType || 'cross';

    // 4. size (ОБОВ'ЯЗКОВО)
    if (params.vehicleSizes && params.vehicleSizes.length > 0) {
      filter.size = params.vehicleSizes;
    }

    // 5. required_vehicle_size (ОБОВ'ЯЗКОВО)
    if (params.requiredVehicleSizes && params.requiredVehicleSizes.length > 0) {
      filter.required_vehicle_size = params.requiredVehicleSizes;
    }

    // 6. exclude_suspended (завжди true)
    filter.exclude_suspended = true;

    const filterString = JSON.stringify(filter);
    
    if (this.config.logging.logRequests) {
      console.log('🔧 RouteApiService - створений фільтр (точна копія оригіналу):', filterString);
      console.log(`📍 Використовується радіус пошуку: ${defaultRadius} км (з API конфігурації)`);
      
      // Перевірка на відповідність оригіналу
      const hasLoadingCoords = loadingPlaceWithCoords?.coordinates;
      const hasUnloadingCoords = unloadingPlaceWithCoords?.coordinates;
      
      if (!hasLoadingCoords || !hasUnloadingCoords) {
        console.error('❌ КРИТИЧНА ПОМИЛКА: Відсутні координати навіть після геокодування!');
        console.log('📍 Очікувані координати:');
        console.log('   Loading (Kraków): 50.077850516, 19.94171128');
        console.log('   Unloading (Gdańsk): 54.301647169, 18.63101292');
      } else {
        console.log('✅ Координати присутні для обох локацій');
      }
    }
    
    return filterString;
  }
}

/**
 * Парсинг адреси з Chrome Extension формату "PL, 30-001, Kraków" або "DE, Німеччина"
 */
function parseExtensionAddress(addressString: string): { country: string; postalCode: string; locality: string } | null {
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
 * Створити конфігурацію місця для API запиту
 */
function createPlaceConfig(point: any, defaultRadius: number): any {
  if (!point) return undefined;
  
  return {
    extensionAddress: point.extensionAddress,
    locality: point.locality,
    country: point.country,
    postalCode: point.postalCode,
    range: point.range,
    coordinates: point.latitude && point.longitude ? {
      latitude: point.latitude,
      longitude: point.longitude,
      range: point.range || defaultRadius
    } : undefined
  };
}

/**
 * Логування конфігурації маршруту
 */
function logRouteConfig(type: 'main' | 'return', config: any, optimizationConfig: any, defaultRadius: number): void {
  const isReturn = type === 'return';
  const loadingPoint = isReturn ? config.unloadingPoints?.[0] : config.loadingPoints?.[0];
  const unloadingPoint = isReturn ? config.loadingPoints?.[0] : config.unloadingPoints?.[0];
  
  console.log(`🔧 fetch${type === 'main' ? 'Main' : 'Return'}Routes - конфігурація${isReturn ? ' (міняємо місцями loading ↔ unloading)' : ''}:`, {
    loadingPoints: isReturn ? config.unloadingPoints : config.loadingPoints,
    unloadingPoints: isReturn ? config.loadingPoints : config.unloadingPoints,
    includeReturnRoute: config.includeReturnRoute,
    vehicleSizes: optimizationConfig.vehicle.defaultSizes,
    requiredSizes: optimizationConfig.vehicle.requiredSizes,
    placesMatchingType: 'cross',
    loadingCoordinates: loadingPoint ? {
      latitude: loadingPoint.latitude,
      longitude: loadingPoint.longitude,
      range: loadingPoint.range || defaultRadius,
      locality: loadingPoint.locality,
      country: loadingPoint.country,
      postalCode: loadingPoint.postalCode
    } : 'відсутні',
    unloadingCoordinates: unloadingPoint ? {
      latitude: unloadingPoint.latitude,
      longitude: unloadingPoint.longitude,
      range: unloadingPoint.range || defaultRadius,
      locality: unloadingPoint.locality,
      country: unloadingPoint.country,
      postalCode: unloadingPoint.postalCode
    } : 'відсутні'
  });
}

/**
 * Логування структури першого маршруту
 */
function logFirstRouteStructure(offers: any[], routeType: string): void {
  if (offers.length > 0) {
    const firstOffer = offers[0];
    console.log(`🔍 Структура першого ${routeType} маршруту:`, {
      id: firstOffer.id,
      hasSpots: !!firstOffer.spots,
      spotsLength: firstOffer.spots?.length || 0,
      hasFreight: !!firstOffer.freight,
      spots: firstOffer.spots?.map((spot: any) => ({
        hasPlace: !!spot.place,
        hasAddress: !!spot.place?.address,
        hasCoordinates: !!spot.place?.coordinates,
        locality: spot.place?.address?.locality,
        coordinates: spot.place?.coordinates
      })) || []
    });
  }
}

/**
 * Кешування маршрутів в Redis (асинхронно, не блокує основний потік)
 */
function cacheRoutesToRedisAsync(offers: any[], redisService: any, routeType: string): void {
  if (!redisService || offers.length === 0) return;
  
  console.log(`💾 Запускаємо асинхронне кешування ${offers.length} ${routeType} маршрутів в Redis...`);
  
  // Запускаємо кешування асинхронно, не чекаємо завершення
  (async () => {
    let successCount = 0;
    let errorCount = 0;
    
    const cachePromises = offers.map((offer: any) => 
      redisService.cacheRoute(offer)
        .then(() => {
          successCount++;
        })
        .catch((error: any) => {
          errorCount++;
          console.warn(`⚠️ Помилка кешування ${routeType} маршруту ${offer.id}:`, error);
        })
    );
    
    try {
      await Promise.all(cachePromises);
      console.log(`📊 Асинхронне кешування ${routeType} маршрутів завершено: ${successCount} успішно, ${errorCount} помилок`);
    } catch (error) {
      console.error(`❌ Критична помилка під час кешування ${routeType} маршрутів:`, error);
    }
  })();
}

/**
 * Завантажити прямі маршрути з автоматичною пагінацією
 */
export async function fetchMainRoutes(config: any, apiService: RouteApiService, redisService: any): Promise<any[]> {
  console.log('📤 Завантажуємо прямі маршрути (всі сторінки автоматично)...');
  
  const defaultRadius = TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;
  const optimizationConfig = getOptimizationConfig();
  
  logRouteConfig('main', config, optimizationConfig, defaultRadius);
  
  const response = await apiService.getAllRoutes({
    vehicleTypes: optimizationConfig.vehicle.defaultSizes,
    placesMatchingType: 'cross',
    filters: {
      loadingPlace: createPlaceConfig(config.loadingPoints?.[0], defaultRadius),
      unloadingPlace: createPlaceConfig(config.unloadingPoints?.[0], defaultRadius)
    }
  });

  const offers = response._embedded?.['freight-offers'] || [];
  console.log(`📦 Отримано ${offers.length} прямих маршрутів`);
  
  logFirstRouteStructure(offers, 'прямого');
  
  // Запускаємо кешування асинхронно, не чекаємо завершення
  cacheRoutesToRedisAsync(offers, redisService, 'прямих');
  
  return offers;
}

/**
 * Завантажити зворотні маршрути з автоматичною пагінацією
 */
export async function fetchReturnRoutes(config: any, apiService: RouteApiService, redisService: any): Promise<any[]> {
  console.log('🔄 Завантажуємо зворотні маршрути (всі сторінки автоматично)...');
  console.log('🔧 fetchReturnRoutes - умови:', {
    includeReturnRoute: config.includeReturnRoute,
    hasUnloadingPoints: config.unloadingPoints?.length > 0,
    hasLoadingPoints: config.loadingPoints?.length > 0,
    unloadingPointsLength: config.unloadingPoints?.length || 0,
    loadingPointsLength: config.loadingPoints?.length || 0
  });
  
  // Перевіряємо умови для зворотних маршрутів
  if (!config.includeReturnRoute) {
    console.log('⚠️ Зворотні маршрути вимкнені в конфігурації (includeReturnRoute = false)');
    return [];
  }
  
  if (!config.unloadingPoints?.length || !config.loadingPoints?.length) {
    console.log('⚠️ Недостатньо точок для зворотних маршрутів');
    return [];
  }
  
  const defaultRadius = TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;
  const optimizationConfig = getOptimizationConfig();
  
  logRouteConfig('return', config, optimizationConfig, defaultRadius);
  
  const response = await apiService.getAllRoutes({
    vehicleTypes: optimizationConfig.vehicle.defaultSizes,
    placesMatchingType: 'cross',
    filters: {
      // Міняємо місцями loading та unloading для зворотного маршруту
      loadingPlace: createPlaceConfig(config.unloadingPoints?.[0], defaultRadius),
      unloadingPlace: createPlaceConfig(config.loadingPoints?.[0], defaultRadius)
    }
  });

  const offers = response._embedded?.['freight-offers'] || [];
  console.log(`🔄 Отримано ${offers.length} зворотних маршрутів`);
  
  // Запускаємо кешування асинхронно, не чекаємо завершення
  cacheRoutesToRedisAsync(offers, redisService, 'зворотних');
  
  return offers;
}

/**
 * Функція для сумісності з старим API
 * Використовується в App.tsx для отримання пропозицій
 */
export async function fetchFreightOffers(config: any): Promise<{ mainOffers: any[], returnOffers: any[] }> {
  try {
    console.log("🔧 fetchFreightOffers - початкова конфігурація:");
    console.log(config);
    
    const apiService = new RouteApiService('http://localhost:8848/api/trans', config.bearerToken);
    
    // Отримуємо радіус пошуку з конфігурації API
    const defaultRadius = TRANSEU_CONFIG.SEARCH_DEFAULTS.SEARCH_RADIUS;
    
    console.log('🚀 Початок паралельного завантаження маршрутів з автоматичною пагінацією...');
    console.log(`📍 Використовуємо радіус пошуку: ${defaultRadius} км (з API конфігурації)`);
    console.log('📄 Всі сторінки будуть завантажені автоматично (замість тільки 20 результатів отримаємо всі 80+)');
    
    // Ініціалізуємо Redis для кешування асинхронно
    const redisServicePromise = (async () => {
      try {
        const { RedisRouteService } = await import('../redis/redisRouteService');
        const redisService = new RedisRouteService();
        await redisService.connect();
        console.log('📦 Redis підключено для кешування');
        return redisService;
      } catch (error) {
        console.warn('⚠️ Redis недоступний, працюємо без кешування:', error);
        return null;
      }
    })();
    
    // Створюємо проміси для паралельного виконання
    const promises: Promise<any[]>[] = [];
    
    // 1. Прямі маршрути (завжди завантажуємо)
    const mainRoutesPromise = redisServicePromise.then(redisService => 
      fetchMainRoutes(config, apiService, redisService)
    );
    promises.push(mainRoutesPromise);
    
    // 2. Зворотні маршрути (тільки якщо включені)
    let returnRoutesPromise: Promise<any[]> | null = null;
    if (config.includeReturnRoute && config.unloadingPoints?.length > 0 && config.loadingPoints?.length > 0) {
      returnRoutesPromise = redisServicePromise.then(redisService => 
        fetchReturnRoutes(config, apiService, redisService)
      );
      promises.push(returnRoutesPromise);
    } else {
      console.log('⚠️ Зворотні маршрути пропущені. Причини:', {
        includeReturnRoute: config.includeReturnRoute,
        hasUnloadingPoints: config.unloadingPoints?.length > 0,
        hasLoadingPoints: config.loadingPoints?.length > 0
      });
    }

    // Виконуємо всі запити паралельно
    console.log(`⚡ Виконуємо ${promises.length} запитів паралельно...`);
    const results = await Promise.allSettled(promises);
    
    // Обробляємо результати
    let mainOffers: any[] = [];
    let returnOffers: any[] = [];
    
    // Прямі маршрути
    if (results[0].status === 'fulfilled') {
      mainOffers = results[0].value;
      console.log(`✅ Прямі маршрути: знайдено ${mainOffers.length} пропозицій`);
    } else {
      console.error('❌ Помилка завантаження прямих маршрутів:', results[0].reason);
    }
    
    // Зворотні маршрути
    if (returnRoutesPromise && results[1]) {
      if (results[1].status === 'fulfilled') {
        returnOffers = results[1].value;
        console.log(`✅ Зворотні маршрути: знайдено ${returnOffers.length} пропозицій`);
      } else {
        console.error('❌ Помилка завантаження зворотних маршрутів:', results[1].reason);
      }
    }

    console.log(`🎉 Паралельне завантаження з автоматичною пагінацією завершено! Всього: ${mainOffers.length + returnOffers.length} пропозицій`);

    // Виводимо статистику Redis кешу асинхронно (не блокуємо повернення результату)
    redisServicePromise.then(async (redisService) => {
      if (redisService) {
        try {
          const stats = await redisService.getCacheStats();
          console.log('📊 Статистика Redis кешу:', stats);
        } catch (error) {
          console.warn('⚠️ Не вдалося отримати статистику Redis:', error);
        }
      }
    });

    return {
      mainOffers,
      returnOffers
    };
  } catch (error) {
    console.error('Error fetching freight offers:', error);
    throw error;
  }
}