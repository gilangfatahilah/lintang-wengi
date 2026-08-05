import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Dev-only stand-in for the Cloudflare Pages Function in functions/api/forecast.ts.
// Vite proxies server-side, so BMKG's missing CORS headers are a non-issue here.
// Keep the path identical to production so client code never branches on env.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/api/forecast': {
        target: 'https://api.bmkg.go.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/forecast/, '/publik/prakiraan-cuaca'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
