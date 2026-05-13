/**
 * Route Management Hook
 * Хук для управління маршрутами та оптимізацією
 */

import { useState, useCallback } from 'react';
import type { FreightOffer, OptimizedRoute, RouteConfig, RoutePoint } from '../types';
import { RoutePointType } from '../types';
import type { TranseuProgress } from '../components/ProgressBar/TranseuProgressBar';
import { getOffers } from '../utils/services/ApiTransService.compatibility';
import type { OffersRequestParams } from '../utils/services/ApiTransService.compatibility';
// import { reverseGeocode } from '../utils/geocode';
import { getApiTransService } from '../utils/services/ApiTransService';
import { createOptimizedRoutes } from '../utils/strategies/new_strategy';
// import { fetchFreightOffers } from '../utils/services/ApiTransService.compatibility';

interface UseRouteManagementProps {
  config: RouteConfig | null;
}

/**
 * Інтерфейс для результату пошуку локацій Trans.eu
 */
interface TranseuLocationResult {
  geocoderId: string;
  geocoderDetailedId: string | null;
  country: string;
  type: string;
  countryName: string | null;
  admin1: string;
  locality: string;
  district: string | null;
  postalCode: string;
  street: string | null;
  number: string | null;
  originalNames: {
    countryName: string | null;
    admin1: string;
    locality: string;
    district: string | null;
  };
  latitude: number;
  longitude: number;
  bbox: [[number, number], [number, number]];
  radius: number;
  locationId: number;
  detailedLocationId: number | null;
  timezone: string;
}

/**
 * Інтерфейс для повної відповіді API пошуку локацій
 */
interface TranseuLocationResponse {
  page_count: number;
  total_items: number;
  page: number;
  page_size: number;
  _embedded: {
    locations: TranseuLocationResult[];
  };
}

/**
 * Пошук локацій через Trans.eu API
 */
