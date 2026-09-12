import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';

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
      name: 'copy-extension-assets',
      closeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );
        // Copy _locales
        copyDirSync(
          resolve(__dirname, '_locales'),
          resolve(__dirname, 'dist/_locales'),
        );
        // Copy icons
        copyDirSync(
          resolve(__dirname, 'icons'),
          resolve(__dirname, 'dist/icons'),
        );
        // Move popup index.html from dist/src/ui/popup/index.html to dist/ui/popup/index.html
        const srcHtml = resolve(__dirname, 'dist/src/ui/popup/index.html');
        const destDir = resolve(__dirname, 'dist/ui/popup');
        const destHtml = resolve(destDir, 'index.html');
        mkdirSync(destDir, { recursive: true });
        if (statSync(srcHtml).isFile()) {
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
        popup: resolve(__dirname, 'src/ui/popup/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') return 'background/service-worker.js';
          if (chunkInfo.name === 'content-script') return 'content/content-script.js';
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
});
