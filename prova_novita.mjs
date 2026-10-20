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

// =====================================================================
// LA SEQUENZA ALL'APERTURA — tutorial, effetto che rigira, chiusura
//
// Con la 0.57.0 il pannello non è comparso. novitaDaMostrare era giusta;
// sbagliava chi la chiamava: App.jsx segnava la versione come vista nel
// momento in cui CALCOLAVA le voci, non quando il pannello veniva chiuso.
// Se il calcolo girava una seconda volta prima che il pannello si
// vedesse — e col tutorial aperto da solo succedeva sempre — rileggeva
// la versione appena segnata, otteneva [] e svuotava la lista.
//
// Qui la sequenza si prova come la vive il telefono: un magazzino finto
// al posto di localStorage, e i passi uno dopo l'altro. Le prove sopra
// guardavano solo la funzione pura, ed erano verdi mentre il difetto
// stava tutto fuori.
// =====================================================================
{
  const D = await import('./src/lib/novita.js');
  const mancano = ['novitaAllApertura', 'novitaAllaChiusura'].filter((f) => typeof D[f] !== 'function');
  if (mancano.length) {
    male++;
    console.error(`✗ sequenza: mancano in novita.js ${mancano.join(', ')}`);
  } else {
    const V = '0.57.0';
    const REG = [
      { versione: '0.57.0', annuncia: true, voci: ['calendario'] },
      { versione: '0.56.13', annuncia: true, voci: ['volte'] },
      { versione: '0.56.12', voci: ['fine ripetizione'] },
    ];
    const CHIAVE = 'corsiapro:novita';

    // Il telefono: cosa c'è nel magazzino, e cosa l'app mostra adesso.
    const telefono = (vista, { giaUsata = true } = {}) =>
      ({ magazzino: vista == null ? {} : { [CHIAVE]: vista }, giaUsata, pannello: [] });

    // Un giro dell'effetto in App.jsx: legge, decide, scrive solo se la
    // decisione lo dice.
    const giro = (t, { tutorialAperto = false } = {}) => {
      const d = D.novitaAllApertura({
        versione: V, cambiamenti: REG,
        vistaPrima: t.magazzino[CHIAVE] ?? null,
        giaUsata: t.giaUsata, tutorialAperto,
      });
      t.pannello = d.voci;
      if (d.segnaOra) t.magazzino[CHIAVE] = V;
    };
    // La chiusura del pannello: è lei a segnare la versione.
    const chiudi = (t) => {
      const c = D.novitaAllaChiusura(V);
      if (c.segna) t.magazzino[CHIAVE] = c.segna;
      t.pannello = [];
    };
    const mostra = (t) => t.pannello.map((c) => c.versione);

    // --- il caso del campo: il tutorial compare prima ---
    // Stesso passaggio: l'effetto delle novità vede ancora il tutorial
    // chiuso e calcola; poi il tutorial si apre (l'effetto rigira e
    // aspetta); poi si chiude, e l'effetto rigira di nuovo.
    {
      const t = telefono('0.56.13');
      giro(t);                                // stesso passaggio del tutorial
      dice('tutorial prima: niente segnato al primo calcolo', t.magazzino[CHIAVE], '0.56.13');
      giro(t, { tutorialAperto: true });      // il tutorial è aperto
      dice('tutorial aperto: il pannello aspetta', mostra(t), []);
      dice('tutorial aperto: niente segnato', t.magazzino[CHIAVE], '0.56.13');
      giro(t);                                // il tutorial si chiude
      dice('tutorial chiuso: il pannello compare', mostra(t), ['0.57.0']);
      chiudi(t);
      dice('chiuso il pannello: la versione è vista', t.magazzino[CHIAVE], '0.57.0');
      giro(t);                                // apertura successiva
      dice('apertura dopo: niente', mostra(t), []);
    }

    // --- l'effetto che gira due volte senza tutorial ---
    // Il secondo giro deve dare le stesse voci, non una lista vuota.
    {
      const t = telefono('0.56.13');
      giro(t);
      giro(t);
      dice('due giri: il pannello resta', mostra(t), ['0.57.0']);
      dice('due giri: ancora niente segnato', t.magazzino[CHIAVE], '0.56.13');
    }

    // --- l'app chiusa senza chiudere il pannello ---
    // Non visto vuol dire non visto: alla prossima apertura torna.
    {
      const t = telefono('0.56.13');
      giro(t);
      const riaperto = telefono(t.magazzino[CHIAVE]);
      giro(riaperto);
      dice('pannello non chiuso: torna alla prossima apertura', mostra(riaperto), ['0.57.0']);
    }

    // --- salto di più versioni: tutte le annunciabili in mezzo ---
    {
      const t = telefono('0.56.12');
      giro(t);
      dice('dalla 0.56.12: due voci', mostra(t), ['0.57.0', '0.56.13']);
    }

    // --- niente da annunciare: si segna subito ---
    // Una voce senza annuncia non deve restare in agguato per la volta
    // dopo: senza pannello non c'è una chiusura che la segni.
    {
      const silenziosa = [{ versione: '0.57.1', voci: ['correzione'] }, ...REG];
      const t = { magazzino: { [CHIAVE]: '0.57.0' }, giaUsata: true, pannello: [] };
      const d = D.novitaAllApertura({ versione: '0.57.1', cambiamenti: silenziosa, vistaPrima: '0.57.0', giaUsata: true });
      if (d.segnaOra) t.magazzino[CHIAVE] = '0.57.1';
      dice('voce senza annuncio: nessun pannello', d.voci, []);
      dice('voce senza annuncio: segnata subito', t.magazzino[CHIAVE], '0.57.1');
    }

    // --- prima apertura in assoluto: niente, e si segna ---
    {
      const t = telefono(null, { giaUsata: false });
      giro(t);
      dice('prima apertura: nessun pannello', mostra(t), []);
      dice('prima apertura: versione segnata', t.magazzino[CHIAVE], '0.57.0');
    }

    // --- chi usava l'app prima degli annunci: una voce, segnata alla chiusura ---
    {
      const t = telefono(null, { giaUsata: true });
      giro(t);
      dice('recupero: una voce', mostra(t), ['0.57.0']);
      dice('recupero: niente segnato prima della chiusura', t.magazzino[CHIAVE], undefined);
      chiudi(t);
      dice('recupero: segnato alla chiusura', t.magazzino[CHIAVE], '0.57.0');
    }

    // --- già vista: niente e niente da scrivere ---
    {
      const t = telefono('0.57.0');
      giro(t);
      dice('già vista: nessun pannello', mostra(t), []);
    }
  }
}

