// Prove del riepilogo seduta: la durata di un ramo e quella della
// seduta. Girano prima di ogni build.
//
// LA REGOLA È LA STESSA DEI VOLUMI, e i tempi la ignoravano: una seduta
// con lo split non dura la somma dei rami, perché nessun atleta fa sia
// il lavoro dei velocisti sia quello dei fondisti. Fino alla 0.56.1
// durataStimata sommava tutto e una seduta da 45' ne dichiarava 57.
import { readFileSync } from 'node:fs';
import {
  durataStimata, durataPerSpecializzazione, inOreMinuti, SPECIALIZZAZIONI,
  specializzazioniDaSezioni, specializzazioniDiAtleti, specializzazioniConLavoroDedicato,
  metriPerSpecializzazione, notaLeggibile, NOTE_DA_NASCONDERE,
} from './src/lib/dominio.js';
import { analizzaTesto } from './src/lib/analizzatore.js';
import { sedutaDaLettura } from './src/lib/importaTesto.js';

// I sorgenti che scrivono davvero le note: l'analizzatore le compone
// (`somma letta: …`, `misura letta …`) e importaTesto le impila con i tag
// di modalità e attrezzi. La guardia sui prefissi cerca in entrambi.
const SORGENTI_NOTE = [
  './src/lib/analizzatore.js',
  './src/lib/importaTesto.js',
].map((f) => ({ file: f, testo: readFileSync(f, 'utf8') }));

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};
const vero = (cosa, avuto) => dice(cosa, !!avuto, true);

// La seduta mista del rapporto: un riscaldamento per tutti, due rami che
// si escludono a vicenda, e la palestra — che è comune e conta.
const MISTA = [
  { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
  { titolo: 'Velocità', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  { titolo: 'Mezzofondo', destinatari: ['Mezzofondo'], serie: [{ notazione: '6x200', metri: 1200, recupero: '@3:00' }] },
  { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 20, serie: [{ notazione: '3x10 piegamenti', metri: 0, senzaMetri: true }] },
];

// =====================================================================
// SEDUTA MISTA: comune + il ramo più lungo
// =====================================================================
{
  // comuni: 400 @7:00 = 420 s, palestra 20' = 1200 s → 1620
  // rami:   velocità 8×90 = 720 · mezzofondo 6×180 = 1080
  dice('il totale è comune + il ramo più lungo', durataStimata(MISTA).secondi, 2700);
  dice('che scritto si legge così', inOreMinuti(durataStimata(MISTA).secondi), '45\'');

  // Le due cose che il totale NON deve essere: la somma di tutto
  // (5940-1200 secco escluso = 3420, com'era prima) e il solo comune.
  dice('non è la somma dei rami', durataStimata(MISTA).secondi === 3420, false);
  dice('e non è il solo comune', durataStimata(MISTA).secondi === 1620, false);

  dice('il ramo lento vale comune + il suo',
    durataPerSpecializzazione(MISTA, 'Mezzofondo').secondi, 2700);
  dice('il ramo veloce pure',
    durataPerSpecializzazione(MISTA, 'Velocità').secondi, 2340);
  dice('chi non ha un ramo suo fa solo il comune',
    durataPerSpecializzazione(MISTA, 'Fondo').secondi, 1620);

  // "di cui Nm' comuni": è la stessa parte per tutti, e comprende la
  // palestra, che è lavoro che fanno insieme.
  for (const spec of SPECIALIZZAZIONI) {
    dice(`la parte comune è la stessa per ${spec}`,
      durataPerSpecializzazione(MISTA, spec).comuni, 1620);
  }
}

// =====================================================================
// IL LAVORO A SECCO RESTA NEL TOTALE E NEL COMUNE
// Occupa tempo: sta nella seduta e l'allenatore ci è dentro. Esce solo
// dal conteggio delle righe senza partenza.
// =====================================================================
{
  const conSecco = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Palestra', aSecco: true, durataMin: 20, serie: [{ notazione: '3x10', metri: 0, senzaMetri: true }] },
  ];
  dice('la palestra conta nel totale', durataStimata(conSecco).secondi, 420 + 1200);
  dice('e nella parte comune', durataPerSpecializzazione(conSecco, 'Velocità').comuni, 420 + 1200);
  dice('ma le sue righe non sono "senza partenza"', durataStimata(conSecco).senzaPartenza, 0);
  dice('ed è contata come sezione secca', durataStimata(conSecco).sezioniSecche, 1);

  // Il caso già fissato in prova_analizzatore.mjs: una sezione a secco
  // senza il campo destinatari è comune, quindi entra in ogni ramo.
  dice('palestra sola, 30 minuti',
    durataStimata([{ titolo: 'Palestra', aSecco: true, durataMin: 30, serie: [] }]).secondi, 1800);
}

// =====================================================================
// SEDUTA DI SOLE SEZIONI COMUNI
// Senza rami il massimo è il comune stesso: il conto non deve cambiare
// forma quando lo split non c'è, che è la maggioranza delle sedute.
// =====================================================================
{
  const comune = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Parte centrale', destinatari: ['*'], serie: [{ notazione: '10x100', metri: 1000, recupero: '@1:40' }] },
    // Senza il campo destinatari: destinatariDi la tratta come [TUTTI].
    { titolo: 'Sciolto', serie: [{ notazione: '200', metri: 200, recupero: '@4:00' }] },
  ];
  const atteso = 420 + 1000 + 240;
  dice('totale = tutto il comune', durataStimata(comune).secondi, atteso);
  dice('una sezione senza destinatari entra lo stesso',
    durataPerSpecializzazione(comune, 'Velocità').secondi, atteso);
  for (const spec of SPECIALIZZAZIONI) {
    dice(`ogni ramo vale il comune intero (${spec})`,
      durataPerSpecializzazione(comune, spec).secondi, atteso);
    dice(`ed è tutto comune (${spec})`,
      durataPerSpecializzazione(comune, spec).comuni, atteso);
  }
}

