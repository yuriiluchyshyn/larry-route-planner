/**
 * Road Optimizer - Оптимізація маршрутів на основі пропозицій
 * ОПТИМІЗОВАНА ВЕРСІЯ з пре-геокодуванням для максимальної продуктивності
 * 
 * Ключові оптимізації:
 * 1. Пре-геокодування всіх оферів один раз перед пошуком
 * 2. Швидкі синхронні розрахунки відстаней в рекурсії
 * 3. Паралельне геокодування батчами
 */

import type { FreightOffer, OptimizedRoute, RouteSegment, RoutePoint } from '../../../../types';
import { searchTranseuLocation } from '../../../services/ApiTransService.compatibility';
import type { LocationSearchParams } from '../../../services/ApiTransService.compatibility';
import {
  DISTANCE_CONFIG,
  SEARCH_LIMITS,
  OPTIMIZATION_PARAMS,
  SCORING_WEIGHTS,
  DRIVING_PARAMS,
  DEFAULT_CONFIG,
  GEOCODING_CONFIG,
  calculateMaxCandidatesForLevel,
  validateOptimizationConfig
} from './roadOptimizerConfig';

interface OptimizationConfig {
  homeBase: RoutePoint;
  maxEmptyRunPercent: number;
  pricePerKm: number;
  averageSpeedKmh: number;
  maxResults?: number;
  maxRouteDepth?: number;
  maxEmptyDistanceKm?: number;
  maxSearchTimeMs?: number;
  departureDate?: string;
  returnDate?: string;
}

interface RouteCandidate {
  offers: GeocodedOffer[];
  totalDistance: number;
  loadedDistance: number;
  totalEmptyDistance: number;
  emptyRunPercent: number;
  totalEarnings: number;
  score: number;
}

/**
 * Геокодований офер з готовими координатами для швидких розрахунків
 */
interface GeocodedOffer extends FreightOffer {
  _geocoded: {
    loading: { lat: number; lon: number; location: string };
    unloading: { lat: number; lon: number; location: string };
  };
}

interface RouteSearchState {
  currentRoute: GeocodedOffer[];
  usedOfferIds: Set<string>;
  availableOffers: GeocodedOffer[];
  config: OptimizationConfig;
  startTime: number;
  foundRoutes: RouteCandidate[];
}

/**
 * Розрахунок відстані між двома точками (формула Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DISTANCE_CONFIG.DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DISTANCE_CONFIG.DEG_TO_RAD;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * DISTANCE_CONFIG.DEG_TO_RAD) * Math.cos(lat2 * DISTANCE_CONFIG.DEG_TO_RAD) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return DISTANCE_CONFIG.EARTH_RADIUS_KM * c;
}

/**
 * ШВИДКИЙ розрахунок відстані (без async) - ключ до продуктивності!
 */
function calculateDistanceFast(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  return calculateDistance(from.lat, from.lon, to.lat, to.lon);
}

/**
 * Кеш для геокодованих локацій
 */
const geocodeCache = new Map<string, { lat: number; lon: number }>();

/**
 * Геокодування локації через Trans.eu API з кешуванням
 */
async function geocodeLocation(locality: string, country: string, postalCode?: string): Promise<{ lat: number; lon: number } | null> {
  const cacheKey = `${country}:${locality}:${postalCode || ''}`;
  
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  let searchQuery = locality;
  if (postalCode) {
    searchQuery = `${postalCode}, ${locality}`;
  }
  if (country) {
    searchQuery += `, ${country}`;
  }

  try {
    const params: LocationSearchParams = {
      search: searchQuery,
      lang: GEOCODING_CONFIG.DEFAULT_LANGUAGE,
      limit: GEOCODING_CONFIG.LOCATION_SEARCH_LIMIT
    };

    const response = await searchTranseuLocation(params);
    
    if (response._embedded.locations.length > 0) {
      const location = response._embedded.locations[0];
      const coordinates = {
        lat: location.latitude,
        lon: location.longitude
      };
      
      geocodeCache.set(cacheKey, coordinates);
      return coordinates;
    }
    return null;
  } catch (error) {
    console.error(`❌ Помилка геокодування ${searchQuery}:`, error);
    return null;
  }
}

/**
 * ПРЕ-ГЕОКОДУВАННЯ - вирішує проблему продуктивності!
 * Геокодує всі офери один раз перед пошуком замість await в циклі
 */
