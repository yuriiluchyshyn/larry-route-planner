# Виправлення помилок в roadOptimizer.ts

## Виправлені помилки

### 1. **Відсутній імпорт функції searchTranseuLocation**
**Помилка**: `Cannot find name 'searchTranseuLocation'`

**Виправлення**: Додано імпорт функції
```typescript
import { searchTranseuLocation } from '../../../services/ApiTransService.compatibility';
```

### 2. **Змінна searchQuery недоступна в catch блоці**
**Помилка**: `Cannot find name 'searchQuery'`

**Виправлення**: Перенесено оголошення змінної `searchQuery` за межі try блоку
```typescript
// Формуємо пошуковий запит (перед try блоком)
let searchQuery = locality;
if (postalCode) {
  searchQuery = `${postalCode}, ${locality}`;
}
if (country) {
  searchQuery += `, ${country}`;
}

try {
  // використання searchQuery
} catch (error) {
  console.error(`❌ Помилка геокодування ${searchQuery}:`, error); // тепер доступна
}
```

### 3. **Невикористовуваний параметр emptyDistanceKm**
**Попередження**: `'emptyDistanceKm' is declared but its value is never read`

**Виправлення**: Видалено невикористовуваний параметр з функції `isTimeValid`
```typescript
// Було
function isTimeValid(
  currentOffer: FreightOffer, 
  nextOffer: FreightOffer, 
  emptyDistanceKm: number, // невикористовуваний
  config: OptimizationConfig // невикористовуваний
): boolean

// Стало
function isTimeValid(
  currentOffer: FreightOffer, 
  nextOffer: FreightOffer
): boolean
```

### 4. **Невикористовувана функція findOffersNearHomeLoading**
**Попередження**: `'findOffersNearHomeLoading' is declared but its value is never read`

**Виправлення**: Видалено функцію, оскільки в рекурсивному підході використовується `findBestStartingOffers`

## Результат

✅ **0 помилок**  
✅ **0 попереджень**  
✅ **Код готовий до використання**

## Функціональність після виправлень

### Рекурсивний пошук маршрутів
- ✅ Пошук маршрутів будь-якої довжини (1-10+ оферів)
- ✅ Геокодування через Trans.eu API
- ✅ Кешування координат
- ✅ Сувора обробка помилок
- ✅ Оптимізація за score (прибутковість)

### Параметри конфігурації
```typescript
interface OptimizationConfig {
  homeBase: RoutePoint;
  maxEmptyRunPercent: number;
  pricePerKm: number;
  averageSpeedKmh: number;
  maxResults?: number;
  maxRouteDepth?: number;        // Нове: максимальна глибина маршруту
  maxEmptyDistanceKm?: number;   // Нове: максимальна відстань порожнього пробігу
  maxSearchTimeMs?: number;      // Нове: максимальний час пошуку
}
```

### Використання
```typescript
const routes = await createOptimizedRoutes(
  offers,
  homeBase,
  10,      // maxEmptyRunPercent
  1.5,     // pricePerKm
  80,      // averageSpeedKmh
  50,      // maxResults
  10,      // maxRouteDepth - до 10 оферів в маршруті
  200,     // maxEmptyDistanceKm - до 200 км порожнього пробігу
  30000    // maxSearchTimeMs - 30 секунд пошуку
);
```

## Переваги рекурсивного підходу

1. **Гнучкість**: Знаходить маршрути будь-якої довжини
2. **Оптимальність**: Шукає найприбутковіші комбінації
3. **Контроль**: Обмеження за часом, глибиною та відстанню
4. **Масштабованість**: Адаптується до розміру набору оферів
5. **Надійність**: Сувора обробка помилок геокодування