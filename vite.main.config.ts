import { builtinModules } from 'module';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    outDir: 'dist/main',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      fileName: 'index',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', ...builtinModules.flatMap((m) => [m, `node:${m}`])],
      output: {
        entryFileNames: 'index.js',
      },
    },
    target: 'node18',
    minify: false,
  },
});
