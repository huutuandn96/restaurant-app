import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_TARGET = process.env.API_TARGET || 'http://localhost:3000'
const SOCKET_TARGET = process.env.SOCKET_TARGET || 'http://localhost:4000'

// Điện thoại chỉ cần truy cập 1 địa chỉ http://LAN_IP:5173 —
// Vite proxy /api sang Rails và /socket.io sang Socket server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: !!process.env.CHOKIDAR_USEPOLLING },
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: SOCKET_TARGET, ws: true, changeOrigin: true },
    },
  },
})