async function preGeocodeOffers(offers: FreightOffer[]): Promise<GeocodedOffer[]> {
  console.log(`🌍 Пре-геокодування ${offers.length} оферів...`);
  const startTime = Date.now();
  
  const geocodedOffers: GeocodedOffer[] = [];
  const batchSize = OPTIMIZATION_PARAMS.GEOCODING_BATCH_SIZE;
  
  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (offer) => {
      try {
        const loading = getLoadingCoordinates(offer);
        const unloading = getUnloadingCoordinates(offer);
        
        const [loadingCoords, unloadingCoords] = await Promise.all([
          loading.lat && loading.lon 
            ? Promise.resolve({ lat: loading.lat, lon: loading.lon })
            : geocodeLocation(loading.locality, loading.country, loading.postalCode),
          unloading.lat && unloading.lon
            ? Promise.resolve({ lat: unloading.lat, lon: unloading.lon })
            : geocodeLocation(unloading.locality, unloading.country, unloading.postalCode)
        ]);
        
        if (!loadingCoords || !unloadingCoords) {
          return null;
        }
        
        const geocodedOffer: GeocodedOffer = {
          ...offer,
          _geocoded: {
            loading: {
              lat: loadingCoords.lat,
              lon: loadingCoords.lon,
              location: loading.location
            },
            unloading: {
              lat: unloadingCoords.lat,
              lon: unloadingCoords.lon,
              location: unloading.location
            }
          }
        };
        
        return geocodedOffer;
      } catch (error) {
        console.warn(`⚠️ Пропускаємо офер ${offer.id}:`, error);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      if (result) {
        geocodedOffers.push(result);
      }
    }
  }
  
  const geocodingTime = Date.now() - startTime;
  console.log(`✅ Пре-геокодування завершено за ${geocodingTime}ms: ${geocodedOffers.length}/${offers.length} оферів`);
  
  return geocodedOffers;
}

/**
 * Отримання координат завантаження
 */
function getLoadingCoordinates(offer: FreightOffer): { 
  lat?: number; 
  lon?: number; 
  locality: string; 
  country: string; 
  postalCode?: string;
  location: string;
} {
  const loadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'loading')
  );
  
  const spot = loadingSpot || offer.freight.spots[0];
  
  return {
    lat: spot.place.coordinates?.latitude,
    lon: spot.place.coordinates?.longitude,
    locality: spot.place.address.locality,
    country: spot.place.address.country,
    postalCode: spot.place.address.postal_code,
    location: `${spot.place.address.locality}, ${spot.place.address.country}`
  };
}

/**
 * Отримання координат розвантаження
 */
function getUnloadingCoordinates(offer: FreightOffer): { 
  lat?: number; 
  lon?: number; 
  locality: string; 
  country: string; 
  postalCode?: string;
  location: string;
} {
  const unloadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'unloading')
  );
  
  const spot = unloadingSpot || offer.freight.spots[offer.freight.spots.length - 1];
  
  return {
    lat: spot.place.coordinates?.latitude,
    lon: spot.place.coordinates?.longitude,
    locality: spot.place.address.locality,
    country: spot.place.address.country,
    postalCode: spot.place.address.postal_code,
    location: `${spot.place.address.locality}, ${spot.place.address.country}`
  };
}

/**
 * Отримання дати завантаження
 */
function getLoadingDate(offer: FreightOffer): string {
  const loadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'loading')
  );
  
  if (loadingSpot) {
    const loadingOp = loadingSpot.operations.find(op => op.type === 'loading');
    if (loadingOp) {
      return loadingOp.timespan.begin;
    }
  }
  
  return offer.freight.spots[0].operations[0].timespan.begin;
}

/**
 * Отримання дати розвантаження
 */
function getUnloadingDate(offer: FreightOffer): string {
  const unloadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'unloading')
  );
  
  if (unloadingSpot) {
    const unloadingOp = unloadingSpot.operations.find(op => op.type === 'unloading');
    if (unloadingOp) {
      return unloadingOp.timespan.end;
    }
  }
  
  const lastSpot = offer.freight.spots[offer.freight.spots.length - 1];
  return lastSpot.operations[lastSpot.operations.length - 1].timespan.end;
}

/**
 * Перевірка часової валідності
 */
