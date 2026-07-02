import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Les specs Playwright ont leur propre runner (npm run test:e2e).
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    // Integration tests hit a remote Neon branch (network latency per query);
    // unit tests finish in ms so a generous global timeout is harmless.
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
