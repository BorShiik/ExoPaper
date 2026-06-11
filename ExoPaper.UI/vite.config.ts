import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/translate': {
        target: 'http://localhost:5500',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/translate/, '/translate'),
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('katex')) return 'vendor-katex';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            // NOTE: must run before the generic `react` check below, otherwise `react-markdown`
            // (it contains "react") leaks into vendor-react and bloats the core chunk.
            if (
              id.includes('remark') || id.includes('rehype') || id.includes('react-markdown') ||
              id.includes('vfile') || id.includes('unist') || id.includes('micromark') ||
              id.includes('mdast') || id.includes('hast') || id.includes('property-information')
            ) return 'vendor-markdown';
            if (id.includes('react') || id.includes('zustand')) return 'vendor-react';
            return 'vendor';
          }
        }
      }
    }
  }
})
