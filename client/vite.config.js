import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Warn earlier than Vite's default 500 kB: the whole point of splitting routes is
    // that no single file should get near that. See the bundle table in README.md.
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        // Framework code changes rarely, so it is cached separately from the app code
        // that changes on every deploy. A returning customer re-downloads only what
        // actually changed.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    // Allows the app to be opened through a tunnel or preview proxy (a hosted
    // sandbox, ngrok) rather than only on localhost.
    allowedHosts: true,
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
    allowedHosts: true,
    // Serving the *built* app against the local API, so `npm run preview` is a real
    // end-to-end check of what will be deployed — the same proxy the dev server uses.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:5000', ws: true },
    },
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
