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
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ stagioni e fasce: tutte le prove passate');
