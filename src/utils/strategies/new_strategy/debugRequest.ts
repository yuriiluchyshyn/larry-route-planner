/**
 * Debug Request Helper
 * Допомагає діагностувати проблеми з запитами до Trans.eu API
 */

import { createTranseuFilter, createSortParams } from './route/proxy/proxyConfig';
import { getOptimizationConfig } from './route/config/optimizationConfig';

/**
 * Діагностика запиту - порівняння з еталонним
 */
export function debugRequest(config: any) {
  console.log('🔍 ДІАГНОСТИКА ЗАПИТУ');
  console.log('='.repeat(50));
  
  // Отримуємо конфігурацію оптимізації
  const optimizationConfig = getOptimizationConfig();
  const defaultRadius = optimizationConfig.locationFiltering.defaultRadius;
  
  console.log('📋 Конфігурація з додатку:');
  console.log('loadingPoints:', config.loadingPoints);
  console.log('unloadingPoints:', config.unloadingPoints);
  console.log('minCapacity:', config.minCapacity);
  console.log('maxCapacity:', config.maxCapacity);
  console.log('');
  
  // Формуємо параметри як у fetchFreightOffers
  const loadingPlace = config.loadingPoints?.[0] ? {
    locality: config.loadingPoints[0].locality,
    country: config.loadingPoints[0].country,
    coordinates: config.loadingPoints[0].latitude && config.loadingPoints[0].longitude ? {
      latitude: config.loadingPoints[0].latitude,
      longitude: config.loadingPoints[0].longitude,
      range: config.loadingPoints[0].range || defaultRadius
    } : undefined
  } : undefined;
  
  const unloadingPlace = config.unloadingPoints?.[0] ? {
    locality: config.unloadingPoints[0].locality,
    country: config.unloadingPoints[0].country,
    coordinates: config.unloadingPoints[0].latitude && config.unloadingPoints[0].longitude ? {
      latitude: config.unloadingPoints[0].latitude,
      longitude: config.unloadingPoints[0].longitude,
      range: config.unloadingPoints[0].range || defaultRadius
    } : undefined
  } : undefined;
  
  console.log('🔧 Сформовані параметри для API:');
  console.log('loadingPlace:', JSON.stringify(loadingPlace, null, 2));
  console.log('unloadingPlace:', JSON.stringify(unloadingPlace, null, 2));
  console.log('');
  
  // Створюємо фільтр
  const filter = createTranseuFilter({
    loadingPlace,
    unloadingPlace,
    excludeSuspended: true,
    placesMatchingType: 'cross',
    minCapacity: config.minCapacity,
    maxCapacity: config.maxCapacity,
    vehicleSizes: optimizationConfig.vehicle.defaultSizes,
    requiredVehicleSizes: optimizationConfig.vehicle.requiredSizes,
    defaultRadius
  });
  
  const sort = createSortParams('index', 'desc');
  
  console.log('📊 Згенерований фільтр:');
  console.log(JSON.stringify(JSON.parse(filter), null, 2));
  console.log('');
  
  // Еталонний фільтр з Trans.eu
  const referenceFilter = {
    "loading_place": [{
      "address": {
        "country": ["47_poland"],
        "locality": "Kraków",
        "postal_code": "30-001"
      },
      "coordinates": {
        "latitude": 50.077850516,
        "longitude": 19.94171128,
        "range": 50
      }
    }],
    "unloading_place": [{
      "address": {
        "country": ["47_poland"],
        "locality": "Gdańsk",
        "postal_code": "80-001"
      },
      "coordinates": {
        "latitude": 54.301647169,
        "longitude": 18.63101292,
        "range": 50
      }
    }],
    "places_matching_type": "cross",
    "size": ["2_double_trailer", "3_lorry", "5_solo"],
    "required_vehicle_size": ["2_double_trailer", "3_lorry", "5_solo"],
    "exclude_suspended": true
  };
  
  console.log('🎯 Еталонний фільтр Trans.eu:');
  console.log(JSON.stringify(referenceFilter, null, 2));
  console.log('');
  
  // Порівняння
  const ourFilter = JSON.parse(filter);
  
  console.log('📈 ПОРІВНЯННЯ:');
  console.log('='.repeat(30));
  
  // Перевіряємо loading_place
  const ourLoading = ourFilter.loading_place?.[0];
  const refLoading = referenceFilter.loading_place[0];
  
  console.log('📍 Loading Place:');
  console.log(`  Locality: ${ourLoading?.address?.locality} vs ${refLoading.address.locality} ${ourLoading?.address?.locality === refLoading.address.locality ? '✅' : '❌'}`);
  console.log(`  Country: ${ourLoading?.address?.country?.[0]} vs ${refLoading.address.country[0]} ${ourLoading?.address?.country?.[0] === refLoading.address.country[0] ? '✅' : '❌'}`);
  console.log(`  Postal Code: ${ourLoading?.address?.postal_code} vs ${refLoading.address.postal_code} ${ourLoading?.address?.postal_code === refLoading.address.postal_code ? '✅' : '❌'}`);
  console.log(`  Coordinates: ${JSON.stringify(ourLoading?.coordinates)} vs ${JSON.stringify(refLoading.coordinates)}`);
  
  // Перевіряємо unloading_place
  const ourUnloading = ourFilter.unloading_place?.[0];
  const refUnloading = referenceFilter.unloading_place[0];
  
  console.log('📍 Unloading Place:');
  console.log(`  Locality: ${ourUnloading?.address?.locality} vs ${refUnloading.address.locality} ${ourUnloading?.address?.locality === refUnloading.address.locality ? '✅' : '❌'}`);
  console.log(`  Country: ${ourUnloading?.address?.country?.[0]} vs ${refUnloading.address.country[0]} ${ourUnloading?.address?.country?.[0] === refUnloading.address.country[0] ? '✅' : '❌'}`);
  console.log(`  Postal Code: ${ourUnloading?.address?.postal_code} vs ${refUnloading.address.postal_code} ${ourUnloading?.address?.postal_code === refUnloading.address.postal_code ? '✅' : '❌'}`);
  
  // Перевіряємо розміри транспорту
  console.log('🚛 Vehicle Sizes:');
  console.log(`  Size: ${JSON.stringify(ourFilter.size)} vs ${JSON.stringify(referenceFilter.size)} ${JSON.stringify(ourFilter.size) === JSON.stringify(referenceFilter.size) ? '✅' : '❌'}`);
  console.log(`  Required Size: ${JSON.stringify(ourFilter.required_vehicle_size)} vs ${JSON.stringify(referenceFilter.required_vehicle_size)} ${JSON.stringify(ourFilter.required_vehicle_size) === JSON.stringify(referenceFilter.required_vehicle_size) ? '✅' : '❌'}`);
  
  console.log('');
  console.log('🔗 Повний URL запиту:');
  const baseUrl = 'http://localhost:8848/app/exchange/api/rest/v2/freight-offers';
  const params = new URLSearchParams({
    filter,
    sort,
    counters: JSON.stringify(['all']),
    limit: '1000'
  });
  
  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log(fullUrl);
  
  return {
    ourFilter,
    referenceFilter,
    fullUrl,
    differences: {
      loadingLocality: ourLoading?.address?.locality !== refLoading.address.locality,
      unloadingLocality: ourUnloading?.address?.locality !== refUnloading.address.locality,
      loadingCountry: ourLoading?.address?.country?.[0] !== refLoading.address.country[0],
      unloadingCountry: ourUnloading?.address?.country?.[0] !== refUnloading.address.country[0]
    }
  };
}

