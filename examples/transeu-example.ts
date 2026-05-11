/**
 * Приклад використання Trans.eu API для розрахунку маршрутів
 * 
 * Цей файл демонструє, як використовувати новий Trans.eu клієнт
 * для точного розрахунку маршрутів між європейськими містами.
 */

import { 
  transeuRouteClient, 
  calculateAccurateDistance, 
  optimizeRouteOrder,
  DEFAULT_TRUCK_PROFILE,
  DEFAULT_VAN_PROFILE 
} from '../src/utils/transeuRouteClient';

// Приклад 1: Простий розрахунок маршруту між двома містами
async function exampleSimpleRoute() {
  console.log('🚛 Приклад 1: Краків → Берлін');
  
  try {
    const result = await calculateAccurateDistance(
      { lat: 50.0619474, lon: 19.9368564 }, // Краків
      { lat: 52.5170365, lon: 13.3888599 }, // Берлін
      'truck'
    );
    
    console.log(`📏 Відстань: ${result.distanceKm.toFixed(0)} км`);
    console.log(`⏱️ Час подорожі: ${result.timeHours.toFixed(1)} год`);
    console.log(`💰 Платні дороги: €${result.tollEur.toFixed(2)}`);
    console.log(`⛽ Споживання палива: ${result.fuelConsumption.toFixed(1)} л`);
    console.log(`🌱 Викиди CO₂: ${result.co2Emissions.toFixed(1)} кг`);
    
  } catch (error) {
    console.error('❌ Помилка розрахунку маршруту:', error);
  }
}

