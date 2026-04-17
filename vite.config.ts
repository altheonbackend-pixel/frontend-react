import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      // @sentry/react is intentionally optional (only loaded when VITE_SENTRY_DSN is set)
      external: ['@sentry/react'],
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':  ['@tanstack/react-query'],
          'vendor-forms':  ['react-hook-form', 'zod', '@hookform/resolvers'],
          'vendor-charts': ['recharts'],
          'vendor-i18n':   ['i18next', 'react-i18next', 'i18next-http-backend', 'i18next-browser-languagedetector'],
        },
      },
    },
    // Raise the advisory warning threshold (1MB) to avoid noise
    chunkSizeWarningLimit: 600,
  },
})
