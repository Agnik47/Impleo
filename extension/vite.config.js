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
      ],
    }),
  ],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
