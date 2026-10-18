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

// ------------------------------------------- la fine della ripetizione
// La fine è una riga: inserirla in mezzo sposta di uno tutte quelle
// sotto, e i loro metri rilevati devono seguirle. Sciogliere toglie
// l'apertura (e la fine), e le chiavi risalgono.
{
  const D = await import('./src/lib/dominio.js');
  const prova = (cosa, fn) => {
    try { fn(); } catch (e) { male++; console.error(`✗ ${cosa}: ${e.message}`); }
  };
  const blocco = () => ({
    sezioni: [{ titolo: 'C', destinatari: ['*'], serie: [
      { notazione: '3x', metri: 0, senzaMetri: true, apreBlocco: 3 },
      { notazione: '8x50', metri: 1200, moltiplicato: 3 },
      { notazione: '200', metri: 200 },
    ] }],
    svolto: { righe: { '0-1': 1100, '0-2': 200 } },
  });
  prova('fine inserita in mezzo', () => {
    const s = blocco();
    D.inserisciFineBlocco(s, 0, 2);
    dice('la fine in mezzo: il 200 si porta dietro i suoi metri', s.svolto, { righe: { '0-1': 1100, '0-3': 200 } });
    dice('e la fine è al suo posto', s.sezioni[0].serie[2].chiudeBlocco, true);
  });
  prova('sciogliere', () => {
    const s = blocco();
    D.sciogliBlocco(s, 0, 0);
    dice('sciolto: le chiavi risalgono con le righe', s.svolto, { righe: { '0-0': 1100, '0-1': 200 } });
    const f = blocco();
    D.inserisciFineBlocco(f, 0, 2);
    D.sciogliBlocco(f, 0, 0);
    dice('sciolto con la fine: via due righe, le chiavi seguono', f.svolto, { righe: { '0-0': 1100, '0-1': 200 } });
    dice('e le righe sono le due di lavoro', f.sezioni[0].serie.map((r) => r.notazione), ['8x50', '200']);
  });
}

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

// ------------------------------------------- com'è andata: le volte di un blocco
// Sulla riga "8x" il campo era quello dei metri, come sulle altre:
// scrivendo 4 si registravano +4 m e le righe del blocco restavano a
// otto giri. Sull'apertura il campo è il numero di volte, e cambiarlo
// riscala le figlie in proporzione, anche quelle corrette a mano.
// La seduta si monta coi gesti dell'editor: tre righe piatte, poi
// "+ ripetizione" ×8 sulla prima.
const D = await import('./src/lib/dominio.js');
const mancano = ['campoAndata', 'volteDiBlocco', 'cambiaVolteSvolto', 'cambiaMetriSvolto']
  .filter((f) => typeof D[f] !== 'function');
