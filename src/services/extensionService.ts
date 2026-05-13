/**
 * Extension Service
 * Сервіс для роботи з browser extension
 */

import type { FreightOffer, RouteConfig } from '../types';
import { RoutePointType } from '../types';
import { RouteStrategy } from '../utils/routeStrategy';
import { convertVehicleTypesToApiCodes } from '../utils/vehicleTypeMapper';

export interface ExtensionMessage {
  type: string;
  [key: string]: any;
}

export interface OfferSearchData {
  type: 'FIND_AND_CLICK_OFFER';
  offerId: string;
  companyName: string;
  loadingCity: string;
  unloadingCity: string;
  loadingCountry: string;
  unloadingCountry: string;
  scrollToElement: boolean;
  highlightElement: boolean;
  maxPagesToSearch: number;
}

/**
 * Перевірити чи додаток працює в контексті extension
 */
export function isInExtensionContext(): boolean {
  // Дозволяємо перевизначити режим через window.__forceStandaloneMode
  if ((window as any).__forceStandaloneMode) {
    return false;
  }
  
  // Перевіряємо чи є параметр в URL для standalone режиму
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('standalone') === 'true') {
    return false;
  }
  
  return window.parent !== window;
}

/**
 * Відправити запит на токен до extension
 */
export function requestTokenFromExtension(): void {
  if (!isInExtensionContext()) return;
  
  console.log('Larry: Requesting token from extension...');
  window.parent.postMessage({ type: 'REQUEST_TOKEN' }, '*');
}

/**
 * Відправити запит на фільтри до extension
 */
export function requestFiltersFromExtension(): void {
  if (!isInExtensionContext()) return;
  
  console.log('Larry: Requesting filters from extension...');
  window.parent.postMessage({ type: 'REQUEST_FILTERS' }, '*');
}

/**
 * Відправити запит на пошук пропозиції на головній сторінці
 */
export function searchOfferOnMainPage(offer: FreightOffer): void {
  if (!isInExtensionContext()) {
    console.log('Larry: Not in extension context, cannot search on main page');
    throw new Error('Функція пошуку доступна тільки в розширенні браузера');
  }
  
  console.log('Larry: Requesting search for offer on main page:', offer.id);
  
  // Extract offer details for search
  const loadingSpot = offer.freight.spots.find(s => 
    s.operations.some(o => o.type === 'loading')
  );
  const unloadingSpot = offer.freight.spots.find(s => 
    s.operations.some(o => o.type === 'unloading')
  );
  
  const searchData: OfferSearchData = {
    type: 'FIND_AND_CLICK_OFFER',
    offerId: offer.id,
    companyName: offer.company.legal_name,
    loadingCity: loadingSpot?.place.address.locality || '',
    unloadingCity: unloadingSpot?.place.address.locality || '',
    loadingCountry: loadingSpot?.place.address.country || '',
    unloadingCountry: unloadingSpot?.place.address.country || '',
    scrollToElement: true,
    highlightElement: true,
    maxPagesToSearch: 10
  };
  
  // Send request to extension to find and click the offer
  window.parent.postMessage(searchData, '*');
}

/**
 * Обробити фільтри отримані з extension
 */
