import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/features/**'],
      reporter: ['text', 'lcov'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached aggressively; very rarely changes
          'react-vendor': ['react', 'react-dom'],
          // Routing
          'router': ['react-router-dom'],
          // i18n — large locale data kept separate
          'i18n': ['react-i18next', 'i18next'],
          // JWT decode utility
          'jwt': ['jwt-decode'],
          // Axios HTTP client
          'axios': ['axios'],
        },
      },
    },
    // Raise the advisory warning threshold (1MB) to avoid noise
    chunkSizeWarningLimit: 600,
  },
})
