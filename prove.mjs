// Esegue tutte le prove, una dopo l'altra. Gira dentro `npm run build`,
// dopo sincronizza_versione, eslint e controlla_import, e prima di Vite.
//
// Le prove le trova da sé: ogni file `prova_*.mjs` nella cartella
// principale del progetto. Prima la build le elencava una per una in
// package.json, e una prova nuova restava fuori in silenzio finché
// qualcuno non si ricordava di aggiungerla — è successo con
// prova_riepilogo.mjs. E la riga era diventata così lunga che, il
// 24/10/2026, con prova_passo_gara.mjs aggiunta, `npm run build` su
// Windows si bloccava prima ancora del primo comando.
//
// Le regole:
//   - ordine fisso, alfabetico: due build uguali girano uguali;
//   - si stampa il nome di ogni file prima di eseguirlo;
//   - ci si ferma alla prima prova che fallisce, e si dice quale — come
//     faceva la catena di && in package.json;
//   - solo la cartella principale: un prova_*.mjs in una sottocartella
//     (una copia, una prova di passaggio) non entra;
//   - nessuna prova trovata è un errore, non una build verde.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const cartella = dirname(fileURLToPath(import.meta.url));
const prove = readdirSync(cartella, { withFileTypes: true })
  .filter((f) => f.isFile() && /^prova_.+\.mjs$/.test(f.name))
  .map((f) => f.name)
  .sort();

if (!prove.length) {
  console.error('✗ nessun prova_*.mjs nella cartella principale: qualcosa non va. Pacchetto non costruito.');
  process.exit(1);
}

for (const file of prove) {
  console.log(`→ ${file}`);
  const esito = spawnSync(process.execPath, [file], { cwd: cartella, stdio: 'inherit' });
  if (esito.status !== 0) {
    const perche = esito.error ? esito.error.message : `uscita ${esito.status ?? esito.signal}`;
    console.error(`\n✗ fallita: ${file} (${perche}). Pacchetto non costruito.`);
    process.exit(1);
  }
}
console.log(`✓ ${prove.length} file di prova passati`);
