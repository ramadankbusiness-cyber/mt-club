import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5001",
      "/uploads": "http://localhost:5001"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["lucide-react"],
          "vendor-xlsx": ["xlsx", "xlsx-js-style"],
          "vendor-qr": ["qrcode.react", "qrcode"],
          "vendor-scanner": ["@zxing/browser", "@zxing/library"],
        }
      }
    },
    chunkSizeWarningLimit: 800
  }
})