function isTimeValid(currentOffer: FreightOffer, nextOffer: FreightOffer): boolean {
  const unloadTimeStr = getUnloadingDate(currentOffer);
  const loadTimeStr = getLoadingDate(nextOffer);
  
  if (!unloadTimeStr || !loadTimeStr) return true;

  const unloadDate = new Date(unloadTimeStr);
  const loadDate = new Date(loadTimeStr);

  const unloadDay = new Date(unloadDate.getFullYear(), unloadDate.getMonth(), unloadDate.getDate());
  const loadDay = new Date(loadDate.getFullYear(), loadDate.getMonth(), loadDate.getDate());

  return loadDay >= unloadDay;
}

/**
 * Перевірка валідності всього маршруту відносно departure та return дат
 */
function isRouteWithinDateRange(offers: GeocodedOffer[], departureDate?: string, returnDate?: string): boolean {
  if (!departureDate && !returnDate) return true;
  if (offers.length === 0) return true;
  
  // Перевіряємо перше завантаження
  const firstOffer = offers[0];
  const firstLoadingDateStr = getLoadingDate(firstOffer);
  
  if (departureDate && firstLoadingDateStr) {
    const firstLoadingDate = new Date(firstLoadingDateStr);
    const departure = new Date(departureDate);
    const loadingDay = new Date(firstLoadingDate.getFullYear(), firstLoadingDate.getMonth(), firstLoadingDate.getDate());
    const departureDay = new Date(departure.getFullYear(), departure.getMonth(), departure.getDate());
    
    if (loadingDay < departureDay) {
      return false;
    }
  }
  
  // Перевіряємо останнє розвантаження
  const lastOffer = offers[offers.length - 1];
  const lastUnloadingDateStr = getUnloadingDate(lastOffer);
  
  if (returnDate && lastUnloadingDateStr) {
    const lastUnloadingDate = new Date(lastUnloadingDateStr);
    const returnDay = new Date(returnDate);
    const unloadingDay = new Date(lastUnloadingDate.getFullYear(), lastUnloadingDate.getMonth(), lastUnloadingDate.getDate());
    const returnDayNormalized = new Date(returnDay.getFullYear(), returnDay.getMonth(), returnDay.getDate());
    
    if (unloadingDay > returnDayNormalized) {
      return false;
    }
  }
  
  return true;
}

/**
 * ОПТИМІЗОВАНА рекурсивна функція - БЕЗ await в циклі!
 */
async function findRoutesRecursively(state: RouteSearchState): Promise<void> {
  const { currentRoute, usedOfferIds, availableOffers, config, startTime, foundRoutes } = state;
  
  // Перевірки лімітів
  if (config.maxSearchTimeMs && (Date.now() - startTime) > config.maxSearchTimeMs) {
    return;
  }
  if (config.maxRouteDepth && currentRoute.length >= config.maxRouteDepth) {
    return;
  }
  if (config.maxResults && foundRoutes.length >= config.maxResults) {
    return;
  }

  const lastOffer = currentRoute[currentRoute.length - 1];
  const homeBaseCoords = { lat: config.homeBase.latitude, lon: config.homeBase.longitude };

  // 1. Перевіряємо чи можна завершити маршрут
  const returnDistance = calculateDistanceFast(lastOffer._geocoded.unloading, homeBaseCoords);
  
  if (returnDistance <= SEARCH_LIMITS.MAX_RETURN_HOME_DISTANCE_KM) {
    // Перевіряємо валідність дат перед додаванням маршруту
    if (isRouteWithinDateRange([...currentRoute], config.departureDate, config.returnDate)) {
      try {
        const route = await buildRouteFromGeocoded([...currentRoute], config);
        foundRoutes.push(route);
      } catch (error) {
        console.warn(`⚠️ Помилка побудови маршруту:`, error);
      }
    }
  }

  // 2. Шукаємо наступні офери - БЕЗ await в циклі!
  const nextOfferCandidates: Array<{ offer: GeocodedOffer; distance: number }> = [];
  
  for (const offer of availableOffers) {
    if (usedOfferIds.has(offer.id)) continue;
    
    // ШВИДКИЙ розрахунок відстані (координати вже є!)
    const emptyDistance = calculateDistanceFast(
      lastOffer._geocoded.unloading, 
      offer._geocoded.loading
    );
    
    const maxEmptyDistance = config.maxEmptyDistanceKm || SEARCH_LIMITS.DEFAULT_MAX_EMPTY_DISTANCE_KM;
    if (emptyDistance > maxEmptyDistance) continue;
    
    if (!isTimeValid(lastOffer, offer)) continue;
    
    nextOfferCandidates.push({ offer, distance: emptyDistance });
  }

  // Сортуємо та обмежуємо кандидатів
  nextOfferCandidates.sort((a, b) => a.distance - b.distance);
  const maxCandidates = calculateMaxCandidatesForLevel(currentRoute.length);
  const limitedCandidates = nextOfferCandidates.slice(0, maxCandidates);

  // 3. Рекурсивно досліджуємо кандидатів
  for (const candidate of limitedCandidates) {
    if (config.maxSearchTimeMs && (Date.now() - startTime) > config.maxSearchTimeMs) {
      break;
    }

    const newRoute = [...currentRoute, candidate.offer];
    const newUsedIds = new Set(usedOfferIds);
    newUsedIds.add(candidate.offer.id);

    const newState: RouteSearchState = {
      currentRoute: newRoute,
      usedOfferIds: newUsedIds,
      availableOffers,
      config,
      startTime,
      foundRoutes
    };

    await findRoutesRecursively(newState);
  }
}

