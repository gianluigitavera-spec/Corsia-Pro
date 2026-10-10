// Prove dell'analizzatore, prese dal foglio vero degli allenamenti.
// Non sono casi inventati: ogni riga qui sotto è scritta come la scrive
// il coach. Girano prima di ogni build, come controlla_import.mjs.
//
// Se cambi una regola dell'analizzatore e uno di questi salta, non hai
// rotto un test: hai cambiato il significato di una riga che lui usa
// davvero.
import { analizzaTesto } from './src/lib/analizzatore.js';
import {
  metriPerSpecializzazione, durataStimata, metriDaNotazione,
  normalizzaRecupero, ripartenzaDaBase,
} from './src/lib/dominio.js';

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

  // --- il titolo di sezione chiude il blocco ---
  // Un "3x" scritto sopra continuava a moltiplicare oltre il titolo:
  // "Sciolto / 200" faceva 600. La riga vuota chiudeva il blocco, il
  // titolo no — ma a bordo vasca il titolo si scrive di seguito.
  // I primi tre titoli sono quelli che sbagliavano (Riscaldamento,
  // Sciolto/defaticamento, [main]); gli altri erano già a posto e
  // devono restarci: la correzione toglie da loro la riga che li
  // salvava, e la sposta in un punto solo.
  ['3x\n8x50 B1\nSciolto\n200', 1400, 'lo sciolto dopo un blocco non si moltiplica'],
  ['3x\n8x50 B1\nDefaticamento\n200', 1400, 'stessa cosa scritta "defaticamento"'],
  ['3x\n8x50 B1\nRiscaldamento\n200', 1400, 'il riscaldamento dopo un blocco nemmeno'],
  ['3x\n8x50 B1\n[main]\n200', 1400, '[main] chiude il blocco come gli altri titoli'],
  ['3x\n8x50 B1\nVelocisti\n200', 1400, 'i destinatari lo chiudevano già: resta così'],
  ['3x\n8x50 B1\nB1\n200', 1400, 'e una riga di sola zona pure'],
  ['3x\n8x50 B1\n\nSciolto\n200', 1400, 'con la riga vuota prima, come ha sempre funzionato'],
  // Il blocco nuovo riparte da capo: 100 x2 = 200, non 100 x6.
  ['3x\n8x50 B1\nSciolto\n2x\n100', 1400, 'un blocco nuovo dopo il titolo parte pulito'],

  // --- la somma a cui segue dell'altro (DIFETTO APERTO) ---
  // Dalla seduta "Tecnica DO C3+A2" del 30/09. Una somma di tratti secchi
  // con uno stile, una zona o un recupero in coda perde l'ULTIMO termine:
  // il pezzo "25 DO" è un numero secco con del testo dietro, e
  // sommaInTesta si ferma prima di contarlo. Senza la coda la stessa riga
  // fa 250.
  ['100+75+50+25 DO', 250, 'somma di tratti secchi con lo stile in coda'],
  ['100+75+50+25 C3', 250, 'la stessa somma con la zona in coda'],
  ['100+75+50+25 @2:00', 250, 'e con la ripartenza in coda'],
  ['100+75+50+25', 250, 'senza coda invece funziona già'],
  // La riga come sta nel foglio, con passo base, stile e descrizione.
  ['100+75+50+25 @@40" DO aumentando velocità', 250, 'la riga vera del 30/09'],
  // Le due guardie: un tratto secco seguito da una descrizione fatta di
  // venticinque non deve diventare una scaletta.
  ['100 + 25 remate 25 completo 25gb 25 ps', 100, 'tratto secco e poi descrizione a venticinque'],
  ['200+50 gambe', 250, 'scaletta corta con la coda'],
  ['100+75+50+25 DO al 75%', 250, 'la percentuale non è una misura'],
  ['100+75+50+25 DO resp 3-5', 250, 'i numeri della respirazione non sono misure'],
  ['100+75+50+25 2SL 2DO', 250, 'né le vasche per stile'],
  ['200+50 gambe Progr 1-4', 250, 'né la progressione'],

  // --- una riga, una andatura ---
  ['8x50 A2 + 4x25 C1', 500, 'due andature: si spezza e i metri non si perdono'],
  ['4x(8x50 B1 + 4x50 B2)', 2400, 'blocco con due andature dentro'],
  ['2x(4x50 SL + 100 B1)', 600, 'una zona sola: resta una riga'],
  // --- il tratto secco dopo un set, dall'archivio vero ---
  // Il riscaldamento scritto di seguito: un set, poi un tratto, poi un
  // altro set. Il tratto dopo un set è lavoro in più, e per contarlo
  // comanda il FATTORE del termine prima, non il posto del pezzo.
  ['200 sl + 4x50 vv + 100 sl', 500, 'tratto secco dopo un set'],
  ['4x100 sl + 400 gambe tav bocc', 800, 'set e poi un 400 di gambe'],
  ['2x100sl+100 Ra+100gb do+100mx', 500, 'tutto attaccato allo stile'],
  ['2x(3x50 sl+100gb)+100 sciolto', 600, 'gruppo col moltiplicatore, poi lo sciolto'],
  ['6x100 + 100 sl', 700, 'il cento dopo il set è un cento in più'],
  // Il "2x" in testa NON distribuisce sulla somma: vale sul suo 100 e
  // basta, come nella riga qui sopra con le quattro ripetute. Se un
  // giorno distribuisse, questa riga farebbe 600 e quella 800.
  ['2x100 sl+100 mix+ 4x25 GB mix', 400, 'il 2x in testa non si spande sui termini dopo'],
  // Un termine che vale UNA ripetuta sola non è un set: il numero dietro
  // lo ripete e lo descrive. Vale col 1x scritto a mano e col gruppo
  // nudo, che moltiplica per uno.
  ['(3x25) + (1x75) Remate DO + 75 DO completo', 150, 'gruppi nudi: la coda descrive'],
  ['3x25 + 75 DO completo', 150, 'dopo un set da tre, invece, il tratto conta'],
  // La distanza attaccata allo stile: fra cifra e lettera non c'è
  // confine di parola, e questi valevano zero.
  ['2x(4x50gb + 100)', 600, 'NxD attaccato allo stile dentro un gruppo'],
  ['50gb', 50, 'la distanza attaccata allo stile, da sola'],
  // Il decimale non è un tratto in più: "12,5" è mezza vasca scritta a
  // mano, cioè il modo in cui si fa il 25.
  ['8x50 + 12,5 RA', 400, 'la mezza vasca in coda non aggiunge metri'],
  ['12,5 RA', 25, 'ma da sola resta mezza vasca, e la vasca si finisce'],
];

