import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: 'src/sidepanel',
  base: '',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: '../../manifest.json', dest: '.' },
        { src: '../../background.js', dest: '.' },
        { src: '../../icons/icon-16.png', dest: 'icons' },
        { src: '../../icons/icon-32.png', dest: 'icons' },
        { src: '../../icons/icon-48.png', dest: 'icons' },
        { src: '../../icons/icon-128.png', dest: 'icons' },
        { src: '../../icons/HeroExtentionImg.png', dest: 'icons' },
      ],
    }),
  ],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
