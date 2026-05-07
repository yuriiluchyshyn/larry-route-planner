// CORS proxy server for Trans.eu API with detailed logging + gzip decoding
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8847;

// Logs directory
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = path.join(LOGS_DIR, `requests-${sessionTimestamp}.log`);
console.log(`📝 Logging all requests to: ${LOG_FILE}`);

function logEntry(entry) {
  const line = JSON.stringify(entry, null, 2);
  console.log(line);
  console.log('─'.repeat(80));
  fs.appendFileSync(LOG_FILE, line + '\n' + '─'.repeat(80) + '\n');
}

let requestCounter = 0;

app.use(cors());

// Helper to decompress gzip body
function decompressBody(buffer, encoding) {
  try {
    if (encoding === 'gzip') return zlib.gunzipSync(buffer).toString('utf-8');
    if (encoding === 'deflate') return zlib.inflateSync(buffer).toString('utf-8');
    if (encoding === 'br') return zlib.brotliDecompressSync(buffer).toString('utf-8');
    return buffer.toString('utf-8');
  } catch (err) {
    return `[decompression error: ${err.message}] raw length: ${buffer.length}`;
  }
}

// Generic proxy factory with detailed logging
function createLoggingProxy(target, pathPrefix, stripPrefix) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: stripPrefix ? { [`^${stripPrefix}`]: '' } : undefined,
    // Disable response buffering so we can intercept
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req, res) => {
      const reqId = ++requestCounter;
      req._reqId = reqId;
      req._startTime = Date.now();

      const fullUrl = req.url;
      const [pathPart, queryPart] = fullUrl.split('?');
      const decodedParams = {};
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        for (const [key, value] of params) {
          try { decodedParams[key] = JSON.parse(value); }
          catch { decodedParams[key] = value; }
        }
      }

      logEntry({
        type: '🔵 REQUEST',
        reqId,
        timestamp: new Date().toISOString(),
        endpoint: pathPrefix,
        method: req.method,
        path: pathPart,
        targetUrl: `${target}${stripPrefix ? fullUrl.replace(stripPrefix, '') : fullUrl}`,
        decodedParams,
        authTokenSuffix: req.headers.authorization ? `***${req.headers.authorization.slice(-10)}` : 'MISSING',
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      const reqId = req._reqId;
      const duration = Date.now() - req._startTime;
      const chunks = [];

      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const encoding = proxyRes.headers['content-encoding'];
        const decompressed = decompressBody(buffer, encoding);

        let parsedBody;
        try { parsedBody = JSON.parse(decompressed); }
        catch { parsedBody = decompressed.substring(0, 1000); }

        const summary = {
          type: proxyRes.statusCode >= 400 ? '🔴 RESPONSE' : '🟢 RESPONSE',
          reqId,
          timestamp: new Date().toISOString(),
          durationMs: duration,
          status: proxyRes.statusCode,
          endpoint: pathPrefix,
        };

        if (parsedBody && typeof parsedBody === 'object') {
          const offers = parsedBody._embedded?.['freight-offers'];
          const locations = parsedBody._embedded?.locations;
          if (offers) {
            summary.offersCount = offers.length;
            summary.total = parsedBody.total;
            summary.counters = parsedBody.counters;
            if (offers.length > 0) {
              summary.firstOffer = { id: offers[0].id, index: offers[0].index, created_at: offers[0].created_at };
              summary.lastOffer = { id: offers[offers.length - 1].id, index: offers[offers.length - 1].index, created_at: offers[offers.length - 1].created_at };
            }
          } else if (locations) {
            summary.locationsCount = locations.length;
            summary.totalItems = parsedBody.total_items;
            summary.firstLocation = locations[0];
          } else if (parsedBody.error || parsedBody.message || parsedBody.errors) {
            summary.error = parsedBody.error;
            summary.message = parsedBody.message;
            summary.errors = parsedBody.errors;
            summary.fullBody = parsedBody;
          } else {
            summary.body = parsedBody;
          }
        } else {
          summary.body = parsedBody;
        }

        logEntry(summary);

        // Forward response to client (must decompress since we intercepted)
        // Strip content-encoding and let express send decompressed body
        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        res.writeHead(proxyRes.statusCode, headers);
        res.end(decompressed);
      });
    },
    onError: (err, req, res) => {
      logEntry({
        type: '❌ PROXY ERROR',
        reqId: req._reqId,
        timestamp: new Date().toISOString(),
        endpoint: pathPrefix,
        error: err.message,
      });
      if (!res.headersSent) res.status(500).json({ error: 'Proxy error', details: err.message });
    }
  });
}

// Proxy for Trans.eu freight-offers API
app.use('/api/trans', createLoggingProxy('https://api-platform.trans.eu', '/api/trans', '/api/trans'));

// Proxy for Trans.eu geocoder API
app.use('/api/geocoder', createLoggingProxy('https://api-platform.trans.eu', '/api/geocoder', '/api/geocoder'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', logFile: LOG_FILE });
});

app.listen(PORT, () => {
  console.log(`🚛 Larry CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`📝 Logging to: ${LOG_FILE}`);
  console.log(`   /api/trans    → https://api-platform.trans.eu (freight-offers)`);
  console.log(`   /api/geocoder → https://api-platform.trans.eu (geocoder)`);
});