let male = 0;

// =====================================================================
// CASI ROSSI — le righe del riscaldamento scritte con gli stili attaccati
// =====================================================================
// Sette righe prese dal foglio, tutte della stessa forma: una somma di
// tratti dove OGNI termine porta dietro lo stile, l'attrezzo o
// l'andatura. Qui i due lettori sbagliano in punti diversi, e per
// ragioni diverse: per questo si provano entrambi sulla stessa riga.
//
// I due lettori NON sono interscambiabili. `analizzaTesto` legge il testo
// libero (import, foto) e applica la regola della vasca; `metriDaNotazione`
// rilegge la notazione dentro l'editor e non la applica. Qui tutte le
// distanze sono >= 25, quindi l'atteso è lo stesso per i due e le
// differenze sono difetti, non convenzioni.
//
// Le tre cause, per non ricorrerci sopra una per volta:
//
// 1. `sommaInTesta` scarta il PRIMO termine se ha del testo dietro
//    ("400 sl"), per via della guardia `quanti > 0` che tiene fuori
//    "300 stile". Risultato: la somma non parte e resta il primo numero.
// 2. `sommaInTesta` conta il termine con la coda e poi `break` (il
//    `if (m.resto) break;` in fondo al ciclo): tutto quello che viene
//    dopo si perde, anche quando è un set pulito.
// 3. In `metriDaNotazione` la ripulitura tiene la "x" di QUALSIASI
//    parola: "mix", "max", "mx" lasciano una x parassita nella stringa,
//    e l'espressione diventa illeggibile (null) o si tronca.
//
// E una quarta, dentro i gruppi: `valoreDelPezzo` cerca la distanza con
// `/^(\d{2,4})\b/`, ma fra cifra e lettera non c'è confine di parola,
// quindi "50gb" e "50sl" valgono ZERO.
const rossi = [
  ['400 sl + 200 mix + 4x50 gambe', 800,
   'stile sul primo tratto (causa 1) + coda che taglia (2) + x di "mix" (3)'],
  ['400 sl + 4x100 mx drills + 4x50 prog interna', 1000,
   'stile sul primo tratto (1), coda che taglia (2), x di "mx" (3)'],
  ['200 sl + 200 pull + 4x50 mix + 4x25 prog', 700,
   'quattro termini, ne arriva uno (1 e 2); x di "mix" (3)'],
  ['100 sl + 100 rana', 200,
   'la somma più corta possibile: basta lo stile sul primo (1)'],
  ['100 sl + 4x25 Ra', 200,
   'stile sul primo (1): il set dopo non viene nemmeno guardato'],
  ['3x(4x25 sl max + 100 easy + pausa)', 600,
   'analizzaTesto ci arriva; metriDaNotazione no, per la x di "max" (3)'],
  ['2x(100 GB mix+50 do+50gb sl+50sl)', 500,
   '"50gb" e "50sl" valgono zero nel gruppo (4); più la x di "mix" (3)'],
];

