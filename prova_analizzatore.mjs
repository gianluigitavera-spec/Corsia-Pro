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

  // --- somme senza parentesi e X maiuscola (dalla seduta del 4 agosto) ---
  ['3x25 + 1x75 Remate DO + 75 DO completo', 150,
   'somma di due misure, poi la descrizione'],
  ['(3x25) + (1x75)', 150, 'due gruppi sommati'],
  ['(3x25) + (1x75) Remate SL + SL', 150, 'due gruppi, poi la descrizione'],
  ['8X25 1\' Apnea + DO', 200, 'X maiuscola'],
  ['2X25 12,5 Remate verticali avanti + 12,5 RA', 50, 'X maiuscola con i decimali dietro'],
  ['4x(150 + 4x25)', 1000, 'gruppo misto numero secco e ripetute'],
  ['4x(150 + 4x25) 150SL 25 1serie X', 1000,
   '"1 serie per stile" descrive, non moltiplica'],
  ['MX 1x 75mx', 75, '"MX 1x" resta un descrittore'],
  ['DO - RA 1x200', 200, 'gli stili prima della misura'],

  // --- il set scritto in fondo alla riga (dal foglio, 307 righe) ---
  ['100GB 50 (25 mono braccio 25compl) 4x(100 + 2x50)', 800,
   'la misura vera è il gruppo in fondo, non il 100 che descrive'],
  ['50GB TAV 25sub 25monobraccio 8x(1x50 + 2x25)', 800, 'stessa forma, gruppo in coda'],
  ['Esercizio DE doppia spinta + 50 SL 5+5 (6x25)+(1x200)', 350, 'due gruppi in coda sommati'],
  ['SL 5x(1x100 + 2x50)', 1000, 'gruppo in coda dopo lo stile'],
  ['2MX + 1x 10x100', 1000, 'non legge "1x 10" dentro "1x 10x100"'],
  ['Riscaldamento 1x400', 400, 'il titolo si portava via il set'],

  // --- la regola della vasca: sotto i 25 si conta 25 ---
  ['CP 2x10', 50, 'partenze dai 10 metri: la vasca la finisce comunque'],
  ['CP 2x15', 50, 'idem dai 15'],
  ['CP 2x20', 50, 'idem dai 20'],
  ['Virate partendo dai 10m 8x25', 200, 'le virate con una misura scritta contano'],
  ['Partenze dal blocco', 0, 'senza misura restano zero'],
  ['Secco: 3x10 plank', 0, 'il lavoro a terra resta zero anche con i numeri'],

  // --- gruppi con etichette e gruppi annidati (segnalati da fuori) ---
  ['2x (4x50 SL @45" + 100 B1) @3\'', 600, 'stili e zone dentro il gruppo'],
  ['4x (2x50 B1 + 100 A2)', 800, 'zone su ogni pezzo del gruppo'],
  ['3x(2x(4x25) + 100)', 900, 'gruppo dentro il gruppo'],
  ['2x(4x50 SL + 100)', 600, 'stile su un pezzo solo'],
  ['5x(100 pinne + 50 fff)', 750, 'attrezzi e andature dentro il gruppo'],

  // --- quello che funzionava prima deve continuare a funzionare ---
  ['8x75', 600, 'la forma semplice'],
  ['1x400', 400, 'una ripetuta sola'],
  ['300 stile', 300, 'tratto secco'],
  ['4x\n100 sl\n100 do', 800, 'moltiplicatore di blocco su righe separate'],
  ['6x100 + 25 remate 25 completo 25gb 25 ps', 600, 'righe di composizione'],

  // --- le scale ---
  ['12/10/8x100', 3000, 'scala di ripetute: dodici, dieci e otto cento'],
  ['400/300/200', 900, 'scala di distanze'],
  ['200/150/100/50', 500, 'scala di quattro gradini'],
  ['PS 12/10/8x100', 3000, 'la scala scritta dopo il lavoro'],
  ['2x(12/10/8x100)', 6000, 'la scala dentro un gruppo'],
  ['12/10/8x100 @1:40', 3000, 'la scala con la ripartenza dietro'],
  ['@@0:35/25 8x50', 400, 'il passo base coi 25 non è una scala'],
  ['Lun 12/10/2025', 0, 'una data non è una scala'],
  ['4x50/4x25', 200, 'la barra fra due set non fa una scala di 1350 m'],

  // --- una riga, una andatura ---
  ['8x50 A2 + 4x25 C1', 500, 'due andature: si spezza e i metri non si perdono'],
  ['4x(8x50 B1 + 4x50 B2)', 2400, 'blocco con due andature dentro'],
  ['2x(4x50 SL + 100 B1)', 600, 'una zona sola: resta una riga'],
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

