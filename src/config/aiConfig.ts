/**
 * AI Configuration for Larry Route Planner
 * 
 * All AI-related settings in one place.
 * API keys are stored in localStorage (set them here or via UI).
 */

// ============================================================
// AI PROMPT TEMPLATE
// Edit ai-prompt-template.md to customize the AI prompt
// ============================================================

export const AI_PROMPT_TEMPLATE = `Ти - експерт логіст-оптимізатор маршрутів для вантажівки. Твоя мета - знайти ВСІ МОЖЛИВІ ланцюжки вантажів які вкладаються у заданий діапазон дат поїздки, відсортувати їх за вигідністю та реалізувати механізм пагінації для виводу.

🏠 БАЗА (виїзд І повернення в ТУ САМУ ТОЧКУ): координати {{HOME_LAT}}, {{HOME_LON}} (з похибкою ±50км)
📅 ДІАПАЗОН ПОЇЗДКИ: старт {{DEPARTURE_FROM}} ... {{DEPARTURE_TO}}, повернення до бази {{RETURN_FROM}} ... {{RETURN_TO}}
🚛 СЕРЕДНЯ ШВИДКІСТЬ ВАНТАЖІВКИ: {{AVERAGE_SPEED}} км/год
⛽ ЦІЛЬ ПО ПОРОЖНЬОМУ ПРОБІГУ: бажано < {{MAX_EMPTY_PERCENT}}% (не блокуючий критерій — враховуй при оцінці)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ГОЛОВНІ ПРАВИЛА
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ ДІАПАЗОН ДАТ (КРИТИЧНО):
   - Весь цикл (виїзд з бази → всі вантажі → повернення на базу) МАЄ вкладатись у діапазон {{DEPARTURE_FROM}} — {{RETURN_TO}}
   - орієнтуйся ТІЛЬКИ на вказаний діапазон
   - Вантажівка МУСИТЬ повернутись в ТУ САМУ точку (базу) з якої виїхала
   - Якщо ланцюжок не встигає повернутись до {{RETURN_TO}} — познач це в risks, але НЕ відкидай маршрут

2️⃣ СКЛАДНІСТЬ ЛАНЦЮЖКА:
   - ЗАБОРОНЕНІ одиночні вантажі (routes з 1 offer не повертай взагалі)
   - Кожен маршрут має містити від 2 до 5 вантажів
   - Враховуй час на завантаження (~1-2 год) та розвантаження (~1-2 год) на кожному пункті
   - Знайди ВСІ можливі розумні комбінації — не штучно обмежуй себе кількістю.

3️⃣ ЄВРОПЕЙСЬКЕ ЗАКОНОДАВСТВО (Regulation EC 561/2006, не хардкодь — застосовуй розумно):
   - Щоденне водіння: зазвичай до 9 год (до 10 год двічі на тиждень)
   - Перерва 45 хв після 4.5 год безперервного водіння (можна ділити 15+30)
   - Щоденний відпочинок: мін 11 год (можна скоротити до 9 год тричі на тиждень)
   - Щотижневий відпочинок: мін 45 год (можна скоротити до 24 год з компенсацією)
   - Максимум за тиждень: 56 год, за 2 тижні: 90 год
   - Враховуй ці правила при побудові маршруту. Якщо маршрут вимагає більше фізично можливого — познач "euCompliant": false і опиши в risks конкретне порушення

4️⃣ ЧАСОВІ ВІКНА ЗАВАНТАЖЕННЯ/РОЗВАНТАЖЕННЯ:
   - Розрахуй реальний час прибуття водія на кожну точку
   - Якщо водій НЕ встигає на вказаний час — не відкидай маршрут, а ПОЗНАЧ:
     * "timeOverlap": true
     * у risks додай: "LATE_ARRIVAL: Запізнення на {locality}: за графіком {час}, реально ~{розрахунковий час}"
   - Якщо прибуття в неробочий час — познач у risks "OFFHOURS: Можливо склад не працює о {час}"
   - Час завантаження/розвантаження ГНУЧКИЙ в межах того самого дня — познач "timeOverlap": true

5️⃣ ПРОЗОРІСТЬ ТА СОРТУВАННЯ ДЛЯ КОРИСТУВАЧА:
   - НЕ ПРИХОВУЙ жодних маршрутів, навіть якщо вони ризиковані або нереалістичні
   - Замість того щоб відкидати — ЧЕСНО ВКАЗУЙ ризики у полі "risks" (масив рядків)
   - СОРТУВАННЯ: Відсортуй повернутий масив routes від НАЙБІЛЬШ підходящого (високий score, немає порушень ЄС, низький порожній пробіг, вчасне повернення) до НАЙМЕНШ підходящого (високий ризик, великі запізнення).
   - ⛔ ЖОРСТКИЙ ФІЛЬТР: НЕ ПОВЕРТАЙ маршрути де emptyRunPercent > {{MAX_EMPTY_PERCENT}}%. Такі маршрути взагалі не включай у відповідь. Рахуй порожній пробіг як: (відстань від бази до першого завантаження) + (відстані між розвантаженням і наступним завантаженням) + (відстань від останнього розвантаження до бази). Порожній % = (порожній км / загальний км) * 100.
   - ⚠️ КРИТИЧНА ПОМИЛКА яку НЕ ДОПУСКАЙ: якщо розвантаження вантажу A в місті X, а завантаження вантажу B в місті Y — порожній пробіг між ними = відстань від X до Y (НЕ нуль!). Водій НЕ повертається на базу між вантажами! Він бере НАЙБЛИЖЧИЙ вантаж до свого поточного місцезнаходження (точки розвантаження). Тому правильний ланцюжок: розвантаження в Würzburg → наступне завантаження має бути ПОБЛИЗУ Würzburg, а НЕ в Кракові!
   - Типи ризиків:
     * "EU_VIOLATION" — порушення EU правил
     * "LATE_ARRIVAL" — запізнення на завантаження/розвантаження
     * "OFFHOURS" — прибуття в неробочий час
     * "TIGHT_SCHEDULE" — дуже щільний графік без запасу часу
     * "OUT_OF_RANGE" — не встигає повернутись на базу до {{RETURN_TO}}

6️⃣ ПАГІНАЦІЯ (ОБХІД ЛІМІТІВ ТОКЕНІВ):
   - Оскільки комбінацій може бути дуже багато, ти фізично не вмістиш їх у ліміт своєї відповіді (JSON).
   - Знайди в пам'яті ВСІ варіанти.
   - Поверни стільки топових (згідно з сортуванням) маршрутів, скільки гарантовано поміститься в 1 відповідь (наприклад, 40-50).
   - Обов'язково заповни об'єкт metadata, вказавши скільки всього маршрутів ти знайшов, скільки повернув у цій відповіді, та згенеруй текст nextPagePrompt, який користувач або система має відправити тобі наступним повідомленням для отримання наступної порції.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 ДОСТУПНІ ВАНТАЖІ ({{OFFERS_COUNT}} шт):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{OFFERS_LIST}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ЗАВДАННЯ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Знайди ВСІ можливі ланцюжки з 2-5 вантажів які:
(а) Стартують з бази {{HOME_LAT}},{{HOME_LON}} (або поряд ±50км)
(б) Завершуються поверненням на ту саму базу
(в) Вкладаються у діапазон {{DEPARTURE_FROM}} — {{RETURN_TO}}

Для кожного маршруту чесно оціни ризики. Відсортуй від найкращого до найгіршого. Заповни метадані пагінації. 
- Реалістичність часового графіка (з урахуванням швидкості {{AVERAGE_SPEED}} км/год і EU відпочинку)
- Потенційні порушення EU законодавства
- Запізнення на завантаження/розвантаження
- Порожній пробіг

Поверни ВСІ знайдені варіанти (навіть ризиковані) — користувач вибере сам.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 ФОРМАТ ВІДПОВІДІ (ТІЛЬКИ JSON, без жодного тексту навколо):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "metadata": {
    "totalRoutesFound": 142,
    "returnedRoutesCount": 40,
    "nextPagePrompt": "Поверни наступну порцію маршрутів (з 41 по 80). Пропусти ті комбінації, які вже були згенеровані, і продовжуй сортування від кращих до гірших згідно з попередніми критеріями."
  },
  "routes": [
    {
      "offerIds": ["id1", "id2", "id3"],
      "totalDistanceKm": 1500,
      "loadedDistanceKm": 1200,
      "emptyDistanceKm": 300,
      "emptyRunPercent": 20,
      "totalDays": 5,
      "totalDrivingHours": 18,
      "euCompliant": true,
      "timeOverlap": false,
      "returnsOnTime": true,
      "startsAt": "2026-05-09T06:00:00",
      "endsAt": "2026-05-14T18:00:00",
      "score": 85,
      "risks": [
        "LATE_ARRIVAL: Запізнення на розвантаження у Berlin: за графіком 08:00, реально ~12:00",
        "OFFHOURS: Прибуття на завантаження у Hamburg ~22:30, склад може бути зачинений"
      ],
      "reasoning": "коротке пояснення логіки маршруту"
    }
  ],
  "reasoning": "загальна стратегія підбору маршрутів",
  "confidence": 0.85
}`;