/**
 * Тестування з еталонними параметрами Trans.eu
 */
export function testWithReferenceParams() {
  console.log('🎯 ТЕСТУВАННЯ З ЕТАЛОННИМИ ПАРАМЕТРАМИ');
  console.log('='.repeat(50));
  
  // Еталонні параметри з Trans.eu
  const referenceConfig = {
    loadingPoints: [{
      id: 'lp1',
      locality: 'Kraków',
      postalCode: '30-001',
      country: '47_poland',
      latitude: 50.077850516,
      longitude: 19.94171128,
      range: 50,
    }],
    unloadingPoints: [{
      id: 'up1',
      locality: 'Gdańsk',
      postalCode: '80-001',
      country: '47_poland',
      latitude: 54.301647169,
      longitude: 18.63101292,
      range: 50,
    }],
    minCapacity: 0,
    maxCapacity: undefined
  };
  
  console.log('📋 Використовуємо еталонні параметри:');
  console.log('Loading: Kraków, 30-001, 47_poland');
  console.log('Unloading: Gdańsk, 80-001, 47_poland');
  console.log('');
  
  return debugRequest(referenceConfig);
}

/**
 * Порівняння результатів з різними конфігураціями
 */
export async function compareConfigurations() {
  console.log('🔄 ПОРІВНЯННЯ КОНФІГУРАЦІЙ');
  console.log('='.repeat(50));
  
  // Конфігурація за замовчуванням (Berlin)
  const defaultConfig = {
    loadingPoints: [{
      locality: 'Kraków',
      postalCode: '30-001',
      country: '47_poland',
      latitude: 50.077850516,
      longitude: 19.94171128,
      range: 50,
    }],
    unloadingPoints: [{
      locality: 'Berlin',
      postalCode: '10115',
      country: '21_germany',
      latitude: 52.5319105,
      longitude: 13.384131422,
      range: 50,
    }]
  };
  
  // Еталонна конфігурація (Gdańsk)
  const referenceConfig = {
    loadingPoints: [{
      locality: 'Kraków',
      postalCode: '30-001',
      country: '47_poland',
      latitude: 50.077850516,
      longitude: 19.94171128,
      range: 50,
    }],
    unloadingPoints: [{
      locality: 'Gdańsk',
      postalCode: '80-001',
      country: '47_poland',
      latitude: 54.301647169,
      longitude: 18.63101292,
      range: 50,
    }]
  };
  
  console.log('1️⃣ Конфігурація за замовчуванням (Kraków → Berlin):');
  const defaultResult = debugRequest(defaultConfig);
  
  console.log('\n2️⃣ Еталонна конфігурація (Kraków → Gdańsk):');
  const referenceResult = debugRequest(referenceConfig);
  
  console.log('\n📊 ВИСНОВКИ:');
  console.log('='.repeat(30));
  console.log('Основна відмінність: пункт призначення');
  console.log(`Default: ${defaultConfig.unloadingPoints[0].locality} (${defaultConfig.unloadingPoints[0].country})`);
  console.log(`Reference: ${referenceConfig.unloadingPoints[0].locality} (${referenceConfig.unloadingPoints[0].country})`);
  console.log('');
  console.log('💡 Рекомендація: Використовуйте еталонну конфігурацію для отримання 80 результатів');
  
  return {
    defaultResult,
    referenceResult
  };
}

/**
 * Експорт для використання в консолі браузера
 */
if (typeof window !== 'undefined') {
  (window as any).debugTranseuRequest = {
    debug: debugRequest,
    testReference: testWithReferenceParams,
    compare: compareConfigurations
  };
}