import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'firebase/auth': '@firebase/auth',
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(?:react|react-dom)\//.test(id)) return 'vendor-react';
          if (/\/node_modules\/(?:socket\.io-client|engine\.io-client|engine\.io-parser|socket\.io-parser|@socket\.io\/component-emitter)\//.test(id)) return 'vendor-socket';
          if (/\/node_modules\/(?:@firebase|firebase)\//.test(id)) return 'vendor-firebase';
          return undefined;
        },
      },
    },
  },
})