// ============================================================
// API KEYS
// Set your API keys here. They will be saved to localStorage.
// Priority: Gemini (free) > Groq (free) > OpenAI > Claude
// ============================================================

const API_KEYS = {
  // 🥇 Google Gemini - FREE, 1M tokens/min, best for large prompts
  // Get key: https://aistudio.google.com/app/apikey
  GEMINI: 'AIzaSyB3Eppp9SanmziMmHAYPOcgxcJJWiCKTMM',

  // 🥈 Groq - FREE, 14,400 requests/day, fast but small context
  // Get key: https://console.groq.com
  GROQ: '',

  // OpenAI - ~$0.03 per request
  // Get key: https://platform.openai.com/api-keys
  OPENAI: '',

  // Claude - ~$0.015 per request
  // Get key: https://console.anthropic.com/settings/keys
  CLAUDE: '',
};

// ============================================================
// AI MODEL SETTINGS
// ============================================================

export const AI_MODELS = {
  GEMINI: 'gemini-2.5-pro',
  GROQ: 'llama-3.3-70b-versatile',
  OPENAI: 'gpt-4o',
  CLAUDE: 'claude-3-5-sonnet-20241022',
};

// ============================================================
// AI REQUEST SETTINGS
// ============================================================

export const AI_REQUEST_CONFIG = {
  // Maximum tokens in AI response
  MAX_TOKENS: 32000,

  // Temperature (0-1): lower = more consistent, higher = more creative
  TEMPERATURE: 0.7,

  // Preferred AI service: 'gemini' | 'groq' | 'openai' | 'claude'
  PREFERRED_SERVICE: 'gemini' as const,
  
  // Debug settings
  SAVE_PROMPTS_TO_FILE: true,
  SAVE_RESPONSES_TO_FILE: true,
};

