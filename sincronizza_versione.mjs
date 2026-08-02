// Controllo prima della consegna: il numero di versione dev'essere lo stesso
// dappertutto. La fonte è "version" in package.json; da lì questo script
// riscrive la cache del service worker e verifica che il registro delle novità
// abbia la voce corrispondente.
// Nato dopo aver scoperto che public/sw.js era rimasto a 0.5.0 mentre l'app
// era alla 0.20.0: la chiave della cache non cambiava mai, quindi le vecchie
// build non venivano mai buttate via.
import { readFileSync, writeFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
let problemi = 0;

// --- 1. Il service worker: prima si legge, si scrive solo in fondo --------
// public/ non passa da vite: nessuna sostituzione automatica, la riga va
// riscritta a mano qui.
const percorsoSw = 'public/sw.js';
const sw = readFileSync(percorsoSw, 'utf8');
const rigaCache = /const CACHE = 'corsiapro-([\d.]+)';/;
const trovata = sw.match(rigaCache);

if (!trovata) {
  console.error(`✗ ${percorsoSw}: non trovo la riga "const CACHE = 'corsiapro-...'"`);
  problemi++;
}

// --- 2. Il registro delle novità -----------------------------------------
const registro = readFileSync('src/versione.js', 'utf8');
const prima = registro.match(/versione:\s*'([\d.]+)'/);

if (!prima) {
  console.error('✗ src/versione.js: non trovo nessuna voce in CAMBIAMENTI');
  problemi++;
} else if (prima[1] !== version) {
  console.error(`✗ src/versione.js: la voce più recente è la ${prima[1]}, ma stai costruendo la ${version}.`);
  console.error('  Aggiungi la voce in cima a CAMBIAMENTI, oppure correggi "version" in package.json.');
  problemi++;
} else {
  console.log(`  src/versione.js: registro allineato alla ${version}`);
}

// --- 3. Solo se tutto torna, si tocca il service worker -------------------
// Se la build si ferma, i file restano come stavano: niente mezze consegne.
if (problemi) {
  console.error(`\nVersioni disallineate (${problemi}). Niente riscritto, pacchetto non costruito.`);
  process.exit(1);
}

if (trovata[1] !== version) {
  writeFileSync(percorsoSw, sw.replace(rigaCache, `const CACHE = 'corsiapro-${version}';`));
  console.log(`  ${percorsoSw}: cache ${trovata[1]} → ${version}`);
} else {
  console.log(`  ${percorsoSw}: cache già a ${version}`);
}

console.log(`Versione ${version} allineata ovunque.`);