/**
 * Побудова маршруту з геокодованих оферів
 */
async function buildRouteFromGeocoded(offers: GeocodedOffer[], config: OptimizationConfig): Promise<RouteCandidate> {
  let totalDistance = 0;
  let loadedDistance = 0;
  let totalEmptyDistance = 0;
  let totalEarnings = 0;

  const homeBaseCoords = { lat: config.homeBase.latitude, lon: config.homeBase.longitude };

  // 1. Дім → перше завантаження
  if (offers.length > 0) {
    const homeToFirstDistance = calculateDistanceFast(homeBaseCoords, offers[0]._geocoded.loading);
    totalEmptyDistance += homeToFirstDistance;
    totalDistance += homeToFirstDistance;
  }

  // 2. Обробляємо кожен офер
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];

    // Порожня відстань до цього офера
    if (i > 0) {
      const emptyDistance = calculateDistanceFast(
        offers[i - 1]._geocoded.unloading, 
        offer._geocoded.loading
      );
      totalEmptyDistance += emptyDistance;
      totalDistance += emptyDistance;
    }

    // Завантажена відстань
    let offerDistance = 0;
    if (offer.freight.route.distance) {
      offerDistance = offer.freight.route.distance / 1000;
    } else {
      offerDistance = calculateDistanceFast(offer._geocoded.loading, offer._geocoded.unloading);
    }

    loadedDistance += offerDistance;
    totalDistance += offerDistance;

    if (offer.price.value) {
      totalEarnings += offer.price.value;
    }
  }

  // 3. Останнє розвантаження → дім
  if (offers.length > 0) {
    const lastToHomeDistance = calculateDistanceFast(
      offers[offers.length - 1]._geocoded.unloading, 
      homeBaseCoords
    );
    totalEmptyDistance += lastToHomeDistance;
    totalDistance += lastToHomeDistance;
  }

  const emptyRunPercent = totalDistance > 0 ? (totalEmptyDistance / totalDistance) * 100 : 0;
  const score = loadedDistance * SCORING_WEIGHTS.LOADED_DISTANCE_WEIGHT - 
                totalEmptyDistance * SCORING_WEIGHTS.EMPTY_DISTANCE_PENALTY + 
                totalEarnings * SCORING_WEIGHTS.EARNINGS_WEIGHT;

  return {
    offers,
    totalDistance,
    loadedDistance,
    totalEmptyDistance,
    emptyRunPercent,
    totalEarnings,
    score
  };
}

/**
 * Знаходження стартових оферів
 */
async function findBestStartingOffers(
  offers: GeocodedOffer[], 
  homeBase: RoutePoint, 
  maxDistance: number = SEARCH_LIMITS.MAX_HOME_TO_START_DISTANCE_KM,
  maxCount: number = SEARCH_LIMITS.MAX_STARTING_OFFERS,
  departureDate?: string,
  returnDate?: string
): Promise<Array<{ offer: GeocodedOffer; distance: number; score: number }>> {
  const candidates: Array<{ offer: GeocodedOffer; distance: number; score: number }> = [];
  const homeBaseCoords = { lat: homeBase.latitude, lon: homeBase.longitude };
  
  let validDateCount = 0;
  let totalChecked = 0;
  
  for (const offer of offers) {
    const distance = calculateDistanceFast(homeBaseCoords, offer._geocoded.loading);
    totalChecked++;
    
    if (distance <= maxDistance) {
      // Перевіряємо валідність дат для стартового офера
      if (isRouteWithinDateRange([offer], departureDate, returnDate)) {
        validDateCount++;
        const earnings = offer.price.value || 0;
        const loadedDistance = offer.freight.route.distance ? offer.freight.route.distance / 1000 : DEFAULT_CONFIG.MIN_LOADED_DISTANCE_KM;
        const pricePerKm = earnings / loadedDistance;
        const score = earnings * SCORING_WEIGHTS.EARNINGS_WEIGHT - 
                     distance * SCORING_WEIGHTS.HOME_DISTANCE_PENALTY + 
                     pricePerKm * SCORING_WEIGHTS.PRICE_PER_KM_WEIGHT;
        
        candidates.push({ offer, distance, score });
      }
    }
  }
  
  if (departureDate || returnDate) {
    console.log(`📅 Стартові офери: ${validDateCount}/${totalChecked} пройшли валідацію дат`);
  }
  
  return candidates.sort((a, b) => b.score - a.score).slice(0, maxCount);
}

