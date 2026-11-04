import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request) => {
          // Better Auth receives the backend origin when developing through Vite.
          request.setHeader('origin', 'http://localhost:3000')
          request.setHeader('referer', 'http://localhost:3000/')
        })
      },
    },
  } },
})
