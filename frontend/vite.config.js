import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const SPRING  = process.env.SPRING_PROXY_TARGET  || 'http://127.0.0.1:8080'
const FASTAPI = process.env.FASTAPI_PROXY_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    allowedHosts: true,
    watch: { usePolling: true },
    proxy: {
      '/api/vlm': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api/diary/generate': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api/avatar': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/report': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api': {
        target: SPRING,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
})
