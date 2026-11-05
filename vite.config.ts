import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// Dev-only stand-in for the Cloudflare Worker in worker/index.ts.
// Vite proxies server-side, so BMKG's missing CORS headers are a non-issue here.
// Keep the path identical to production so client code never branches on env.
export default defineConfig({
  plugins: [
    vue(),
    // Offline support. The app is used at dark sites, which are dark because they are
    // remote, which is also why they have no signal. Disabled in dev, so the proxy
    // below is never shadowed by a cached response.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // The glob below already covers them; listing them twice duplicates entries.
      includeManifestIcons: false,
      manifest: {
        name: 'Lintang Wengi',
        short_name: 'Lintang Wengi',
        description:
          'Cari lokasi stargazing & astrophotography terbaik di Indonesia berdasarkan polusi cahaya, cuaca BMKG, dan fase bulan.',
        lang: 'id',
        display: 'standalone',
        // --void, matching index.html, so launch does not flash a lighter colour.
        background_color: '#0e0909',
        theme_color: '#0e0909',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // public/data is the whole offline app: the light pollution grid and overlay,
        // and the kecamatan index. Only the Latin font subsets are precached; the
        // others load on demand if a glyph ever needs them.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,bin}', 'assets/*latin*.woff2'],
        // The full logo is a source file for icons, never loaded by the app.
        globIgnores: ['logo.png'],
        // lp-grid.bin is 2.1 MB and Workbox's default limit is 2 MiB, which drops a
        // file from the precache with only a build warning. Real light pollution data
        // will be larger again; raise this with it.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Same rule as the Worker: /api/forecast must never be answered with HTML.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/forecast',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bmkg-forecast',
              networkTimeoutSeconds: 6,
              // BMKG forecasts three days out; past that a saved one covers no night.
              expiration: { maxEntries: 50, maxAgeSeconds: 3 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'basemaps.cartocdn.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'basemap-tiles',
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
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