if (mancano.length) {
  male++;
  console.error(`✗ com'è andata: mancano in dominio.js ${mancano.join(', ')}`);
} else {
  const bloccoDaOtto = () => {
    const sezione = { titolo: 'Centrale', destinatari: ['*'], serie: [
      { notazione: '8x', metri: 0, zona: '' },
      { notazione: '1x100', metri: 100, zona: 'A2' },
      { notazione: '1x50', metri: 50, zona: 'B1' },
    ] };
    D.applicaAperturaBlocco(sezione, 0, 8);
    return [sezione];
  };
  const sezioni = bloccoDaOtto();
  dice('il blocco montato coi gesti: 800 e 400',
    sezioni[0].serie.map((s) => s.metri), [0, 800, 400]);

  dice('sull\'apertura il campo è delle volte, sulle figlie dei metri',
    [0, 1, 2].map((j) => D.campoAndata(sezioni[0], j)), ['volte', 'metri', 'metri']);
  dice('le volte di partenza sono quelle scritte', D.volteDiBlocco(sezioni, null, 0, 0), 8);

  // Il caso del campo: 8x portato a 4.
  const a4 = D.cambiaVolteSvolto(sezioni, null, 0, 0, '4');
  dice('8x portato a 4: le figlie a 400 e 200, l\'apertura ricorda 4',
    a4.svolto, { righe: { '0-1': 400, '0-2': 200 }, volte: { '0-0': 4 }, nota: undefined });
  dice('8x portato a 4: nessun "+4" sulla riga di apertura', a4.svolto.righe['0-0'], undefined);
  dice('8x portato a 4: la seduta fa 600, non 1204', D.metriSvolti(sezioni, a4.svolto), 600);
  dice('8x portato a 4: riaprendo il campo dice 4', D.volteDiBlocco(sezioni, a4.svolto, 0, 0), 4);

  // In salita: il blocco fatto più volte di quelle scritte.
  for (const [volte, figlie] of [[10, [1000, 500]], [12, [1200, 600]], [9, [900, 450]]]) {
    const su = D.cambiaVolteSvolto(sezioni, null, 0, 0, String(volte));
    dice(`8x portato a ${volte}: le figlie a ${figlie.join(' e ')}`,
      [su.svolto.righe['0-1'], su.svolto.righe['0-2'], su.svolto.volte['0-0'], su.nonRiscalate],
      [...figlie, volte, []]);
  }

  // I tasti "1" poi "12": il campo passa da 1 prima di arrivare a 12, e
  // il risultato deve essere quello di 12. ComeAndata fa ripartire ogni
  // tasto dalla seduta di quando il campo è stato toccato; si prova
  // anche la catena tasto dopo tasto, che qui deve dare lo stesso.
  const tasto1 = D.cambiaVolteSvolto(sezioni, null, 0, 0, '1');
  dice('tasto "1": le figlie a 100 e 50', tasto1.svolto.righe, { '0-1': 100, '0-2': 50 });
  const diretto12 = D.cambiaVolteSvolto(sezioni, null, 0, 0, '12').svolto;
  dice('"1" poi "12", dalla partenza: come 12', D.cambiaVolteSvolto(sezioni, null, 0, 0, '12').svolto, diretto12);
  dice('"1" poi "12", in catena: come 12', D.cambiaVolteSvolto(sezioni, tasto1.svolto, 0, 0, '12').svolto, diretto12);
  dice('"1" poi "12": la seduta fa 1800', D.metriSvolti(sezioni, diretto12), 1800);

  // Anche la riga corretta a mano segue le volte, in proporzione.
  const corretta = D.cambiaMetriSvolto(null, 0, 1, '700');
  dice('la figlia corretta a mano segue le volte: 700 su 8 giri, 350 su 4',
    D.cambiaVolteSvolto(sezioni, corretta, 0, 0, '4').svolto.righe, { '0-1': 350, '0-2': 200 });

  // Toccando i metri di una riga sola cambia solo quella.
  dice('i metri di una figlia cambiano solo lei',
    D.cambiaMetriSvolto(a4.svolto, 0, 2, '150'),
    { righe: { '0-1': 400, '0-2': 150 }, volte: { '0-0': 4 }, nota: undefined });

  // Tornando alle volte scritte la seduta torna com'era: svolto sparisce.
  dice('tornando a 8 svolto torna null', D.cambiaVolteSvolto(sezioni, a4.svolto, 0, 0, '8').svolto, null);
  dice('svuotando il campo svolto torna null', D.cambiaVolteSvolto(sezioni, a4.svolto, 0, 0, '').svolto, null);

  // Se la divisione non è esatta la riga non si riscala, e lo si dice.
  const strana = D.cambiaVolteSvolto(sezioni, D.cambiaMetriSvolto(null, 0, 1, '750'), 0, 0, '3');
  dice('750 su 8 giri portato a 3 non si inventa: la riga resta e si segnala',
    [strana.svolto.righe, strana.nonRiscalate], [{ '0-1': 750, '0-2': 150 }, ['0-1']]);

  // Da zero volte si riparte dal programma, non da zero.
  const zero = D.cambiaVolteSvolto(sezioni, null, 0, 0, '0');
  dice('a zero volte le figlie fanno zero', zero.svolto.righe, { '0-1': 0, '0-2': 0 });
  dice('da zero a 2 si riparte dal programma',
    D.cambiaVolteSvolto(sezioni, zero.svolto, 0, 0, '2').svolto.righe, { '0-1': 200, '0-2': 100 });

  // Righe senza campo: l'apertura a secco, l'apertura nuda di una seduta
  // vecchia (le figlie non si sanno) e la fine della ripetizione.
  const palestra = { ...D.sezioneSeccaVuota('Palestra'), serie: [
    { notazione: '4x', metri: 0, apreBlocco: 4, senzaMetri: true },
    { notazione: '10 piegamenti', metri: 0 },
  ] };
  dice('a secco l\'apertura non ha campo', D.campoAndata(palestra, 0), null);
  const vecchia = { titolo: 'X', destinatari: ['*'], serie: [{ notazione: '8x', metri: 0 }, D.rigaFineBlocco()] };
  dice('l\'apertura nuda non ha campo', D.campoAndata(vecchia, 0), null);
  dice('la fine della ripetizione non ha campo', D.campoAndata(vecchia, 1), null);

  // Le volte sono posizionali come i metri: seguono la riga.
  dice('le volte seguono l\'apertura quando le righe scalano',
    svoltoDopoInserisciRiga(a4.svolto, 0, 0),
    { righe: { '0-2': 400, '0-3': 200 }, volte: { '0-1': 4 }, nota: undefined });
  dice('togliendo l\'apertura le sue volte se ne vanno',
    svoltoDopoTogliRiga(a4.svolto, 0, 0), { righe: { '0-0': 400, '0-1': 200 }, nota: undefined });
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ svolto: tutte le prove passate');
