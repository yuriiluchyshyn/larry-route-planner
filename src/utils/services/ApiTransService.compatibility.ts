/**
 * Функції сумісності для ApiTransService
 * Забезпечують сумісність з існуючим кодом routeApiService.ts та geocoderService.ts
 */

import { getApiTransService } from './ApiTransService';

// ============================================================
// LOCATION SEARCH INTERFACES
// ============================================================

export interface LocationSearchFilter {
  type?: string[];
}

export interface LocationSearchParams {
  search: string;
  lang?: string;
  filter?: LocationSearchFilter;
  offset?: number;
  limit?: number;
}

export interface LocationOriginalNames {
  countryName?: string | null;
  admin1?: string | null;
  locality?: string | null;
  district?: string | null;
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
  originalNames?: LocationOriginalNames;
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

// ============================================================
// FREIGHT OFFERS INTERFACES
// ============================================================

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
 * Метод для пошуку локацій через Trans.eu API
 * Приймає параметри пошуку як інтерфейс і виконує запит через проксі з токеном
 */
export async function searchTranseuLocation(
  params: LocationSearchParams
): Promise<LocationSearchResponse> {
  try {
    console.log('🔍 Виконання пошуку локацій з параметрами...');
    console.log('🔧 Параметри пошуку:', params);
    
    const apiService = getApiTransService();
    
    // Перевіряємо підключення до проксі
    const isConnected = await apiService.checkHealth();
    if (!isConnected) {
      throw new Error('Проксі-сервер недоступний. Запустіть його спочатку.');
    }

    // Формуємо параметри запиту з інтерфейсу
    const requestParams: Record<string, string> = {
      search: params.search,
      lang: params.lang || 'en',
      offset: (params.offset || 0).toString(),
      limit: (params.limit || 10).toString()
    };

    // Додаємо фільтр якщо є
    if (params.filter) {
      requestParams.filter = JSON.stringify(params.filter);
    } else {
      // Використовуємо дефолтний фільтр для всіх типів локацій
      requestParams.filter = JSON.stringify({
        type: [
          'locality_postal_area',
          'locality',
          'postal_area',
          'admin_area_level_1',
          'admin_area_level_2',
          'country'
        ]
      });
    }

    console.log('🔧 Сформовані параметри запиту:', requestParams);

    // Виконуємо запит через проксі до ендпоінту геокодера
    // Використовуємо правильний ендпоінт та базовий URL для геокодера
    const response = await apiService.makeRequest(
      "/app/geocoder-api/api/v2/locations",
      {
        method: 'GET',
        params: requestParams,
        targetBaseUrl: 'https://api-platform.trans.eu' // Використовуємо правильний базовий URL для геокодера
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Помилка виконання запиту пошуку локацій');
    }

    console.log(`✅ Пошук локацій виконано успішно!`);
    console.log('📊 Знайдено локацій:', response.data?._embedded?.locations?.length || 0);
    console.log('📊 Загальна кількість:', response.data?.total_items || 0);
    
    // Повертаємо точну структуру як в оригінальному API
    const result: LocationSearchResponse = {
      page_count: response.data?.page_count || 1,
      total_items: response.data?.total_items || 0,
      page: response.data?.page || 1,
      page_size: response.data?.page_size || 0,
      _embedded: {
        locations: response.data?._embedded?.locations || []
      }
    };

    return result;

  } catch (error) {
    console.error('❌ Помилка виконання пошуку локацій:', error);
    throw error;
  }
}