// =====================================================================
// ELENCO DI SPECIALIZZAZIONI VUOTO O NULLO
// Il riepilogo si disegna PRIMA che la lista degli atleti arrivi: senza
// questo ripiego il massimo resterebbe a zero e una seduta piena
// mostrerebbe durata zero, che è peggio di una durata approssimata.
// =====================================================================
{
  dice('elenco vuoto vale come tutte', durataStimata(MISTA, []).secondi, 2700);
  dice('elenco nullo pure', durataStimata(MISTA, null).secondi, 2700);
  dice('indefinito usa il valore per difetto', durataStimata(MISTA, undefined).secondi, 2700);

  // Ristretto per davvero: con un gruppo di soli "Generale" il ramo dei
  // velocisti non allunga una seduta che nessuno nuoterà.
  dice('solo Generale: niente rami', durataStimata(MISTA, ['Generale']).secondi, 1620);
  dice('solo Velocità', durataStimata(MISTA, ['Velocità']).secondi, 2340);
  dice('due rami, vince il più lungo',
    durataStimata(MISTA, ['Velocità', 'Mezzofondo']).secondi, 2700);
}

// =====================================================================
// I CONTATORI GUARDANO TUTTA LA SEDUTA, NON IL RAMO PIÙ LUNGO
// Sono righe da sistemare, non tempo: una riga senza ripartenza fra i
// velocisti va segnalata anche quando il ramo che vince è un altro.
// =====================================================================
{
  const conBuchi = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Velocità', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400 }] },
    { titolo: 'Mezzofondo', destinatari: ['Mezzofondo'], serie: [{ notazione: '6x200', metri: 1200, recupero: '@3:00' }] },
  ];
  const t = durataStimata(conBuchi);
  dice('vince il mezzofondo', t.secondi, 420 + 1080);
  dice('ma la riga scoperta dei velocisti si conta lo stesso', t.senzaPartenza, 1);
  dice('anche restringendo il gruppo al solo mezzofondo',
    durataStimata(conBuchi, ['Mezzofondo']).senzaPartenza, 1);

  // Nella card invece il buco è solo di chi ce l'ha: serve a marcare
  // QUELLA card come sottostimata.
  dice('la card dei velocisti sa di essere sottostimata',
    durataPerSpecializzazione(conBuchi, 'Velocità').senzaPartenza, 1);
  dice('quella dei mezzofondisti no',
    durataPerSpecializzazione(conBuchi, 'Mezzofondo').senzaPartenza, 0);
}

