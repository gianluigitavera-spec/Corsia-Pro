// Prove della rimappatura di svolto. Gira prima di ogni build.
//
// Le chiavi di svolto sono posizionali ("sez_n-ser_m") e non contengono
// niente che dica a quale riga appartengono. Se le righe si spostano e
// le chiavi restano ferme, i metri nuotati finiscono sul lavoro
// sbagliato — e il totale resta credibile, perché i numeri sono gli
// stessi. È il guasto che non si vede: per questo qui non si controlla
// quante chiavi restano, si controlla che OGNI riga si ritrovi i SUOI
// metri.
import {
  svoltoDopoTogliRiga, svoltoDopoTogliSezione,
  svoltoDopoMuoviRiga, svoltoDopoMuoviSezione,
  svoltoDopoInserisciRiga, svoltoDopoInserisciSezione,
  svoltoCollassato, metriSvoltiDiRiga, metriSvoltiDiSezione,
} from './src/lib/dominio.js';

let male = 0;

// Ordinato per chiave: quello che conta è quale riga tiene quali metri,
// non in che ordine l'oggetto è stato costruito. Senza questo, un
// riordino interno innocuo farebbe fallire le prove per niente.
const ordinato = (x) => {
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) return x.map(ordinato);
  return Object.fromEntries(
    Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => [k, ordinato(x[k])])
  );
};

const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(ordinato(avuto));
  const b = JSON.stringify(ordinato(atteso));
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// Una seduta con due sezioni. Nella prima tre righe, tutte rilevate:
// i metri sono diversi apposta, così uno scambio si vede.
//   sezione 0: riga 0 = 300, riga 1 = 800, riga 2 = 150
//   sezione 1: riga 0 = 400
const SVOLTO = { righe: { '0-0': 300, '0-1': 800, '0-2': 150, '1-0': 400 } };

// ------------------------------------------------- cancello la prima riga
// Le due superstiti scalano e si portano dietro i loro metri: 800 era la
// riga di mezzo e deve restare 800, non prendersi i 300 della cancellata.
dice('cancello la riga 0: le altre scalano coi propri metri',
  svoltoDopoTogliRiga(SVOLTO, 0, 0),
  { righe: { '0-0': 800, '0-1': 150, '1-0': 400 }, nota: undefined });

// La chiave cancellata non deve finire addosso alla vicina: è il guasto
// che non si nota, perché il totale cambia di poco e sembra plausibile.
const dopoTaglio = svoltoDopoTogliRiga(SVOLTO, 0, 1);
dice('cancello la riga di mezzo: i 800 spariscono, non si spostano',
  dopoTaglio, { righe: { '0-0': 300, '0-1': 150, '1-0': 400 }, nota: undefined });
if (Object.values(dopoTaglio.righe).includes(800)) {
  male++;
  console.error('✗ i metri della riga cancellata sono rimasti addosso a un\'altra riga');
}

// ------------------------------------------------ sposto la seconda in alto
dice('sposto la riga 1 in alto: i suoi 800 la seguono',
  svoltoDopoMuoviRiga(SVOLTO, 0, 1, 0),
  { righe: { '0-1': 300, '0-0': 800, '0-2': 150, '1-0': 400 }, nota: undefined });

// E in giù, che è il verso in cui il fuori-di-uno cambia segno.
dice('sposto la riga 0 in fondo: il fuori-di-uno nell\'altro verso',
  svoltoDopoMuoviRiga(SVOLTO, 0, 0, 2),
  { righe: { '0-2': 300, '0-0': 800, '0-1': 150, '1-0': 400 }, nota: undefined });

// Lo spostamento non tocca le altre sezioni.
dice('spostare una riga non tocca le altre sezioni',
  svoltoDopoMuoviRiga(SVOLTO, 0, 0, 1).righe['1-0'], 400);

// ------------------------------------------------ cancello una sezione intera
dice('cancello la sezione 0: resta la 1, rinumerata a 0',
  svoltoDopoTogliSezione(SVOLTO, 0),
  { righe: { '0-0': 400 }, nota: undefined });

dice('cancello la sezione 1: la 0 resta dov\'è',
  svoltoDopoTogliSezione(SVOLTO, 1),
  { righe: { '0-0': 300, '0-1': 800, '0-2': 150 }, nota: undefined });

