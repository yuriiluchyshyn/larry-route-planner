/**
 * Road Optimizer - Оптимізація маршрутів на основі пропозицій
 * Знаходить оптимальні маршрути з домашньої бази з мінімальним порожнім пробігом
 */

import type { FreightOffer, OptimizedRoute, RouteSegment, RoutePoint } from '../../../../types';

interface OptimizationConfig {
  homeBase: RoutePoint;
  maxEmptyRunPercent: number; // максимальний відсоток порожнього пробігу (наприклад, 10%)
  pricePerKm: number; // ціна за км для розрахунку прибутку
  averageSpeedKmh: number; // середня швидкість вантажівки
  maxResults?: number; // максимальна кількість результатів
}

interface RouteCandidate {
  offers: FreightOffer[];
  totalDistance: number;
  loadedDistance: number;
  emptyDistance: number;
  emptyRunPercent: number;
  totalEarnings: number;
  score: number;
}

/**
 * Розрахунок відстані між двома точками (формула Haversine)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // радіус Землі в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Отримання координат точки завантаження з пропозиції
 */
function getLoadingCoordinates(offer: FreightOffer): { lat: number; lon: number; location: string } {
  const loadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'loading')
  );
  
  if (loadingSpot) {
    return {
      lat: loadingSpot.place.coordinates.latitude,
      lon: loadingSpot.place.coordinates.longitude,
      location: `${loadingSpot.place.address.locality}, ${loadingSpot.place.address.country}`
    };
  }
  
  // Fallback до першої точки
  const firstSpot = offer.freight.spots[0];
  return {
    lat: firstSpot.place.coordinates.latitude,
    lon: firstSpot.place.coordinates.longitude,
    location: `${firstSpot.place.address.locality}, ${firstSpot.place.address.country}`
  };
}

/**
 * Отримання координат точки розвантаження з пропозиції
 */
function getUnloadingCoordinates(offer: FreightOffer): { lat: number; lon: number; location: string } {
  const unloadingSpot = offer.freight.spots.find(spot => 
    spot.operations.some(op => op.type === 'unloading')
  );
  
  if (unloadingSpot) {
    return {
      lat: unloadingSpot.place.coordinates.latitude,
      lon: unloadingSpot.place.coordinates.longitude,
      location: `${unloadingSpot.place.address.locality}, ${unloadingSpot.place.address.country}`
    };
  }
  
  // Fallback до останньої точки
  const lastSpot = offer.freight.spots[offer.freight.spots.length - 1];
  return {
    lat: lastSpot.place.coordinates.latitude,
    lon: lastSpot.place.coordinates.longitude,
    location: `${lastSpot.place.address.locality}, ${lastSpot.place.address.country}`
  };
}

/**
 * Отримання дати завантаження з пропозиції
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
  
  // Fallback до першої операції
  return offer.freight.spots[0].operations[0].timespan.begin;
}

/**
 * Отримання дати розвантаження з пропозиції
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
  
  // Fallback до останньої операції
  const lastSpot = offer.freight.spots[offer.freight.spots.length - 1];
  return lastSpot.operations[lastSpot.operations.length - 1].timespan.end;
}

/**
 * Перевірка, чи можна взяти наступний офер після поточного:
 * 1. Наступний офер має завантажуватися в той самий ДЕНЬ або пізніше (порівнюємо тільки дати)
 * 2. Години гнучкі — можна домовитись з клієнтом
 * 3. Вантажівка має встигнути доїхати (з урахуванням відстані)
 */
function isTimeValid(
  currentOffer: FreightOffer, 
  nextOffer: FreightOffer, 
  emptyDistanceKm: number, 
  config: OptimizationConfig
): boolean {
  const unloadTimeStr = getUnloadingDate(currentOffer);
  const loadTimeStr = getLoadingDate(nextOffer);
  
  if (!unloadTimeStr || !loadTimeStr) return true; // Якщо немає дат — дозволяємо

  const unloadDate = new Date(unloadTimeStr);
  const loadDate = new Date(loadTimeStr);

  // Порівнюємо тільки ДАТИ (без годин), оскільки години гнучкі
  const unloadDay = new Date(unloadDate.getFullYear(), unloadDate.getMonth(), unloadDate.getDate());
  const loadDay = new Date(loadDate.getFullYear(), loadDate.getMonth(), loadDate.getDate());

  // Наступний офер має бути в той самий день або пізніше (не раніше за днем)
  if (loadDay < unloadDay) {
    return false;
  }

  return true;
}

/**
 * Створення сегмента маршруту з пропозиції
 */
