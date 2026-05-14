/**
 * API Configuration
 * Конфігурація для API сервісу
 */

export const API_CONFIG = {
  // Base URLs
  BASE_URL: 'https://api.trans.eu',
  PROXY_BASE_URL: 'http://localhost:8848',
  GEOCODER_BASE_URL: 'https://api-platform.trans.eu',
  
  // Endpoints
  ENDPOINTS: {
    FREIGHT_OFFERS: '/app/exchange/api/rest/v2/freight-offers',
    GEOCODER_LOCATIONS: '/app/geocoder-api/api/v2/locations',
    GEOCODER_REVERSE: '/app/geocoder-api/api/v2/reverse',
    GEOCODER_SUGGEST: '/app/geocoder-api/api/v2/suggest',
    ROUTE_CALCULATE: '/app/stored-routes/api/rest/v3/stored-routes/{routeId}/private/calculate',
    HEALTH: '/health',
    STATUS: '/status'
  },
  
  // Request settings
  REQUEST: {
    TIMEOUT: 30000, // 30 seconds
    RETRIES: 3,
    BATCH_SIZE: 100,
    DELAY_BETWEEN_REQUESTS: 200 // ms
  },
  
  // Headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Larry-Route-Planner/1.0',
    'Cache-Control': 'no-cache'
  },
  
  // Rate limiting
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 100,
    BURST_LIMIT: 10
  }
};

export const TRANSEU_CONFIG = {
  // Countries - ВИПРАВЛЕНІ КОДИ КРАЇН
  COUNTRIES: {
    POLAND: '47_poland',
    GERMANY: '21_germany', 
    UKRAINE: '380_ukraine',
    FRANCE: '19_france', // ВИПРАВЛЕНО: було 33_france
    CZECH_REPUBLIC: '420_czech_republic',
    AUSTRIA: '43_austria',
    SLOVAKIA: '421_slovakia',
    HUNGARY: '36_hungary',
    ITALY: '39_italy',
    SPAIN: '34_spain',
    NETHERLANDS: '31_netherlands',
    BELGIUM: '32_belgium'
  },
  
  // Geocoder configuration
  GEOCODER: {
    DEFAULT_LANG: 'ua',
    DEFAULT_LIMIT: 10,
    DEFAULT_OFFSET: 0,
    LOCATION_TYPES: ['combined_postal_area', 'postal_area', 'locality_postal_area', 'country'],
    ENABLE_AUTO_GEOCODING: true // увімкнено після виправлення проксі
  },
  
  // Default search parameters
  SEARCH_DEFAULTS: {
    EXCLUDE_SUSPENDED: true,
    PLACES_MATCHING_TYPE: 'cross' as const,
    SORT_FIELD: 'index',
    SORT_ORDER: 'desc' as const,
    COUNTERS: ['all'],
    SEARCH_RADIUS: 50 // km - радіус пошуку навколо вказаних координат
  },
  
  // Filters
  FILTERS: {
    MAX_DISTANCE: 2000000, // 2000 km in meters
    MIN_CAPACITY: 1,
    MAX_CAPACITY: 100
  }
};