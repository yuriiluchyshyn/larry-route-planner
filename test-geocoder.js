// Простий тест геокодера
const fetch = require('node-fetch');

async function testGeocoderAPI() {
  console.log('🧪 Тестування Trans.eu Geocoder API...');
  
  // Тест 1: Пошук по країні "germany"
  const testUrl = 'https://api-platform.trans.eu/app/geocoder-api/api/v2/locations?search=germany&lang=ua&filter=%7B%22type%22:[%22combined_postal_area%22,%22postal_area%22,%22locality_postal_area%22,%22country%22]%7D&offset=0&limit=10';
  
  try {
    console.log('📡 Запит до:', testUrl);
    
    const response = await fetch(testUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Larry-Route-Planner/1.0'
      }
    });
    
    console.log('📊 Статус відповіді:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Відповідь API:');
      console.log(JSON.stringify(data, null, 2));
      
      // Перевіряємо структуру відповіді
      if (data._embedded && data._embedded.locations) {
        console.log(`🎯 Знайдено ${data._embedded.locations.length} локацій`);
        
        data._embedded.locations.forEach((location, index) => {
          console.log(`  ${index + 1}. ${location.name || location.locality || 'Unknown'}`);
          console.log(`     Координати: ${location.latitude}, ${location.longitude}`);
          console.log(`     Тип: ${location.type}`);
        });
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Помилка API:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Помилка запиту:', error.message);
  }
}

// Запускаємо тест
testGeocoderAPI();