/**
 * Конвертація в OptimizedRoute
 */
async function convertToOptimizedRoute(candidate: RouteCandidate, config: OptimizationConfig): Promise<OptimizedRoute> {
  const segments: RouteSegment[] = [];
  
  for (let index = 0; index < candidate.offers.length; index++) {
    const offer = candidate.offers[index];
    let emptyDistanceToReach = 0;
    
    if (index === 0) {
      const homeBaseCoords = { lat: config.homeBase.latitude, lon: config.homeBase.longitude };
      emptyDistanceToReach = calculateDistanceFast(homeBaseCoords, offer._geocoded.loading);
    } else {
      const prevOffer = candidate.offers[index - 1];
      emptyDistanceToReach = calculateDistanceFast(prevOffer._geocoded.unloading, offer._geocoded.loading);
    }
    
    let offerDistance = 0;
    if (offer.freight.route.distance) {
      offerDistance = offer.freight.route.distance / 1000;
    } else {
      offerDistance = calculateDistanceFast(offer._geocoded.loading, offer._geocoded.unloading);
    }

    const drivingHours = offerDistance / config.averageSpeedKmh;
    const restStops = Math.floor(drivingHours / DRIVING_PARAMS.MAX_CONTINUOUS_DRIVING_HOURS);
    
    const segment: RouteSegment = {
      offer,
      from: offer._geocoded.loading.location,
      to: offer._geocoded.unloading.location,
      distanceKm: offerDistance,
      loadingDate: getLoadingDate(offer),
      unloadingDate: getUnloadingDate(offer),
      pricePerKm: offer.price.value ? offer.price.value / offerDistance : null,
      isEmpty: false,
      emptyDistanceKm: emptyDistanceToReach,
      drivingHours,
      restStops
    };
    
    segments.push(segment);
  }

  const totalDrivingHours = segments.reduce((sum, seg) => sum + seg.drivingHours, 0);
  const totalDays = Math.max(1, totalDrivingHours / DRIVING_PARAMS.AVERAGE_WORK_HOURS_PER_DAY);
  const mandatoryBreaks = segments.reduce((sum, seg) => sum + seg.restStops, 0);
  const totalRestHours = mandatoryBreaks * DRIVING_PARAMS.MANDATORY_BREAK_HOURS;
  const idleHours = Math.max(0, totalDays * 24 - totalDrivingHours - totalRestHours - (totalDays * DRIVING_PARAMS.MIN_DAILY_REST_HOURS));
  const weeklyRestsNeeded = Math.floor(totalDays / DRIVING_PARAMS.DAYS_BEFORE_WEEKLY_REST);

  const avgDailyDriving = totalDrivingHours / totalDays;
  const euCompliant = avgDailyDriving <= DRIVING_PARAMS.MAX_DAILY_DRIVING_HOURS_EU && candidate.emptyRunPercent <= config.maxEmptyRunPercent;

  return {
    segments,
    totalDistanceKm: candidate.totalDistance,
    loadedDistanceKm: candidate.loadedDistance,
    emptyDistanceKm: candidate.totalEmptyDistance,
    emptyRunPercent: candidate.emptyRunPercent,
    totalDays,
    idleHours,
    totalDrivingHours,
    totalRestHours,
    mandatoryBreaks,
    weeklyRestsNeeded,
    score: candidate.score,
    euCompliant
  };
}

/**
 * ГОЛОВНА ОПТИМІЗОВАНА ФУНКЦІЯ
 */
