/// <reference types="vitest" />
import { defineConfig } from 'vite';

// Rewrites src/data/shines.ts from the field niche sim (about two minutes).
export default defineConfig({ test: { include: ['tools/gen_shines.ts'], setupFiles: ['src/test-setup.ts'], testTimeout: 600_000 } });