async function searchTranseuLocation(searchTerm: string): Promise<TranseuLocationResult[]> {
  try {
    const apiService = getApiTransService();

    // Перевіряємо підключення до проксі
    const isConnected = await apiService.checkHealth();
    if (!isConnected) {
      throw new Error('Проксі-сервер недоступний');
    }

    const filter = JSON.stringify({
      "type": ["combined_postal_area", "postal_area", "locality_postal_area", "country"]
    });

    const response = await apiService.makeRequest(
      "/app/geocoder-api/api/v2/locations",
      {
        method: 'GET',
        params: {
          search: searchTerm,
          lang: 'ua',
          filter: filter,
          offset: '0',
          limit: '10'
        }
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Помилка пошуку локацій');
    }

    // Обробляємо нову структуру відповіді
    const locationResponse = response.data as TranseuLocationResponse;
    return locationResponse?._embedded?.locations || [];
  } catch (error) {
    console.warn(`⚠️ Помилка пошуку локації "${searchTerm}":`, error);
    return [];
  }
}

/**
 * Генерує фільтр для API запиту на основі конфігурації маршрутів
 * HOME_POINT включається як в loading_place, так і в unloading_place
 * Використовує Trans.eu locations API для пошуку локацій та включає координати
 */
async function generateFilterFromConfig(config: RouteConfig): Promise<OffersRequestParams['filter']> {
  const allPoints = config.routes;

  // Розділяємо точки за типами
  const homePoints = allPoints.filter(point => point.type === RoutePointType.HOME_POINT);
  const loadingPoints = allPoints.filter(point => point.type === RoutePointType.LOADING_POINT);
  const unloadingPoints = allPoints.filter(point => point.type === RoutePointType.UNLOADING_POINT);

  // Створюємо пули точок для завантаження та розвантаження
  // HOME_POINT включається в обидва пули
  const allLoadingCandidates = [...loadingPoints, ...homePoints];
  const allUnloadingCandidates = [...unloadingPoints, ...homePoints];

  // Конвертуємо RoutePoint в формат API з використанням Trans.eu locations API та координат
  const convertRoutePointToApiFormat = async (point: RoutePoint) => {
    let locality = point.locality;
    let postalCode = point.postalCode;
    let country = point.country;
    let location: TranseuLocationResult | null = null;

    // Якщо відсутні locality або postalCode, спробуємо знайти через Trans.eu locations API
    if (locality) {
      // Спробуємо пошук за extensionAddress якщо є, інакше за locality
      const searchTerm = (point as any).extensionAddress || locality;
      if (searchTerm && searchTerm.trim() !== '') {
        const locations = await searchTranseuLocation(searchTerm);
        if (locations.length > 0) {
          location = locations[0];
          locality = locality || location.locality;
          postalCode = postalCode || location.postalCode || '';
          country = country || location.country;
        }
      }

    }

    // Мапимо країну в формат Trans.eu якщо потрібно
    const countryMap: Record<string, string> = {
      'poland': '47_poland',
      'germany': '21_germany',
      'france': '19_france',
      'czech_republic': '16_czech_republic',
      'slovakia': '56_slovakia',
      'austria': '5_austria',
      'netherlands': '43_netherlands',
      'belgium': '7_belgium',
      'italy': '28_italy',
      'spain': '58_spain',
      'hungary': '26_hungary',
      'romania': '50_romania',
      'bulgaria': '10_bulgaria',
      'croatia': '25_croatia',
      'slovenia': '57_slovenia',
      'lithuania': '35_lithuania',
      'latvia': '34_latvia',
      'estonia': '18_estonia',
      'denmark': '17_denmark',
      'sweden': '59_sweden',
      'finland': '20_finland',
      'portugal': '48_portugal',
      'ireland': '27_ireland',
      'luxembourg': '36_luxembourg',
      'greece': '23_greece',
      'ukraine': '63_ukraine',
      'great_britain': '22_great_britain',
      'switzerland': '60_switzerland',
      'norway': '44_norway'
    };

    // Якщо країна вже в правильному форматі (містить _), залишаємо як є
    const formattedCountry = country.includes('_')
      ? country
      : countryMap[country.toLowerCase()] || country;

    return {
      address: {
        country: [formattedCountry],
        locality: locality,
        postal_code: postalCode
      },
      coordinates: {
        latitude: location?.latitude || point.latitude,
        longitude: location?.longitude || point.longitude,
        range: point.range || 50
      }
    };
  };

  // Конвертуємо всі точки завантаження
  const loadingPlaces = await Promise.all(
    allLoadingCandidates.map(async (point) => {
      const converted = await convertRoutePointToApiFormat(point);

      console.log("convertedconverted")
      console.log(converted)

      // Якщо точка має координати (не 0), включаємо повну інформацію
      if (converted.coordinates.latitude !== 0 && converted.coordinates.longitude !== 0) {
        return {
          address: {
            country: converted.address.country,
            locality: converted.address.locality,
            postal_code: converted.address.postal_code
          },
          coordinates: {
            latitude: converted.coordinates.latitude,
            longitude: converted.coordinates.longitude,
            range: converted.coordinates.range
          }
        };
      } else {
        // Якщо координати 0, використовуємо тільки країну
        return {
          address: {
            country: converted.address.country
          },
          isCountry: true
        };
      }
    })
  );

  // Конвертуємо всі точки розвантаження
  const unloadingPlaces: Array<{
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
  }> = await Promise.all(
    allUnloadingCandidates.map(async (point) => {
      const converted = await convertRoutePointToApiFormat(point);

      // Якщо точка має координати (не 0), включаємо повну інформацію
      if (converted.coordinates.latitude !== 0 && converted.coordinates.longitude !== 0) {
        return {
          address: {
            country: converted.address.country,
            locality: converted.address.locality,
            postal_code: converted.address.postal_code
          },
          coordinates: {
            latitude: converted.coordinates.latitude,
            longitude: converted.coordinates.longitude,
            range: converted.coordinates.range
          }
        };
      } else {
        // Якщо координати 0, використовуємо тільки країну
        return {
          address: {
            country: converted.address.country
          },
          isCountry: true
        };
      }
    })
  );

  // Генеруємо фільтр
  const filter: OffersRequestParams['filter'] = {
    loading_place: loadingPlaces,
    unloading_place: unloadingPlaces,
    places_matching_type: config.placesMatchingType || 'cross',
    size: config.vehicleTypes && config.vehicleTypes.length > 0
      ? config.vehicleTypes
      : ["2_double_trailer", "3_lorry", "5_solo"],
    required_vehicle_size: config.vehicleTypes && config.vehicleTypes.length > 0
      ? config.vehicleTypes
      : ["2_double_trailer", "3_lorry", "5_solo"],
    exclude_suspended: true
  };

  console.log('🔧 Згенерований фільтр:', filter);
  console.log(`📍 Loading places: ${filter.loading_place.length}`);
  console.log(`📍 Unloading places: ${filter.unloading_place.length}`);

  return filter;
}

/**
 * Створити всі можливі комбінації RoutePoint з baseConfig
 * Повертає список маршрутів, де перший елемент завжди LOADING_POINT, другий - UNLOADING_POINT
 * HOME_POINT може бути як LOADING_POINT так і UNLOADING_POINT
 */
// function createAllRouteConfigs(baseConfig: RouteConfig): RoutePoint[][] {
//   const allRoutes: RoutePoint[][] = [];
//   const allPoints = baseConfig.routes;

//   // Розділяємо точки за типами
//   const homePoints = allPoints.filter(point => point.type === RoutePointType.HOME_POINT);
//   const loadingPoints = allPoints.filter(point => point.type === RoutePointType.LOADING_POINT);
//   const unloadingPoints = allPoints.filter(point => point.type === RoutePointType.UNLOADING_POINT);

//   console.log(`🔧 Знайдено точок: ${homePoints.length} домашніх, ${loadingPoints.length} завантаження, ${unloadingPoints.length} розвантаження`);

//   // Створюємо пули точок для завантаження та розвантаження
//   // HOME_POINT може бути як місцем завантаження, так і розвантаження
//   const allLoadingCandidates = [...loadingPoints, ...homePoints];
//   const allUnloadingCandidates = [...unloadingPoints, ...homePoints];

//   // Генеруємо всі комбінації: LOADING_CANDIDATE → UNLOADING_CANDIDATE
//   for (const loadingCandidate of allLoadingCandidates) {
//     for (const unloadingCandidate of allUnloadingCandidates) {
//       // Уникаємо маршрутів з однією і тією ж точкою (якщо це HOME_POINT)
//       if (loadingCandidate.id === unloadingCandidate.id) {
//         continue;
//       }

//       const route: RoutePoint[] = [loadingCandidate, unloadingCandidate];
//       allRoutes.push(route);
//     }
//   }

//   console.log(`🔧 Створено ${allRoutes.length} маршрутів (включаючи домашню базу як можливе місце завантаження/розвантаження)`);

//   return allRoutes;
// }

/**
 * Завантажити пропозиції з відстеженням прогресу
 * Кожен маршрут: Домашня база → Точка завантаження → Точка розвантаження → Домашня база (якщо база задана)
 * Або: Точка завантаження → Точка розвантаження (якщо база не задана)
 */
// async function fetchOffersWithProgress(
//   routes: RoutePoint[][], 
//   baseConfig: RouteConfig,
//   setProgress: (progress: { current: number; total: number; currentRoute: string; phase: 'searching' | 'optimizing' | 'completed' }) => void
// ): Promise<{ offers: FreightOffer[] }> {
//   const allOffers: FreightOffer[] = [];

//   console.log("🔧 fetchOffersWithProgress - обробка маршрутів:");
//   console.log(`📊 Всього маршрутів для обробки: ${routes.length}`);
//   routes.forEach((route, index) => {
//     console.log(`  Маршрут ${index + 1}: ${route[0].locality || route[0].country} → ${route[1].locality || route[1].country}`);
//   });

//   for (let i = 0; i < routes.length; i++) {
//     const route = routes[i];

//     console.log("🔧 Обробляємо маршрут:");
//     console.log(route);

//     // Кожен маршрут має 2 точки: [0] - завантаження, [1] - розвантаження
//     const loadingPoint = route[0];
//     const unloadingPoint = route[1];

//     // Формуємо назву маршруту
//     const routeName = `📦 ${loadingPoint.locality || loadingPoint.country} → 🚚 ${unloadingPoint.locality || unloadingPoint.country}`;

//     // Оновлюємо прогрес
//     setProgress({
//       current: i,
//       total: routes.length,
//       currentRoute: `Пошук: ${routeName} (${i + 1}/${routes.length})`,
//       phase: 'searching'
//     });

//     try {
//       // Створюємо тимчасовий конфіг у старому форматі для сумісності з API
//       // const compatConfig = {
//       //   ...baseConfig,
//       //   loadingPoints: [loadingPoint],
//       //   unloadingPoints: [unloadingPoint],
//       // };

//       // Використовуємо існуючу функцію fetchFreightOffers для одного конфігу
//       // const offers = await fetchFreightOffers(compatConfig);
//       const offers = await executeHardcodedRequest();

//       allOffers.push(...offers);
//       console.log(`✅ ${routeName}: ${offers.length} пропозицій (загалом зібрано: ${allOffers.length})`);

//     } catch (error) {
//       console.error(`❌ Помилка для маршруту ${routeName}:`, error);
//       // Продовжуємо обробку інших маршрутів навіть якщо один з них не вдався
//     }
//   }

//   console.log(`🎉 Завершено обробку всіх маршрутів! Загалом зібрано: ${allOffers.length} пропозицій`);

//   return { offers: allOffers };
// }

/**
 * Завантажити всі сторінки пропозицій
 * Виконує послідовні запити до API поки не завантажить всі доступні пропозиції
 */
async function loadAllPages(
  filter: OffersRequestParams['filter'],
  sort: { field: string; order: string },
  counters: string[],
  setProgress?: (progress: { current: number; total: number; currentRoute: string; phase: 'searching' | 'optimizing' | 'completed' }) => void
): Promise<FreightOffer[]> {
  const allOffers: FreightOffer[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  let pagination: OffersRequestParams['pagination'] | undefined = undefined;
  let totalEstimate = 0;
  const MAX_PAGES = 100; // Safety limit to prevent infinite loops

  console.log('🔄 Початок завантаження всіх сторінок...');

  while (hasMorePages && currentPage <= MAX_PAGES) {
    try {
      // Оновлюємо прогрес
      if (setProgress) {
        // Розраховуємо кількість сторінок на основі реальних даних
        let estimatedTotalPages;
        if (totalEstimate > 0 && currentPage > 1) {
          // Використовуємо середню кількість елементів на сторінку з уже завантажених даних
          const avgItemsPerPage = allOffers.length / (currentPage - 1);
          estimatedTotalPages = Math.ceil(totalEstimate / avgItemsPerPage);
        } else {
          // Для першої сторінки використовуємо приблизну оцінку
          estimatedTotalPages = totalEstimate > 0 ? Math.ceil(totalEstimate / 20) : currentPage + 1;
        }
        
        setProgress({
          current: currentPage,
          total: Math.max(estimatedTotalPages, currentPage),
          currentRoute: `Завантаження сторінки ${currentPage}${totalEstimate > 0 ? ` (${allOffers.length}/${totalEstimate} пропозицій)` : ''}...`,
          phase: 'searching'
        });
      }

      console.log(`📄 Завантаження сторінки ${currentPage}...`);
      console.log('🔍 DEBUG: Pagination parameter:', pagination);

      const response = await getOffers(filter, pagination, sort, counters);

      // Додаємо пропозиції з поточної сторінки
      allOffers.push(...response.offers);

      // Оновлюємо загальну оцінку кількості тільки з першої відповіді
      if (response.total && currentPage === 1) {
        totalEstimate = response.total;
        console.log(`📊 Загальна кількість пропозицій (з першої відповіді): ${totalEstimate}`);
      }

      console.log(`✅ Сторінка ${currentPage}: завантажено ${response.offers.length} пропозицій (загалом: ${allOffers.length})`);
      console.log('🔍 DEBUG: Response structure:', {
        offersCount: response.offers.length,
        total: response.total,
        counters: response.counters,
        lastOfferId: response.offers[response.offers.length - 1]?.id,
        lastOfferIndex: response.offers[response.offers.length - 1]?.index
      });

      // Перевіряємо чи є ще сторінки
      if (response.offers.length === 0) {
        // Якщо немає пропозицій на поточній сторінці, завершуємо
        hasMorePages = false;
        console.log('🏁 Досягнуто кінець результатів (порожня сторінка)');
      } else if (totalEstimate > 0 && allOffers.length >= totalEstimate) {
        // Якщо завантажили всі пропозиції згідно з totalEstimate з першої відповіді
        hasMorePages = false;
        console.log(`🏁 Завантажено всі доступні пропозиції: ${allOffers.length}/${totalEstimate}`);
      } else {
        // Підготовка пагінації для наступної сторінки
        // Використовуємо index останньої пропозиції для search_after (не id!)
        const lastOffer = response.offers[response.offers.length - 1];
        if (lastOffer && lastOffer.index) {
          pagination = {
            search_after: {
              id: lastOffer.index  // Використовуємо index, не id!
            }
          };
          currentPage++;
          console.log(`🔄 Підготовка наступної сторінки з search_after index: ${lastOffer.index}`);
        } else {
          hasMorePages = false;
          console.log('🏁 Не вдалося отримати index для наступної сторінки');
        }
      }

      // Додаємо невелику затримку між запитами щоб не перевантажувати API
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`❌ Помилка завантаження сторінки ${currentPage}:`, error);

      // Якщо це перша сторінка, пробрасуємо помилку
      if (currentPage === 1) {
        throw error;
      }

      // Якщо це не перша сторінка, завершуємо завантаження з тим що вже є
      console.warn(`⚠️ Завершуємо завантаження через помилку на сторінці ${currentPage}. Завантажено: ${allOffers.length} пропозицій`);
      hasMorePages = false;
    }
  }

  // Фінальне оновлення прогресу
  if (setProgress) {
    setProgress({
      current: currentPage - 1,
      total: currentPage - 1,
      currentRoute: `Завантажено ${allOffers.length} пропозицій з ${currentPage - 1} сторінок`,
      phase: 'completed'
    });
  }

  return allOffers;
}

export function useRouteManagement({ config }: UseRouteManagementProps) {
  const [offers, setOffers] = useState<FreightOffer[]>([]);
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [transeuProgress, setTranseuProgress] = useState<TranseuProgress | null>(null);
  const [aiPaginationMeta] = useState<{
    totalRoutesFound: number;
    returnedRoutesCount: number;
    nextPagePrompt: string | null;
  } | null>(null);

  // Окремий метод для створення оптимізованих маршрутів
  const handleOptimizeRoutes = useCallback(async (offersToOptimize?: FreightOffer[]) => {
    if (!config) {
      console.warn('⚠️ Конфігурація не встановлена');
      return;
    }

    const offersForOptimization = offersToOptimize || offers;
    
    if (offersForOptimization.length === 0) {
      console.warn('⚠️ Немає пропозицій для оптимізації');
      setRoutes([]);
      return;
    }

    if (config.routes.length > 0) {
      // Знаходимо домашню базу
      const homeBase = config.routes.find(point => point.type === RoutePointType.HOME_POINT);
      
      if (homeBase) {
        console.log('🔧 Створення оптимізованих маршрутів...');
        
        // Імпортуємо оптимізатор динамічно
        // const { createOptimizedRoutes } = await import('../utils/strategies/new_strategy/route/roadOptimizer');
        
        const optimizedRoutes = await createOptimizedRoutes(
          offersForOptimization,
          homeBase,
          config.maxEmptyRunPercent || 10,
          config.pricePerKm || 1.5,
          config.averageSpeedKmh || 80,
          config.maxResults || 50
        );
        
        console.log(`✅ Створено ${optimizedRoutes.length} оптимізованих маршрутів`);
        setRoutes(optimizedRoutes);
      } else {
        console.warn('⚠️ Домашня база не знайдена, маршрути не створені');
        setRoutes([]);
      }
    } else {
      setRoutes([]);
    }
  }, [config, offers]);

  // Новий стан для відстеження прогресу пошуку
  const [searchProgress, setSearchProgress] = useState<{
    current: number;
    total: number;
    currentRoute: string;
    phase: 'searching' | 'optimizing' | 'completed';
  } | null>(null);

  // Fetch offers from API
  const handleFetch = useCallback(async () => {
    if (!config) {
      setError('Конфігурація не встановлена');
      return;
    }

    setLoading(true);
    setError(null);

    // Очищуємо попередні результати при початку нового пошуку
    setOffers([]);
    setRoutes([]);
    setAiStatus(null);
    setSearchProgress(null);

    try {
      // Створюємо всі можливі комбінації маршрутів
      // const allRoutes = createAllRouteConfigs(config);

      // Завантажуємо пропозиції для всіх маршрутів з відстеженням прогресу
      // const response = await fetchOffersWithProgress(allRoutes, config, setSearchProgress);

      // Генеруємо фільтр на основі конфігурації маршрутів
      const filter = await generateFilterFromConfig(config);

      // Ініціалізуємо прогрес пошуку
      setSearchProgress({
        current: 0,
        total: 1,
        currentRoute: 'Завантаження всіх сторінок...',
        phase: 'searching'
      });

      // Виконуємо запит з згенерованим фільтром та завантажуємо всі сторінки
      const allOffers = await loadAllPages(filter, { field: "index", order: "desc" }, ["all"], setSearchProgress);

      // ЗБЕРІГАЄМО ВСІ ПРОПОЗИЦІЇ ДЛЯ ВІДОБРАЖЕННЯ
      setOffers(allOffers);

      // СТВОРЮЄМО ОПТИМІЗОВАНІ МАРШРУТИ
      await handleOptimizeRoutes(allOffers);

      // Завершуємо прогрес з оптимізацією
      setSearchProgress({
        current: 1,
        total: 1,
        currentRoute: `Завантажено ${allOffers.length} пропозицій та створено маршрути`,
        phase: 'completed'
      });

      // Очищуємо прогрес через 3 секунди
      setTimeout(() => setSearchProgress(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unknown error occurred'
      );
      setSearchProgress(null);
    } finally {
      setLoading(false);
      setTranseuProgress(null);
    }
  }, [config]);


  return {
    // State
    offers,
    routes,
    loading,
    error,
    aiStatus,
    transeuProgress,
    aiPaginationMeta,
    searchProgress, // Додаємо новий стан прогресу пошуку

    // Actions
    handleFetch,
    handleOptimizeRoutes, // Додаємо новий метод оптимізації

    // Setters for external use
    setError,
    setAiStatus,
  };
}