for (const [testo, atteso, cosa] of rossi) {
  const letti = analizzaTesto(testo).metri;
  const daNotazione = metriDaNotazione(testo);
  if (letti !== atteso || daNotazione !== atteso) {
    male++;
    console.error(`✗ ROSSO: ${cosa}`);
    console.error(`  "${testo}"`);
    console.error(`  attesi ${atteso} m — analizzaTesto ${letti}, metriDaNotazione ${daNotazione}`);
  }
}

// --- il tratto scartato si racconta ---
// Quando il termine prima vale una ripetuta sola, il tratto in coda non
// entra nei metri: "3x25 + 1x75 Remate DO + 75 DO completo" resta 150.
// È una convenzione, non una certezza — la stessa riga con "3x25 + 75"
// fa 150 contando il tratto — quindi la riga deve DIRLO, con i metri che
// non sono entrati. Senza la nota quel 75 scompare e non c'è modo di
// dare torto alla lettura rileggendo il revisore.
const conScarto = analizzaTesto('3x25 + 1x75 Remate DO + 75 DO completo').sezioni[0].serie[0];
if (conScarto.metri !== 150) {
  male++;
  console.error(`✗ il tratto dopo una ripetuta sola non va contato: 150 m attesi, ${conScarto.metri}`);
}
if (!/tratto non contato: 75 m/.test(conScarto.note || '')) {
  male++;
  console.error(`✗ la riga doveva dire i metri scartati, la nota dice "${conScarto.note || ''}"`);
}

// La stessa nota sull'altra strada: qui la somma non scatta nemmeno (un
// termine contato solo), e la riga passa dalla regola della misura in
// testa. Se la nota stesse in un ramo solo, metà dei casi tacerebbe.
const scartoInTesta = analizzaTesto('1x75 Remate DO + 75 DO completo').sezioni[0].serie[0];
if (scartoInTesta.metri !== 75 || !/tratto non contato: 75 m/.test(scartoInTesta.note || '')) {
  male++;
  console.error(`✗ "1x75 Remate DO + 75 DO completo": ${scartoInTesta.metri} m, nota "${scartoInTesta.note || ''}"`);
}

