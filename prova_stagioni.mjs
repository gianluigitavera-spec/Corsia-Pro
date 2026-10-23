// Prove sulle stagioni e sulla proiezione delle fasce d'età.
// Girano prima di ogni build. Sono la rete sotto la regola più silenziosa
// dell'app: se le fasce si proiettano male, tutta la squadra cambia
// categoria di nascosto e i volumi finiscono nel posto sbagliato.
import { stagioneCorrente, stagioniProposte, fasceRisolte, categoriaDi,
         proponiFasi, proponiTutteLeFasi, gruppoRipartizione, giorno,
         copiaSeduta, perSettimana, lunediDi,
         metriSvolti, scartoPerZona, metriPerSpecializzazione,
         zonePerSpecializzazione, CATEGORIE } from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const ok = JSON.stringify(avuto) === JSON.stringify(atteso);
  if (!ok) { male++; console.error(`✗ ${cosa}\n  atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)}`); }
};

// --- il cambio di stagione è a luglio ---
dice('30 giugno 2026 è ancora la stagione vecchia', stagioneCorrente(new Date('2026-06-30')), '2025/26');
dice('1 luglio 2026 apre la stagione nuova', stagioneCorrente(new Date('2026-07-01')), '2026/27');
dice('agosto 2026 è 2026/27', stagioneCorrente(new Date('2026-08-04')), '2026/27');
dice('gennaio 2027 è ancora 2026/27', stagioneCorrente(new Date('2027-01-10')), '2026/27');

// La stagione appena chiusa resta scegliibile: le sedute vecchie stanno lì.
const proposte = stagioniProposte(['2025/26'], stagioneCorrente(new Date('2026-08-04')));
if (!proposte.includes('2025/26')) { male++; console.error('✗ la stagione 2025/26 è sparita dal selettore'); }
if (!proposte.includes('2026/27')) { male++; console.error('✗ la stagione 2026/27 non è nel selettore'); }

// --- le fasce si proiettano di un anno esatto ---
// Una sola stagione compilata (la 2025/26), come nel database vero.
const fasce2526 = [
  { stagione: '2025/26', categoria: 'ESO_A1', sesso: 'M', anno_nascita_da: 2013, anno_nascita_a: 2013 },
  { stagione: '2025/26', categoria: 'ESO_A2', sesso: 'M', anno_nascita_da: 2012, anno_nascita_a: 2012 },
];

const proiettata = fasceRisolte(fasce2526, '2026/27');
if (!proiettata.proiettata) { male++; console.error('✗ la 2026/27 doveva risultare proiettata, non compilata'); }
dice('lo scarto fra 2025/26 e 2026/27 è di un anno', proiettata.scarto, 1);

// Chi era Esordiente A1 nel 2013 lascia il posto a chi è nato nel 2014.
const eso = proiettata.fasce.find((f) => f.categoria === 'ESO_A1');
dice('la fascia ESO_A1 scala di un anno', [eso?.anno_nascita_da, eso?.anno_nascita_a], [2014, 2014]);

// E la categoria calcolata segue: stesso atleta, un anno dopo, sale.
dice('un 2013 nel 2025/26 è ESO_A1', categoriaDi(2013, 'M', fasce2526), 'ESO_A1');
dice('lo stesso 2013 nel 2026/27 è salito', categoriaDi(2013, 'M', proiettata.fasce), 'ESO_A2');

// --- programma contro vasca ---
const sezioni = [
  { titolo: 'Riscaldamento', serie: [{ notazione: '1x400', metri: 400, zona: 'A1' }] },
  { titolo: 'Centrale', serie: [
    { notazione: '2x 8x100', metri: 1600, zona: 'A2' },
    { notazione: '8x25', metri: 200, zona: 'C3' },
  ] },
];

dice('senza correzioni valgono i metri del programma', metriSvolti(sezioni, null), 2200);
dice('una seduta andata come scritta non cambia', metriSvolti(sezioni, { righe: {} }), 2200);

// Il caso vero: il gruppo chiude il 2x8x100 a 1400 invece di 1600.
const chiusaPrima = { righe: { '1-0': 1400 } };
dice('la riga corretta entra nel totale', metriSvolti(sezioni, chiusaPrima), 2000);
dice('lo scarto cade nella zona giusta', scartoPerZona(sezioni, chiusaPrima), { A2: -200 });

// Zero è un valore, non un "non toccato": la serie saltata del tutto.
dice('una serie saltata vale zero, non il programmato',
  metriSvolti(sezioni, { righe: { '1-1': 0 } }), 2000);

