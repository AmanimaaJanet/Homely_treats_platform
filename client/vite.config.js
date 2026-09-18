import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  // Component/unit tests run in jsdom so the store, router and DOM APIs behave as they
  // do in a browser. `npm run test` in CI runs the same suite.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The app's value is in its logic (money, dates, formatting, guards); components
      // are covered where they carry decisions rather than markup.
      include: ['src/lib/**', 'src/api.js', 'src/components/**'],
      exclude: ['src/**/*.test.*'],
    },
  },
});
