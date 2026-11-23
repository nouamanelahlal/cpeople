import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    root: '.',
  },
  // NestJS relies on decorator metadata, which esbuild does not emit; swc does.
  plugins: [swc.vite()],
});