// --- il carico dell'atleta segue i metri veri, non il programma ---
const conSplit = [
  { titolo: 'Warm Up', destinatari: ['*'], serie: [{ notazione: '1x400', metri: 400, zona: 'A1' }] },
  { titolo: 'Centrale velocisti', destinatari: ['Velocità'], serie: [
    { notazione: '16x25', metri: 400, zona: 'C3' },
  ] },
  { titolo: 'Centrale mezzofondo', destinatari: ['Mezzofondo'], serie: [
    { notazione: '2x 8x100', metri: 1600, zona: 'A2' },
  ] },
];

// La regola dello split regge: il velocista non nuota la parte del mezzofondista.
dice('velocista, programma', metriPerSpecializzazione(conSplit, 'Velocità'), 800);
dice('mezzofondista, programma', metriPerSpecializzazione(conSplit, 'Mezzofondo'), 2000);

// Il gruppo mezzofondo chiude a 1400: cala solo il suo conto.
const chiusa = { righe: { '2-0': 1400 } };
dice('mezzofondista, metri veri', metriPerSpecializzazione(conSplit, 'Mezzofondo', chiusa), 1800);
dice('il velocista non c\'entra niente', metriPerSpecializzazione(conSplit, 'Velocità', chiusa), 800);

// E la ripartizione per zona segue.
const zoneMezzo = zonePerSpecializzazione(conSplit, 'Mezzofondo', chiusa);
dice('la zona A2 perde i 200 metri', zoneMezzo.find((z) => z.zona === 'A2')?.metri, 1400);

// --- doppia e tripla periodizzazione ---
// Primo macrociclo: obiettivo a dicembre, generale allungata a settembre.
const primo = proponiFasi('2026-12-13', { inizioStagione: '2026-09-01' });
dice('il primo parte dall\'inizio stagione', primo[0].dal, '2026-09-01');
dice('e finisce il giorno prima della gara', primo[3].al, '2026-12-12');

// Secondo: obiettivo a marzo, paletto il giorno dopo la gara di dicembre.
const paletto = giorno('2026-12-13', 1);
dice('il paletto è il giorno dopo l\'obiettivo precedente', paletto, '2026-12-14');
const secondo = proponiFasi('2027-03-28', { inizioStagione: paletto });
dice('il secondo non invade il primo', secondo[0].dal >= paletto, true);
dice('il secondo chiude prima della sua gara', secondo[3].al, '2027-03-27');

// Terzo: obiettivo a luglio. Le quattro fasi ci sono sempre tutte.
const terzo = proponiFasi('2027-07-25', { inizioStagione: giorno('2027-03-28', 1) });
dice('anche il terzo ha quattro fasi', terzo.length, 4);
dice('e non si sovrappone al secondo', terzo[0].dal > secondo[3].al, true);

// --- la ripartizione proposta ---
dice('gli Esordienti B non fanno lattacido in generale',
  proponiTutteLeFasi(['ESO_B1']).generale.lattacido, 0);
dice('comanda la categoria più alta fra quelle scelte',
  gruppoRipartizione(['ESO_A2', 'RAG_1']), 'ragazzi');
dice('Propaganda non ha proposta', proponiTutteLeFasi(['PROP_01']), null);

// Una seduta dei soli Ragazzi 3 riceve la proposta dei Ragazzi. Il
// gruppo elencava "RAG_3", che non esiste: la categoria è RAG_3M, e la
// seduta restava senza proposta.
dice('Ragazzi 3 (RAG_3M) è nel gruppo ragazzi', gruppoRipartizione(['RAG_3M']), 'ragazzi');
dice('e riceve la proposta dei Ragazzi',
  proponiTutteLeFasi(['RAG_3M']), proponiTutteLeFasi(['RAG_1']));

// Ogni categoria d'età cade in un gruppo: un codice scritto male in
// GRUPPO_DI lascia senza proposta una categoria intera, in silenzio.
// Fuori per scelta i percorsi (Teen, Triathlon) e i Propaganda.
const SENZA_PROPOSTA = /^(PROP_|TEEN_|TRI$)/;
for (const { codice } of CATEGORIE) {
  if (SENZA_PROPOSTA.test(codice)) continue;
  if (!gruppoRipartizione([codice])) {
    male++; console.error(`✗ ${codice}: nessun gruppo di ripartizione`);
  }
}

for (const cat of ['ESO_B1', 'ESO_A1', 'RAG_2', 'JUN_1', 'ASS', 'MAS']) {
  const tutte = proponiTutteLeFasi([cat]);
  for (const [fase, r] of Object.entries(tutte)) {
    const somma = Object.values(r).reduce((a, b) => a + b, 0);
    if (somma !== 100) { male++; console.error(`\u2717 ${cat}/${fase} somma ${somma}, non 100`); }
  }
  // Il lattacido non deve mai calare salendo di fase fino alla specifica.
  if (tutte.specifica.lattacido < tutte.generale.lattacido) {
    male++; console.error(`\u2717 ${cat}: la specifica ha meno lattacido della generale`);
  }
}

