import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages and inside a Capacitor APK.
export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 0 },
});
