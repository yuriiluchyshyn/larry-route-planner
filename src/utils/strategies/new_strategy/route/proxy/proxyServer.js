/**
 * Clean Proxy Server
 * Чистий проксі-сервер без хардкодів
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
  PORT: process.env.PROXY_PORT || 8848,
  TARGET: process.env.PROXY_TARGET || 'https://api-platform.trans.eu',
  TIMEOUT: parseInt(process.env.PROXY_TIMEOUT) || 30000,
  RETRIES: parseInt(process.env.PROXY_RETRIES) || 3,
  JWT_TOKEN: process.env.TRANSEU_JWT_TOKEN || ''
};

// CORS конфігурація
const corsOptions = {
  origin: function (origin, callback) {
    // Дозволяємо запити без origin (наприклад, мобільні додатки)
    if (!origin) return callback(null, true);
    // Дозволяємо всі origins для розробки
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
    'Origin',
    'Cache-Control',
    'Pragma',
    'X-API-Key',
    'Referer',
    'User-Agent',
    'Sec-Ch-Ua',
    'Sec-Ch-Ua-Mobile',
    'Sec-Ch-Ua-Platform',
    'Sec-Fetch-Dest',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Site'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // Кешувати preflight на 24 години
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
  
  // Обробляємо OPTIONS запити (preflight)
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
    config: {
      port: CONFIG.PORT,
      target: CONFIG.TARGET,
      timeout: CONFIG.TIMEOUT,
      hasJwtToken: !!CONFIG.JWT_TOKEN
    }
  });
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
  
  // Зберігаємо токен в пам'яті
  CONFIG.JWT_TOKEN = token;
  process.env.TRANSEU_JWT_TOKEN = token;
  
  console.log('🔑 JWT Token updated');
  
  res.json({
    success: true,
    message: 'JWT token has been set',
    tokenLength: token.length
  });
});

// GET endpoint для отримання токену з URL параметрів
app.get('/', (req, res) => {
  const { token } = req.query;
  
  if (token) {
    // Встановлюємо токен
    CONFIG.JWT_TOKEN = token;
    process.env.TRANSEU_JWT_TOKEN = token;
    
    console.log('🔑 JWT Token received from URL parameter');
    
    res.json({
      success: true,
      message: 'JWT token received and set successfully',
      tokenLength: token.length
    });
  } else {
    res.json({
      message: 'Clean Proxy Server',
      version: '3.0.0',
      endpoints: {
        health: '/health',
        status: '/status',
        setToken: 'POST /set-token',
        apiProxy: '/api/*'
      },
      usage: 'Add ?token=your_jwt_token to this URL to set authentication'
    });
  }
});

// Конфігурація проксі
const proxyOptions = {
  target: CONFIG.TARGET,
  changeOrigin: true,
  timeout: CONFIG.TIMEOUT,
  proxyTimeout: CONFIG.TIMEOUT,
  secure: true,
  followRedirects: true,
  
  // Додаткові заголовки
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8,pl;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive'
  },

  // Обробка помилок
  onError: (err, req, res) => {
    console.error('❌ Proxy Error:', err.message);
    
    if (err.code === 'ECONNREFUSED') {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'Unable to connect to target API',
        code: 'CONNECTION_REFUSED'
      });
    } else if (err.code === 'ETIMEDOUT') {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: 'Request to target API timed out',
        code: 'TIMEOUT'
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Proxy server error',
        code: err.code || 'UNKNOWN_ERROR'
      });
    }
  },

  // Обробка відповіді - ДОДАЄМО CORS заголовки
  onProxyRes: (proxyRes, req, res) => {
    try {
      // Додаємо CORS заголовки до відповіді від цільового API
      proxyRes.headers['access-control-allow-origin'] = req.headers.origin || '*';
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type,Authorization,X-Requested-With,Accept,Accept-Language,Origin,Cache-Control,Pragma,X-API-Key,Referer,User-Agent,Sec-Ch-Ua,Sec-Ch-Ua-Mobile,Sec-Ch-Ua-Platform,Sec-Fetch-Dest,Sec-Fetch-Mode,Sec-Fetch-Site';
      
      // Логування відповіді
      console.log(`✅ Response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    } catch (error) {
      console.error('❌ Error in onProxyRes:', error.message);
    }
  },

  // Модифікація запиту
  onProxyReq: (proxyReq, req) => {
    try {
      // Встановлюємо правильні заголовки для цільового API
      const targetUrl = new URL(CONFIG.TARGET);
      proxyReq.setHeader('Host', targetUrl.host);
      proxyReq.setHeader('Origin', `${targetUrl.protocol}//${targetUrl.host}`);
      proxyReq.setHeader('Referer', `${targetUrl.protocol}//${targetUrl.host}/`);
      
      // Додаємо автентифікацію: пріоритет - збережений токен на проксі, потім токен з запиту клієнта
      if (CONFIG.JWT_TOKEN) {
        proxyReq.setHeader('Authorization', `Bearer ${CONFIG.JWT_TOKEN}`);
      } else if (req.headers.authorization) {
        // Якщо проксі не має свого токена, використовуємо токен з запиту клієнта
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
      
      // Додаємо cookie якщо є в оригінальному запиті
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }
      
      // Логування запиту
      const hasAuth = !!(CONFIG.JWT_TOKEN || req.headers.authorization);
      console.log(`🔄 Proxying: ${req.method} ${req.url} -> ${targetUrl.host} [auth: ${hasAuth}]`);
    } catch (error) {
      console.error('❌ Error setting headers in onProxyReq:', error.message);
    }
  }
};

// Middleware для обробки динамічних target URL
app.use((req, res, next) => {
  // Парсимо URL і видаляємо _target_base_url з query string
  try {
    const fullUrl = new URL(req.url, `http://localhost:${CONFIG.PORT}`);
    const targetBaseUrl = fullUrl.searchParams.get('_target_base_url');
    
    if (targetBaseUrl) {
      fullUrl.searchParams.delete('_target_base_url');
      // Оновлюємо req.url без _target_base_url
      req.url = fullUrl.pathname + fullUrl.search;
      req.customTargetUrl = targetBaseUrl;
      console.log(`🎯 Custom target URL: ${targetBaseUrl}`);
      console.log(`🔗 Cleaned URL: ${req.url}`);
    }
  } catch (e) {
    // Fallback для випадку коли URL не парситься
    if (req.query && req.query._target_base_url) {
      req.customTargetUrl = req.query._target_base_url;
      delete req.query._target_base_url;
    }
  }
  
  next();
});

// Створюємо проксі middleware ОДИН РАЗ (не на кожен запит!)
const apiProxy = createProxyMiddleware({
  ...proxyOptions,
  router: (req) => {
    return req.customTargetUrl || CONFIG.TARGET;
  },
  pathRewrite: (path, req) => {
    // Видаляємо /api префікс при проксуванні
    return path.replace(/^\/api/, '');
  }
});

// Основний проксі маршрут
app.use('/api', (req, res, next) => {
  const targetUrl = req.customTargetUrl || CONFIG.TARGET;
  console.log(`🔄 Proxying to: ${targetUrl}${req.url}`);
  apiProxy(req, res, next);
});

// Обробка 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/status',
      '/set-token',
      '/api/*'
    ]
  });
});

// Глобальний обробник помилок
app.use((err, req, res, next) => {
  console.error('� Global Error:', err);
  
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
  console.log('� SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Запуск сервера
const server = app.listen(CONFIG.PORT, () => {
  console.log('🚀 Clean Proxy Server started');
  console.log(`📡 Port: ${CONFIG.PORT}`);
  console.log(`🎯 Target: ${CONFIG.TARGET}`);
  console.log(`⏱️  Timeout: ${CONFIG.TIMEOUT}ms`);
  console.log(`🌐 Health check: http://localhost:${CONFIG.PORT}/health`);
  console.log(`📊 Status: http://localhost:${CONFIG.PORT}/status`);
});

// Налаштування timeout для сервера
server.timeout = CONFIG.TIMEOUT + 5000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;