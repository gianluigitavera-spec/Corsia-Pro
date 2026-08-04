// Prove dell'analizzatore, prese dal foglio vero degli allenamenti.
// Non sono casi inventati: ogni riga qui sotto è scritta come la scrive
// il coach. Girano prima di ogni build, come controlla_import.mjs.
//
// Se cambi una regola dell'analizzatore e uno di questi salta, non hai
// rotto un test: hai cambiato il significato di una riga che lui usa
// davvero.
import { analizzaTesto } from './src/lib/analizzatore.js';

const prove = [
  // --- la riga che non tornava ---
  ['3x\n(2x50+4x25) 50SL BN + 1 serie 25DO/RA (50 resp 5-3 7-3)', 600,
   'gruppo fra parentesi con il moltiplicatore sulla riga sopra'],
  ['3x(2x50+4x25)', 600, 'stesso gruppo, tutto su una riga'],

  // --- gruppi fra parentesi, dal foglio ---
  ['2x(4x25 + 1x100)', 400, 'gruppo con due tipi di ripetuta'],
  ['4x(4x50 + 1x100 + 200)', 2000, 'gruppo con un tratto secco in fondo'],
  ['2x(200+2x100+4x50)', 1200, 'gruppo di soli tratti sommati'],
  ['5x(50+100)', 750, 'gruppo minimo'],
  ['3x(1x150 + 2x100 + 3x50)', 1500, 'gruppo lungo'],
  ['8x(100+2x50)', 1600, 'gruppo ripetuto otto volte'],

  // --- le parentesi che NON sono metri ---
  ['4x25 (50 resp 5-3 7-3)', 100, 'la nota fra parentesi non fa metri'],
  ['Mx 4x(1GB max sub 1Dx 1Sx 1c)', 0, 'parentesi di sola descrizione'],

  // --- misura scritta dopo il lavoro, come nel foglio ---
  ['PS 12x25 progr 1-4', 300, 'lavoro prima, misura dopo'],
  ['2BN 1fff SL 12x25', 300, 'descrizione lunga, misura in fondo'],
  ['MX 2x 25compl 25GB 25compl 8x75', 600, 'misura in coda a una riga piena'],

  // --- i tempi non sono distanze ---
  ["8x75 1'40", 600, 'la ripartenza non conta come vasca'],
  ['12x25 @0:45', 300, 'nemmeno la ripartenza con la chiocciola'],

  // --- quello che funzionava prima deve continuare a funzionare ---
  ['8x75', 600, 'la forma semplice'],
  ['1x400', 400, 'una ripetuta sola'],
  ['300 stile', 300, 'tratto secco'],
  ['4x\n100 sl\n100 do', 800, 'moltiplicatore di blocco su righe separate'],
  ['6x100 + 25 remate 25 completo 25gb 25 ps', 600, 'righe di composizione'],
];

let male = 0;
for (const [testo, atteso, cosa] of prove) {
  const { metri } = analizzaTesto(testo);
  if (metri !== atteso) {
    male++;
    console.error(`✗ ${cosa}`);
    console.error(`  "${testo.replace(/\n/g, ' ⏎ ')}"`);
    console.error(`  attesi ${atteso} m, letti ${metri} m`);
  }
}

// --- la zona scritta sul titolo vale per tutta la sezione ---
const conTitolo = analizzaTesto('Centrale A2\n8x100\n4x50');
const sezione = conTitolo.sezioni.find((s) => s.titolo === 'Centrale');
if (!sezione) {
  male++;
  console.error('✗ "Centrale A2" dovrebbe restare la sezione "Centrale"');
} else if (!sezione.serie.every((r) => r.zona === 'A2')) {
  male++;
  console.error('✗ l\'andatura del titolo non è scesa su tutte le righe sotto');
}

if (male) {
  console.error(`\n${male} prove fallite su ${prove.length + 1}. Pacchetto non costruito.`);
  process.exit(1);
}
console.log(`✓ analizzatore: ${prove.length + 1} prove passate`);