// E l'avviso deve restare raro, o si impara a saltarlo: una riga che non
// scarta niente non lo porta, e nemmeno la riga di composizione, dove la
// coda con dentro altre misure è descrizione evidente.
for (const testo of ['6x100 + 100 sl', '100 + 25 remate 25 completo 25gb 25 ps']) {
  const r = analizzaTesto(testo).sezioni[0].serie[0];
  if (/tratto non contato/.test(r.note || '')) {
    male++;
    console.error(`✗ "${testo}" non scarta niente ma la nota dice "${r.note}"`);
  }
}

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

// --- la sezione a secco non fa metri, per tutte le sue righe ---
// Il caso che sbagliava: "Palestra" apriva una sezione qualunque e
// "4x12 ripetizioni" sotto faceva 100 metri (4×12, col 12 portato a 25
// dalla regola della vasca). Lavoro a terra contato come nuotato.
const secco = analizzaTesto('Palestra\n4x12 ripetizioni\n3x10 trazioni').sezioni[0];
if (!secco?.aSecco) {
  male++;
  console.error('✗ "Palestra" come titolo deve marcare la sezione come lavoro a secco');
}
const metriSecchi = (secco?.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0);
if (metriSecchi !== 0) {
  male++;
  console.error(`✗ la sezione a secco doveva fare 0 metri, ne ha fatti ${metriSecchi}`);
}
if ((secco?.serie || []).some((s) => s.zona)) {
  male++;
  console.error('✗ le righe a secco non devono prendere nessuna zona');
}

for (const titolo of ['Dryland', 'Secco', 'Pre-vasca', 'Lavoro a secco']) {
  const s = analizzaTesto(`${titolo}\n4x12 ripetizioni`).sezioni[0];
  const m = (s?.serie || []).reduce((t, r) => t + (Number(r.metri) || 0), 0);
  if (!s?.aSecco || m !== 0) {
    male++;
    console.error(`✗ "${titolo}" doveva aprire una sezione a secco da 0 metri, invece ${m} m`);
  }
}

// Dopo il secco si torna in acqua: la sezione seguente conta di nuovo.
const dopoIlSecco = analizzaTesto('Palestra\n3x10 trazioni\nParte centrale\n8x100').sezioni;
const inAcqua = dopoIlSecco[dopoIlSecco.length - 1];
if (inAcqua?.aSecco) {
  male++;
  console.error('✗ il secco non deve contagiare la sezione dopo');
}
if ((inAcqua?.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0) !== 800) {
  male++;
  console.error('✗ dopo la sezione a secco i metri devono tornare a contare (8x100 = 800)');
}

// E i conti del dominio la saltano: è lì che i metri finirebbero nei grafici.
if (metriPerSpecializzazione(dopoIlSecco, 'Generale') !== 800) {
  male++;
  console.error('✗ metriPerSpecializzazione deve ignorare la sezione a secco');
}
// La durata invece la conta, coi minuti scritti a mano.
const conMinuti = [{ titolo: 'Palestra', aSecco: true, durataMin: 30, serie: [] }];
if (durataStimata(conMinuti).secondi !== 1800) {
  male++;
  console.error('✗ i minuti della sezione a secco devono entrare nella durata stimata');
}

// =====================================================================
// LE DUE STRADE, UN NUMERO SOLO
// =====================================================================
// analizzaTesto legge il testo, metriDaNotazione legge il campo notazione
// dell'editor: due strade, una lettura. Dal passo del lettore unico sono
// la stessa funzione, e questa prova lo tiene fermo riga per riga su
// tutta la tabella — se qualcuno rimette una lettura sua da una parte,
// qui diventa rosso.
//
// Le divergenze che restano sono quattro, e sono VOLUTE: nessuna riguarda
// la notazione, tutte il contesto, che il lettore di una riga non ha e
// non deve avere. Stanno scritte qui una per una col motivo, perché una
// divergenza nuova deve far rumore e non nascondersi in mezzo a loro.
const DIVERGENZE_VOLUTE = [
  ['Partenze dal blocco',
   'non ho capito: in lettura diventa una riga a zero da rivedere, '
   + "nell'editor un null che lascia stare i metri scritti"],
  ['Mx 4x(1GB max sub 1Dx 1Sx 1c)',
   'stessa famiglia: parentesi di sola descrizione, nessuna misura dentro'],
  ['Secco: 3x10 plank',
   'lavoro a secco: lo decide la parola (A_SECCO) o il titolo della '
   + "sezione, e nell'editor il campo aSecco. Il lettore di riga ci "
   + 'legge 75 metri, ed è giusto che li legga: non sa dove sta'],
  ['Lun 12/10/2025',
   "la data è l'intestazione della seduta, non una serie: lo decide il "
   + 'ciclo del testo, che ne fa un avviso e nessuna riga'],
];