// =====================================================================
// QUALI CARD MOSTRARE
//
// Le card sono quelle degli atleti del gruppo, più il lavoro scritto che
// non deve sparire. Finché la lista degli atleti non arriva si ricavano
// dalle sezioni: mai partire dalle cinque del dominio per collassare a
// una appena arriva la rete.
// =====================================================================
{
  const soloVelocisti = [
    { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  ];
  const gruppoVeloce = [{ specializzazione: 'Velocità' }, { specializzazione: 'Velocità' }];

  dice('il gruppo dà una specializzazione sola',
    specializzazioniDiAtleti(gruppoVeloce), ['Velocità']);
  dice('e il lavoro dedicato la conferma',
    specializzazioniConLavoroDedicato(soloVelocisti), ['Velocità']);
  // Senza sezioni comuni Generale non entra nello stato iniziale: chi è
  // Generale non nuoterebbe niente, e la card sarebbe vuota davvero.
  dice('seduta tutta dedicata: niente Generale a vuoto',
    specializzazioniDaSezioni(soloVelocisti), ['Velocità']);

  // L'eccezione del lavoro dedicato non deve riportare dentro nessun altro.
  dice('un riscaldamento comune NON crea rami dedicati',
    specializzazioniConLavoroDedicato([
      { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400 }] },
    ]), []);
  // Un ramo appena creato, ancora a zero metri, non è "lavoro scritto"…
  dice('ramo a zero metri fuori dall\'eccezione',
    specializzazioniConLavoroDedicato([
      { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '', metri: 0 }] },
    ]), []);
  // …ma nello stato iniziale la sua card c'è: mentre scrivi devi vederla.
  dice('lo stato iniziale invece lo cita',
    specializzazioniDaSezioni([
      { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '', metri: 0 }] },
    ]), ['Velocità']);

  // Campo vuoto, nullo o sconosciuto: conta come Generale, nessuno si perde.
  dice('specializzazioni mancanti valgono Generale',
    specializzazioniDiAtleti([{ specializzazione: null }, { specializzazione: '' }, { specializzazione: 'Boh' }, {}]),
    ['Generale']);
  dice('nessun atleta, nessuna specializzazione', specializzazioniDiAtleti([]), []);
}

// =====================================================================
// GRUPPO TUTTO GENERALE, SEDUTA DI SOLE SEZIONI COMUNI
// Il caso più frequente: nessuno split, nessuna specializzazione. Una card
// sola, e il suo tempo deve coincidere col totale in intestazione.
// =====================================================================
{
  const comune = [
    { titolo: 'Riscaldamento', destinatari: ['*'], serie: [{ notazione: '400', metri: 400, recupero: '@7:00' }] },
    { titolo: 'Parte centrale', destinatari: ['*'], serie: [{ notazione: '10x100', metri: 1000, recupero: '@1:40' }] },
    { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 15, serie: [] },
  ];
  const gruppo = [{ specializzazione: 'Generale' }, { specializzazione: null }, {}];
  const atteso = 420 + 1000 + 900;

  dice('una card sola', specializzazioniDiAtleti(gruppo), ['Generale']);
  dice('nessun lavoro dedicato', specializzazioniConLavoroDedicato(comune), []);
  dice('e lo stato iniziale dice la stessa cosa',
    specializzazioniDaSezioni(comune), ['Generale']);

  const card = durataPerSpecializzazione(comune, 'Generale');
  dice('tutto il tempo è comune', card.comuni, card.secondi);
  dice('e vale quanto ci si aspetta', card.secondi, atteso);
  // Il numero nella card e quello in intestazione devono coincidere: sono
  // la stessa seduta guardata da due punti.
  dice('card e intestazione dicono lo stesso numero',
    card.secondi, durataStimata(comune, ['Generale']).secondi);
  dice('anche senza restringere il gruppo',
    card.secondi, durataStimata(comune).secondi);
}