// ------------------------------------------------- sposto una sezione
dice('sposto la sezione 1 in cima: le righe la seguono',
  svoltoDopoMuoviSezione(SVOLTO, 1, 0),
  { righe: { '1-0': 300, '1-1': 800, '1-2': 150, '0-0': 400 }, nota: undefined });

// ------------------------------------------------- aggiungo in coda
// Non muove niente: nessuna chiave sta sopra la posizione nuova.
dice('aggiungo una riga in coda: le chiavi restano tutte dove sono',
  svoltoDopoInserisciRiga(SVOLTO, 0, 3), { righe: { ...SVOLTO.righe }, nota: undefined });
dice('aggiungo una sezione in fondo: niente si muove',
  svoltoDopoInserisciSezione(SVOLTO, 2), { righe: { ...SVOLTO.righe }, nota: undefined });

// ------------------------------------------------- aggiungo in CIMA
// La sezione a secco entra con unshift: fa scalare ogni sezione.
dice('aggiungo una sezione in cima: tutto scala di uno',
  svoltoDopoInserisciSezione(SVOLTO, 0),
  { righe: { '1-0': 300, '1-1': 800, '1-2': 150, '2-0': 400 }, nota: undefined });

// E l'inserimento in mezzo a una sezione, per quando ci sarà.
dice('inserisco una riga in posizione 1: da lì in giù scalano',
  svoltoDopoInserisciRiga(SVOLTO, 0, 1),
  { righe: { '0-0': 300, '0-2': 800, '0-3': 150, '1-0': 400 }, nota: undefined });

// ------------------------------------------------- il collasso a null
dice('svuotando tutto svolto torna null',
  svoltoDopoTogliSezione({ righe: { '0-0': 300 } }, 0), null);

dice('ma con la nota svolto sopravvive',
  svoltoDopoTogliSezione({ righe: { '0-0': 300 }, nota: 'acqua fredda' }, 0),
  { righe: {}, nota: 'acqua fredda' });

dice('svoltoCollassato butta i valori vuoti',
  svoltoCollassato({ righe: { '0-0': 300, '0-1': '', '0-2': null } }),
  { righe: { '0-0': 300 }, nota: undefined });

dice('svoltoCollassato: solo righe vuote e nessuna nota -> null',
  svoltoCollassato({ righe: { '0-0': '' } }), null);

// ------------------------------------------------- niente svolto: non esplode
for (const vuoto of [null, undefined, {}, { righe: {} }]) {
  const r = svoltoDopoTogliRiga(vuoto, 0, 0);
  if (r !== null && r !== undefined && Object.keys(r.righe || {}).length) {
    male++;
    console.error(`✗ svolto assente (${JSON.stringify(vuoto)}) doveva restare vuoto, ho avuto ${JSON.stringify(r)}`);
  }
}

// ------------------------------------------------- i metri a rischio (l'avviso)
dice('metri della riga che sto per cancellare', metriSvoltiDiRiga(SVOLTO, 0, 1), 800);
dice('riga senza rilevazione: niente avviso', metriSvoltiDiRiga(SVOLTO, 5, 5), null);
dice('metri della sezione che sto per cancellare',
  metriSvoltiDiSezione(SVOLTO, 0), { metri: 1250, righe: 3 });
dice('sezione senza rilevazioni: niente avviso', metriSvoltiDiSezione(SVOLTO, 9), null);

// ------------------------------------------------- l'import da testo
// Sostituire in blocco le sezioni azzera le posizioni: nessuna
// rimappatura può salvare svolto, perché le righe vecchie non esistono
// più. Oggi si parte sempre da sedutaVuota(), che svolto non ce l'ha, e
// il caso è protetto per costruzione. Questa prova fissa la REGOLA: se
// un domani si reimporterà dentro una seduta esistente, svolto va
// portato dietro o dichiarato perso — mai lasciato a puntare a righe che
// non ci sono. Se qualcuno cambia quel punto, qui deve fermarsi.
const { sedutaVuota } = await import('./src/lib/dominio.js');
const dopoImport = { ...sedutaVuota(), sezioni: [{ titolo: 'X', serie: [] }] };
if ('svolto' in dopoImport && dopoImport.svolto != null) {
  male++;
  console.error(
    '✗ l\'import da testo si porta dietro uno svolto che punta a righe sostituite.\n'
    + '  Vedi il commento su usaSeduta in EditorSeduta.jsx: o lo si rimappa, o si\n'
    + '  avvisa l\'allenatore che i metri rilevati si perdono. Mai in silenzio.'
  );
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ svolto: tutte le prove passate');
