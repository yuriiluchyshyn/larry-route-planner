/**
 * Redis Configuration
 * Конфігурація для Redis сервісу
 */

export const REDIS_CONFIG = {
  // Connection settings
  CONNECTION: {
    HOST: 'localhost',
    PORT: 6379,
    PASSWORD: '',
    DB: 0,
    CONNECT_TIMEOUT: 10000,
    COMMAND_TIMEOUT: 5000
  },
  
  // Key prefixes
  KEYS: {
    PREFIX: 'larry:routes:',
    ROUTE: 'route:',
    INDEX: 'index:',
    ROUTES_INDEX: 'routes_index',
    STATS: 'stats:'
  },
  
  // TTL settings (in seconds)
  TTL: {
    ROUTE_DATA: 24 * 60 * 60, // 24 hours
    ROUTE_INDEX: 24 * 60 * 60, // 24 hours
    STATS: 60 * 60, // 1 hour
    TEMP_DATA: 5 * 60 // 5 minutes
  },
  
  // Batch processing
  BATCH: {
    SIZE: 50,
    DELAY: 10 // ms between batch operations
  },
  
  // Memory limits
  LIMITS: {
    MAX_MEMORY: '512mb',
    MAX_KEYS: 100000,
    WARNING_THRESHOLD: 0.8 // 80% of max memory
  }
};

export const REDIS_MOCK_CONFIG = {
  // Mock Redis settings for development/testing
  ENABLED: true,
  AUTO_EXPIRE: true,
  LOG_OPERATIONS: false,
  SIMULATE_NETWORK_DELAY: false,
  NETWORK_DELAY_MS: 10
};