// =====================================================================
// UNA CARD A ZERO METRI PUÒ AVERE MINUTI VERI
//
// QUESTA PROVA BLOCCA UN'IDEA SBAGLIATA: "togliamo le card a zero metri".
// Palestra comune più un ramo dedicato ai velocisti, gruppo tutto Generale.
// La card Generale ha zero metri — non nuota niente — ma venti minuti di
// palestra, che sono tempo vero in cui l'allenatore è con loro. Filtrare
// sui metri la cancellerebbe insieme al suo tempo.
//
// Se un filtro servirà mai, il test è "metri 0 E secondi 0".
// =====================================================================
{
  const palestraPiuRamo = [
    { titolo: 'Palestra', destinatari: ['*'], aSecco: true, durataMin: 20, serie: [{ notazione: '3x10 piegamenti', metri: 0, senzaMetri: true }] },
    { titolo: 'Velocisti', destinatari: ['Velocità'], serie: [{ notazione: '8x50', metri: 400, recupero: '@1:30' }] },
  ];

  dice('Generale non nuota un metro',
    metriPerSpecializzazione(palestraPiuRamo, 'Generale'), 0);
  const g = durataPerSpecializzazione(palestraPiuRamo, 'Generale');
  dice('ma ha i venti minuti di palestra', g.secondi, 1200);
  dice('e sono tutti comuni', g.comuni, 1200);

  dice('il velocista nuota i suoi metri',
    metriPerSpecializzazione(palestraPiuRamo, 'Velocità'), 400);
  const v = durataPerSpecializzazione(palestraPiuRamo, 'Velocità');
  dice('e sta in acqua più a lungo', v.secondi, 1920);
  dice('con la stessa parte comune', v.comuni, 1200);

  // La card Generale va mostrata: il test di un eventuale filtro futuro
  // dev'essere metri 0 E secondi 0, e qui i secondi non sono zero.
  dice('zero metri ma non zero secondi', [
    metriPerSpecializzazione(palestraPiuRamo, 'Generale') === 0,
    g.secondi === 0,
  ], [true, false]);
}

// =====================================================================
// LE NOTE SUL FOGLIO DI STAMPA
//
// L'analizzatore appende alle note dei promemoria di lettura. Sul foglio
// che finisce a bordo vasca non servono: la riga è già stata riletta, e
// "somma letta: 200 m a giro" ripete un numero che sta nella colonna dei
// metri. Nel revisore invece devono restare, ed è il motivo per cui
// notaLeggibile si usa SOLO in stampa.
// =====================================================================
{
  dice('togliere la somma letta',
    notaLeggibile('somma letta: 200 m a giro · pull'), 'pull');
  dice('togliere il promemoria di controllo',
    notaLeggibile('misura letta in mezzo alla riga: controlla · gambe'), 'gambe');
  dice('tenere quello che parla del lavoro',
    notaLeggibile('una serie per stile'), 'una serie per stile');
  dice('tenere il blocco con più andature',
    notaLeggibile('blocco aperto dalla riga scritta con più andature'),
    'blocco aperto dalla riga scritta con più andature');
  dice('tenere le note scritte a mano',
    notaLeggibile('somma letta: 400 m a giro · tenere i piedi alti'), 'tenere i piedi alti');
  dice('se resta solo il promemoria, non resta niente',
    notaLeggibile('somma letta: 200 m a giro'), '');
  dice('nota vuota', notaLeggibile(''), '');
  dice('nota assente', notaLeggibile(undefined), '');
}