// ============================================================
// OFFER LIMITS
// ============================================================

export const AI_LIMITS = {
  // Maximum offers to send to AI in one request
  // Gemini 2.5 Pro має 1M context window
  // 1 пропозиція ≈ 250 символів ≈ 80 токенів
  MAX_OFFERS_FOR_AI: 2000,

  // When AI returns 429/context error, reduce to this percentage
  RETRY_REDUCTION_PERCENT: 0.5,

  // Minimum offers to try (won't reduce below this)
  MIN_OFFERS_FOR_RETRY: 100,
};

// ============================================================
// API ENDPOINTS (Vite proxy paths - resolve CORS automatically)
// ============================================================

export const AI_ENDPOINTS = {
  GEMINI: `/api/gemini/v1beta/models/${AI_MODELS.GEMINI}:generateContent`,
  GROQ: '/api/groq/openai/v1/chat/completions',
  OPENAI: '/api/openai/v1/chat/completions',
  CLAUDE: '/api/claude/v1/messages',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Initialize API keys from this config file into localStorage.
 * Keys set here ALWAYS overwrite localStorage values.
 */
export function initializeApiKeys(): void {
  if (typeof window === 'undefined') return;

  const keyMap: Record<string, string> = {
    GEMINI_API_KEY: API_KEYS.GEMINI,
    GROQ_API_KEY: API_KEYS.GROQ,
    OPENAI_API_KEY: API_KEYS.OPENAI,
    CLAUDE_API_KEY: API_KEYS.CLAUDE,
  };

  for (const [storageKey, configValue] of Object.entries(keyMap)) {
    if (configValue) {
      localStorage.setItem(storageKey, configValue);
    }
  }
}

/**
 * Get API key from localStorage
 */
export function getApiKey(service: 'gemini' | 'groq' | 'openai' | 'claude'): string {
  if (typeof window === 'undefined') return '';
  
  const keyMap: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
    openai: 'OPENAI_API_KEY',
    claude: 'CLAUDE_API_KEY',
  };

  return localStorage.getItem(keyMap[service]) || '';
}

/**
 * Check which AI services are available (have API keys)
 */
export function getAvailableServices(): string[] {
  const services: string[] = [];
  if (getApiKey('gemini')) services.push('gemini');
  if (getApiKey('groq')) services.push('groq');
  if (getApiKey('openai')) services.push('openai');
  if (getApiKey('claude')) services.push('claude');
  return services;
}
