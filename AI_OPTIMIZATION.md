# 🤖 AI Оптимізація маршрутів в Larry Route Planner

## ✅ РЕАЛІЗОВАНО: Реальна інтеграція з AI

Larry Route Planner тепер підтримує **справжню AI оптимізацію** з реальними запитами до OpenAI GPT-4o та Anthropic Claude 3.5 Sonnet.

## 🚀 Швидкий старт

1. **Отримайте API ключ** (див. інструкції нижче)
2. **Увімкніть AI оптимізацію** в секції "🔄 Route Optimization"
3. **Додайте API ключ** в відповідне поле
4. **Натисніть "Fetch Offers"** для отримання AI-оптимізованих маршрутів

## 🧪 Тестування

**Відкрийте `test-real-ai.html`** для інтерактивного тестування AI функціональності:
- Додайте API ключі
- Протестуйте реальні запити до AI
- Переглядайте промпти та відповіді
- Перевірте обробку помилок

## 💰 Вартість

- **OpenAI GPT-4o:** ~$0.03 за запит оптимізації
- **Claude 3.5 Sonnet:** ~$0.015 за запит оптимізації
- **Один запит = одна оптимізація** всіх доступних пропозицій

## Як використовувати

### 1. Переключення режиму
В секції "🔄 Route Optimization" в ConfigPanel є чекбокс:
```
🤖 AI Оптимізація маршрутів
```

### 2. Індикатор режиму
- Вкладка "Оптимізовані пропозиції" показує поточний режим:
  - `🏆 Оптимізовані пропозиції (X)` - внутрішній алгоритм
  - `🤖 AI Оптимізовані пропозиції (X)` - AI режим

## Технічна реалізація

### Файли
- `src/types.ts` - додано `useAIOptimization: boolean` в RouteConfig
- `src/utils/aiOptimizer.ts` - новий AI оптимізатор
- `src/components/ConfigPanel.tsx` - кнопка переключення
- `src/App.tsx` - логіка вибору алгоритму
- `src/App.css` - стилі для AI індикатора

### AI Промпт
Система генерує детальний промпт для AI, який включає:

```typescript
const prompt = `Ви - експерт з оптимізації логістичних маршрутів для вантажних перевезень. 
Потрібно створити оптимальні маршрути для водія вантажівки з урахуванням європейських правил водіння (EC 561/2006).

ДОМАШНЯ БАЗА:
Широта: ${config.homeBaseLat}
Довгота: ${config.homeBaseLon}

ЧАСОВІ РАМКИ:
- Відправлення: з ${config.departureFrom} по ${config.departureTo}
- Повернення: з ${config.returnFrom} по ${config.returnTo}

ОБМЕЖЕННЯ:
- Максимальний відсоток порожнього пробігу: ${config.maxEmptyRunPercent}%
- Дотримання європейських правил водіння
- Обов'язкові перерви кожні 4.5 години
- Щоденний відпочинок мінімум 11 годин

ДОСТУПНІ ПРОПОЗИЦІЇ ВАНТАЖІВ:
[детальний список пропозицій з координатами, датами, вагою, ціною]

ЗАВДАННЯ:
Створіть 3-5 оптимальних маршрутів...`;
```

### Поточна реалізація (Mock)
Зараз AI оптимізатор працює в режимі симуляції:
- Генерує промпт
- Симулює виклик AI API (затримка 2-5 секунд)
- Створює mock маршрути на основі доступних пропозицій
- Повертає результати з високими оцінками (90+)

## Інтеграція з реальним AI

### 1. Claude API
```typescript
async function callClaudeAPI(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });
  
  const data = await response.json();
  return data.content[0].text;
}
```

### 2. OpenAI GPT API
```typescript
async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'user',
        content: prompt
      }],
      max_tokens: 4000,
      temperature: 0.7
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}
```

## Очікуваний формат відповіді AI

```json
{
  "routes": [
    {
      "offerIds": ["offer1", "offer2", "offer3"],
      "totalDistanceKm": 1500,
      "loadedDistanceKm": 1200,
      "emptyDistanceKm": 300,
      "emptyRunPercent": 20,
      "totalDays": 5,
      "euCompliant": true,
      "score": 85,
      "reasoning": "Цей маршрут оптимальний тому що..."
    }
  ],
  "reasoning": "Загальна стратегія оптимізації...",
  "confidence": 0.87
}
```

## Переваги AI оптимізації

1. **Контекстуальне розуміння** - AI може врахувати складні залежності
2. **Адаптивність** - може пристосовуватися до специфічних вимог
3. **Пояснення** - надає reasoning для кожного рішення
4. **Навчання** - може покращуватися з часом

## Обмеження поточної реалізації

1. **Mock режим** - не використовує реальний AI
2. **Статичні маршрути** - генерує фіксовані комбінації
3. **Немає персоналізації** - не враховує історію користувача
4. **Обмежений промпт** - тільки базова інформація

## Наступні кроки

### Фаза 1: Базова інтеграція
- [ ] Додати API ключі в environment variables
- [ ] Реалізувати HTTP клієнт для Claude/GPT
- [ ] Додати обробку помилок та fallback
- [ ] Тестування з реальними API

### Фаза 2: Покращення промпту
- [ ] Додати історію попередніх маршрутів
- [ ] Включити preferences користувача
- [ ] Додати контекст про traffic patterns
- [ ] Врахувати seasonal factors

### Фаза 3: Розширена функціональність
- [ ] Кешування AI відповідей
- [ ] A/B тестування AI vs внутрішній алгоритм
- [ ] Feedback loop для покращення
- [ ] Персоналізація на основі історії

## Тестування

Відкрийте `test-ai-optimization.html` для інтерактивного тестування функціональності переключення режимів.

## Конфігурація

Додайте в `.env` файл:
```env
# AI API Keys (для майбутньої інтеграції)
CLAUDE_API_KEY=your_claude_key_here
OPENAI_API_KEY=your_openai_key_here

# AI Settings
AI_MODEL=claude-3-sonnet-20240229
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.7
```