// Prove sulle stagioni e sulla proiezione delle fasce d'età.
// Girano prima di ogni build. Sono la rete sotto la regola più silenziosa
// dell'app: se le fasce si proiettano male, tutta la squadra cambia
// categoria di nascosto e i volumi finiscono nel posto sbagliato.
import { stagioneCorrente, stagioniProposte, fasceRisolte, categoriaDi,
         metriSvolti, scartoPerZona, metriPerSpecializzazione,
         zonePerSpecializzazione } from './src/lib/dominio.js';

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

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ stagioni e fasce: tutte le prove passate');