{
  const righeSingole = [...prove, ...rossi].filter(([t]) => !t.includes('\n'));
  const volute = new Map(DIVERGENZE_VOLUTE);

  for (const [testo] of righeSingole) {
    const dalTesto = analizzaTesto(testo).metri;
    const dallaNotazione = metriDaNotazione(testo);
    if (volute.has(testo)) {
      if (dalTesto === dallaNotazione) {
        male++;
        console.error(`✗ la divergenza voluta su "${testo}" non c'è più (${dalTesto} m da entrambe): togli la voce da DIVERGENZE_VOLUTE`);
      }
      continue;
    }
    if (dalTesto !== dallaNotazione) {
      male++;
      console.error(`✗ le due strade divergono su "${testo}": testo ${dalTesto} m, notazione ${dallaNotazione}`);
      console.error('  se la divergenza è voluta va dichiarata in DIVERGENZE_VOLUTE, col motivo');
    }
  }

  // Una voce dichiarata su una riga che non è in tabella è un filtro che
  // non filtra niente: la prova dice tutto verde e non controlla nulla.
  for (const [testo] of DIVERGENZE_VOLUTE) {
    if (!righeSingole.some(([t]) => t === testo)) {
      male++;
      console.error(`✗ "${testo}" è dichiarata fra le divergenze volute ma non sta in tabella`);
    }
  }
}

// =====================================================================
// GLI APICI DEL TABLET
// =====================================================================
// Dal campo: su tablet "@1’45" e "@5’" non vengono letti e bisogna
// scrivere "@5.0". La tastiera non mette l'apostrofo dritto: con la
// punteggiatura intelligente di iOS mette la virgoletta curva, e a
// seconda del layout arrivano anche l'apice tipografico, l'accento grave
// e quello acuto. Per chi scrive sono tutti "minuti"; per le regex no.
//
// Non è un difetto di un lettore: di lettori di tempo ce ne sono SETTE
// (normalizzaRecupero, secondiDaRipartenza, inSecondi, le due
// ripartenzaDaBase omonime, trovaRecupero, senzaTempi) e ognuno ha la sua
// espressione. Le prove girano in ciclo sui caratteri, così la copertura
// è l'elenco e non quattro casi scelti a mano — e l'apostrofo dritto sta
// nel ciclo insieme agli altri, perché quello che oggi funziona deve
// continuare a funzionare.
//
// I casi che fanno più male non sono quelli che non si leggono: in
// "Scrivi o incolla" "@1’45" diventava @0:01 (un secondo) e nei metri
// "100+75+50+25 @1’45" diventava 225, perché senzaTempi non spogliava il
// tempo curvo e la somma si fermava prima.
const MINUTI = ["'", '\u2019', '\u2018', '\u2032', '\u0060', '\u00b4'];
const SECONDI = ['"', '\u201d', '\u201c', '\u2033', "''"];
const NOMI = {
  "'": "apostrofo dritto", '\u2019': 'virgoletta curva destra',
  '\u2018': 'virgoletta curva sinistra', '\u2032': 'apice tipografico',
  '\u0060': 'accento grave', '\u00b4': 'accento acuto',
  '"': 'doppio apice dritto', '\u201d': 'doppia curva destra',
  '\u201c': 'doppia curva sinistra', '\u2033': 'doppio apice tipografico',
  "''": 'due apostrofi dritti',
};