// Приклад 2: Розрахунок маршруту з кількома точками
async function exampleMultiPointRoute() {
  console.log('\n🚛 Приклад 2: Маршрут через кілька міст');
  
  const waypoints = [
    { latitude: 50.0619474, longitude: 19.9368564, name: 'Краків' },
    { latitude: 50.0874654, longitude: 14.4212535, name: 'Прага' },
    { latitude: 52.5170365, longitude: 13.3888599, name: 'Берлін' },
    { latitude: 52.2319581, longitude: 21.0067249, name: 'Варшава' }
  ];
  
  try {
    const response = await transeuRouteClient.calculateRoute(waypoints, {
      vehicleProfile: DEFAULT_TRUCK_PROFILE,
      routingMode: 'FAST',
      loadWeight: 25000
    });
    
    const route = response.route.properties;
    
    console.log(`📏 Загальна відстань: ${(route.distance / 1000).toFixed(0)} км`);
    console.log(`⏱️ Загальний час: ${(route.travel_time / 3600).toFixed(1)} год`);
    console.log(`💰 Загальні платні дороги: €${route.toll.total_cost_EUR.toFixed(2)}`);
    console.log(`⛽ Загальне споживання палива: ${route.emissions.iso14083_2023.fuel_consumption.toFixed(1)} л`);
    console.log(`🌱 Загальні викиди CO₂: ${route.emissions.iso14083_2023.co2e_well_to_wheel.toFixed(1)} кг`);
    
    // Деталі по країнах
    console.log('\n💰 Платні дороги по країнах:');
    for (const [country, data] of Object.entries(route.toll.countries)) {
      console.log(`  ${country}: €${data.cost.price.toFixed(2)}`);
      for (const [system, systemData] of Object.entries(data.systems)) {
        console.log(`    - ${systemData.name}: €${systemData.cost.price.toFixed(2)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Помилка розрахунку багатоточкового маршруту:', error);
  }
}

// Приклад 3: Оптимізація порядку точок
async function exampleRouteOptimization() {
  console.log('\n🚛 Приклад 3: Оптимізація порядку міст');
  
  const cities = [
    { lat: 50.0619474, lon: 19.9368564, id: 'krakow' }, // Краків
    { lat: 50.0874654, lon: 14.4212535, id: 'prague' }, // Прага
    { lat: 52.5170365, lon: 13.3888599, id: 'berlin' }, // Берлін
    { lat: 52.2319581, lon: 21.0067249, id: 'warsaw' }, // Варшава
    { lat: 48.2083537, lon: 16.3725042, id: 'vienna' }  // Відень
  ];
  
  try {
    const optimization = await optimizeRouteOrder(cities, 'truck');
    
    console.log('📍 Оптимальний порядок міст:');
    optimization.optimizedOrder.forEach((cityId, index) => {
      const city = cities.find(c => c.id === cityId);
      console.log(`  ${index + 1}. ${cityId}`);
    });
    
    console.log(`\n📊 Результати оптимізації:`);
    console.log(`📏 Загальна відстань: ${optimization.totalDistance.toFixed(0)} км`);
    console.log(`⏱️ Загальний час: ${optimization.totalTime.toFixed(1)} год`);
    console.log(`💰 Загальні платні дороги: €${optimization.totalToll.toFixed(2)}`);
    console.log(`⛽ Загальне споживання палива: ${optimization.totalFuelConsumption.toFixed(1)} л`);
    console.log(`🌱 Загальні викиди CO₂: ${optimization.totalCo2Emissions.toFixed(1)} кг`);
    
  } catch (error) {
    console.error('❌ Помилка оптимізації маршруту:', error);
  }
}

// Приклад 4: Порівняння вантажівки та фургона
async function exampleVehicleComparison() {
  console.log('\n🚛 Приклад 4: Порівняння вантажівки та фургона');
  
  const from = { lat: 50.0619474, lon: 19.9368564 }; // Краків
  const to = { lat: 52.5170365, lon: 13.3888599 };   // Берлін
  
  try {
    console.log('🚚 Вантажівка (40т):');
    const truckResult = await calculateAccurateDistance(from, to, 'truck');
    console.log(`  📏 Відстань: ${truckResult.distanceKm.toFixed(0)} км`);
    console.log(`  ⏱️ Час: ${truckResult.timeHours.toFixed(1)} год`);
    console.log(`  💰 Платні дороги: €${truckResult.tollEur.toFixed(2)}`);
    console.log(`  ⛽ Паливо: ${truckResult.fuelConsumption.toFixed(1)} л`);
    console.log(`  🌱 CO₂: ${truckResult.co2Emissions.toFixed(1)} кг`);
    
    console.log('\n🚐 Фургон (3.5т):');
    const vanResult = await calculateAccurateDistance(from, to, 'van');
    console.log(`  📏 Відстань: ${vanResult.distanceKm.toFixed(0)} км`);
    console.log(`  ⏱️ Час: ${vanResult.timeHours.toFixed(1)} год`);
    console.log(`  💰 Платні дороги: €${vanResult.tollEur.toFixed(2)}`);
    console.log(`  ⛽ Паливо: ${vanResult.fuelConsumption.toFixed(1)} л`);
    console.log(`  🌱 CO₂: ${vanResult.co2Emissions.toFixed(1)} кг`);
    
    // Порівняння
    console.log('\n📊 Порівняння:');
    const tollDiff = truckResult.tollEur - vanResult.tollEur;
    const fuelDiff = truckResult.fuelConsumption - vanResult.fuelConsumption;
    const co2Diff = truckResult.co2Emissions - vanResult.co2Emissions;
    
    console.log(`  💰 Різниця в платних дорогах: €${tollDiff.toFixed(2)} (${((tollDiff / vanResult.tollEur) * 100).toFixed(1)}%)`);
    console.log(`  ⛽ Різниця в паливі: ${fuelDiff.toFixed(1)} л (${((fuelDiff / vanResult.fuelConsumption) * 100).toFixed(1)}%)`);
    console.log(`  🌱 Різниця в CO₂: ${co2Diff.toFixed(1)} кг (${((co2Diff / vanResult.co2Emissions) * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Помилка порівняння транспорту:', error);
  }
}

// Приклад 5: Перевірка доступності сервісу
async function exampleHealthCheck() {
  console.log('\n🚛 Приклад 5: Перевірка доступності Trans.eu API');
  
  try {
    const isHealthy = await transeuRouteClient.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Trans.eu API доступний та працює');
    } else {
      console.log('❌ Trans.eu API недоступний');
    }
    
  } catch (error) {
    console.error('❌ Помилка перевірки доступності:', error);
  }
}

// Запуск всіх прикладів
async function runAllExamples() {
  console.log('🚛 Trans.eu API - Приклади використання\n');
  
  await exampleHealthCheck();
  await exampleSimpleRoute();
  await exampleMultiPointRoute();
  await exampleRouteOptimization();
  await exampleVehicleComparison();
  
  console.log('\n✅ Всі приклади завершено!');
}

// Експорт для використання в інших файлах
export {
  exampleSimpleRoute,
  exampleMultiPointRoute,
  exampleRouteOptimization,
  exampleVehicleComparison,
  exampleHealthCheck,
  runAllExamples
};

// Запуск прикладів, якщо файл викликається напряму
if (require.main === module) {
  runAllExamples().catch(console.error);
}