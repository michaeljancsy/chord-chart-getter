import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));

      const iconsDir = resolve(__dirname, 'assets/icons');
      const distIcons = resolve(dist, 'icons');
      if (!existsSync(distIcons)) mkdirSync(distIcons, { recursive: true });
      if (existsSync(iconsDir)) {
        for (const file of readdirSync(iconsDir)) {
          copyFileSync(resolve(iconsDir, file), resolve(distIcons, file));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), copyExtensionFiles()],
  base: '',
  build: {
    outDir: 'dist',
    emptyDirFirst: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'spotify-extractor': resolve(__dirname, 'src/content-scripts/spotify-extractor.js'),
        'ug-extractor': resolve(__dirname, 'src/content-scripts/ug-extractor.js'),
        'chordify-extractor': resolve(__dirname, 'src/content-scripts/chordify-extractor.js'),
        'songsterr-extractor': resolve(__dirname, 'src/content-scripts/songsterr-extractor.js'),
        'ug-print-trigger': resolve(__dirname, 'src/content-scripts/ug-print-trigger.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
