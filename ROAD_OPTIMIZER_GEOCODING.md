# Road Optimizer з Геокодуванням

## Оновлення roadOptimizer.ts

Файл `roadOptimizer.ts` було оновлено для використання методу `searchTranseuLocation` для більш точного розрахунку відстані між локаціями з суворою обробкою помилок.

## Основні зміни

### 1. Інтеграція з Trans.eu Geocoding API

```typescript
import { searchTranseuLocation, type LocationSearchParams } from '../../../services/index';
```

### 2. Сувора обробка помилок геокодування

**Раніше**: Fallback до формули Haversine при невдалому геокодуванні
**Тепер**: Кидання помилки при неможливості геокодувати локацію

```typescript
async function calculateDistanceWithGeocoding(
  from: { lat?: number; lon?: number; locality: string; country: string; postalCode?: string },
  to: { lat?: number; lon?: number; locality: string; country: string; postalCode?: string }
): Promise<number> {
  // Якщо геокодування не вдалося - кидаємо помилку
  if (!geocoded) {
    throw new Error(`❌ Не вдалося геокодувати точку: ${locality}, ${country}. Неможливо розрахувати маршрут.`);
  }
}
```

### 3. Детальна обробка помилок на всіх рівнях

#### Рівень функцій пошуку оферів
```typescript
async function findOffersNearHomeLoading() {
  const errors: string[] = [];
  
  for (const offer of offers) {
    try {
      // Розрахунок відстані
    } catch (error) {
      errors.push(`Офер ${offer.id}: ${error.message}`);
      console.warn(`⚠️ Пропускаємо офер ${offer.id} через помилку геокодування`);
    }
  }
  
  if (errors.length > 0) {
    console.warn(`⚠️ Помилки геокодування для ${errors.length} оферів`);
  }
}
```

#### Рівень побудови маршрутів
```typescript
async function buildRoute() {
  try {
    // Побудова маршруту
  } catch (error) {
    throw new Error(`Неможливо побудувати маршрут: ${error.message}`);
  }
}
```

#### Рівень оптимізації
```typescript
export async function optimizeRoutes() {
  const errors: string[] = [];
  
  try {
    // Оптимізація маршрутів
  } catch (error) {
    console.error(`❌ Критична помилка оптимізації маршрутів:`, error);
    throw error;
  }
  
  if (routes.length === 0 && errors.length > 0) {
    throw new Error(`❌ Жоден маршрут не вдалося побудувати через помилки геокодування. Перевірте доступність Trans.eu API та правильність адрес.`);
  }
}
```

## Типи помилок

### 1. Помилки геокодування
```
❌ Не вдалося геокодувати початкову точку: Berlin, DE. Неможливо розрахувати маршрут.
❌ Не вдалося геокодувати кінцеву точку: Paris, FR. Неможливо розрахувати маршрут.
```

### 2. Помилки розрахунку відстані
```
❌ Розрахована відстань некоректна (0 км) між Berlin, DE та Paris, FR. Неможливо розрахувати маршрут.
```

### 3. Помилки побудови маршруту
```
❌ Неможливо розрахувати відстань для маршруту Berlin, DE → Paris, FR: Не вдалося геокодувати кінцеву точку
```

### 4. Критичні помилки оптимізації
```
❌ Не знайдено жодної пропозиції для завантаження поблизу домашньої бази (Warsaw). Неможливо побудувати маршрути.
❌ Жоден маршрут не вдалося побудувати через помилки геокодування. Перевірте доступність Trans.eu API та правильність адрес.
```

## Логування помилок

### Детальне логування процесу
```
🔍 Геокодування локації: 30-001, Kraków, PL
✅ Геокодування успішне: 30-001, Kraków, PL → 50.0779, 19.9417
⚠️ Пропускаємо офер OFFER-123 через помилку геокодування: Не вдалося геокодувати точку
❌ Помилка розрахунку відстані для офера OFFER-456: Неможливо розрахувати маршрут
⚠️ Помилки геокодування для 5 оферів при пошуку завантаження поблизу дому
⚠️ Виникло 12 помилок під час побудови маршрутів (деталі в логах)
```

## Обробка помилок в коді

### Використання try-catch
```typescript
try {
  const routes = await createOptimizedRoutes(offers, homeBase);
  console.log(`Знайдено ${routes.length} оптимізованих маршрутів`);
} catch (error) {
  console.error('Помилка оптимізації маршрутів:', error);
  
  // Показати користувачу зрозумілу помилку
  if (error.message.includes('геокодування')) {
    alert('Помилка: Неможливо знайти координати для деяких локацій. Перевірте підключення до інтернету та спробуйте пізніше.');
  } else if (error.message.includes('Trans.eu API')) {
    alert('Помилка: Проблеми з доступом до Trans.eu API. Перевірте налаштування проксі.');
  } else {
    alert('Помилка: Неможливо побудувати маршрути. Спробуйте змінити параметри пошуку.');
  }
}
```

### Graceful degradation
```typescript
// Якщо геокодування не працює, можна відключити оптимізацію
const useGeocoding = await checkGeocodingAvailability();

if (useGeocoding) {
  const routes = await createOptimizedRoutes(offers, homeBase);
} else {
  console.warn('Геокодування недоступне, використовуємо базовий алгоритм');
  const routes = createBasicRoutes(offers, homeBase);
}
```

## Переваги нового підходу

### 1. Надійність
- Чіткі повідомлення про помилки
- Неможливість отримати некоректні результати
- Детальне логування для діагностики

### 2. Зрозумілість
- Користувач розуміє чому маршрут не вдалося побудувати
- Розробник може швидко знайти проблему
- Чіткі інструкції для вирішення проблем

### 3. Контроль якості
- Гарантія точності розрахунків
- Відсутність "тихих" помилок
- Можливість моніторингу проблем

## Моніторинг та діагностика

### Перевірка доступності API
```typescript
async function checkGeocodingHealth() {
  try {
    const testResult = await searchTranseuLocation({
      search: 'Berlin, DE',
      limit: 1
    });
    return testResult._embedded.locations.length > 0;
  } catch (error) {
    console.error('Геокодування недоступне:', error);
    return false;
  }
}
```

### Збір статистики помилок
```typescript
const errorStats = {
  geocodingErrors: 0,
  distanceErrors: 0,
  routeBuildErrors: 0
};

// Використовувати для аналізу та покращення системи
```