# Location Search API

## Метод `searchTranseuLocation`

Новий метод для пошуку локацій через Trans.eu API, створений аналогічно до методу `getOffers`.

### Опис

Метод виконує пошук локацій через проксі-сервер з автентифікацією токеном, повертаючи структуровані дані про знайдені локації.

### Сигнатура

```typescript
export async function searchTranseuLocation(
  params: LocationSearchParams
): Promise<LocationSearchResponse>
```

### Інтерфейси параметрів

```typescript
interface LocationSearchFilter {
  type?: string[];
}

interface LocationSearchParams {
  search: string;
  lang?: string;
  filter?: LocationSearchFilter;
  offset?: number;
  limit?: number;
}
```

### Параметри

- **search** (string, обов'язковий) - Пошуковий запит (наприклад, "Kraków", "Berlin", "30-001")
- **lang** (string, опціонально) - Мова відповіді (за замовчуванням "en")
- **filter** (LocationSearchFilter, опціонально) - Фільтр типів локацій
- **offset** (number, опціонально) - Зсув для пагінації (за замовчуванням 0)
- **limit** (number, опціонально) - Кількість результатів (за замовчуванням 10)

### Повертає

```typescript
interface LocationSearchResponse {
  page_count: number;
  total_items: number;
  page: number;
  page_size: number;
  _embedded: {
    locations: LocationItem[];
  };
}
```

### Структура LocationItem

```typescript
interface LocationItem {
  geocoderId: string;
  geocoderDetailedId?: string | null;
  country: string;
  type: string;
  countryName?: string | null;
  admin1?: string | null;
  locality?: string | null;
  district?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  originalNames?: {
    countryName?: string | null;
    admin1?: string | null;
    locality?: string | null;
    district?: string | null;
  };
  latitude: number;
  longitude: number;
  bbox?: number[][];
  radius?: number;
  locationId: number;
  detailedLocationId?: number | null;
  timezone?: string;
}
```

### Приклад використання

```typescript
import { searchTranseuLocation, type LocationSearchParams } from './src/utils/services/index';

// Простий пошук
const simpleParams: LocationSearchParams = {
  search: 'Kraków'
};
const result = await searchTranseuLocation(simpleParams);

// Пошук з додатковими параметрами
const detailedParams: LocationSearchParams = {
  search: 'Berlin',
  lang: 'en',
  filter: { 
    type: ['locality_postal_area', 'locality'] 
  },
  offset: 0,
  limit: 5
};
const detailedResult = await searchTranseuLocation(detailedParams);

// Обробка результату
if (detailedResult._embedded.locations.length > 0) {
  const location = detailedResult._embedded.locations[0];
  console.log(`Знайдено: ${location.locality}, ${location.country}`);
  console.log(`Координати: ${location.latitude}, ${location.longitude}`);
}
```

### Приклад відповіді

```json
{
  "page_count": 1,
  "total_items": 1,
  "page": 1,
  "page_size": 1,
  "_embedded": {
    "locations": [{
      "geocoderId": "1838666975-3094802-1364443",
      "geocoderDetailedId": null,
      "country": "PL",
      "type": "locality_postal_area",
      "countryName": null,
      "admin1": "Województwo małopolskie",
      "locality": "Kraków",
      "district": null,
      "postalCode": "30-001",
      "street": null,
      "number": null,
      "originalNames": {
        "countryName": null,
        "admin1": "województwo małopolskie",
        "locality": "Kraków",
        "district": null
      },
      "latitude": 50.077850516,
      "longitude": 19.94171128,
      "bbox": [[19.937833885,50.080813516],[19.9472511340001,50.0749891180001]],
      "radius": 364,
      "locationId": 1545479,
      "detailedLocationId": null,
      "timezone": "Europe/Warsaw"
    }]
  }
}
```

### Особливості

1. **Автентифікація**: Метод автоматично використовує токен з localStorage
2. **Проксі**: Всі запити йдуть через проксі-сервер на порту 8848
3. **Кешування**: Підтримує внутрішнє кешування для оптимізації
4. **Помилки**: Детальне логування та обробка помилок
5. **Типізація**: Повна підтримка TypeScript з інтерфейсами

### Налаштування

Метод використовує конфігурацію з `apiConfig.ts`:

- **Базовий URL**: `https://api-platform.trans.eu`
- **Ендпоінт**: `/app/geocoder-api/api/v2/locations`
- **Таймаут**: 30 секунд
- **Повторні спроби**: 3

### Помилки

Метод може кинути помилки в наступних випадках:

- Проксі-сервер недоступний
- Відсутній або недійсний токен автентифікації
- Помилка API Trans.eu
- Мережева помилка

### Інтеграція

Метод повністю інтегрований з існуючою архітектурою:

- Експортується через `src/utils/services/index.ts`
- Використовує той же проксі-клієнт що й `getOffers`
- Підтримує ту ж систему конфігурації
- Сумісний з існуючими типами даних