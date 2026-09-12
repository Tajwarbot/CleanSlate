/// <reference types="vitest" />
import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';

/** Recursively copy a directory */
function copyDirSync(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'build-content-script-iife',
      /**
       * After the main build finishes, run a second Vite build for the
       * content script as an IIFE.  Chrome content scripts do NOT support
       * ES-module `import` statements, so every dependency must be inlined
       * into a single self-contained file.
       */
      async closeBundle() {
        // ── 1. Build content script as IIFE ──────────────────────────
        await viteBuild({
          configFile: false,
          resolve: {
            alias: { '@': resolve(__dirname, 'src') },
          },
          define: {
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
          },
          build: {
            outDir: resolve(__dirname, 'dist/content'),
            emptyOutDir: true,
            sourcemap: process.env.NODE_ENV === 'development',
            minify: process.env.NODE_ENV === 'production',
            lib: {
              entry: resolve(__dirname, 'src/content/index.ts'),
              name: 'CleanSlateContent',
              formats: ['iife'],
              fileName: () => 'content-script.js',
            },
            rollupOptions: {
              output: {
                // Ensure everything is inlined — no code-splitting
                inlineDynamicImports: true,
              },
            },
          },
        });

        // ── 2. Copy static extension assets ──────────────────────────
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );
        copyDirSync(
          resolve(__dirname, '_locales'),
          resolve(__dirname, 'dist/_locales'),
        );
        copyDirSync(
          resolve(__dirname, 'icons'),
          resolve(__dirname, 'dist/icons'),
        );

        // ── 3. Move popup HTML to the correct location ───────────────
        const srcHtml = resolve(__dirname, 'dist/src/ui/popup/index.html');
        const destDir = resolve(__dirname, 'dist/ui/popup');
        const destHtml = resolve(destDir, 'index.html');
        mkdirSync(destDir, { recursive: true });
        if (existsSync(srcHtml) && statSync(srcHtml).isFile()) {
          copyFileSync(srcHtml, destHtml);
          rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      input: {
        // Only popup + service worker in the main build.
        // The content script is built separately as IIFE above.
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js';
          return 'ui/popup/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.dev-profile/**'],
    passWithNoTests: true,
  },
});
