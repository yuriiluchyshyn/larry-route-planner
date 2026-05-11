# Larry Route Planner 🚛

Інтелектуальний планувальник маршрутів для європейських вантажних перевезень з інтеграцією Trans.eu API.

## 🌟 Основні можливості

- **🚛 Trans.eu інтеграція** - Точні розрахунки маршрутів з реальними витратами
- **💰 Розрахунок платних доріг** - Точні витрати на автобани та платні дороги
- **⛽ Споживання палива** - Реальні дані споживання та витрат на паливо
- **🌱 Екологічність** - Розрахунок викидів CO₂ за стандартом ISO 14083:2023
- **🤖 AI оптимізація** - Штучний інтелект для пошуку найкращих маршрутів
- **📊 EU правила** - Автоматична перевірка відповідності європейським правилам водіння
- **📈 Аналітика** - Детальна аналітика маршрутів та витрат

## 🚀 Швидкий старт

### Встановлення

```bash
# Клонування репозиторію
git clone <repository-url>
cd larry-route-planner

# Встановлення залежностей
npm install

# Запуск в режимі розробки
npm run dev
```

### Конфігурація

1. **Trans.eu API** - Найточніші дані для Європи (рекомендовано)
2. **AI оптимізація** - Потребує API ключ (опціонально)

## 🛠️ Стратегії оптимізації

### 1. Trans.eu Маршрутизація 🚛 (Рекомендовано)

Використовує офіційний Trans.eu API для найточніших розрахунків:

```typescript
import { RouteStrategy } from './utils/routeStrategy';

const routes = await executeRouteOptimization(offers, {
  strategy: RouteStrategy.TRANSEU_ROUTING,
  vehicleType: 'truck', // або 'van'
  maxEmptyRunPercent: 30,
  homeBaseLat: 50.0619474,
  homeBaseLon: 19.9368564,
});
```

**Переваги:**
- ✅ Найточніші дані маршрутизації для Європи
- ✅ Реальні витрати на платні дороги
- ✅ Точний розрахунок палива та викидів CO₂
- ✅ Враховує обмеження для вантажівок
- ✅ Фільтрує маршрути за відсотком холостого ходу

### 2. AI Оптимізація 🤖

Використовує штучний інтелект для складних оптимізацій:

```typescript
const routes = await executeRouteOptimization(offers, {
  strategy: RouteStrategy.AI_OPTIMIZATION,
  // ... параметри
});
```

## 📊 Приклад використання

```typescript
import { 
  calculateAccurateDistance, 
  optimizeRouteOrder 
} from './utils/transeuRouteClient';

// Розрахунок маршруту між містами
const result = await calculateAccurateDistance(
  { lat: 50.0619474, lon: 19.9368564 }, // Краків
  { lat: 52.5170365, lon: 13.3888599 }, // Берлін
  'truck'
);

console.log(`Відстань: ${result.distanceKm} км`);
console.log(`Час: ${result.timeHours} год`);
console.log(`Платні дороги: €${result.tollEur}`);
console.log(`Паливо: ${result.fuelConsumption} л`);
console.log(`CO₂: ${result.co2Emissions} кг`);

// Оптимізація порядку міст
const cities = [
  { lat: 50.0619474, lon: 19.9368564, id: 'krakow' },
  { lat: 52.5170365, lon: 13.3888599, id: 'berlin' },
  { lat: 48.2083537, lon: 16.3725042, id: 'vienna' }
];

const optimization = await optimizeRouteOrder(cities, 'truck');
console.log('Оптимальний порядок:', optimization.optimizedOrder);
```

## 🚛 Підтримувані транспортні засоби

### Вантажівка (40т)
- Максимальна вага: 40,000 кг
- Споживання палива: 35 л/100км
- Стандарт викидів: EURO 6
- Кількість осей: 5

### Фургон (3.5т)
- Максимальна вага: 3,500 кг
- Споживання палива: 12 л/100км
- Стандарт викидів: EURO 6
- Кількість осей: 2

## 🌍 Підтримувані країни

- 🇵🇱 Польща
- 🇩🇪 Німеччина
- 🇫🇷 Франція
- 🇨🇿 Чехія
- 🇦🇹 Австрія
- 🇸🇰 Словаччина
- 🇭🇺 Угорщина
- 🇮🇹 Італія
- 🇪🇸 Іспанія
- 🇳🇱 Нідерланди
- 🇧🇪 Бельгія
- І багато інших європейських країн

