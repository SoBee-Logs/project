import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const SPRING  = process.env.SPRING_PROXY_TARGET  || 'http://127.0.0.1:8080'
const FASTAPI = process.env.FASTAPI_PROXY_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(),
  ],
  server: {
    https: true,
    host: true,
    allowedHosts: true,
    watch: { usePolling: true },
    proxy: {
      '/api/vlm': {
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
      '/report/mydata': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/report/ai-insight': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/report': {
        target: FASTAPI,
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/search': {
        target: SPRING,
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