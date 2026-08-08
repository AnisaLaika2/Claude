import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'app è interamente locale: il dev server ascolta solo su localhost.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