export function processFiltersFromExtension(filters: any, currentConfig: RouteConfig | null): RouteConfig {
  console.log('🔧 Extension Service: Processing filters from extension:', filters);
  
  // Якщо конфігурації немає, створюємо базову
  const baseConfig: RouteConfig = currentConfig || {
    apiUrl: '/api/trans/app/exchange/api/rest/v2/freight-offers',
    bearerToken: '',
    routes: [], // Новий формат - масив RoutePoint
    minWeight: 0,
    maxWeight: undefined,
    minCapacity: 0,
    maxCapacity: undefined,
    vehicleTypes: [],
    placesMatchingType: 'cross',
    maxEmptyRunPercent: 10,
    includeReturnRoute: true,
    departureDate: new Date().toISOString().split('T')[0],
    returnDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    useAIOptimization: false,
    routeStrategy: RouteStrategy.NEW_STRATEGY,
    pricePerKm: 1.5,
    averageSpeedKmh: 80,
  };

  const newConfig = { ...baseConfig };
  
  // Log current config before update
  console.log('Larry: Current config before update:', {
    minWeight: newConfig.minWeight,
    maxWeight: newConfig.maxWeight,
    minCapacity: newConfig.minCapacity,
    maxCapacity: newConfig.maxCapacity,
    vehicleTypes: newConfig.vehicleTypes,
    placesMatchingType: newConfig.placesMatchingType
  });
  
  // Helper to deduplicate points by country+locality+postalCode key
  const dedupe = (points: any[]) => {
    const seen = new Set<string>();
    return points.filter(p => {
      const key = `${p.country || ''}|${p.locality || ''}|${p.postalCode || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  
  // Створюємо масив RoutePoint з усіх точок
  const allRoutePoints: any[] = [];
  
  // Функція для виправлення неправильних кодів країн
  const fixCountryCode = (countryCode: string): string => {
    const countryCodeFixes: Record<string, string> = {
      '33_france': '19_france', // Виправляємо неправильний код Франції
    };
    return countryCodeFixes[countryCode] || countryCode;
  };
  
  // Додаємо loading points як LOADING_POINT
  if (filters.loadingPoints && filters.loadingPoints.length > 0) {
    const dedupedLoading = dedupe(filters.loadingPoints);
    console.log(`🚛 Extension Service: Loading points: ${filters.loadingPoints.length} from extension, ${dedupedLoading.length} after dedupe`);
    
    const loadingRoutePoints = dedupedLoading.map((point: any, index: number) => ({
      id: point.id || `lp${index + 1}`,
      type: RoutePointType.LOADING_POINT,
      locality: point.locality || '',
      postalCode: point.postalCode || '',
      country: fixCountryCode(point.country || '47_poland'), // Виправляємо код країни
      latitude: 0, // Always 0 - geocoder will fill these
      longitude: 0,
      range: point.range || 50,
      extensionAddress: point.extensionAddress // Передаємо extensionAddress для геокодування
    }));
    
    allRoutePoints.push(...loadingRoutePoints);
    console.log('🚛 Extension Service: Processed loading points:', loadingRoutePoints);
  }
  
  // Додаємо unloading points як UNLOADING_POINT
  if (filters.unloadingPoints && filters.unloadingPoints.length > 0) {
    const dedupedUnloading = dedupe(filters.unloadingPoints);
    console.log(`🚚 Extension Service: Unloading points: ${filters.unloadingPoints.length} from extension, ${dedupedUnloading.length} after dedupe`);
    
    const unloadingRoutePoints = dedupedUnloading.map((point: any, index: number) => ({
      id: point.id || `up${index + 1}`,
      type: RoutePointType.UNLOADING_POINT,
      locality: point.locality || '',
      postalCode: point.postalCode || '',
      country: fixCountryCode(point.country || '21_germany'), // Виправляємо код країни
      latitude: 0, // Always 0 - geocoder will fill these
      longitude: 0,
      range: point.range || 50,
      extensionAddress: point.extensionAddress // Передаємо extensionAddress для геокодування
    }));
    
    allRoutePoints.push(...unloadingRoutePoints);
    console.log('🚚 Extension Service: Processed unloading points:', unloadingRoutePoints);
  }
  
  // Додаємо домашню базу як HOME_POINT якщо є
  if (filters.homeBase && filters.homeBase.locality) {
    const homeRoutePoint = {
      id: 'home',
      type: RoutePointType.HOME_POINT,
      locality: filters.homeBase.locality || '',
      postalCode: filters.homeBase.postalCode || '',
      country: fixCountryCode(filters.homeBase.country || ''), // Виправляємо код країни
      latitude: filters.homeBase.latitude || 0,
      longitude: filters.homeBase.longitude || 0,
      range: filters.homeBase.range || 50,
    };
    
    allRoutePoints.push(homeRoutePoint);
    console.log('🏠 Extension Service: Processed home base:', homeRoutePoint);
  }
  
  // Встановлюємо всі точки в новий формат
  newConfig.routes = allRoutePoints;
  console.log('🔧 Extension Service: All route points:', allRoutePoints);
  
  // Update weight with detailed logging
  if (filters.minWeight !== undefined && filters.minWeight !== null) {
    console.log('Larry: Setting minWeight from extension:', filters.minWeight);
    newConfig.minWeight = filters.minWeight;
  }
  if (filters.maxWeight !== undefined && filters.maxWeight !== null) {
    console.log('Larry: Setting maxWeight from extension:', filters.maxWeight);
    newConfig.maxWeight = filters.maxWeight;
  }
  // Update capacity from extension
  if (filters.minCapacity !== undefined && filters.minCapacity !== null) {
    console.log('Larry: Setting minCapacity from extension:', filters.minCapacity);
    newConfig.minCapacity = filters.minCapacity;
  }
  if (filters.maxCapacity !== undefined && filters.maxCapacity !== null) {
    console.log('Larry: Setting maxCapacity from extension:', filters.maxCapacity);
    newConfig.maxCapacity = filters.maxCapacity;
  }
  
  // Update vehicle types from extension
  if (filters.vehicleTypes && Array.isArray(filters.vehicleTypes)) {
    console.log('Larry: Setting vehicleTypes from extension:', filters.vehicleTypes);
    // Конвертуємо українські назви в API коди
    const apiCodes = convertVehicleTypesToApiCodes(filters.vehicleTypes);
    newConfig.vehicleTypes = apiCodes;
    console.log('Larry: Converted to API codes:', apiCodes);
  }
  
  // Update places matching type from extension
  if (filters.placesMatchingType && (filters.placesMatchingType === 'cross' || filters.placesMatchingType === 'pairs')) {
    console.log('Larry: Setting placesMatchingType from extension:', filters.placesMatchingType);
    newConfig.placesMatchingType = filters.placesMatchingType;
  }
  
  // Log final config after update
  console.log('Larry: Final config after update:', {
    routes: newConfig.routes,
    minWeight: newConfig.minWeight,
    maxWeight: newConfig.maxWeight,
    minCapacity: newConfig.minCapacity,
    maxCapacity: newConfig.maxCapacity,
    vehicleTypes: newConfig.vehicleTypes,
    placesMatchingType: newConfig.placesMatchingType
  });
  
  return newConfig;
}