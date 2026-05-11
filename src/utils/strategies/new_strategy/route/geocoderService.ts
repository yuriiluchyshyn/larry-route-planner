/**
 * Geocoder Service
 * Сервіс для геокодування адрес через Trans.eu API
 */

import { API_CONFIG, TRANSEU_CONFIG } from './config/apiConfig';

export interface GeocodeRequest {
  country?: string;      // Код країни (наприклад, 'PL')
  postalCode?: string;   // Поштовий код (наприклад, '80-001')
  locality?: string;     // Місто (наприклад, 'Gdańsk')
  lang?: string;         // Мова відповіді (за замовчуванням 'ua')
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

export class GeocoderService {
  private baseUrl: string;
  private proxyClient: any;

  constructor(proxyClient: any) {
    this.baseUrl = API_CONFIG.GEOCODER_BASE_URL;
    this.proxyClient = proxyClient;
  }

  /**
   * Геокодування адреси
   */
  async geocodeAddress(request: GeocodeRequest): Promise<GeocodeResponse | null> {
    try {
      // Формуємо пошуковий запит
      const searchQuery = this.buildSearchQuery(request);
      
      if (!searchQuery) {
        console.warn('⚠️ Недостатньо даних для геокодування:', request);
        return null;
      }

      // Формуємо параметри запиту відповідно до API Trans.eu
      const params = {
        search: searchQuery,
        lang: request.lang || TRANSEU_CONFIG.GEOCODER.DEFAULT_LANG,
        filter: JSON.stringify({
          type: TRANSEU_CONFIG.GEOCODER.LOCATION_TYPES
        }),
        offset: TRANSEU_CONFIG.GEOCODER.DEFAULT_OFFSET,
        limit: TRANSEU_CONFIG.GEOCODER.DEFAULT_LIMIT
      };

      console.log('🌍 Геокодування адреси:', { searchQuery, params });

      // Виконуємо запит через проксі до геокодера
      const response = await this.proxyClient.makeRequest(
        '/app/geocoder-api/api/v2/locations', 
        params,
        'GET'
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

  /**
   * Формування пошукового запиту
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

    // Якщо немає поштового коду, шукаємо за містом
    if (request.locality) {
      if (request.country) {
        return `${request.country}, ${request.locality}`;
      }
      return request.locality;
    }

    // Якщо є тільки країна (без міста і поштового коду)
    if (request.country) {
      // Для пошуку країни використовуємо назву країни
      const countryNames: { [key: string]: string } = {
        'DE': 'germany',
        'PL': 'poland', 
        'FR': 'france',
        'CZ': 'czech',
        'AT': 'austria',
        'SK': 'slovakia',
        'HU': 'hungary',
        'IT': 'italy',
        'ES': 'spain',
        'NL': 'netherlands',
        'BE': 'belgium'
      };
      
      const countryName = countryNames[request.country.toUpperCase()];
      if (countryName) {
        console.log(`🌍 Пошук по країні: ${request.country} -> ${countryName}`);
        return countryName;
      }
      
      return request.country;
    }

    return null;
  }

  /**
   * Геокодування з кешуванням
   */
  async geocodeWithCache(request: GeocodeRequest, cacheKey?: string): Promise<GeocodeResponse | null> {
    // TODO: Додати кешування в Redis якщо потрібно
    return this.geocodeAddress(request);
  }

  /**
   * Пакетне геокодування
   */
  async batchGeocode(requests: GeocodeRequest[]): Promise<(GeocodeResponse | null)[]> {
    const results: (GeocodeResponse | null)[] = [];
    
    for (const request of requests) {
      const result = await this.geocodeAddress(request);
      results.push(result);
      
      // Невелика затримка між запитами
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
}

/**
 * Допоміжна функція для геокодування адреси
 */
export async function geocodeAddress(
  address: { country?: string; postalCode?: string; locality?: string },
  proxyClient: any
): Promise<{ latitude: number; longitude: number } | null> {
  const geocoder = new GeocoderService(proxyClient);
  
  const result = await geocoder.geocodeAddress({
    country: address.country,
    postalCode: address.postalCode,
    locality: address.locality
  });
  
  if (result) {
    return {
      latitude: result.latitude,
      longitude: result.longitude
    };
  }
  
  return null;
}