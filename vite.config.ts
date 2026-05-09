import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 7739,
    host: '127.0.0.1',
    strictPort: true, // Fail if port is already in use
    proxy: {
      '/api/trans': {
        target: 'http://localhost:8847',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
      '/api/geocoder': {
        target: 'http://localhost:8847',
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