function createRouteSegment(
  offer: FreightOffer, 
  config: OptimizationConfig,
  emptyDistanceToReach: number = 0
): RouteSegment {
  const loading = getLoadingCoordinates(offer);
  const unloading = getUnloadingCoordinates(offer);
  
  // Відстань завантаженого сегмента (з API або розрахована)
  const loadedDistance = offer.freight.route.distance 
    ? offer.freight.route.distance / 1000 // конвертуємо з метрів в км
    : calculateDistance(loading.lat, loading.lon, unloading.lat, unloading.lon);
  
  const drivingHours = loadedDistance / config.averageSpeedKmh;
  const restStops = Math.floor(drivingHours / 4.5); // перерва кожні 4.5 години
  
  return {
    offer,
    from: loading.location,
    to: unloading.location,
    distanceKm: loadedDistance,
    loadingDate: getLoadingDate(offer),
    unloadingDate: getUnloadingDate(offer),
    pricePerKm: offer.price.value ? offer.price.value / loadedDistance : null,
    isEmpty: false,
    emptyDistanceKm: emptyDistanceToReach,
    drivingHours,
    restStops
  };
}

/**
 * Знаходження найближчих пропозицій до домашньої бази (за точкою завантаження)
 */
function findOffersNearHomeLoading(offers: FreightOffer[], homeBase: RoutePoint, maxDistance: number = 200): Array<{ offer: FreightOffer; distance: number }> {
  return offers
    .map(offer => {
      const loading = getLoadingCoordinates(offer);
      const distance = calculateDistance(homeBase.latitude, homeBase.longitude, loading.lat, loading.lon);
      return { offer, distance };
    })
    .filter(item => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Знаходження пропозицій, які розвантажуються поблизу домашньої бази
 */
function findOffersNearHomeUnloading(offers: FreightOffer[], homeBase: RoutePoint, maxDistance: number = 200): Array<{ offer: FreightOffer; distance: number }> {
  return offers
    .map(offer => {
      const unloading = getUnloadingCoordinates(offer);
      const distance = calculateDistance(homeBase.latitude, homeBase.longitude, unloading.lat, unloading.lon);
      return { offer, distance };
    })
    .filter(item => item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Знаходження пропозицій, які можна поєднати в ланцюжок (з перевіркою часу)
 */
function findConnectableOffers(
  currentOffer: FreightOffer, 
  remainingOffers: FreightOffer[], 
  config: OptimizationConfig,
  maxEmptyDistance: number = 200
): FreightOffer[] {
  const currentUnloading = getUnloadingCoordinates(currentOffer);
  
  return remainingOffers
    .map(offer => {
      const nextLoading = getLoadingCoordinates(offer);
      const emptyDistance = calculateDistance(
        currentUnloading.lat, currentUnloading.lon, 
        nextLoading.lat, nextLoading.lon
      );
      return { offer, emptyDistance };
    })
    .filter(item => item.emptyDistance <= maxEmptyDistance)
    .filter(item => isTimeValid(currentOffer, item.offer, item.emptyDistance, config)) // Перевірка часу
    .sort((a, b) => a.emptyDistance - b.emptyDistance)
    .map(item => item.offer);
}

/**
 * Розрахунок відстані повернення додому
 */
function calculateReturnDistance(lastOffer: FreightOffer, homeBase: RoutePoint): number {
  const unloading = getUnloadingCoordinates(lastOffer);
  return calculateDistance(unloading.lat, unloading.lon, homeBase.latitude, homeBase.longitude);
}

/**
 * Побудова маршруту з ланцюжка пропозицій
 * Порожній пробіг = тільки переїзди між оферами (від розвантаження до наступного завантаження)
 * Повернення додому та виїзд з дому НЕ враховуються як порожній пробіг для фільтрації
 */
function buildRoute(offers: FreightOffer[], config: OptimizationConfig): RouteCandidate {
  const segments: RouteSegment[] = [];
  let totalDistance = 0;
  let loadedDistance = 0;
  let emptyDistance = 0; // тільки переїзди між оферами
  let deadheadDistance = 0; // виїзд з дому + повернення додому
  let totalEarnings = 0;

  // Відстань від дому до першої точки завантаження (deadhead, не empty)
  if (offers.length > 0) {
    const firstLoading = getLoadingCoordinates(offers[0]);
    const distanceFromHome = calculateDistance(
      config.homeBase.latitude, config.homeBase.longitude,
      firstLoading.lat, firstLoading.lon
    );
    deadheadDistance += distanceFromHome;
    totalDistance += distanceFromHome;
  }

  // Обробляємо кожну пропозицію
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    let emptyDistanceToReach = 0;

    // Якщо це не перша пропозиція, розраховуємо порожню відстань до неї
    if (i > 0) {
      const prevUnloading = getUnloadingCoordinates(offers[i - 1]);
      const currentLoading = getLoadingCoordinates(offer);
      emptyDistanceToReach = calculateDistance(
        prevUnloading.lat, prevUnloading.lon,
        currentLoading.lat, currentLoading.lon
      );
      emptyDistance += emptyDistanceToReach; // це реальний порожній пробіг між оферами
      totalDistance += emptyDistanceToReach;
    }

    // Створюємо сегмент
    const segment = createRouteSegment(offer, config, emptyDistanceToReach);
    segments.push(segment);

    // Додаємо до загальних показників
    loadedDistance += segment.distanceKm;
    totalDistance += segment.distanceKm;
    
    if (offer.price.value) {
      totalEarnings += offer.price.value;
    }
  }

  // Відстань повернення додому (deadhead, не empty)
  if (offers.length > 0) {
    const returnDistance = calculateReturnDistance(offers[offers.length - 1], config.homeBase);
    deadheadDistance += returnDistance;
    totalDistance += returnDistance;
  }

  // Порожній пробіг = тільки переїзди між оферами / загальна завантажена відстань
  // Це показує ефективність з'єднання оферів в ланцюжок
  const emptyRunPercent = loadedDistance > 0 ? (emptyDistance / loadedDistance) * 100 : 0;

  // Розрахунок score (вищий = кращий)
  // Враховуємо: більше завантажених км, менше порожніх переїздів, менше deadhead, більший прибуток
  const score = loadedDistance * 10 - emptyDistance * 5 - deadheadDistance * 2 + totalEarnings * 0.1;

  return {
    offers,
    totalDistance,
    loadedDistance,
    emptyDistance: emptyDistance + deadheadDistance, // для відображення показуємо повний порожній пробіг
    emptyRunPercent,
    totalEarnings,
    score
  };
}

/**
 * Конвертація кандидата в OptimizedRoute
 */
function convertToOptimizedRoute(candidate: RouteCandidate, config: OptimizationConfig): OptimizedRoute {
  const segments = candidate.offers.map((offer, index) => {
    let emptyDistanceToReach = 0;
    
    if (index === 0) {
      const firstLoading = getLoadingCoordinates(offer);
      emptyDistanceToReach = calculateDistance(
        config.homeBase.latitude, config.homeBase.longitude,
        firstLoading.lat, firstLoading.lon
      );
    } else {
      const prevUnloading = getUnloadingCoordinates(candidate.offers[index - 1]);
      const currentLoading = getLoadingCoordinates(offer);
      emptyDistanceToReach = calculateDistance(
        prevUnloading.lat, prevUnloading.lon,
        currentLoading.lat, currentLoading.lon
      );
    }
    
    return createRouteSegment(offer, config, emptyDistanceToReach);
  });

  const totalDrivingHours = segments.reduce((sum, seg) => sum + seg.drivingHours, 0);
  const totalDays = Math.max(1, totalDrivingHours / 8); 
  const mandatoryBreaks = segments.reduce((sum, seg) => sum + seg.restStops, 0);
  const totalRestHours = mandatoryBreaks * 0.75; 
  const idleHours = Math.max(0, totalDays * 24 - totalDrivingHours - totalRestHours - (totalDays * 11)); 
  const weeklyRestsNeeded = Math.floor(totalDays / 7);

  const avgDailyDriving = totalDrivingHours / totalDays;
  const euCompliant = avgDailyDriving <= 9 && candidate.emptyRunPercent <= config.maxEmptyRunPercent;

  return {
    segments,
    totalDistanceKm: candidate.totalDistance,
    loadedDistanceKm: candidate.loadedDistance,
    emptyDistanceKm: candidate.emptyDistance,
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
 * Основна функція оптимізації маршрутів
 */
export function optimizeRoutes(
  offers: FreightOffer[], 
  config: OptimizationConfig
): OptimizedRoute[] {
  console.log(`🚀 Початок оптимізації маршрутів: ${offers.length} пропозицій`);
  console.log(`🏠 Домашня база: ${config.homeBase.locality} (${config.homeBase.latitude}, ${config.homeBase.longitude})`);
  
  if (offers.length === 0) return [];

  const routes: RouteCandidate[] = [];
  const maxEmptyPercent = config.maxEmptyRunPercent;
  
  // 1. Знаходимо офери, які ЗАВАНТАЖУЮТЬСЯ поблизу дому (старт маршруту)
  const startOffers = findOffersNearHomeLoading(offers, config.homeBase, 300);
  console.log(`📍 Знайдено ${startOffers.length} пропозицій для старту (завантаження поблизу дому)`);

  // 2. Знаходимо офери, які РОЗВАНТАЖУЮТЬСЯ поблизу дому (кінець маршруту)
  const endOffers = findOffersNearHomeUnloading(offers, config.homeBase, 300);
  console.log(`📍 Знайдено ${endOffers.length} пропозицій для фінішу (розвантаження поблизу дому)`);

  // 3. Будуємо маршрути
  for (const startItem of startOffers) {
    const startOffer = startItem.offer;

    // 3a. Маршрут з 1 офера (завантаження І розвантаження поблизу дому)
    const unloadingOfStart = getUnloadingCoordinates(startOffer);
    const returnDistanceFromStart = calculateDistance(
      unloadingOfStart.lat, unloadingOfStart.lon,
      config.homeBase.latitude, config.homeBase.longitude
    );
    if (returnDistanceFromStart <= 300) {
      const route = buildRoute([startOffer], config);
      if (route.emptyRunPercent <= maxEmptyPercent) {
        routes.push(route);
      }
    }

    // 3b. Маршрут з 2 оферів: startOffer → endOffer (розвантаження поблизу дому)
    for (const endItem of endOffers) {
      const endOffer = endItem.offer;
      if (endOffer.id === startOffer.id) continue;

      const startUnloading = getUnloadingCoordinates(startOffer);
      const endLoading = getLoadingCoordinates(endOffer);
      const gapDistance = calculateDistance(
        startUnloading.lat, startUnloading.lon,
        endLoading.lat, endLoading.lon
      );

      // Перевіряємо відстань та час
      if (gapDistance <= 200 && isTimeValid(startOffer, endOffer, gapDistance, config)) {
        const route = buildRoute([startOffer, endOffer], config);
        if (route.emptyRunPercent <= maxEmptyPercent) {
          routes.push(route);
        }
      }
    }

    // 3c. Маршрут з 3 оферів: startOffer → middleOffer → endOffer
    if (routes.length < 2000) {
      const startUnloading = getUnloadingCoordinates(startOffer);
      const middleOffers = offers
        .filter(o => o.id !== startOffer.id)
        .map(offer => {
          const loading = getLoadingCoordinates(offer);
          const gap = calculateDistance(startUnloading.lat, startUnloading.lon, loading.lat, loading.lon);
          return { offer, gap };
        })
        .filter(item => item.gap <= 150)
        .filter(item => isTimeValid(startOffer, item.offer, item.gap, config)) // Перевірка часу
        .sort((a, b) => a.gap - b.gap)
        .slice(0, 15);

      for (const middleItem of middleOffers) {
        const middleOffer = middleItem.offer;
        const middleUnloading = getUnloadingCoordinates(middleOffer);
        
        for (const endItem of endOffers.slice(0, 20)) {
          const endOffer = endItem.offer;
          if (endOffer.id === startOffer.id || endOffer.id === middleOffer.id) continue;

          const endLoading = getLoadingCoordinates(endOffer);
          const gapToEnd = calculateDistance(
            middleUnloading.lat, middleUnloading.lon,
            endLoading.lat, endLoading.lon
          );

          // Перевіряємо відстань та час
          if (gapToEnd <= 150 && isTimeValid(middleOffer, endOffer, gapToEnd, config)) {
            const route = buildRoute([startOffer, middleOffer, endOffer], config);
            if (route.emptyRunPercent <= maxEmptyPercent) {
              routes.push(route);
            }
          }
        }
      }
    }
  }

  console.log(`🔧 Створено ${routes.length} кандидатів маршрутів`);

  if (routes.length === 0) {
    console.warn(`⚠️ Жоден маршрут не знайдено. Спробуйте збільшити maxEmptyRunPercent (зараз: ${maxEmptyPercent}%)`);
  }

  // 4. Сортуємо за score
  const sortedRoutes = routes
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxResults || 50);

  console.log(`✅ Відібрано ${sortedRoutes.length} найкращих маршрутів`);

  // 5. Конвертуємо в OptimizedRoute
  return sortedRoutes.map(candidate => convertToOptimizedRoute(candidate, config));
}

/**
 * Експортована функція для використання в useRouteManagement
 */
export function createOptimizedRoutes(
  offers: FreightOffer[],
  homeBase: RoutePoint,
  maxEmptyRunPercent: number = 10,
  pricePerKm: number = 1.5,
  averageSpeedKmh: number = 80,
  maxResults?: number
): OptimizedRoute[] {
  const config: OptimizationConfig = {
    homeBase,
    maxEmptyRunPercent,
    pricePerKm,
    averageSpeedKmh,
    maxResults
  };

  return optimizeRoutes(offers, config);
}