// =====================================================================
// LA GUARDIA: I PREFISSI COINCIDONO CON QUELLO CHE L'ANALIZZATORE SCRIVE
//
// NOTE_DA_NASCONDERE vive in dominio.js e l'analizzatore non la conosce —
// non si tocca, continua a scrivere quello che scrive. Se un giorno
// cambiasse una dicitura, la costante resterebbe muta e i promemoria
// tornerebbero sul foglio stampato senza che nessuno se ne accorga.
// Questa prova legge testo VERO e verifica che le note prodotte comincino
// davvero per uno dei prefissi.
// =====================================================================
{
  // I sorgenti devono essere stati letti per davvero, o le prove sui
  // prefissi qui sotto passerebbero a vuoto senza controllare niente.
  for (const s of SORGENTI_NOTE) {
    vero(`${s.file} letto`, typeof s.testo === 'string' && s.testo.length > 0);
  }

  // IL PERCORSO VERO: testo → analizzatore → importaTesto, lo stesso che
  // scrive le note in archivio. Provare il solo analizzatore direbbe meno,
  // perché è importaTesto a impilare i tag di modalità e attrezzi.
  const inArchivio = (t) => sedutaDaLettura(analizzaTesto(t).sezioni)
    .flatMap((s) => s.serie);

  // "(2x50 + 4x25)" è un gruppo: l'analizzatore ci appende la somma letta,
  // e l'import ci aggiunge "pull" dagli attrezzi.
  const conSomma = inArchivio('(2x50 + 4x25) pull')[0];
  vero('in archivio la riga di un gruppo porta una nota', !!conSomma.note);
  vero('che comincia per un prefisso che conosciamo',
    NOTE_DA_NASCONDERE.some((p) => conSomma.note.toLowerCase().startsWith(p.toLowerCase())));
  dice('quindi sul foglio resta solo il tag', notaLeggibile(conSomma.note), 'pull');

  // Il tratto scartato perché il termine prima valeva una ripetuta sola:
  // nel revisore la nota serve — è l'unico posto dove si può dare torto
  // alla lettura — e sul foglio a bordo vasca no. Quei metri non si
  // nuotano, e il numero giusto è già nella colonna dei metri.
  const conScarto = inArchivio('3x25 + 1x75 Remate DO + 75 DO completo')[0];
  vero('in archivio la riga col tratto scartato porta la nota',
    /tratto non contato: 75 m/.test(conScarto.note || ''));
  dice('e sul foglio stampato non ne resta niente', notaLeggibile(conScarto.note), '');

  // Una riga senza promemoria resta intatta dall'inizio alla fine.
  const pulita = inArchivio('8x50 progr @1:00')[0];
  dice('una nota di solo lavoro passa intera',
    notaLeggibile(pulita.note), pulita.note);

  // Ogni prefisso deve corrispondere a una stringa che qualcuno scrive
  // ancora: uno rimasto orfano è un filtro che non filtra più niente, e
  // il promemoria tornerebbe sul foglio senza che nessuno se ne accorga.
  for (const p of NOTE_DA_NASCONDERE) {
    vero(`il prefisso "${p}" è ancora scritto in uno dei sorgenti`,
      SORGENTI_NOTE.some((s) => s.testo.includes(p)));
  }
}

// =====================================================================
// CASI VUOTI
// =====================================================================
{
  dice('nessuna sezione', durataStimata([]).secondi, 0);
  dice('sezioni nulle', durataStimata(null).secondi, 0);
  dice('ramo su seduta vuota', durataPerSpecializzazione([], 'Velocità'),
    { secondi: 0, comuni: 0, conPartenza: 0, senzaPartenza: 0, sezioniSecche: 0 });
}

