import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/challenge-tracker/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      base: '/challenge-tracker/',
      manifest: {
        name: 'Challenge Tracker',
        short_name: 'Challenges',
        description: 'Live prop trading challenge dashboard',
        theme_color: '#06060b',
        background_color: '#06060b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/challenge-tracker/',
        scope: '/challenge-tracker/',
        icons: [
          {
            src: '/challenge-tracker/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/challenge-tracker/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