// E deve crescere con l'età: un Assoluto fa più lattacido di un Esordiente.
dice('il lattacido cresce con la categoria',
  proponiTutteLeFasi(['ASS']).specifica.lattacido > proponiTutteLeFasi(['ESO_A1']).specifica.lattacido,
  true);

// --- copiare le sedute ---
dice('il lunedì di un mercoledì', lunediDi('2026-08-05'), '2026-08-03');
dice('il lunedì di una domenica', lunediDi('2026-08-09'), '2026-08-03');
dice('il lunedì di un lunedì è sé stesso', lunediDi('2026-08-03'), '2026-08-03');

const originale = {
  id: 'abc', societa_id: 'soc', data: '2026-08-03', titolo: 'Centrale A2',
  categorie: ['ESO_A1'], origine: 'manuale',
  sezioni: [{ titolo: 'WU', serie: [{ notazione: '1x400', metri: 400 }] }],
  svolto: { righe: { '0-0': 300 } },
};
const copiata = copiaSeduta(originale, '2026-08-10');

dice('la copia va sulla data nuova', copiata.data, '2026-08-10');
dice('la copia non porta l\'id dell\'originale', copiata.id, undefined);
dice('e nemmeno "com\'è andata"', copiata.svolto, undefined);
dice('il programma però c\'è tutto', copiata.sezioni[0].serie[0].metri, 400);

// La copia dev'essere profonda: toccare la copia non deve toccare l'originale.
copiata.sezioni[0].serie[0].metri = 999;
dice('toccare la copia non tocca l\'originale', originale.sezioni[0].serie[0].metri, 400);

const settimane = perSettimana([
  { data: '2026-08-03' }, { data: '2026-08-05' }, { data: '2026-08-11' },
]);
dice('due settimane distinte', settimane.length, 2);
dice('la più recente per prima', settimane[0].lunedi, '2026-08-10');
dice('e la settimana piena ne ha due', settimane[1].sedute.length, 2);

// --- le percentuali per famiglia, sui soli metri classificati ---
// Dashboard e Confronto dividevano per il totale, metri senza zona
// compresi: ogni famiglia usciva più bassa, la somma sotto il 100, e il
// confronto con obiettivi che fra le quattro famiglie fanno 100 diceva
// "manca aerobico" dove mancava solo la zona. I metri senza zona restano
// nel totale (sono nuotati) e si dice quanti sono, ma non nel
// denominatore.
{
  const D = await import('./src/lib/dominio.js');
  if (typeof D.percentualiPerFamiglia !== 'function') {
    male++; console.error('✗ percentuali: manca in dominio.js percentualiPerFamiglia');
  } else {
    // Dashboard: la famiglia mancante si chiama nonClassificati.
    const conFuori = D.percentualiPerFamiglia({
      aerobico: 7200, vo2: 900, lattacido: 0, alattacido: 900, nonClassificati: 1000,
    });
    dice('totale: tutti i metri, anche senza zona', conFuori.totale, 10000);
    dice('classificati: le quattro famiglie', conFuori.classificati, 9000);
    dice('fuori: i metri senza zona', conFuori.fuori, 1000);
    dice('aerobico sui classificati: 80, non 72', conFuori.pct.aerobico, 80);
    dice('vo2 e alattacido 10, lattacido 0',
      [conFuori.pct.vo2, conFuori.pct.alattacido, conFuori.pct.lattacido], [10, 10, 0]);
    dice('le quattro famiglie fanno 100',
      Object.values(conFuori.pct).reduce((a, b) => a + b, 0), 100);

    // Confronto: la vista chiama la famiglia mancante 'altro'.
    const altro = D.percentualiPerFamiglia({ aerobico: 600, lattacido: 200, altro: 200 });
    dice('anche "altro" resta fuori', [altro.classificati, altro.fuori, altro.pct.aerobico], [800, 200, 75]);

    // Senza metri senza zona non cambia niente rispetto a prima.
    const pulita = D.percentualiPerFamiglia({ aerobico: 300, vo2: 100 });
    dice('senza metri fuori: come prima', [pulita.fuori, pulita.pct.aerobico, pulita.pct.vo2], [0, 75, 25]);

    // Tutto senza zona: nessuna percentuale da inventare, tutto fuori.
    const tuttoFuori = D.percentualiPerFamiglia({ nonClassificati: 500 });
    dice('tutto senza zona: percentuali a zero, 500 fuori',
      [tuttoFuori.classificati, tuttoFuori.fuori, tuttoFuori.pct.aerobico], [0, 500, 0]);

    // Niente di niente.
    dice('vuoto', D.percentualiPerFamiglia({}),
      { totale: 0, classificati: 0, fuori: 0, pct: { aerobico: 0, vo2: 0, lattacido: 0, alattacido: 0 } });
    dice('null', D.percentualiPerFamiglia(null).totale, 0);
  }
}