// ------------------------------------- l'etichetta della seduta in Calendario
// Con un gruppo scelto, la casella del giorno dice titolo e metri di ogni
// seduta. I metri seguono la regola dei volumi: con lo split non si
// sommano i rami, si dice da quanto a quanto nuota chi c'è
// (deciso il 19/10/2026: intervallo, dal ramo più corto al più lungo).
{
  const D = await import('./src/lib/dominio.js');
  const mancano = ['etichettaCalendario', 'etichetteDelGiorno', 'metriConPunto']
    .filter((f) => typeof D[f] !== 'function');
  if (mancano.length) {
    male++;
    console.error(`✗ calendario: mancano in dominio.js ${mancano.join(', ')}`);
  } else {
    const comune = (metri) => ({ titolo: 'Warm Up', destinatari: ['*'], serie: [{ notazione: `1x${metri}`, metri, zona: 'A1' }] });
    const ramo = (spec, metri) => ({ titolo: spec, destinatari: [spec], serie: [{ notazione: `1x${metri}`, metri, zona: 'A2' }] });
    const piatta = (titolo, metri) => ({ titolo, sezioni: [comune(1200), { ...comune(metri - 1200), titolo: 'Centrale' }] });

    // Il punto delle migliaia c'è anche sotto i 10.000: toLocaleString
    // in italiano scriverebbe "4200".
    dice('metri con il punto', ['800', '4200', '12500', '0'].map((m) => D.metriConPunto(+m)),
      ['800', '4.200', '12.500', '0']);

    // Titolo pieno.
    dice('titolo pieno: titolo e metri',
      D.etichettaCalendario(piatta('Aerobico lungo', 4200)),
      { titolo: 'Aerobico lungo', metri: '4.200 m', intero: 'Aerobico lungo · 4.200 m' });

    // Titolo vuoto, assente o di soli spazi: solo i metri.
    for (const titolo of ['', null, undefined, '   ']) {
      dice(`titolo ${JSON.stringify(titolo)}: solo i metri`,
        D.etichettaCalendario(piatta(titolo, 4200)), { titolo: '', metri: '4.200 m', intero: '4.200 m' });
    }

    // Titolo lungo: la regola non lo taglia — lo taglia la casella, e
    // tiene intero il testo per il passaggio del mouse. Titolo e metri
    // restano separati, così il taglio non mangia mai i metri.
    const lungo = 'Aerobico lungo con pinne e palette, poi tecnica di virata a dorso';
    const l = D.etichettaCalendario(piatta(lungo, 4200));
    dice('titolo lungo: intero nella regola', l.titolo, lungo);
    dice('titolo lungo: i metri a parte', l.metri, '4.200 m');
    dice('titolo lungo: intero per il passaggio del mouse', l.intero, `${lungo} · 4.200 m`);

    // Split: da quanto a quanto, mai la somma dei rami (6.200).
    const split = { titolo: 'Aerobico lungo', sezioni: [comune(1200), ramo('Velocità', 2000), ramo('Mezzofondo', 3000)] };
    dice('split: l\'intervallo dei rami, non la somma', D.etichettaCalendario(split).metri, '3.200–4.200 m');
    const uguali = { titolo: 'X', sezioni: [comune(1200), ramo('Velocità', 2000), ramo('Mezzofondo', 2000)] };
    dice('split con rami uguali: un numero solo', D.etichettaCalendario(uguali).metri, '3.200 m');

    // Due sedute nello stesso giorno: una sotto l'altra, nell'ordine in
    // cui arrivano — lo stesso del pannello del giorno.
    dice('due sedute: in ordine',
      D.etichetteDelGiorno([piatta('Mattino', 3000), piatta('', 2500)]).map((e) => e.intero),
      ['Mattino · 3.000 m', '2.500 m']);

    // L'ordine del giorno è quello di creazione: in archivio non c'è un
    // orario, e la lettura dal database non garantisce niente fra due
    // sedute della stessa data. Casella e pannello usano lo stesso.
    if (typeof D.inOrdineDiCreazione !== 'function') {
      male++; console.error('✗ calendario: manca in dominio.js inOrdineDiCreazione');
    } else {
      const s = (id, created_at) => ({ id, created_at });
      const arrivate = [
        s('c', '2026-10-19T16:30:00.000000+00:00'),
        s('a', '2026-10-19T06:45:00.123456+00:00'),
        s('b', '2026-10-19T12:00:00+00:00'),
      ];
      dice('per created_at, qualunque sia l\'ordine di arrivo',
        D.inOrdineDiCreazione(arrivate).map((x) => x.id), ['a', 'b', 'c']);
      dice('la lista di partenza non si tocca', arrivate.map((x) => x.id), ['c', 'a', 'b']);
      // Una copia salvata nel dispositivo prima di questa versione non ha
      // created_at: in fondo, e fra loro per id, perché l'ordine non
      // cambi a ogni disegno.
      dice('senza created_at in fondo, fra loro per id',
        D.inOrdineDiCreazione([s('z', null), s('y', undefined), s('x', '2026-10-19T08:00:00+00:00')]).map((x) => x.id),
        ['x', 'y', 'z']);
      dice('stesso istante: per id',
        D.inOrdineDiCreazione([s('2', '2026-10-19T08:00:00+00:00'), s('1', '2026-10-19T08:00:00+00:00')]).map((x) => x.id),
        ['1', '2']);
      dice('nessuna seduta: niente', D.inOrdineDiCreazione(null), []);
    }

    // Nessuna seduta: nessuna etichetta.
    dice('nessuna seduta: niente', D.etichetteDelGiorno([]), []);
    dice('nessuna seduta (null): niente', D.etichetteDelGiorno(null), []);
  }
}

