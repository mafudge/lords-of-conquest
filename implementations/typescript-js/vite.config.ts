import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/ui',
  base: './',
  build: { outDir: '../../dist', emptyOutDir: true },
  test: { environment: 'happy-dom' },
});