// --- la frequenza dell'Appello: Sett. e Mese (regole del 19/10/2026) ---
// % = (P + R) / (P + R + A), solo sulle sedute con l'appello fatto. R è
// una presenza, G non entra nel conto. Denominatore zero: nessuna
// percentuale ("—"), non 0%. Sett. è la settimana da lunedì a domenica
// che contiene oggi; Mese è il mese di calendario. Prima erano gli
// ultimi 7 e 30 giorni, con G contato come presenza (v_frequenza).
{
  const D = await import('./src/lib/dominio.js');
  const servono = ['frequenzaAppello', 'periodoFrequenza'];
  const mancano = servono.filter((f) => typeof D[f] !== 'function');
  if (mancano.length) {
    male++; console.error(`✗ frequenza: mancano in dominio.js ${mancano.join(', ')}`);
  } else {
    const p = (data, stato, atleta_id = 'x') => ({ atleta_id, seduta_id: `${data}-${atleta_id}`, data, stato });
    const di = (presenze, oggi, atleta = 'x') => D.frequenzaAppello(presenze, oggi)[atleta];

    // Lunedì mattina, nessun appello ancora: "—", non 0%. La settimana
    // prima non conta, anche se è a un giorno di distanza.
    const lunedi = di([p('2026-10-16', 'P'), p('2026-10-18', 'A')], '2026-10-19');
    dice('lunedì senza appelli: settimana senza percentuale', lunedi?.sett.pct ?? null, null);
    dice('lunedì: il mese però c\'è', lunedi?.mese.pct, 50);

    // Settimana a metà: lunedì P, martedì A, mercoledì R → 2 su 3.
    // La domenica prima (A) è negli ultimi 7 giorni ma non in settimana.
    const meta = di([p('2026-10-18', 'A'), p('2026-10-19', 'P'), p('2026-10-20', 'A'), p('2026-10-21', 'R')], '2026-10-21');
    dice('settimana a metà: 67%', meta?.sett.pct, 67);
    dice('settimana a metà: i conti', [meta?.sett.p, meta?.sett.r, meta?.sett.a], [1, 1, 1]);

    // G non conta: né sopra né sotto.
    dice('G non conta', di([p('2026-10-19', 'P'), p('2026-10-20', 'G')], '2026-10-21')?.sett.pct, 100);
    dice('solo G: nessuna percentuale', di([p('2026-10-19', 'G')], '2026-10-21')?.sett.pct ?? null, null);

    // R conta come presenza.
    dice('R conta', di([p('2026-10-19', 'R'), p('2026-10-20', 'R'), p('2026-10-21', 'A')], '2026-10-21')?.sett.pct, 67);

    // Fine mese: domenica 1 novembre. La settimana parte lunedì 26
    // ottobre e prende anche ottobre; il mese è solo novembre.
    const fine = di([p('2026-10-27', 'P'), p('2026-10-29', 'A'), p('2026-11-01', 'P')], '2026-11-01');
    dice('fine mese: la settimana scavalca il mese', fine?.sett.pct, 67);
    dice('fine mese: il mese è solo novembre', fine?.mese.pct, 100);
    // L'ultimo del mese è dentro il mese.
    dice('ultimo giorno del mese incluso',
      di([p('2026-10-01', 'A'), p('2026-10-31', 'P')], '2026-10-31')?.mese.pct, 50);

    // Ogni atleta per sé.
    const due = D.frequenzaAppello([p('2026-10-19', 'P', 'a'), p('2026-10-19', 'A', 'b')], '2026-10-21');
    dice('ogni atleta per sé', [due.a.sett.pct, due.b.sett.pct], [100, 0]);

    // Il periodo da leggere: tutto quello che serve a Sett. e Mese.
    dice('periodo: fine mese, dal lunedì di ottobre alla fine di novembre',
      D.periodoFrequenza('2026-11-01'), { da: '2026-10-26', a: '2026-11-30' });
    dice('periodo: a metà mese, il mese intero',
      D.periodoFrequenza('2026-10-21'), { da: '2026-10-01', a: '2026-10-31' });
    dice('periodo: febbraio bisestile', D.periodoFrequenza('2028-02-15'), { da: '2028-02-01', a: '2028-02-29' });
  }

  // --- la stessa regola su un periodo qualunque: Volumi ---
  // Volumi sceglie il periodo (settimana, mese, intervallo, stagione) e
  // la frequenza per atleta deve contare come l'Appello: la stessa
  // funzione, non una copia — due regole scritte in due posti divergono.
  if (typeof D.frequenzaNelPeriodo !== 'function') {
    male++; console.error('✗ frequenza: manca in dominio.js frequenzaNelPeriodo');
  } else {
    const p = (data, stato, atleta_id = 'x') => ({ atleta_id, data, stato });
    const righe = [
      p('2026-09-30', 'A'),                       // fuori dal periodo
      p('2026-10-05', 'P'), p('2026-10-06', 'R'), p('2026-10-07', 'G'), p('2026-10-08', 'A'),
      p('2026-10-31', 'P'),                       // ultimo giorno, dentro
      p('2026-11-01', 'A'),                       // fuori dal periodo
    ];
    const ottobre = D.frequenzaNelPeriodo(righe, { da: '2026-10-01', a: '2026-10-31' }).x;
    dice('periodo: P, R, P su P, R, P, A — G fuori', [ottobre.p, ottobre.r, ottobre.g, ottobre.a, ottobre.pct], [2, 1, 1, 1, 75]);
    // Senza limiti: tutte le righe che arrivano (Volumi le passa già
    // filtrate sul periodo scelto).
    const tutte = D.frequenzaNelPeriodo(righe).x;
    dice('periodo senza limiti: tutte le righe', [tutte.a, tutte.pct], [3, 50]);
    dice('periodo: solo G, nessuna percentuale',
      D.frequenzaNelPeriodo([p('2026-10-07', 'G')]).x.pct, null);
    // L'Appello è la stessa funzione, due volte.
    const oggi = '2026-10-21';
    const app = D.frequenzaAppello(righe, oggi).x;
    const settimana = D.frequenzaNelPeriodo(righe, { da: '2026-10-19', a: '2026-10-25' }).x;
    // Il mese si conta fino a oggi, come nel report (21/10/2026): la P
    // del 31 è nel futuro e non entra.
    const mese = D.frequenzaNelPeriodo(righe, { da: '2026-10-01', a: '2026-10-21' }).x;
    dice('Appello = frequenzaNelPeriodo sulla settimana', app.sett, settimana ?? { p: 0, r: 0, g: 0, a: 0, pct: null });
    dice('Appello = frequenzaNelPeriodo sul mese, fino a oggi', app.mese, mese);
    dice('Appello: un giorno futuro del mese non conta', [app.mese.p, app.mese.pct], [1, 67]);

    // Anche la settimana si conta fino a oggi (21/10/2026): mercoledì 21,
    // la A di giovedì 22 segnata in anticipo non entra.
    const settFutura = D.frequenzaAppello(
      [p('2026-10-19', 'P'), p('2026-10-21', 'P'), p('2026-10-22', 'A')], '2026-10-21').x.sett;
    dice('Appello: un giorno futuro della settimana non conta', [settFutura.a, settFutura.pct], [0, 100]);

    // Una regola sola: la colonna Mese dell'Appello e il report mensile
    // dicono lo stesso numero, sugli stessi dati.
    if (typeof D.reportMensile === 'function') {
      const conSeduta = righe.map((x, i) => ({ ...x, seduta_id: `s${i}` }));
      const rep = D.reportMensile({ mese: '2026-10', oggi, atleti: [{ id: 'x', cognome: 'X' }], presenze: conSeduta });
      dice('Appello e report mensile: la stessa percentuale', app.mese.pct, rep.righe[0].frequenza.pct);
      dice('Appello e report mensile: gli stessi conti',
        [app.mese.p, app.mese.r, app.mese.g, app.mese.a],
        [rep.righe[0].frequenza.p, rep.righe[0].frequenza.r, rep.righe[0].frequenza.g, rep.righe[0].frequenza.a]);
    }
    if (typeof D.finoAOggi !== 'function') {
      male++; console.error('✗ frequenza: manca in dominio.js finoAOggi, la regola del "fino a oggi"');
    } else {
      dice('finoAOggi: il mese in corso si ferma a oggi',
        D.finoAOggi({ da: '2026-10-01', a: '2026-10-31' }, '2026-10-21'), { da: '2026-10-01', a: '2026-10-21' });
      dice('finoAOggi: un mese passato resta intero',
        D.finoAOggi({ da: '2026-09-01', a: '2026-09-30' }, '2026-10-21'), { da: '2026-09-01', a: '2026-09-30' });
    }
  }

  // --- il report presenze (deciso il 19/10/2026): giornaliero, mensile,
  // stagione. Stessa regola di frequenzaNelPeriodo, filtro per gruppo
  // con atletaNelGruppo, giorni e mesi futuri vuoti. ---
  {
    const servono = ['reportGiornaliero', 'reportMensile', 'reportStagione', 'nomeFileReport'];
    const mancano = servono.filter((f) => typeof D[f] !== 'function');
    if (mancano.length) {
      male++; console.error(`✗ report: mancano in dominio.js ${mancano.join(', ')}`);
    } else {
      // Tre atleti degli Esordienti A, uno dei Ragazzi (fuori dal gruppo).
      const atleti = [
        { id: 'v', cognome: 'Verdi', nome: 'Anna', categoria_override: 'ESO_A1' },
        { id: 'b', cognome: 'Bianchi', nome: 'Luca', categoria_override: 'ESO_A2' },
        { id: 'r', cognome: 'Rossi', nome: 'Marta', categoria_override: 'ESO_A1' },
        { id: 'g', cognome: 'Gialli', nome: 'Piero', categoria_override: 'RAG_1' },
      ];
      const codici = D.codiciDelGruppo(['Esordienti A']);
      const s = (id, data, created_at = `${data}T07:00:00+00:00`, extra = {}) => ({ id, data, created_at, titolo: id, ...extra });
      const pr = (seduta_id, atleta_id, stato, data) => ({ seduta_id, atleta_id, stato, data });
      const vuoto = { p: 0, r: 0, g: 0, a: 0, pct: null };

      // ---- giornaliero ----
      const seduta = s('s1', '2026-10-20');
      const gio = D.reportGiornaliero({
        seduta, atleti, codici,
        presenze: [pr('s1', 'v', 'P', '2026-10-20'), pr('s1', 'b', 'A', '2026-10-20'), pr('s1', 'g', 'P', '2026-10-20'),
          pr('altra', 'r', 'P', '2026-10-20')],
      });
      dice('giornaliero: il gruppo, in ordine di cognome',
        gio.righe.map((x) => [x.cognome, x.stato]), [['Bianchi', 'A'], ['Rossi', null], ['Verdi', 'P']]);
      dice('giornaliero: il conto dei presenti', [gio.presenti, gio.conti.a, gio.conti.nonRilevati, gio.conti.pct], [1, 1, 1, 50]);
      // La doppia: l'elenco della seduta vince sul gruppo, come in Appello.
      const doppia = D.reportGiornaliero({ seduta: { ...seduta, atleti: ['v', 'g'] }, atleti, codici, presenze: [] });
      dice('giornaliero: la seduta per pochi vince sul gruppo', doppia.righe.map((x) => x.id ?? x.atleta_id), ['g', 'v']);
      dice('giornaliero: nessun rilevato, nessuna percentuale', doppia.conti.pct, null);

      // ---- mensile: ottobre 2026, oggi il 21 ----
      const sedute = [
        s('m1', '2026-10-05'), s('m2', '2026-10-12'), s('m3', '2026-10-15'),
        // due sedute il 20: mattina e pomeriggio
        s('m4am', '2026-10-20', '2026-10-20T06:00:00+00:00'), s('m4pm', '2026-10-20', '2026-10-20T15:00:00+00:00'),
        s('m5', '2026-10-23'),                         // futura
      ];
      const presenze = [
        // Verdi: P, A, P, e il 20 pomeriggio A — scritte in disordine
        pr('m4pm', 'v', 'A', '2026-10-20'), pr('m1', 'v', 'P', '2026-10-05'),
        pr('m2', 'v', 'A', '2026-10-12'), pr('m4am', 'v', 'P', '2026-10-20'),
        // un G segnato in anticipo per il 23: il giorno è futuro
        pr('m5', 'v', 'G', '2026-10-23'),
        // Bianchi: solo giustificati
        pr('m1', 'b', 'G', '2026-10-05'), pr('m2', 'b', 'G', '2026-10-12'),
        // Rossi: entrata il 15, prima non c'era
        pr('m3', 'r', 'P', '2026-10-15'), pr('m4am', 'r', 'P', '2026-10-20'), pr('m4pm', 'r', 'A', '2026-10-20'),
        // Gialli: fuori dal gruppo
        pr('m1', 'g', 'P', '2026-10-05'),
      ];
      const mese = D.reportMensile({ mese: '2026-10', oggi: '2026-10-21', atleti, codici, sedute, presenze });
      const riga = (id) => mese.righe.find((x) => x.atleta_id === id);
      const casella = (id, giorno) => riga(id).caselle[giorno - 1];

      dice('mensile: 31 giorni', mese.giorni.length, 31);
      dice('mensile: dal 22 i giorni sono futuri',
        [mese.giorni[20].futuro, mese.giorni[21].futuro, mese.giorni[30].futuro], [false, true, true]);
      dice('mensile: solo il gruppo, in ordine di cognome', mese.righe.map((x) => x.cognome), ['Bianchi', 'Rossi', 'Verdi']);

      // Mese con giorni futuri: la casella futura è vuota anche con un
      // G già segnato, e la percentuale non lo guarda.
      dice('mensile: giorno futuro vuoto', casella('v', 23), null);
      dice('mensile: un giorno passato senza appello è vuoto ma non futuro', casella('v', 6), []);
      // Due sedute nello stesso giorno: tutti e due gli stati, in ordine
      // di creazione delle sedute (mattina, poi pomeriggio).
      dice('mensile: due sedute il 20, in ordine', casella('v', 20), ['P', 'A']);
      dice('mensile: e tutte e due contano', [riga('v').frequenza.p, riga('v').frequenza.a, riga('v').frequenza.pct], [2, 2, 50]);
      // Solo G: le caselle li mostrano, la percentuale non c'è.
      dice('mensile: solo G, le caselle', [casella('b', 5), casella('b', 12)], [['G'], ['G']]);
      dice('mensile: solo G, nessuna percentuale', riga('b').frequenza.pct, null);
      // Entrata a metà mese: prima del 15 niente, e la percentuale è
      // sulle sue sedute, non abbassata dai giorni in cui non c'era.
      dice('mensile: entrata il 15, prima vuoto', [casella('r', 5), casella('r', 12)], [[], []]);
      dice('mensile: entrata il 15, 2 su 3', riga('r').frequenza.pct, 67);

      // ---- stagione 2026/27, oggi il 15 gennaio 2027: scavalca l'anno ----
      const presenzeStagione = [
        pr('a', 'v', 'P', '2026-09-10'), pr('b', 'v', 'A', '2026-09-17'),
        pr('c', 'v', 'P', '2026-12-18'),
        pr('d', 'v', 'P', '2027-01-08'), pr('e', 'v', 'A', '2027-01-20'),   // il 20 è futuro
        pr('f', 'v', 'P', '2026-08-31'),                                    // stagione prima
        pr('a', 'b', 'G', '2026-09-10'),
      ];
      const st = D.reportStagione({ stagione: '2026/27', oggi: '2027-01-15', atleti, codici, presenze: presenzeStagione });
      dice('stagione: dodici mesi, da settembre ad agosto',
        [st.mesi.length, st.mesi[0].mese, st.mesi[3].mese, st.mesi[4].mese, st.mesi[11].mese],
        [12, '2026-09', '2026-12', '2027-01', '2027-08']);
      dice('stagione: dopo gennaio i mesi sono futuri',
        [st.mesi[4].futuro, st.mesi[5].futuro], [false, true]);
      const sv = st.righe.find((x) => x.atleta_id === 'v');
      dice('stagione: settembre 50, ottobre senza appelli, dicembre 100, gennaio fino a oggi 100',
        [sv.mesi[0].pct, sv.mesi[1].pct, sv.mesi[3].pct, sv.mesi[4].pct], [50, null, 100, 100]);
      dice('stagione: i mesi futuri sono vuoti', sv.mesi[5], null);
      dice('stagione: il totale, da settembre a oggi', [sv.totale.p, sv.totale.a, sv.totale.pct], [3, 1, 75]);
      const sb = st.righe.find((x) => x.atleta_id === 'b');
      dice('stagione: solo G, totale senza percentuale', sb.totale.pct, null);
      dice('stagione: un mese senza niente ha i conti a zero', sv.mesi[1], vuoto);

      // ---- gli archiviati (21/10/2026) ----
      // Entrano nel report solo se hanno almeno una rilevazione nel
      // periodo scelto (fino a oggi), segnati come archiviati. Gli altri
      // archiviati no: un elenco di nomi senza niente accanto non serve.
      {
        const conArchiviati = [
          ...atleti,
          { id: 'z', cognome: 'Zeta', nome: 'Ugo', categoria_override: 'ESO_A1', attivo: false },
          { id: 'k', cognome: 'Kappa', nome: 'Ivo', categoria_override: 'ESO_A2', attivo: false },
          { id: 'f', cognome: 'Effe', nome: 'Lia', categoria_override: 'ESO_A1', attivo: false },
        ];
        const pres = [
          pr('m1', 'z', 'P', '2026-10-05'), pr('m2', 'z', 'A', '2026-10-12'),   // Zeta: c'era a ottobre
          pr('x', 'k', 'P', '2026-09-20'),                                       // Kappa: solo a settembre
          pr('m5', 'f', 'G', '2026-10-23'),                                      // Effe: solo un giorno futuro
        ];
        const m = D.reportMensile({ mese: '2026-10', oggi: '2026-10-21', atleti: conArchiviati, codici, sedute, presenze: pres });
        dice('archiviati: entra chi ha una presenza nel mese, gli altri no',
          m.righe.map((x) => x.cognome), ['Bianchi', 'Rossi', 'Verdi', 'Zeta']);
        dice('archiviati: segnato come archiviato',
          m.righe.map((x) => x.archiviato), [false, false, false, true]);
        dice('archiviati: e la sua percentuale c\'è', m.righe[3].frequenza.pct, 50);
        // Il giorno futuro non è "una presenza nel periodo": Effe resta fuori.
        dice('archiviati: un giorno futuro non basta', m.righe.some((x) => x.atleta_id === 'f'), false);

        // Stagione: Kappa c'era a settembre, quindi entra.
        const st2 = D.reportStagione({ stagione: '2026/27', oggi: '2026-10-21', atleti: conArchiviati, codici, presenze: pres });
        dice('archiviati: nella stagione entra chi c\'era in un mese qualunque',
          st2.righe.filter((x) => x.archiviato).map((x) => x.cognome), ['Kappa', 'Zeta']);

        // Giornaliero: solo chi è stato segnato in quella seduta.
        const g2 = D.reportGiornaliero({ seduta: s('m1', '2026-10-05'), atleti: conArchiviati, codici, presenze: pres });
        dice('archiviati: nel giornaliero chi è stato segnato quel giorno',
          g2.righe.filter((x) => x.archiviato).map((x) => x.cognome), ['Zeta']);
        // Un archiviato fuori dal gruppo resta fuori anche con le presenze.
        const fuori = D.reportMensile({
          mese: '2026-10', oggi: '2026-10-21', codici, sedute,
          atleti: [{ id: 'q', cognome: 'Qu', nome: 'Ada', categoria_override: 'RAG_1', attivo: false }],
          presenze: [pr('m1', 'q', 'P', '2026-10-05')],
        });
        dice('archiviati: fuori dal gruppo resta fuori', fuori.righe, []);
      }

      // ---- il nome del file ----
      // Dal 23/10/2026 come la seduta: prima il gruppo, poi il periodo,
      // con le date come nel nome della seduta (GG-MM-AA, MM-AA) e la
      // stagione col trattino.
      dice('nome file: mensile', D.nomeFileReport({ periodo: '2026-10', gruppi: ['Esordienti A'] }),
        'CorsiaPro_Presenze_EsordientiA_10-26');
      dice('nome file: stagione, senza la barra', D.nomeFileReport({ periodo: '2026/27', gruppi: ['Esordienti A'] }),
        'CorsiaPro_Presenze_EsordientiA_2026-27');
      dice('nome file: giornaliero, due gruppi', D.nomeFileReport({ periodo: '2026-10-20', gruppi: ['Esordienti A', 'Esordienti B'] }),
        'CorsiaPro_Presenze_EsordientiA-EsordientiB_20-10-26');
      dice('nome file: tutte le categorie', D.nomeFileReport({ periodo: '2026-10', gruppi: [] }),
        'CorsiaPro_Presenze_Tutti_10-26');
      dice('nome file: gennaio, a due cifre', D.nomeFileReport({ periodo: '2027-01', gruppi: ['Ragazzi'] }),
        'CorsiaPro_Presenze_Ragazzi_01-27');
      dice('nome file: giorno a una cifra', D.nomeFileReport({ periodo: '2027-01-05', gruppi: ['Ragazzi'] }),
        'CorsiaPro_Presenze_Ragazzi_05-01-27');
    }
  }

  // Volumi non deve contare per conto suo: la guardia sta sul sorgente,
  // perché il conto sta dentro un componente React che qui non si monta.
  const { readFileSync } = await import('node:fs');
  const volumi = readFileSync('./src/componenti/Volumi.jsx', 'utf8');
  if (!/frequenzaNelPeriodo/.test(volumi)) {
    male++; console.error('✗ frequenza: Volumi.jsx non usa frequenzaNelPeriodo');
  }
  if (/\['P',\s*'R',\s*'G'\]/.test(volumi)) {
    male++; console.error('✗ frequenza: Volumi.jsx conta ancora G fra le presenze, per conto suo');
  }
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ stagioni e fasce: tutte le prove passate');
