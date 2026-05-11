import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        finance: resolve(__dirname, 'public/finance.html')
      }
    }
  },
  server: {
    port: 7740,
    host: '127.0.0.1',
    strictPort: true, // Fail if port is already in use
    proxy: {
      '/api/trans': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/api/freight-offers': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/app/exchange/api/rest/v2': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/set-token': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/health': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/status': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/api/geocoder': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/app/geocoder-api': {
        target: 'http://localhost:8848',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      // AI API proxies (resolve CORS)
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
      },
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ''),
      },
      '/api/groq': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/groq/, ''),
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
    },
  },
})