// =====================================================================
// IL TUTORIAL — quando si apre da solo, e dove si torna chiudendolo
//
// Fino alla 0.57.0 il tutorial si segnava "visto" solo con la casella
// «Non mostrare più» spuntata: chi chiudeva con la X, con «Comincia»,
// con Esc o toccando fuori se lo ritrovava a ogni avvio — e il tutorial
// aperto da solo era anche quello che nascondeva le novità. In più
// portava in giro per le schede dei suoi passi e lì lasciava.
//
// Ora la prima chiusura, in qualunque modo, vale "visto"; il tasto «?»
// lo riapre quando vuoi; chiudendolo si torna alla scheda da cui era
// partito. Con localStorage che non risponde non si apre da solo: senza
// poter segnare "visto" tornerebbe a ogni avvio.
// =====================================================================
{
  let T = null;
  try { T = await import('./src/lib/tutorial.js'); } catch { /* sotto */ }
  const servono = ['tutorialSiApreDaSolo', 'tutorialAperto', 'tutorialChiuso'];
  const mancano = T ? servono.filter((f) => typeof T[f] !== 'function') : servono;
  if (mancano.length) {
    male++;
    console.error(`✗ tutorial: mancano in src/lib/tutorial.js ${mancano.join(', ')}`);
  } else {
    const CHIAVE = 'corsiapro:tutorial';
    // Un telefono: il magazzino (o null se localStorage non risponde) e
    // la scheda a schermo.
    const telefono = (magazzino, scheda = 'dashboard') => ({ magazzino, scheda, stato: null });
    const leggi = (t) => (t.magazzino ? { ok: true, valore: t.magazzino[CHIAVE] ?? null } : { ok: false });
    const avvio = (t) => {
      if (T.tutorialSiApreDaSolo(leggi(t))) t.stato = T.tutorialAperto(t.scheda);
    };
    const tasto = (t) => { t.stato = T.tutorialAperto(t.scheda); };     // il «?» in testata
    const passi = (t, ...schede) => { for (const s of schede) t.scheda = s; };  // vaiA dei passi
    const chiudi = (t) => {
      const c = T.tutorialChiuso(t.stato);
      if (t.magazzino && c.segna) t.magazzino[CHIAVE] = c.segna;
      if (c.tornaA) t.scheda = c.tornaA;
      t.stato = null;
    };

    // --- prima apertura: si apre da solo ---
    {
      const t = telefono({});
      avvio(t);
      dice('tutorial: alla prima apertura si apre', t.stato?.aperto, true);
      // Chiuso senza nessuna casella: vale già "visto".
      passi(t, 'dashboard', 'sedute', 'calendario');
      chiudi(t);
      dice('tutorial: la prima chiusura vale visto', t.magazzino[CHIAVE], 'visto');
      dice('tutorial: si torna alla scheda di partenza', t.scheda, 'dashboard');
      avvio(t);
      dice('tutorial: all\'avvio dopo non si riapre', t.stato, null);
    }

    // --- chi aveva già scelto «non mostrare più»: niente cambia ---
    {
      const t = telefono({ [CHIAVE]: 'visto' });
      avvio(t);
      dice('tutorial: già visto, non si apre', t.stato, null);
    }

    // --- localStorage che non risponde: non si apre da solo ---
    {
      const t = telefono(null);
      avvio(t);
      dice('tutorial: senza magazzino non si apre da solo', t.stato, null);
    }

    // --- il «?» lo apre sempre, e si torna da dove eri ---
    {
      const t = telefono({ [CHIAVE]: 'visto' }, 'calendario');
      tasto(t);
      dice('tutorial: il ? lo apre anche se già visto', t.stato?.aperto, true);
      passi(t, 'dashboard', 'sedute', 'atleti');
      chiudi(t);
      dice('tutorial: chiuso, di nuovo in Calendario', t.scheda, 'calendario');
      dice('tutorial: e resta visto', t.magazzino[CHIAVE], 'visto');
    }
    {
      const t = telefono(null, 'sedute');
      tasto(t);
      dice('tutorial: il ? funziona anche senza magazzino', t.stato?.aperto, true);
      passi(t, 'dashboard');
      chiudi(t);
      dice('tutorial: e si torna comunque alle Sedute', t.scheda, 'sedute');
    }

    // --- chiusura senza stato (non dovrebbe capitare): non si va da nessuna parte ---
    dice('tutorial: chiusura senza stato', T.tutorialChiuso(null), { segna: 'visto', tornaA: null });
  }

  // "In qualunque modo": X, «Comincia», Esc, tocco fuori chiamano tutti
  // la stessa chiusura, senza più una casella che decida. La guardia sta
  // sul sorgente: se la casella torna, o una chiusura riprende a passare
  // un'opzione, la prova salta.
  const { readFileSync } = await import('node:fs');
  const sorgente = readFileSync('./src/componenti/Tutorial.jsx', 'utf8');
  if (/nonPiu|Non mostrare più/.test(sorgente)) {
    male++; console.error('✗ tutorial: in Tutorial.jsx c\'è ancora la casella «Non mostrare più»');
  }
  const chiusure = [...sorgente.matchAll(/chiudi\(([^)]*)\)/g)].map((m) => m[1].trim());
  if (chiusure.length < 4 || chiusure.some((a) => a !== '')) {
    male++; console.error(`✗ tutorial: le chiusure devono essere almeno quattro e tutte chiudi(), sono ${JSON.stringify(chiusure)}`);
  }
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ novità: tutte le prove passate');