// --- la riga con due andature diventa due righe, non una ---
// I metri giusti da soli non bastano: se restassero su una riga sola,
// una delle due zone sparirebbe e il carico per zona sarebbe falso.
const spezzata = analizzaTesto('4x(8x50 B1 + 4x50 B2)').sezioni[0].serie;
const conMetri = spezzata.filter((s) => s.metri > 0);
if (spezzata[0]?.apreBlocco !== 4) {
  male++;
  console.error('✗ il blocco "4x" dovrebbe restare in testa alle due righe');
} else if (conMetri.length !== 2) {
  male++;
  console.error(`✗ due andature dovrebbero fare due righe, ne ho ${conMetri.length}`);
} else if (conMetri[0].zona !== 'B1' || conMetri[1].zona !== 'B2') {
  male++;
  console.error('✗ ogni riga deve tenersi la sua andatura');
}

// --- e una zona sola resta una riga sola ---
const intera = analizzaTesto('2x(4x50 SL + 100 B1)').sezioni[0].serie;
if (intera.length !== 1) {
  male++;
  console.error('✗ con una zona sola la riga non si spezza');
}

// --- la zona proposta dal titolo della sezione ---
const conProposta = analizzaTesto('Soglia\n8x100\n4x50').sezioni[0].serie;
if (!conProposta.every((r) => r.zona === 'B1' && r.fiducia === 'gialla')) {
  male++;
  console.error('✗ "Soglia" come titolo dovrebbe proporre B1 in fiducia gialla');
}

// --- "aerobico" da solo indica lavoro aerobico medio: propone A2 ---
const soloAerobico = analizzaTesto('Aerobico\n8x100').sezioni[0].serie;
if (!soloAerobico.every((r) => r.zona === 'A2' && r.fiducia === 'gialla')) {
  male++;
  console.error('✗ "Aerobico" da solo dovrebbe proporre A2 in fiducia gialla');
}
const aerobicoMedio = analizzaTesto('Aerobico medio\n8x100').sezioni[0].serie;
if (!aerobicoMedio.every((r) => r.zona === 'A2' && r.fiducia === 'gialla')) {
  male++;
  console.error('✗ "Aerobico medio" (con "medio") dovrebbe proporre A2');
}

// --- "Velocità" da sola come titolo: il caso che in produzione falliva,
// perché \b non chiude mai dopo una lettera accentata come la "à" ---
const soloVelocita = analizzaTesto('Velocità\n8x50').sezioni[0].serie;
if (!soloVelocita.every((r) => r.zona === 'C3' && r.fiducia === 'gialla')) {
  male++;
  console.error('✗ "Velocità" da sola come titolo dovrebbe proporre C3 in fiducia gialla');
}

// --- la zona scritta sulla riga vince sempre sul titolo ---
const vinceLaRiga = analizzaTesto('Soglia\n8x100 C3').sezioni[0].serie;
if (vinceLaRiga[0]?.zona !== 'C3' || vinceLaRiga[0]?.fiducia !== 'verde') {
  male++;
  console.error('✗ la zona scritta sulla riga deve vincere sulla proposta del titolo');
}

// --- la proposta dal titolo arriva anche ai pezzi senza zona propria di
// una riga con più andature, e resta gialla come nel ciclo principale ---
const scalettaSenzaZona = analizzaTesto('Tolleranza\n4x(8x50 B1 + 4x50 C2 + 2x25)').sezioni[0].serie;
const pezzoSenzaZona = scalettaSenzaZona.find((r) => r.notazione === '2x25');
if (!pezzoSenzaZona || pezzoSenzaZona.zona !== 'C1' || pezzoSenzaZona.fiducia !== 'gialla') {
  male++;
  console.error('✗ il pezzo senza zona propria dovrebbe prendere C1 dal titolo, in fiducia gialla');
}

// --- Fondo e Mezzofondo sono due gruppi diversi (026) ---
// La trappola: "mezzofondo" contiene "fondo". Se le regole perdessero
// l'ancoraggio, i metri del mezzofondo finirebbero anche ai fondisti —
// un totale plausibile e sbagliato.
const chiPrende = (titolo) => analizzaTesto(`${titolo}\n8x100`).sezioni[0]?.destinatari;
const dice = (titolo, atteso) => {
  const avuto = chiPrende(titolo);
  if (JSON.stringify(avuto) !== JSON.stringify(atteso)) {
    male++;
    console.error(`✗ "${titolo}" doveva andare a ${atteso.join(' + ')}, invece a ${JSON.stringify(avuto)}`);
  }
};

dice('Fondo', ['Fondo']);
dice('Fondista', ['Fondo']);
dice('Fondisti', ['Fondo']);
dice('Mezzofondo', ['Mezzofondo']);
dice('Mezzofondista', ['Mezzofondo']);
dice('Mezzofondisti', ['Mezzofondo']);

// La prova che conta: "mezzofondo" non deve MAI finire nel Fondo.
for (const titolo of ['Mezzofondo', 'Mezzofondista', 'Mezzofondisti']) {
  if ((chiPrende(titolo) || []).includes('Fondo')) {
    male++;
    console.error(`✗ "${titolo}" è finito nel Fondo: la regola ha perso l'ancoraggio`);
  }
}

const quante = prove.length + 9 + 9;
if (male) {
  console.error(`\n${male} prove fallite su ${quante}. Pacchetto non costruito.`);
  process.exit(1);
}
console.log(`✓ analizzatore: ${quante} prove passate`);
