import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'app è interamente locale/statica. `base: './'` usa percorsi relativi così
// il sito funziona sia in locale sia se pubblicato su GitHub Pages in una
// sottocartella (es. https://utente.github.io/Claude/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
