import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Относительные ассеты: сайт работает и на корне домена, и на github.io-подпути (W105).
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
  },
});
