import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    // Lets the dev server accept requests through a temporary tunnel (e.g.
    // cloudflared/ngrok), whose Host header Vite would otherwise reject as
    // an unrecognized host. Fine for a short-lived local demo; revert if
    // this stops being used for that.
    allowedHosts: true,
  },
})
