/**
 * Enhanced Proxy Server
 * Покращений проксі-сервер для усунення 502 та CORS помилок
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Завантаження .env файлу якщо існує
const envPath = path.join(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  });
  console.log('📄 Loaded .env file');
}

const app = express();

// Конфігурація
const CONFIG = {
  PORT: process.env.PROXY_PORT || 8848, // Змінено з 7740 на 8848
  TARGET: 'https://api-platform.trans.eu', // Виправлено домен!
  TIMEOUT: 30000,
  RETRIES: 3,
  // API ключі та токени (можна передати через змінні середовища)
  API_KEY: process.env.TRANSEU_API_KEY || '',
  CLIENT_ID: process.env.TRANSEU_CLIENT_ID || '',
  CLIENT_SECRET: process.env.TRANSEU_CLIENT_SECRET || '',
  JWT_TOKEN: process.env.TRANSEU_JWT_TOKEN || ''
};

// CORS конфігурація
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:7740', // Додано порт для Vite frontend
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:7740', // Додано порт для Vite frontend
    'http://localhost:8080'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-API-Key'
  ],
  credentials: true
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 хвилина
  max: 100, // максимум 100 запитів на хвилину
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 60
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логування запитів
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  
  // Додаємо заголовки для кращої сумісності
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: CONFIG.PORT
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    requests: req.app.locals.requestCount || 0,
    errors: req.app.locals.errorCount || 0,
    config: {
      port: CONFIG.PORT,
      target: CONFIG.TARGET,
      timeout: CONFIG.TIMEOUT,
      hasApiKey: !!CONFIG.API_KEY,
      hasClientCredentials: !!(CONFIG.CLIENT_ID && CONFIG.CLIENT_SECRET),
      hasJwtToken: !!CONFIG.JWT_TOKEN,
      jwtExpiry: CONFIG.JWT_TOKEN ? extractTokenExpiry(CONFIG.JWT_TOKEN) : null
    }
  });
});

// Test geocoder endpoint
app.get('/test-geocoder', async (req, res) => {
  try {
    const { search = 'Gdańsk' } = req.query;
    
    console.log('🧪 Testing Geocoder API...');
    
    const params = new URLSearchParams({
      search: search,
      lang: 'ua',
      filter: JSON.stringify({
        type: ['combined_postal_area', 'postal_area', 'locality_postal_area', 'country']
      }),
      offset: '0',
      limit: '10'
    });
    
    const testUrl = `${CONFIG.TARGET}/app/geocoder-api/api/v2/locations?${params.toString()}`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru,de=0.9,en=0.8,it=0.7,pl=0.6,uk=0.5',
        'Host': 'api-platform.trans.eu',
        'Origin': 'https://platform.trans.eu',
        'Referer': 'https://platform.trans.eu/',
        ...(CONFIG.JWT_TOKEN && { 'Authorization': `Bearer ${CONFIG.JWT_TOKEN}` }),
        ...(CONFIG.API_KEY && !CONFIG.JWT_TOKEN && { 'Authorization': `Bearer ${CONFIG.API_KEY}` })
      },
      timeout: 10000
    });
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      url: testUrl,
      search: search
    };
    
    if (response.ok) {
      try {
        const data = await response.json();
        result.data = data;
        result.success = true;
        result.locationsFound = data._embedded?.locations?.length || 0;
        
        if (result.locationsFound > 0) {
          result.firstLocation = {
            locality: data._embedded.locations[0].locality,
            postalCode: data._embedded.locations[0].postalCode,
            latitude: data._embedded.locations[0].latitude,
            longitude: data._embedded.locations[0].longitude
          };
        }
      } catch (e) {
        result.bodyError = 'Failed to parse JSON response';
      }
    } else {
      try {
        result.errorBody = await response.text();
      } catch (e) {
        result.errorBody = 'Failed to read error response';
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ Geocoder test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Test endpoint для перевірки доступу до Trans.eu
app.get('/test-transeu', async (req, res) => {
  try {
    console.log('🧪 Testing Trans.eu API access...');
    
    // Простий запит до Trans.eu без автентифікації
    const testUrl = `${CONFIG.TARGET}/app/exchange/api/rest/v2/freight-offers?limit=1`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru,de=0.9,en=0.8,it=0.7,pl=0.6,uk=0.5',
        'Host': 'api-platform.trans.eu',
        'Origin': 'https://platform.trans.eu',
        'Referer': 'https://platform.trans.eu/',
        ...(CONFIG.JWT_TOKEN && { 'Authorization': `Bearer ${CONFIG.JWT_TOKEN}` }),
        ...(CONFIG.API_KEY && !CONFIG.JWT_TOKEN && { 'Authorization': `Bearer ${CONFIG.API_KEY}` })
      },
      timeout: 10000
    });
    
    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: testUrl
    };
    
    if (response.ok) {
      try {
        const data = await response.json();
        result.data = data;
        result.success = true;
      } catch (e) {
        result.bodyError = 'Failed to parse JSON response';
      }
    } else {
      try {
        result.errorBody = await response.text();
      } catch (e) {
        result.errorBody = 'Failed to read error response';
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('❌ Trans.eu test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Restart endpoint (для розробки)
app.post('/restart', (req, res) => {
  res.json({ message: 'Restarting server...' });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// JWT Token endpoint для встановлення токену
app.post('/set-token', express.json(), (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: 'Token is required',
      usage: 'POST /set-token with {"token": "your_jwt_token"}'
    });
  }
  
  // Зберігаємо токен в пам'яті (в продакшені краще використовувати Redis)
  CONFIG.JWT_TOKEN = token;
  
  // Також можна встановити як змінну середовища
  process.env.TRANSEU_JWT_TOKEN = token;
  
  console.log('🔑 JWT Token updated');
  
  res.json({
    success: true,
    message: 'JWT token has been set',
    tokenLength: token.length,
    expiresAt: extractTokenExpiry(token)
  });
});

// Функція для витягування expiry з JWT токену
function extractTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
  } catch (error) {
    return null;
  }
}

// GET endpoint для отримання токену з URL параметрів
app.get('/', (req, res) => {
  const { token } = req.query;
  
  if (token) {
    // Встановлюємо токен
    CONFIG.JWT_TOKEN = token;
    process.env.TRANSEU_JWT_TOKEN = token;
    
    console.log('🔑 JWT Token received from URL parameter');
    
    const expiry = extractTokenExpiry(token);
    
    res.json({
      success: true,
      message: 'JWT token received and set successfully',
      tokenLength: token.length,
      expiresAt: expiry,
      instructions: {
        testAccess: 'GET /test-transeu',
        makeRequests: 'Use /api/trans/* endpoints'
      }
    });
  } else {
    res.json({
      message: 'Enhanced Proxy Server for Trans.eu API',
      version: '2.0.0',
      endpoints: {
        health: '/health',
        status: '/status',
        setToken: 'POST /set-token',
        testTranseu: '/test-transeu',
        testGeocoder: '/test-geocoder',
        apiProxy: '/api/trans/*'
      },
      usage: 'Add ?token=your_jwt_token to this URL to set authentication'
    });
  }
});

// Конфігурація проксі для Trans.eu API
const proxyOptions = {
  target: CONFIG.TARGET,
  changeOrigin: true,
  timeout: CONFIG.TIMEOUT,
  proxyTimeout: CONFIG.TIMEOUT,
  secure: true, // для HTTPS
  followRedirects: true,
  
  // Додаткові заголовки для автентифікації
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8,pl;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Connection': 'keep-alive'
  },

  // Обробка помилок
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    
    req.app.locals.errorCount = (req.app.locals.errorCount || 0) + 1;
    
    if (err.code === 'ECONNREFUSED') {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Unable to connect to Trans.eu API',
        code: 'CONNECTION_REFUSED',
        suggestions: [
          'Check internet connection',
          'Verify Trans.eu API is accessible',
          'Try again in a few moments'
        ]
      });
    } else if (err.code === 'ETIMEDOUT') {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request to Trans.eu API timed out',
        code: 'TIMEOUT',
        suggestions: [
          'Try again with a smaller request',
          'Check network connectivity',
          'Contact support if issue persists'
        ]
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Proxy server error',
        code: err.code || 'UNKNOWN_ERROR'
      });
    }
  },

  // Обробка відповіді
  onProxyRes: (proxyRes, req, res) => {
    try {
      // Додаємо CORS заголовки до відповіді тільки якщо заголовки ще не відправлені
      if (!res.headersSent) {
        proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      }
      
      // Спеціальна обробка 403 помилки
      if (proxyRes.statusCode === 403) {
        console.error('🚫 403 Forbidden - Authentication required');
        console.error('💡 Suggestions:');
        console.error('   1. Add TRANSEU_API_KEY environment variable');
        console.error('   2. Add TRANSEU_CLIENT_ID and TRANSEU_CLIENT_SECRET');
        console.error('   3. Check if your IP is whitelisted');
        console.error('   4. Verify API credentials are valid');
        
        // Додаємо додаткові заголовки для діагностики тільки якщо можливо
        if (!res.headersSent) {
          proxyRes.headers['X-Auth-Error'] = 'API key required';
          proxyRes.headers['X-Suggestions'] = 'Set TRANSEU_API_KEY environment variable';
        }
      }
      
      // Логування відповіді
      console.log(`✅ Response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
      
      req.app.locals.requestCount = (req.app.locals.requestCount || 0) + 1;
    } catch (error) {
      console.error('❌ Error in onProxyRes:', error.message);
    }
  },

  // Модифікація запиту
  onProxyReq: (proxyReq, req, res) => {
    try {
      // Перевіряємо, чи можемо встановлювати заголовки
      if (typeof proxyReq.setHeader !== 'function') {
        console.warn('⚠️ proxyReq.setHeader is not available');
        return;
      }

      // Додаємо необхідні заголовки для Trans.eu (виправлені домени)
      proxyReq.setHeader('Host', 'api-platform.trans.eu');
      proxyReq.setHeader('Origin', 'https://platform.trans.eu');
      proxyReq.setHeader('Referer', 'https://platform.trans.eu/');
      
      // Пріоритет автентифікації: JWT Token > API Key > OAuth2
      if (CONFIG.JWT_TOKEN) {
        proxyReq.setHeader('Authorization', `Bearer ${CONFIG.JWT_TOKEN}`);
        console.log('🔑 Using JWT Token for authentication');
      } else if (CONFIG.API_KEY) {
        proxyReq.setHeader('Authorization', `Bearer ${CONFIG.API_KEY}`);
        console.log('🔑 Using API Key for authentication');
      } else if (CONFIG.CLIENT_ID && CONFIG.CLIENT_SECRET) {
        const auth = Buffer.from(`${CONFIG.CLIENT_ID}:${CONFIG.CLIENT_SECRET}`).toString('base64');
        proxyReq.setHeader('Authorization', `Basic ${auth}`);
        console.log('🔑 Using OAuth2 credentials for authentication');
      }
      
      // Додаємо cookie якщо є в оригінальному запиті
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }
      
      // Логування запиту
      console.log(`🔄 Proxying: ${req.method} ${req.url} -> ${CONFIG.TARGET}${req.url}`);
    } catch (error) {
      console.error('❌ Error setting headers in onProxyReq:', error.message);
    }
  },

  // Retry логіка
  retry: {
    retries: CONFIG.RETRIES,
    retryDelay: (retryCount) => {
      return Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff
    },
    retryCondition: (error) => {
      return error.code === 'ECONNRESET' || 
             error.code === 'ETIMEDOUT' || 
             error.code === 'ECONNREFUSED';
    }
  }
};

// Middleware для обробки динамічних target URL
app.use((req, res, next) => {
  // Перевіряємо чи є параметр _target_base_url
  const targetBaseUrl = req.query._target_base_url;
  
  if (targetBaseUrl) {
    // Видаляємо параметр з query string
    delete req.query._target_base_url;
    
    // Зберігаємо target URL в req для використання в проксі
    req.customTargetUrl = targetBaseUrl;
    
    console.log(`🎯 Custom target URL detected: ${targetBaseUrl}`);
  }
  
  next();
});

// Основний проксі маршрут для Trans.eu API з підтримкою динамічних target URL
app.use('/api/trans', (req, res, next) => {
  const targetUrl = req.customTargetUrl || CONFIG.TARGET;
  
  const dynamicProxyOptions = {
    ...proxyOptions,
    target: targetUrl,
    router: (req) => {
      return req.customTargetUrl || CONFIG.TARGET;
    },
    // Додаємо обробку помилок для HTML відповідей
    onProxyRes: (proxyRes, req, res) => {
      try {
        // Перевіряємо Content-Type
        const contentType = proxyRes.headers['content-type'] || '';
        
        if (contentType.includes('text/html')) {
          console.error('🚫 Received HTML instead of JSON from Trans.eu API');
          console.error('   This usually means authentication failed or wrong endpoint');
          console.error('   Request URL:', req.url);
          console.error('   Target URL:', targetUrl + req.url);
          
          // Встановлюємо правильні заголовки для JSON відповіді
          res.status(403);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Authentication required',
            message: 'Trans.eu API returned HTML instead of JSON. Please check your authentication token.',
            requestUrl: req.url,
            targetUrl: targetUrl + req.url,
            suggestions: [
              'Verify your JWT token is valid and not expired',
              'Check if your IP is whitelisted in Trans.eu',
              'Ensure you have proper API access permissions'
            ]
          }));
          return;
        }
        
        // Викликаємо оригінальний обробник
        if (proxyOptions.onProxyRes) {
          proxyOptions.onProxyRes(proxyRes, req, res);
        }
      } catch (error) {
        console.error('❌ Error in proxy response handler:', error.message);
      }
    }
  };
  
  console.log(`🔄 Proxying to: ${targetUrl}${req.url}`);
  
  createProxyMiddleware(dynamicProxyOptions)(req, res, next);
});

// Альтернативний маршрут для freight-offers
app.use('/api/freight-offers', createProxyMiddleware({
  ...proxyOptions,
  target: `${CONFIG.TARGET}/app/exchange/api/rest/v2`,
  pathRewrite: {
    '^/api/freight-offers': '/freight-offers'
  }
}));

// Прямий маршрут для app/exchange/api/rest/v2 (для сумісності)
app.use('/app/exchange/api/rest/v2', (req, res, next) => {
  const proxyMiddleware = createProxyMiddleware({
    ...proxyOptions,
    target: CONFIG.TARGET,
    pathRewrite: {
      '^/app/exchange/api/rest/v2': '/app/exchange/api/rest/v2'
    },
    // Додаємо обробку помилок для HTML відповідей
    onProxyRes: (proxyRes, req, res) => {
      try {
        // Перевіряємо Content-Type
        const contentType = proxyRes.headers['content-type'] || '';
        
        if (contentType.includes('text/html')) {
          console.error('🚫 Received HTML instead of JSON from Trans.eu API (direct route)');
          console.error('   This usually means authentication failed or wrong endpoint');
          console.error('   Request URL:', req.url);
          console.error('   Full URL:', CONFIG.TARGET + '/app/exchange/api/rest/v2' + req.url);
          
          // Встановлюємо правильні заголовки для JSON відповіді
          res.status(403);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Authentication required',
            message: 'Trans.eu API returned HTML instead of JSON. Please check your authentication token.',
            requestUrl: req.url,
            fullUrl: CONFIG.TARGET + '/app/exchange/api/rest/v2' + req.url,
            suggestions: [
              'Verify your JWT token is valid and not expired',
              'Check if your IP is whitelisted in Trans.eu',
              'Ensure you have proper API access permissions',
              'Try setting a valid JWT token via POST /set-token'
            ]
          }));
          return;
        }
        
        // Викликаємо оригінальний обробник
        if (proxyOptions.onProxyRes) {
          proxyOptions.onProxyRes(proxyRes, req, res);
        }
      } catch (error) {
        console.error('❌ Error in direct route proxy response handler:', error.message);
      }
    }
  });
  
  proxyMiddleware(req, res, next);
});

// Маршрут для геокодера (реалізовано так само як freight-offers)
app.use('/app/geocoder-api', createProxyMiddleware({
  ...proxyOptions,
  target: `${CONFIG.TARGET}/app/geocoder-api`,
  pathRewrite: {
    '^/app/geocoder-api': ''
  }
}));

// Обробка 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/status',
      '/test-geocoder',
      '/api/trans/*',
      '/api/freight-offers/*',
      '/app/geocoder-api/*'
    ]
  });
});

// Глобальний обробник помилок
app.use((err, req, res, next) => {
  console.error('💥 Global Error:', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Запуск сервера
const server = app.listen(CONFIG.PORT, () => {
  console.log('🚀 Enhanced Proxy Server started');
  console.log(`📡 Port: ${CONFIG.PORT}`);
  console.log(`🎯 Target: ${CONFIG.TARGET}`);
  console.log(`⏱️  Timeout: ${CONFIG.TIMEOUT}ms`);
  console.log(`🔄 Retries: ${CONFIG.RETRIES}`);
  console.log(`🌐 Health check: http://localhost:${CONFIG.PORT}/health`);
  console.log(`📊 Status: http://localhost:${CONFIG.PORT}/status`);
});

// Налаштування timeout для сервера
server.timeout = CONFIG.TIMEOUT + 5000; // +5 секунд для обробки
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;