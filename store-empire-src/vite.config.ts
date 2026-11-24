import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Build ra ../store-empire (GitHub Pages phục vụ thẳng thư mục đó). base './' để chạy ở mọi đường dẫn con.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: './',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Store Empire',
        short_name: 'Store Empire',
        description: 'From Employee to Business Tycoon',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#9fd8c7',
        theme_color: '#2b2340',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,glb,svg}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: { outDir: '../store-empire', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
