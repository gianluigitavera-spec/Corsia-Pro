import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Le librerie in un file a parte. Non le tocchiamo quasi mai, quindi
        // il loro nome non cambia e il telefono se le tiene in cache: una
        // release nostra fa scaricare solo il nostro codice, non anche React.
        // Supabase sta da solo perché è il pezzo più grosso e il più lento
        // a cambiare.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react')) return 'react';
          return 'librerie';
        },
      },
    },
  },
  define: {
    __VERSIONE__: JSON.stringify(version),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
});
