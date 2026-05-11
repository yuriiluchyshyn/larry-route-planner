#!/usr/bin/env node

/**
 * Redis Cache Inspector
 * Консольна утиліта для перевірки Redis кешу маршрутів
 * 
 * Використання:
 *   node inspect-redis.js                    # Загальна статистика
 *   node inspect-redis.js stats              # Статистика кешу
 *   node inspect-redis.js search Berlin      # Пошук маршрутів з Berlin
 *   node inspect-redis.js search Berlin Warsaw # Пошук Berlin → Warsaw
 *   node inspect-redis.js route ROUTE_ID     # Детальна інформація про маршрут
 *   node inspect-redis.js clear              # Очистити кеш
 *   node inspect-redis.js help               # Показати допомогу
 */

const { RedisRouteService } = require('./dist/assets/redisRouteService-Cxy-AvHc.js');

class RedisInspectorCLI {
  constructor() {
    this.redisService = new RedisRouteService();
  }

  async connect() {
    try {
      await this.redisService.connect();
      return true;
    } catch (error) {
      console.error('❌ Не вдалося підключитися до Redis:', error.message);
      console.log('\n💡 Переконайтеся, що Redis запущено:');
      console.log('   - macOS: brew services start redis');
      console.log('   - Ubuntu: sudo systemctl start redis');
      console.log('   - Docker: docker run -d -p 6379:6379 redis:alpine');
      return false;
    }
  }

  async showStats() {
    try {
      const stats = await this.redisService.getCacheStats();
      
      console.log('\n📊 СТАТИСТИКА REDIS КЕШУ');
      console.log('═'.repeat(50));
      console.log(`📦 Всього маршрутів: ${stats.totalRoutes}`);
      console.log(`💾 Розмір кешу: ${stats.totalSize}`);
      
      if (stats.totalRoutes > 0) {
        console.log(`⏰ Найстаріший запис: ${new Date(stats.oldestRoute).toLocaleString()}`);
        console.log(`🆕 Найновіший запис: ${new Date(stats.newestRoute).toLocaleString()}`);
      } else {
        console.log('\n⚠️ Кеш порожній. Запустіть пошук маршрутів для заповнення кешу.');
      }
    } catch (error) {
      console.error('❌ Помилка отримання статистики:', error.message);
    }
  }

  async showSampleRoutes(limit = 5) {
    try {
      const allRoutes = await this.redisService.getAllCachedRoutes();
      
      if (allRoutes.length === 0) {
        console.log('\n📭 Немає збережених маршрутів');
        return;
      }

      console.log(`\n🗂️ ПРИКЛАДИ МАРШРУТІВ (показано ${Math.min(limit, allRoutes.length)} з ${allRoutes.length}):`);
      console.log('═'.repeat(80));

      for (let i = 0; i < Math.min(limit, allRoutes.length); i++) {
        const route = allRoutes[i];
        const origin = route.spots[0];
        const destination = route.spots[route.spots.length - 1];

        console.log(`\n${i + 1}. 🚛 Маршрут ID: ${route.id}`);
        console.log(`   📍 Від: ${origin.place.address.locality}, ${origin.place.address.country}`);
        console.log(`   🎯 До: ${destination.place.address.locality}, ${destination.place.address.country}`);
        console.log(`   📏 Відстань: ${route.route.distance} км`);
        console.log(`   📦 Вантажопідйомність: ${route.freight.capacity} кг`);
        console.log(`   💰 Ціна: ${route.price.value} ${route.price.currency}`);
        console.log(`   🏢 Компанія: ${route.company.legal_name}`);
      }

      if (allRoutes.length > limit) {
        console.log(`\n... та ще ${allRoutes.length - limit} маршрутів`);
      }
    } catch (error) {
      console.error('❌ Помилка показу маршрутів:', error.message);
    }
  }

  async searchRoutes(origin, destination) {
    try {
      console.log(`\n🔍 Пошук маршрутів в кеші...`);
      if (origin) console.log(`   📍 Від: ${origin}`);
      if (destination) console.log(`   🎯 До: ${destination}`);

      const results = await this.redisService.searchRoutes({
        origin,
        destination
      });

      console.log(`\n📋 РЕЗУЛЬТАТИ ПОШУКУ: знайдено ${results.length} маршрутів`);
      console.log('═'.repeat(80));

      if (results.length === 0) {
        console.log('\n📭 Маршрутів не знайдено за вказаними критеріями');
        return;
      }

      results.forEach((route, index) => {
        console.log(`\n${index + 1}. 🚛 ${route.id}`);
        console.log(`   📍 ${route.origin} → 🎯 ${route.destination}`);
        console.log(`   📏 ${route.distance} км | 📦 ${route.capacity} кг | 💰 ${route.price} ${route.currency}`);
        console.log(`   🏢 ${route.company}`);
        console.log(`   ⏰ Кешовано: ${new Date(route.cachedAt).toLocaleString()}`);
      });
    } catch (error) {
      console.error('❌ Помилка пошуку:', error.message);
    }
  }

