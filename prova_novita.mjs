// Prove del meccanismo delle novità. Gira prima di ogni build, come le
// altre: qui un errore non si vede subito, si vede quando un allenatore
// apre l'app e trova una finestra che non doveva esserci — o non trova
// quella che doveva.
import { novitaDaMostrare, novitaDiRecupero, TETTO_NOVITA } from './src/lib/novita.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}: mi aspettavo ${b}, ho avuto ${a}`); }
};

// Un registro finto, come quello vero: dal più recente al più vecchio,
// con l'annuncio acceso solo su alcune voci.
const REGISTRO = [
  { versione: '0.54.0', data: '2026-09-20', annuncia: true, voci: ['quattro'] },
  { versione: '0.53.1', data: '2026-09-15', voci: ['tre e mezzo'] },
  { versione: '0.53.0', data: '2026-09-10', annuncia: true, voci: ['tre'] },
  { versione: '0.52.0', data: '2026-09-07', voci: ['due'] },
  { versione: '0.51.0', data: '2026-09-05', annuncia: true, voci: ['uno'] },
];
const versioni = (r) => r.map((c) => c.versione);

// --- prima apertura in assoluto: si registra e basta ---
dice('prima apertura (nessuna versione salvata)',
  novitaDaMostrare('0.54.0', REGISTRO, null), []);
dice('prima apertura (chiave vuota)',
  novitaDaMostrare('0.54.0', REGISTRO, ''), []);

// --- niente di nuovo: la versione vista è quella che gira ---
dice('stessa versione di prima',
  novitaDaMostrare('0.54.0', REGISTRO, '0.54.0'), []);

// --- un aggiornamento solo, annunciabile ---
dice('dalla 0.53.1 alla 0.54.0',
  versioni(novitaDaMostrare('0.54.0', REGISTRO, '0.53.1')), ['0.54.0']);

// --- salto di più versioni: solo le annunciabili in mezzo ---
// Dalla 0.52.0 alla 0.54.0 sono uscite 0.53.0, 0.53.1, 0.54.0: la 0.53.1
// non ha l'annuncio e resta fuori.
dice('salto di piu\' versioni, solo le annunciabili',
  versioni(novitaDaMostrare('0.54.0', REGISTRO, '0.52.0')), ['0.54.0', '0.53.0']);

// --- il caso che il coach ha chiesto: nulla da annunciare in mezzo ---
// Dalla 0.53.0 alla 0.53.1 c'è una voce sola e non è annunciabile:
// non si apre niente (la versione la registra chi chiama).
dice('nessuna voce annunciabile fra le due versioni',
  novitaDaMostrare('0.53.1', REGISTRO, '0.53.0'), []);

// --- versione salvata sconosciuta: si ripiega sulla sola corrente ---
dice('versione vista non piu\' nel registro, corrente annunciabile',
  versioni(novitaDaMostrare('0.54.0', REGISTRO, '0.40.0')), ['0.54.0']);
dice('versione vista sconosciuta, corrente NON annunciabile',
  novitaDaMostrare('0.53.1', REGISTRO, '0.40.0'), []);

// --- versione corrente senza voce nel registro ---
// Succede solo in sviluppo: la build si ferma prima (sincronizza_versione).
// Non deve aprire niente e non deve esplodere.
dice('versione corrente senza voce nel registro',
  novitaDaMostrare('0.99.0', REGISTRO, '0.53.0'), []);

// --- tornando indietro a una build precedente ---
// Salvata la 0.54.0 ma gira la 0.53.0: non si annuncia il futuro.
dice('ritorno a una versione precedente',
  novitaDaMostrare('0.53.0', REGISTRO, '0.54.0'), []);

// --- registro assente o malfatto: silenzio, non un errore ---
dice('registro vuoto', novitaDaMostrare('0.54.0', [], '0.53.0'), []);
dice('registro non e\' un elenco', novitaDaMostrare('0.54.0', null, '0.53.0'), []);

// --- il tetto: sul telefono non si scorre un papiro ---
const tanti = Array.from({ length: 9 }, (_, k) => ({
  versione: `1.${9 - k}.0`, annuncia: true, voci: ['x'],
}));
const molte = novitaDaMostrare('1.9.0', tanti, '1.1.0');
if (molte.length !== TETTO_NOVITA) {
  male++;
  console.error(`✗ il tetto doveva fermarsi a ${TETTO_NOVITA} voci, ne ho ${molte.length}`);
}

// --- e le voci tornano intere, non solo il numero ---
const una = novitaDaMostrare('0.54.0', REGISTRO, '0.53.1')[0];
if (!una || una.voci?.[0] !== 'quattro' || una.data !== '2026-09-20') {
  male++;
  console.error('✗ la voce deve tornare intera: numero, data e testo');
}

// --- il recupero, per chi usava l'app prima che l'annuncio esistesse ---
// Una voce sola: la più recente annunciabile che il pacchetto contiene.
dice('recupero: la piu\' recente annunciabile',
  versioni(novitaDiRecupero('0.54.0', REGISTRO)), ['0.54.0']);

// Se la corrente non è annunciabile, si scende alla prima che lo è.
dice('recupero: scende alla prima annunciabile sotto la corrente',
  versioni(novitaDiRecupero('0.53.1', REGISTRO)), ['0.53.0']);

// Mai voci più recenti della versione che gira.
dice('recupero: non annuncia il futuro',
  versioni(novitaDiRecupero('0.51.0', REGISTRO)), ['0.51.0']);

// Una voce sola, mai un arretrato: chi rientra dopo mesi non deve
// scorrere cinque schermate prima di segnare l'appello.
if (novitaDiRecupero('0.54.0', REGISTRO).length !== 1) {
  male++;
  console.error('✗ il recupero deve tornare una voce sola');
}

// Nessuna voce annunciabile in tutto il registro: silenzio.
dice('recupero: registro senza voci annunciabili',
  novitaDiRecupero('0.53.1', [{ versione: '0.53.1', voci: ['x'] }]), []);
dice('recupero: versione corrente fuori dal registro',
  novitaDiRecupero('0.99.0', REGISTRO), []);
dice('recupero: registro vuoto', novitaDiRecupero('0.54.0', []), []);

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ novità: tutte le prove passate');