## 📋 EU правила водіння

Автоматична перевірка відповідності:

- ⏰ Максимум 9 годин водіння на день
- 🛑 Обов'язкова перерва 45 хвилин після 4.5 годин
- 📅 Максимум 56 годин водіння на тиждень
- 🏠 Щотижневий відпочинок 45 годин

## 🔧 Налаштування

### Environment Variables

```bash
# Trans.eu API (не потрібен API ключ)
VITE_TRANSEU_API_URL=https://dc1.api-platform.trans.eu/app/stored-routes/api/v1

# AI оптимізація (опціонально)
VITE_AI_API_KEY=your-ai-api-key
```

### Конфігурація маршрутизації

```typescript
interface RouteConfig {
  maxEmptyRunPercent: number; // Максимальний відсоток холостого ходу
  homeBaseLat: number;        // Широта домашньої бази
  homeBaseLon: number;        // Довгота домашньої бази
  departureDate: string;      // Дата відправлення
  returnDate: string;         // Дата повернення
  averageSpeedKmh: number;    // Середня швидкість
  vehicleType: 'truck' | 'van'; // Тип транспорту
}
```

## 📈 Метрики та аналітика

### Основні метрики
- 📏 Загальна відстань (км)
- 🚛 Відстань з вантажем (км)
- 🔄 Відстань холостого ходу (км)
- ⏱️ Загальний час подорожі
- 💰 Витрати на платні дороги (EUR)
- ⛽ Споживання палива (л)
- 🌱 Викиди CO₂ (кг)

### EU відповідність
- ✅ Відповідність правилам водіння
- 🛑 Кількість обов'язкових перерв
- 📅 Потреба в щотижневому відпочинку
- ⚠️ Попередження про порушення

## 🗂️ Структура проекту

```
larry-route-planner/
├── src/
│   ├── components/          # React компоненти
│   │   ├── RouteResults.tsx # Відображення результатів
│   │   ├── TranseuRouteInfo.tsx # Trans.eu інформація
│   │   └── ...
│   ├── utils/              # Утиліти та API клієнти
│   │   ├── transeuRouteClient.ts # Trans.eu API клієнт
│   │   ├── routeOptimizer.ts     # Оптимізатори маршрутів
│   │   ├── routeStrategy.ts      # Стратегії оптимізації
│   │   └── ...
│   ├── types.ts            # TypeScript типи
│   └── App.tsx             # Головний компонент
├── examples/               # Приклади використання
│   └── transeu-example.ts  # Trans.eu API приклади
├── TRANSEU_INTEGRATION.md  # Документація інтеграції
└── README.md              # Цей файл
```

## 🧪 Тестування

```bash
# Запуск тестів
npm test

# Тестування Trans.eu API
npm run test:transeu

# Приклади використання
npm run examples
```

## 📚 Документація

- [Trans.eu Integration](./TRANSEU_INTEGRATION.md) - Детальна документація інтеграції
- [Examples](./examples/) - Приклади використання API
- [API Reference](./docs/api.md) - Довідник API (якщо існує)

## 🤝 Внесок у розробку

1. Fork репозиторію
2. Створіть feature branch (`git checkout -b feature/amazing-feature`)
3. Commit зміни (`git commit -m 'Add amazing feature'`)
4. Push до branch (`git push origin feature/amazing-feature`)
5. Відкрийте Pull Request

## 📄 Ліцензія

Цей проект ліцензований під [MIT License](./LICENSE).

## 🆘 Підтримка

Якщо у вас виникли питання або проблеми:

1. Перевірте [документацію](./TRANSEU_INTEGRATION.md)
2. Подивіться [приклади](./examples/)
3. Створіть Issue в GitHub

## 🔄 Changelog

### v2.0.0 - Trans.eu Integration
- ✨ Додано Trans.eu API інтеграцію
- 💰 Розрахунок платних доріг
- ⛽ Споживання палива та викиди CO₂
- 🚛 Підтримка різних типів транспорту
- 📊 Розширена аналітика маршрутів

### v1.0.0 - Initial Release
- 🤖 AI оптимізація маршрутів
- 📋 EU правила водіння
- 📈 Базова аналітика

---

**Larry Route Planner** - Ваш надійний помічник у плануванні європейських вантажних перевезень! 🚛✨