let quanteTempi = 0;
{
  const come = (q) => `${NOMI[q]} (${JSON.stringify(q)})`;
  const uguale = (cosa, avuto, atteso) => {
    quanteTempi++;
    if (JSON.stringify(avuto) !== JSON.stringify(atteso)) {
      male++;
      console.error(`✗ ${cosa}: atteso ${JSON.stringify(atteso)}, avuto ${JSON.stringify(avuto)}`);
    }
  };
  // Otto partenze da 1:45 sono 840 secondi; da 5' sono 2400; da 45" 360.
  const conRecupero = (rec) => [{ titolo: 'Centrale', serie: [{ notazione: '8x50', metri: 400, recupero: rec }] }];
  const recuperoLetto = (riga) => analizzaTesto(riga).sezioni[0]?.serie[0]?.recupero || '';

  for (const q of MINUTI) {
    // --- il campo Recupero dell'editor ---
    uguale(`campo Recupero, @1${q}45 con ${come(q)}`, normalizzaRecupero(`@1${q}45`), '@1:45');
    uguale(`campo Recupero, @5${q} sono cinque MINUTI, con ${come(q)}`, normalizzaRecupero(`@5${q}`), '@5:00');
    // --- la durata stimata, che da una ripartenza non letta fa zero ---
    uguale(`durata di 8x50 @1${q}45 con ${come(q)}`, durataStimata(conRecupero(`@1${q}45`)).secondi, 840);
    uguale(`durata di 8x50 @5${q} con ${come(q)}`, durataStimata(conRecupero(`@5${q}`)).secondi, 2400);
    // --- "Scrivi o incolla": qui non falliva, sbagliava ---
    uguale(`dal testo, 8x50 @1${q}45 con ${come(q)}`, recuperoLetto(`8x50 @1${q}45`), '@1:45');
    uguale(`dal testo, 8x50 @5${q} con ${come(q)}`, recuperoLetto(`8x50 @5${q}`), '@5:00');
    // --- il passo base @@ ---
    uguale(`passo base @@1${q}30 su 8x150 con ${come(q)}`,
      ripartenzaDaBase(`@@1${q}30`, '8x150')?.recupero || null, '@2:15');
    // --- e i metri, dove il tempo non spogliato ferma la somma ---
    uguale(`metri di "100+75+50+25 @1${q}45" con ${come(q)}`,
      analizzaTesto(`100+75+50+25 @1${q}45`).metri, 250);
    uguale(`metri di "200+50 gambe @1${q}30" con ${come(q)}`,
      analizzaTesto(`200+50 gambe @1${q}30`).metri, 250);
  }

  for (const d of SECONDI) {
    uguale(`campo Recupero, @45${d} sono quarantacinque SECONDI, con ${come(d)}`,
      normalizzaRecupero(`@45${d}`), '@0:45');
    uguale(`durata di 8x50 @45${d} con ${come(d)}`, durataStimata(conRecupero(`@45${d}`)).secondi, 360);
    uguale(`dal testo, 8x50 @45${d} con ${come(d)}`, recuperoLetto(`8x50 @45${d}`), '@0:45');
  }

  // Minuti e secondi insieme, in tutte le combinazioni: è come si scrive
  // sul foglio ("@1'45\"") e come lo scrive il tablet ("@1’45”").
  for (const q of MINUTI) {
    for (const d of SECONDI) {
      uguale(`campo Recupero, @1${q}45${d}`, normalizzaRecupero(`@1${q}45${d}`), '@1:45');
    }
  }
}

// Le due strade: un confronto per riga singola, piu' le voci dichiarate e
// il controllo che nessuna sia orfana.
const righeSingole = [...prove, ...rossi].filter(([t]) => !t.includes('\n')).length;
const quante = prove.length + rossi.length + 4 + 9 + 9 + 11
  + righeSingole + DIVERGENZE_VOLUTE.length + quanteTempi;
if (male) {
  console.error(`\n${male} prove fallite su ${quante}. Pacchetto non costruito.`);
  process.exit(1);
}
console.log(`✓ analizzatore: ${quante} prove passate`);
