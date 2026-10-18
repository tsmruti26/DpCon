import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Match Spring's explicit server.address=127.0.0.1 binding and avoid hostname
// resolution selecting IPv6 ::1 on some Windows/Node setups.
const backendTarget = process.env.BACKEND_URL || 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
