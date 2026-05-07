// Simple CORS proxy server for Trans.eu API
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 8847;

// Enable CORS for all routes
app.use(cors());

// Proxy middleware for Trans.eu API
const apiProxy = createProxyMiddleware({
  target: 'https://api-platform.trans.eu',
  changeOrigin: true,
  pathRewrite: {
    '^/api/trans': '', // Remove /api/trans prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying: ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Use the proxy for /api/trans routes
app.use('/api/trans', apiProxy);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CORS proxy server is running' });
});

app.listen(PORT, () => {
  console.log(`🚛 Larry CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`Proxying Trans.eu API requests to avoid CORS issues`);
});