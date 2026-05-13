/**
 * Функції сумісності для ApiTransService
 * Забезпечують сумісність з існуючим кодом routeApiService.ts та geocoderService.ts
 */

import { getApiTransService } from './ApiTransService';

// TypeScript interfaces for the freight offers response
export interface FreightOfferSpot {
  place: {
    address: {
      locality: string;
      postal_code: string;
      country: string;
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
    distance: number; // Added missing distance property
  };
  operations: Array<{
    type: 'loading' | 'unloading';
    timespan: {
      begin: string;
      end: string;
      timezone: string;
    };
    local_timespan: {
      begin: string;
      end: string;
      timezone: string;
    };
  }>;
}

export interface FreightOfferRequirements {
  shipping_remarks: string | null;
  other_requirements: string[];
  required_ways_of_loading: string[];
  required_truck_bodies: string[];
  vehicle_size: string;
  is_ftl: boolean;
  transport: {
    count: number | null;
    total_weight: number | null;
    type: 'ftl' | 'ltl';
    settlement: string | null;
    settlement_basis: string | null;
    schedule_type: string;
  };
  temperature: {
    min: number | null;
    max: number | null;
  };
  expected_monitoring: string;
}

export interface FreightOfferEmployee {
  id: number;
  account_id: number;
  trans_id: string;
  given_name: string;
  family_name: string;
  email?: string;
  telephone?: string;
  avatar?: string;
}

export interface FreightOfferCompany {
  id: number;
  legal_name: string;
  certificates: string[];
  vat_id: string;
  is_debtor: boolean;
  bonabanco: boolean;
  bonabanco_pay: boolean;
  safepay: boolean;
  internal_negotiations: boolean;
}

export interface FreightOfferRatingSummary {
  rate: number;
  rates_count: number;
  ratings_trend: string;
  companies_count: number;
  payment_issues: {
    paid_on_time: number;
    paid_with_delay: number;
    unresolved: number;
  };
}

export interface FreightOfferFreight {
  id: number;
  publication_id: number;
  publication_offer_id: string;
  publication_auction_id: string;
  period: {
    payment: string;
    days: number;
  };
  is_quick_pay: boolean;
  is_roundtrip: boolean;
  route: {
    id: string;
    distance: number | null;
    distance_override: number | null;
  };
  spots: FreightOfferSpot[];
  width: number | null;
  height: number | null;
  length: number | null;
  volume: number | null;
  capacity: number;
  loading_meters: number | null;
  requirements: FreightOfferRequirements;
}

export interface FreightOffer {
  id: string;
  index: string;
  offer_id: string | null;
  company_hash: string;
  user_hash: string;
  global_hash: string;
  lsh_hash: string;
  lsh_global_hash: string;
  created_at: string;
  publish_date: string;
  was_refreshed: boolean;
  type: 'public' | 'private';
  freight: FreightOfferFreight;
  price: {
    value: number | null;
    currency: string;
    dynamic_price_raised: boolean;
  };
  employee: FreightOfferEmployee;
  company: FreightOfferCompany;
  contact_persons: FreightOfferEmployee[];
  rating_summary: FreightOfferRatingSummary;
  labels: string[];
  is_humanitarian_aid: boolean;
}

export interface FreightOffersCounters {
  all: number;
  direct: number;
  private: number;
  multi_ftl: number;
}

export interface FreightOffersResponse {
    offers: FreightOffer[];
  total: number;
  counters: FreightOffersCounters;
}

// TypeScript interfaces for the request parameters
export interface OffersRequestParams {
    filter: {
      loading_place: Array<{
        address: {
          country: string[];
          locality?: string;
          postal_code?: string;
        };
        coordinates?: {
          latitude: number;
          longitude: number;
          range: number;
        };
        isCountry?: boolean;
      }>;
      unloading_place: Array<{
        address: {
          country: string[];
          locality?: string;
          postal_code?: string;
        };
        coordinates?: {
          latitude: number;
          longitude: number;
          range: number;
        };
        isCountry?: boolean;
      }>;
      places_matching_type: string;
      size: string[];
      required_vehicle_size: string[];
      exclude_suspended: boolean;
    };
    pagination?: {
      search_after?: {
        id: string;
      };
    };
    sort: {
      field: string;
      order: string;
    };
    counters: string[];
}

/**
 * Метод для отримання пропозицій з параметрами фільтрації, пагінації, сортування та лічильників
 * Приймає окремі параметри і виконує запит через проксі
 */
export async function getOffers(
  filter: OffersRequestParams['filter'],
  pagination?: OffersRequestParams['pagination'],
  sort?: OffersRequestParams['sort'],
  counters?: string[]
): Promise<FreightOffersResponse> {
  try {
    console.log('🚀 Виконання запиту з параметрами...');
    console.log('🔧 Фільтр:', filter);
    console.log('🔧 Пагінація:', pagination);
    console.log('🔧 Сортування:', sort);
    console.log('🔧 Лічильники:', counters);
    
    const apiService = getApiTransService();
    
    // Перевіряємо підключення до проксі
    const isConnected = await apiService.checkHealth();
    if (!isConnected) {
      throw new Error('Проксі-сервер недоступний. Запустіть його спочатку.');
    }

    // Формуємо параметри запиту з отриманих параметрів
    // Використовуємо правильне кодування URL як в оригінальному запиті
    const requestParams: Record<string, string> = {
      filter: JSON.stringify(filter),
      sort: JSON.stringify(sort || { field: "index", order: "desc" }),
      counters: JSON.stringify(counters || ["all"])
    };

    // Додаємо пагінацію якщо є
    if (pagination) {
      requestParams.pagination = JSON.stringify(pagination);
    }

    console.log('🔧 Сформовані параметри запиту:', requestParams);

    // Виконуємо запит через проксі до точного ендпоінту
    // Використовуємо правильний формат для ApiTransService.makeRequest
    const response = await apiService.makeRequest(
      "/app/exchange/api/rest/v2/freight-offers",
      {
        method: 'GET',
        params: requestParams
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Помилка виконання запиту');
    }

    const offers: FreightOffer[] = response.data?._embedded?.['freight-offers'] || [];
    console.log(`✅ Запит виконано успішно! Отримано ${offers.length} пропозицій`);
    console.log('📊 Загальна кількість:', response.data?.total || 0);
    console.log('📊 Лічильники:', response.data?.counters || {});
    
    // Повертаємо точну структуру як в оригінальному API
    const result: FreightOffersResponse = {
      offers: offers,
      total: response.data?.total || 0,
      counters: response.data?.counters || { all: offers.length, direct: 0, private: 0, multi_ftl: 0 }
    };

    return result;

  } catch (error) {
    console.error('❌ Помилка виконання запиту:', error);
    throw error;
  }
}















/**
 * Метод для виконання хардкодованого запиту з конкретними параметрами (backward compatibility)
 * Приймає хардкодовані параметри і виконує запит через проксі
 */
export async function executeHardcodedRequest(hardcodedParams?: OffersRequestParams): Promise<FreightOffersResponse> {
  const params = hardcodedParams || createDefaultHardcodedParams();
  
  return getOffers(
    params.filter,
    params.pagination,
    params.sort,
    params.counters
  );
}







/**
 * Створює дефолтні хардкодовані параметри для тестування
 */
export function createDefaultHardcodedParams(): OffersRequestParams {
  return {
      filter: {
        loading_place: [
          {
            address: {
              country: ["47_poland"],
              locality: "Kraków",
              postal_code: "30-001"
            },
            coordinates: {
              latitude: 50.077850516,
              longitude: 19.94171128,
              range: 50
            }
          }
        ],
        unloading_place: [
          {
            address: {
              country: ["19_france"]
            },
            isCountry: true
          },
          {
            address: {
              country: ["21_germany"]
            },
            isCountry: true
          }
        ],
        places_matching_type: "cross",
        size: ["2_double_trailer", "3_lorry", "5_solo"],
        required_vehicle_size: ["2_double_trailer", "3_lorry", "5_solo"],
        exclude_suspended: true
      },
      pagination: {
        search_after: {
          id: "01KRE6JA7V73SGB3R8187SHZZD"
        }
      },
      sort: {
        field: "index",
        order: "desc"
      },
      counters: ["all"]
  };
}













// /**
//  * Функції сумісності для ApiTransService
//  * Забезпечують сумісність з існуючим кодом routeApiService.ts та geocoderService.ts
//  */

// import { getApiTransService, type GeocodeRequest, type GeocodeResponse } from './ApiTransService';
// import type { FreightOffersResponse, RouteData } from '../strategies/new_strategy/models/routeModels';
// import type { ApiStats } from '../strategies/new_strategy/models/apiModels';

// /**
//  * Функція для пошуку вантажних пропозицій по одному конфігу
//  */
// export async function fetchFreightOffer(config: any): Promise<any[]> {
//   try {
//     console.log("🔧 fetchFreightOffer (compatibility) - конфігурація для одного пошуку:");
//     console.log(`  Loading: ${config.loadingPoints?.[0]?.locality} (${config.loadingPoints?.[0]?.country})`);
//     console.log(`  Unloading: ${config.unloadingPoints?.[0]?.locality} (${config.unloadingPoints?.[0]?.country})`);
//     console.log('🔍 DEBUG: Повний конфіг:', config);
//     console.log('🔍 DEBUG: Loading point повністю:', config.loadingPoints?.[0]);
//     console.log('🔍 DEBUG: Unloading point повністю:', config.unloadingPoints?.[0]);
    
//     const apiService = getApiTransService();
    
//     // Встановлюємо токен якщо є
//     if (config.bearerToken) {
//       apiService.setAuthToken(config.bearerToken);
//       console.log('🔑 Токен встановлено');
//     } else {
//       console.warn('⚠️ Токен відсутній!');
//     }
    
//     console.log('🚀 Використовуємо ApiTransService для завантаження маршрутів...');
    
//     const loadingPlaceConfig = createPlaceConfigCompat(config.loadingPoints?.[0]);
//     const unloadingPlaceConfig = createPlaceConfigCompat(config.unloadingPoints?.[0]);
    
//     console.log('🔍 DEBUG: loadingPlaceConfig після обробки:', loadingPlaceConfig);
//     console.log('🔍 DEBUG: unloadingPlaceConfig після обробки:', unloadingPlaceConfig);
    
//     // Робимо один запит для отримання всіх пропозицій для цієї пари точок
//     const response = await apiService.getAllRoutes({
//       filters: {
//         loadingPlace: loadingPlaceConfig,
//         unloadingPlace: unloadingPlaceConfig
//       },
//       vehicleTypes: config.vehicleTypes && config.vehicleTypes.length > 0 
//         ? config.vehicleTypes 
//         : ["2_double_trailer", "3_lorry", "5_solo"], // Дефолтні типи транспорту
//       placesMatchingType: config.placesMatchingType || 'cross'
//     });

//     const offers = response._embedded?.['freight-offers'] || [];
//     console.log(`✅ Отримано ${offers.length} пропозицій для ${config.loadingPoints?.[0]?.locality} → ${config.unloadingPoints?.[0]?.locality}`);

//     return offers;
//   } catch (error) {
//     console.error('Error fetching freight offer via ApiTransService:', error);
//     throw error;
//   }
// }

// /**
//  * Функція для сумісності з fetchFreightOffers з routeApiService.ts
//  * Приймає один конфіг і повертає пропозиції
//  */
// export async function fetchFreightOffers(config: any): Promise<any[]> {
//   try {
//     console.log(`🔧 fetchFreightOffers (compatibility) - обробка конфігурації:`);
//     console.log(config);
    
//     // Викликаємо fetchFreightOffer для конфігу
//     const offers = await fetchFreightOffer(config);
    
//     console.log(`🎉 Конфіг оброблено! Отримано: ${offers.length} пропозицій`);

//     return offers;
//   } catch (error) {
//     console.error('Error fetching freight offers:', error);
//     throw error;
//   }
// }

// /**
//  * Створити конфігурацію місця для API запиту (compatibility)
//  */
// function createPlaceConfigCompat(point: any): any {
//   if (!point) {
//     console.warn('⚠️ createPlaceConfigCompat: point is undefined');
//     return undefined;
//   }
  
//   console.log('🔧 createPlaceConfigCompat - вхідна точка:', point);
  
//   // Повертаємо структуру, яку очікує createApiFilter
//   const result: any = {
//     country: point.country,
//     range: point.range || 50
//   };

//   // Додаємо locality тільки якщо воно не порожнє
//   if (point.locality && point.locality.trim() !== '') {
//     result.locality = point.locality;
//   }

//   // Додаємо postalCode тільки якщо воно не порожнє
//   if (point.postalCode && point.postalCode.trim() !== '') {
//     result.postalCode = point.postalCode;
//   }

//   // Додаємо координати якщо є
//   if (point.latitude && point.longitude) {
//     result.latitude = point.latitude;
//     result.longitude = point.longitude;
//   }
  
//   console.log('🔧 createPlaceConfigCompat - результат:', result);
  
//   return result;
// }

// /**
//  * Функція для сумісності з geocodeAddress з geocoderService.ts
//  */
// export async function geocodeAddress(
//   address: { country?: string; postalCode?: string; locality?: string }
// ): Promise<{ latitude: number; longitude: number } | null> {
//   const apiService = getApiTransService();
  
//   const result = await apiService.geocodeAddress({
//     country: address.country,
//     postalCode: address.postalCode,
//     locality: address.locality
//   });
  
//   if (result) {
//     return {
//       latitude: result.latitude,
//       longitude: result.longitude
//     };
//   }
  
//   return null;
// }

// /**
//  * Клас для сумісності з RouteApiService
//  */
// export class RouteApiServiceCompat {
//   private apiService: any;

//   constructor(apiKey?: string) {
//     this.apiService = getApiTransService();
    
//     if (apiKey) {
//       this.apiService.setAuthToken(apiKey);
//     }
    
//     console.log(`🔧 RouteApiServiceCompat initialized (delegating to ApiTransService)`);
//   }

//   /**
//    * Оновити токен автентифікації
//    */
//   updateAuthToken(token: string): void {
//     this.apiService.setAuthToken(token);
//   }

//   /**
//    * Перевірити доступність API через проксі
//    */
//   async checkConnection(): Promise<boolean> {
//     return this.apiService.checkHealth();
//   }

//   /**
//    * Отримати всі доступні маршрути
//    */
//   async getAllRoutes(params?: any): Promise<FreightOffersResponse> {
//     return this.apiService.getAllRoutes(params);
//   }

//   /**
//    * Отримати маршрут за ID
//    */
//   async getRouteById(routeId: string): Promise<RouteData> {
//     const response = await this.apiService.getFreightOfferById(routeId);
//     if (response.success) {
//       return response.data;
//     }
//     throw new Error(response.error || `Failed to fetch route ${routeId}`);
//   }

//   /**
//    * Пошук маршрутів за критеріями
//    */
//   async searchRoutes(searchParams: any): Promise<FreightOffersResponse> {
//     return this.apiService.searchRoutes(searchParams);
//   }

//   /**
//    * Отримати статистику маршрутів
//    */
//   async getRoutesStats(): Promise<ApiStats> {
//     return this.apiService.getRoutesStats();
//   }

//   /**
//    * Отримати статистику проксі
//    */
//   getProxyStats() {
//     return {
//       message: 'Using ApiTransService - proxy client is simplified',
//       config: this.apiService.getConfig()
//     };
//   }

//   /**
//    * Отримати поточну конфігурацію
//    */
//   getConfig() {
//     return this.apiService.getConfig();
//   }
// }

// /**
//  * Клас для сумісності з GeocoderService
//  */
// export class GeocoderServiceCompat {
//   private apiService: any;

//   constructor() {
//     this.apiService = getApiTransService();
//     console.log(`🔧 GeocoderServiceCompat initialized (delegating to ApiTransService)`);
//   }

//   /**
//    * Геокодування адреси
//    */
//   async geocodeAddress(request: GeocodeRequest): Promise<GeocodeResponse | null> {
//     return this.apiService.geocodeAddress(request);
//   }

// }