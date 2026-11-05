import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// A version the user can read off the screen: the build's date and time in
// Bangkok, e.g. 261105.2325. It changes on every deploy, so "did the app
// actually update?" can be answered by looking rather than guessing.
const BUILD_ID = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', year: '2-digit', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date()).reduce((o, x) => ({ ...o, [x.type]: x.value }), {} as Record<string, string>)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(`${BUILD_ID.year}${BUILD_ID.month}${BUILD_ID.day}.${BUILD_ID.hour}${BUILD_ID.minute}`),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new build waits until the user taps "อัปเดต" (see src/lib/pwa.ts),
      // so an update never interrupts what they're doing.
      registerType: 'prompt',
      includeAssets: ['taurus-01.svg', 'taurus-02.svg', 'taurus-04.svg', 'taurus-04-white.svg'],
      manifest: {
        name: 'TAURUS',
        short_name: 'TAURUS',
        description: 'Travel planner for your group trips',
        theme_color: '#0270FB',
        background_color: '#F6F8FB',
        display: 'standalone',
        icons: [
          { src: 'taurus-01.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // /api = Vercel serverless functions — the SW must NEVER hijack them,
        // or opening /api/... shows the cached app shell (blank white page).
        navigateFallbackDenylist: [/^\/api\//, /^\/rest/, /^\/auth/, /^\/storage/, /^\/realtime/],
        // pull in the push / notificationclick handlers (public/push-sw.js)
        importScripts: ['push-sw.js'],
        // Cache app shell + Supabase API/storage responses for offline viewing
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-api', networkTimeoutSeconds: 5, expiration: { maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-files',
              // signed URLs carry a fresh ?token= every time — match by path so
              // previously-viewed files (QR codes!) still render offline
              matchOptions: { ignoreSearch: true },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Cloudinary photos (place/hotel/cover images)
            urlPattern: ({ url }) => url.origin === 'https://res.cloudinary.com',
            handler: 'CacheFirst',
            options: { cacheName: 'cloudinary-images', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // airline logos on the flight card
            urlPattern: ({ url }) => url.origin === 'https://images.kiwi.com',
            handler: 'CacheFirst',
            options: { cacheName: 'airline-logos', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