  async inspectRoute(routeId) {
    try {
      console.log(`\n🔍 Інспекція маршруту ${routeId}...`);
      
      const route = await this.redisService.getRoute(routeId);
      const routeInfo = await this.redisService.getRouteInfo(routeId);

      if (!route || !routeInfo) {
        console.log(`❌ Маршрут ${routeId} не знайдено в кеші`);
        return;
      }

      console.log('\n📋 ДЕТАЛЬНА ІНФОРМАЦІЯ:');
      console.log('═'.repeat(50));
      console.log(`🆔 ID: ${route.id}`);
      console.log(`📍 Маршрут: ${routeInfo.origin} → ${routeInfo.destination}`);
      console.log(`📏 Відстань: ${routeInfo.distance} км`);
      console.log(`📦 Вантажопідйомність: ${routeInfo.capacity} кг`);
      console.log(`💰 Ціна: ${routeInfo.price} ${routeInfo.currency}`);
      console.log(`🏢 Компанія: ${routeInfo.company}`);
      console.log(`⏰ Кешовано: ${new Date(routeInfo.cachedAt).toLocaleString()}`);
      
      console.log('\n📍 КООРДИНАТИ:');
      console.log(`   Початок: ${routeInfo.coordinates.origin.lat}, ${routeInfo.coordinates.origin.lng}`);
      console.log(`   Кінець: ${routeInfo.coordinates.destination.lat}, ${routeInfo.coordinates.destination.lng}`);

      console.log('\n🚛 ТОЧКИ МАРШРУТУ:');
      route.spots.forEach((spot, index) => {
        console.log(`   ${index + 1}. ${spot.place.address.locality}, ${spot.place.address.country}`);
        console.log(`      📅 ${spot.date} ${spot.time || ''}`);
        console.log(`      📍 ${spot.place.coordinates.latitude}, ${spot.place.coordinates.longitude}`);
      });
    } catch (error) {
      console.error('❌ Помилка інспекції маршруту:', error.message);
    }
  }

  async clearCache() {
    try {
      console.log('🗑️ Очищення кешу...');
      await this.redisService.clearCache();
      console.log('✅ Кеш очищено');
    } catch (error) {
      console.error('❌ Помилка очищення кешу:', error.message);
    }
  }

  showHelp() {
    console.log('\n🔍 REDIS CACHE INSPECTOR');
    console.log('═'.repeat(50));
    console.log('Утиліта для перевірки Redis кешу маршрутів\n');
    
    console.log('📋 КОМАНДИ:');
    console.log('  node inspect-redis.js                    # Загальна статистика + приклади');
    console.log('  node inspect-redis.js stats              # Тільки статистика кешу');
    console.log('  node inspect-redis.js search Berlin      # Пошук маршрутів з Berlin');
    console.log('  node inspect-redis.js search Berlin Warsaw # Пошук Berlin → Warsaw');
    console.log('  node inspect-redis.js route ROUTE_ID     # Детальна інформація про маршрут');
    console.log('  node inspect-redis.js clear              # Очистити весь кеш');
    console.log('  node inspect-redis.js help               # Показати цю допомогу\n');
    
    console.log('💡 ПРИКЛАДИ:');
    console.log('  node inspect-redis.js search "Київ"');
    console.log('  node inspect-redis.js search "Berlin" "Warsaw"');
    console.log('  node inspect-redis.js route "12345-abcde"');
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0] || 'default';

    // Показуємо допомогу
    if (command === 'help' || command === '--help' || command === '-h') {
      this.showHelp();
      return;
    }

    // Підключаємося до Redis
    const connected = await this.connect();
    if (!connected) {
      process.exit(1);
    }

    try {
      switch (command) {
        case 'stats':
          await this.showStats();
          break;

        case 'search':
          const origin = args[1];
          const destination = args[2];
          await this.searchRoutes(origin, destination);
          break;

        case 'route':
          const routeId = args[1];
          if (!routeId) {
            console.log('❌ Потрібно вказати ID маршруту');
            console.log('Використання: node inspect-redis.js route ROUTE_ID');
            process.exit(1);
          }
          await this.inspectRoute(routeId);
          break;

        case 'clear':
          await this.clearCache();
          break;

        case 'default':
        default:
          await this.showStats();
          await this.showSampleRoutes();
          break;
      }
    } catch (error) {
      console.error('❌ Помилка виконання команди:', error.message);
      process.exit(1);
    }
  }
}

// Запуск CLI
if (require.main === module) {
  const cli = new RedisInspectorCLI();
  cli.run().catch(error => {
    console.error('💥 Критична помилка:', error);
    process.exit(1);
  });
}

module.exports = RedisInspectorCLI;