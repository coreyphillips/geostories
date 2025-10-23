import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  plugins: [
    {
      name: 'copy-config-files',
      closeBundle() {
        // Copy _redirects for Netlify
        try {
          copyFileSync('_redirects', 'dist/_redirects');
          console.log('✓ Copied _redirects to dist/');
        } catch (e) {
          console.warn('Could not copy _redirects:', e.message);
        }
        // Copy vercel.json for Vercel
        try {
          copyFileSync('vercel.json', 'dist/vercel.json');
          console.log('✓ Copied vercel.json to dist/');
        } catch (e) {
          console.warn('Could not copy vercel.json:', e.message);
        }
      }
    }
  ]
});
