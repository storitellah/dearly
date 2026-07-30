import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

/**
 * Dearly ships as a static bundle. Nothing here assumes a hostname: the base
 * path comes from the environment so the same build works from a pages.dev
 * address, a root domain or a subdirectory.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH && env.VITE_BASE_PATH.length > 0 ? env.VITE_BASE_PATH : '/';

  return {
    base,
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode !== 'production',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 250,
      rollupOptions: {
        output: {
          // Chunking is left to Rollup: the heavy parts of the application
          // (export pipelines, printing, archive encryption) are reached through
          // dynamic imports, so they already land in their own lazy chunks.
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    test: {
      environment: 'jsdom',
      globals: false,
      include: ['tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
      restoreMocks: true,
    },
  };
});
