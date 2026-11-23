/// <reference types="vitest" />
import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages and inside a Capacitor APK.
export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 0 },
  // Tests run with the daily boosts off (src/test-setup.ts).
  test: { setupFiles: ['src/test-setup.ts'] },
});