// ------------------------------------------------ il nome del PDF della seduta
// Il PDF è la stampa del browser, che propone come nome il titolo della
// pagina: «CorsiaPro_GG-MM-AA_Titolo». I caratteri che Windows, macOS e
// iOS non accettano in un nome di file si sostituiscono.
{
  const D = await import('./src/lib/dominio.js');
  if (typeof D.nomeFileSeduta !== 'function') {
    male++; console.error('✗ PDF: manca in dominio.js nomeFileSeduta');
  } else {
    const n = (titolo, data = '2026-10-19') => D.nomeFileSeduta({ data, titolo });
    dice('PDF: titolo pieno', n('Aerobico lungo'), 'CorsiaPro_19-10-26_Aerobico lungo');
    for (const vuoto of ['', null, undefined, '   ']) {
      dice(`PDF: titolo ${JSON.stringify(vuoto)}`, n(vuoto), 'CorsiaPro_19-10-26');
    }
    // Ogni carattere non valido (\ / : * ? " < > | e i caratteri di
    // controllo) diventa un trattino; più di seguito, uno solo.
    dice('PDF: la barra e i due punti', n('A1/A2: base'), 'CorsiaPro_19-10-26_A1-A2- base');
    dice('PDF: tutti i non validi', n('a\\b/c:d*e?f"g<h>i|j'), 'CorsiaPro_19-10-26_a-b-c-d-e-f-g-h-i-j');
    dice('PDF: di seguito, un trattino solo', n('Soglia ??? fine'), 'CorsiaPro_19-10-26_Soglia - fine');
    dice('PDF: un trattino in fondo se ne va', n('Soglia?'), 'CorsiaPro_19-10-26_Soglia');
    dice('PDF: a capo e tabulazioni', n('Riga uno\nriga\tdue'), 'CorsiaPro_19-10-26_Riga uno-riga-due');
    // Windows toglie da sé punti e spazi in fondo: meglio toglierli qui
    // che ritrovarsi un nome diverso da quello mostrato.
    dice('PDF: punti e spazi in fondo', n('Tecnica... '), 'CorsiaPro_19-10-26_Tecnica');
    dice('PDF: solo caratteri non validi vale vuoto', n('///'), 'CorsiaPro_19-10-26');
    dice('PDF: gli accenti restano', n('Velocità · C3'), 'CorsiaPro_19-10-26_Velocità · C3');
    dice('PDF: spazi doppi', n('Aerobico   lungo'), 'CorsiaPro_19-10-26_Aerobico lungo');
    // Il giorno e il mese a due cifre, l'anno con le ultime due.
    dice('PDF: giorno e mese a due cifre', n('X', '2027-01-05'), 'CorsiaPro_05-01-27_X');
    // Senza data (una bozza mai datata) il nome resta valido, senza data.
    dice('PDF: senza data', n('Aerobico lungo', ''), 'CorsiaPro_Aerobico lungo');
    dice('PDF: senza data né titolo', n('', null), 'CorsiaPro');
  }
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ riepilogo seduta: tutte le prove passate');
