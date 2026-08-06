import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // "Circular CHUNK" vuol dire che due pezzi del pacchetto si aspettano
      // a vicenda: in pagina esce "Cannot access 'h' before initialization"
      // e lo schermo resta rotto. Qui la build si ferma invece di
      // consegnarlo.
      // Da non confondere con "circular dependency", che è normale dentro
      // le librerie e non fa danni: quello si lascia passare.
      onwarn(avviso, avvisaDefault) {
        if (/circular chunk/i.test(avviso.message || '')) {
          throw new Error(`Pacchetto non costruito — ${avviso.message}`);
        }
        avvisaDefault(avviso);
      },
      output: {
        // TUTTE le librerie in un file solo. Prima erano tre (react,
        // supabase, resto) e i tre pezzi si rimandavano l'uno all'altro:
        // librerie → react → librerie. Il guadagno era zero, il rischio no.
        //
        // Il motivo del taglio resta intatto: le librerie non le tocchiamo
        // quasi mai, quindi il loro nome non cambia e restano in cache. Una
        // release nostra fa scaricare solo il nostro codice.
        manualChunks(id) {
          return id.includes('node_modules') ? 'librerie' : undefined;
        },
      },
    },
  },
  define: {
    __VERSIONE__: JSON.stringify(version),
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
});