export async function optimizeRoutes(
  offers: FreightOffer[], 
  config: OptimizationConfig
): Promise<OptimizedRoute[]> {
  console.log(`🚀 Оптимізована оптимізація: ${offers.length} оферів`);
  
  if (config.departureDate || config.returnDate) {
    console.log(`📅 Валідація дат: departure=${config.departureDate}, return=${config.returnDate}`);
  }
  
  if (offers.length === 0) return [];

  const startTime = Date.now();
  const foundRoutes: RouteCandidate[] = [];
  
  try {
    // 1. ПРЕ-ГЕОКОДУВАННЯ - ключ до продуктивності!
    const geocodedOffers = await preGeocodeOffers(offers);
    
    if (geocodedOffers.length === 0) {
      throw new Error('Жоден офер не вдалося геокодувати');
    }

    // 2. Знаходимо стартові офери
    const startingOffers = await findBestStartingOffers(
      geocodedOffers, 
      config.homeBase, 
      SEARCH_LIMITS.MAX_HOME_TO_START_DISTANCE_KM, 
      15,
      config.departureDate,
      config.returnDate
    );
    
    if (startingOffers.length === 0) {
      throw new Error('Не знайдено стартових оферів поблизу домашньої бази');
    }

    // 4. Рекурсивний пошук для кожного стартового офера
    for (const startingOffer of startingOffers) {
      if (config.maxSearchTimeMs && (Date.now() - startTime) > config.maxSearchTimeMs) {
        break;
      }

      const initialState: RouteSearchState = {
        currentRoute: [startingOffer.offer],
        usedOfferIds: new Set([startingOffer.offer.id]),
        availableOffers: geocodedOffers,
        config,
        startTime,
        foundRoutes
      };

      await findRoutesRecursively(initialState);

      if (config.maxResults && foundRoutes.length >= config.maxResults) {
        break;
      }
    }

    // 5. Фільтрація та сортування
    const validRoutes = foundRoutes.filter(route => 
      route.emptyRunPercent <= config.maxEmptyRunPercent
    );

    const sortedRoutes = validRoutes
      .sort((a, b) => b.score - a.score)
      .slice(0, config.maxResults || OPTIMIZATION_PARAMS.DEFAULT_MAX_RESULTS);

    // 6. Конвертація в OptimizedRoute
    const optimizedRoutes: OptimizedRoute[] = [];
    for (const candidate of sortedRoutes) {
      try {
        const optimizedRoute = await convertToOptimizedRoute(candidate, config);
        optimizedRoutes.push(optimizedRoute);
      } catch (error) {
        console.error('Помилка конвертації маршруту:', error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Оптимізація завершена за ${totalTime}ms: ${optimizedRoutes.length} маршрутів`);

    return optimizedRoutes;

  } catch (error) {
    console.error('Критична помилка оптимізації:', error);
    throw error;
  }
}

/**
 * Експортована функція для useRouteManagement
 */
export async function createOptimizedRoutes(
  offers: FreightOffer[],
  homeBase: RoutePoint,
  maxEmptyRunPercent: number = DEFAULT_CONFIG.MAX_EMPTY_RUN_PERCENT,
  pricePerKm: number = DEFAULT_CONFIG.PRICE_PER_KM,
  averageSpeedKmh: number = DEFAULT_CONFIG.AVERAGE_SPEED_KMH,
  maxResults?: number,
  maxRouteDepth?: number,
  maxEmptyDistanceKm?: number,
  maxSearchTimeMs?: number,
  departureDate?: string,
  returnDate?: string
): Promise<OptimizedRoute[]> {
  // Валідація параметрів
  validateOptimizationConfig({
    maxEmptyRunPercent,
    pricePerKm,
    averageSpeedKmh,
    maxResults,
    maxRouteDepth,
    maxEmptyDistanceKm,
    maxSearchTimeMs
  });

  const config: OptimizationConfig = {
    homeBase,
    maxEmptyRunPercent,
    pricePerKm,
    averageSpeedKmh,
    maxResults: maxResults || OPTIMIZATION_PARAMS.DEFAULT_MAX_RESULTS,
    maxRouteDepth: maxRouteDepth || OPTIMIZATION_PARAMS.DEFAULT_MAX_ROUTE_DEPTH,
    maxEmptyDistanceKm: maxEmptyDistanceKm || SEARCH_LIMITS.DEFAULT_MAX_EMPTY_DISTANCE_KM,
    maxSearchTimeMs: maxSearchTimeMs || OPTIMIZATION_PARAMS.DEFAULT_MAX_SEARCH_TIME_MS,
    departureDate,
    returnDate
  };

  return await optimizeRoutes(offers, config);
}