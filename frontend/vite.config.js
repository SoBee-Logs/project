import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

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
    proxy: {
      '/api/vlm': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api/diary/generate': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api/avatar': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/report': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        headers: { origin: 'http://localhost:5173' },
      },
    },
  },
})
