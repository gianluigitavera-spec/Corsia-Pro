// Prove della sezione «Test», prima fase (decisa il 26/10/2026). Girano
// prima di ogni build.
//
// Il test serve a valutare l'allenamento, non a prevedere la gara: prima
// il confronto dell'atleta con sé stesso. Base di metodo: i test della
// FIN in «Totalmente nuoto» (6x50 ogni 2', 15x100 ogni 1'30", 5x300 con
// 1') più i T-1000 e T-2000 dell'allenatore.
//
// Le regole che queste prove tengono ferme:
//   - le percentuali di zona sono della VELOCITÀ di B1, non del passo:
//     A1 al 93 % ha il passo di B1 diviso 0,93, non moltiplicato 1,07;
//   - la velocità di una serie è la distanza sul tempo totale, non la
//     media delle velocità;
//   - bracciate singole per 25 (una per braccio, come SN nel libro):
//     DS = 25 / (bracciate / 2) in metri per ciclo, SWOLF = tempo per 25
//     + bracciate per 25, indice di efficienza = v² × DS;
//   - mai un numero inventato: un dato che manca dà null, mai zero e
//     mai infinito;
//   - lo storico confronta solo risultati nella stessa vasca.
import * as T from './src/lib/test.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};
const cifre = (n, k) => (n == null ? null : Number(n).toFixed(k));

// Un risultato com'è in squadra.test_risultati: i tempi in centesimi.
const risultato = (tempi, extra = {}) => ({ ripetute: tempi.map((t) => ({ t })), ...extra });
const modello = (codice) => T.copiaModello(codice);

// =====================================================================
// I TEMPI: si scrivono come a bordo vasca, si salvano in centesimi
// =====================================================================
dice('leggiTempo 1:20,5', T.leggiTempo('1:20,5'), 8050);
dice('leggiTempo 1:20.5', T.leggiTempo('1:20.5'), 8050);
dice('leggiTempo 1:20.05', T.leggiTempo('1:20.05'), 8005);
dice('leggiTempo 26:40', T.leggiTempo('26:40'), 160000);
dice('leggiTempo 59.9', T.leggiTempo('59.9'), 5990);
dice('leggiTempo 80 (secondi soli)', T.leggiTempo('80'), 8000);
dice('leggiTempo con spazi', T.leggiTempo(' 1:20.5 '), 8050);
dice("leggiTempo 1'20 non è un tempo", T.leggiTempo("1'20"), null);
dice('leggiTempo 1:75 non è un tempo', T.leggiTempo('1:75'), null);
dice('leggiTempo abc', T.leggiTempo('abc'), null);
dice('leggiTempo vuoto', T.leggiTempo(''), null);
dice('leggiTempo null', T.leggiTempo(null), null);

dice('scriviTempo 8602 → 1:26.0', T.scriviTempo(8602), '1:26.0');
dice('scriviTempo 5800 → 58.0', T.scriviTempo(5800), '58.0');
dice('scriviTempo 160000 → 26:40.0', T.scriviTempo(160000), '26:40.0');
dice('scriviTempo 5996 → 1:00.0 (il decimo arrotonda il minuto)', T.scriviTempo(5996), '1:00.0');
dice('scriviTempo null → vuoto', T.scriviTempo(null), '');

// =====================================================================
// VELOCITÀ E PASSO
// =====================================================================
dice('velocità 2000 in 26:40', T.velocita(2000, 160000), 1.25);
dice('velocità con tempo zero: null, non infinito', T.velocita(100, 0), null);
dice('velocità senza tempo', T.velocita(100, null), null);
dice('passo ai 100 a 1,25 m/s', T.passo100(1.25), 8000);
dice('passo ai 100 senza velocità', T.passo100(null), null);

// =====================================================================
// TECNICA: DS, SWOLF, indice di efficienza
// =====================================================================
// 100 in 1:20.0 in vasca da 25, 20 bracciate per 25 (10 cicli).
dice('DS da 20 bracciate per 25', T.dsDaBracciate(20), 2.5);
dice('SWOLF 100 in 80 s, 20 bracciate', T.swolf(100, 8000, 20), 40);
dice('indice 1,25 m/s e DS 2,5', cifre(T.indiceEfficienza(1.25, 2.5), 2), '3.91');
dice('DS senza bracciate', T.dsDaBracciate(null), null);
dice('DS con zero bracciate', T.dsDaBracciate(0), null);
dice('SWOLF senza bracciate', T.swolf(100, 8000, null), null);
dice('indice senza DS', T.indiceEfficienza(1.25, null), null);

// Il primo 50 di Dotto, dal libro: 24,8 s, frequenza media 45,8 cicli al
// minuto → DS 2,64; con v 2,016 l'indice è 10,7.
const vDotto = T.velocita(50, 2480);
dice('Dotto: velocità del primo 50', cifre(vDotto, 3), '2.016');
dice('Dotto: DS dalla frequenza', cifre(T.dsDaFrequenza(vDotto, 45.8), 2), '2.64');
dice('Dotto: indice v² × DS', cifre(T.indiceEfficienza(2.016, 2.64), 1), '10.7');
// Le stesse bracciate contate per 25: 24,8 × 45,8 / 60 = 18,93 cicli sui
// 50, cioè 18,93 bracciate singole per 25. Le due strade danno la stessa DS.
dice('Dotto: DS dalle bracciate per 25', cifre(T.dsDaBracciate(18.93), 2), '2.64');
dice('DS dalla frequenza senza frequenza', T.dsDaFrequenza(2, null), null);

// =====================================================================
// I MODELLI PRONTI DA COPIARE
// =====================================================================
dice('cinque modelli', T.MODELLI_TEST.map((m) => m.modello), ['T-1000', 'T-2000', '15x100', '6x50', '5x300']);
dice('T-1000: B1 = v × 0,97, passaggi ogni 100',
  (({ distanza, ripetute, regola_zone, fattore_b1, parziali_ogni }) => ({ distanza, ripetute, regola_zone, fattore_b1, parziali_ogni }))(modello('T-1000')),
  { distanza: 1000, ripetute: 1, regola_zone: 'b1', fattore_b1: 0.97, parziali_ogni: 100 });
dice('T-2000: B1 = v, passaggi ogni 200',
  (({ distanza, regola_zone, fattore_b1, parziali_ogni }) => ({ distanza, regola_zone, fattore_b1, parziali_ogni }))(modello('T-2000')),
  { distanza: 2000, regola_zone: 'b1', fattore_b1: 1, parziali_ogni: 200 });
dice('15x100: tre serie da cinque, ogni 1\'30"',
  (({ distanza, ripetute, serie, ripartenza_s, regola_zone }) => ({ distanza, ripetute, serie, ripartenza_s, regola_zone }))(modello('15x100')),
  { distanza: 100, ripetute: 15, serie: 3, ripartenza_s: 90, regola_zone: 'serie' });
dice("6x50 ogni 2': niente zone",
  (({ distanza, ripetute, ripartenza_s, regola_zone }) => ({ distanza, ripetute, ripartenza_s, regola_zone }))(modello('6x50')),
  { distanza: 50, ripetute: 6, ripartenza_s: 120, regola_zone: null });
dice("5x300 con 1': recupero, non ripartenza, niente zone",
  (({ distanza, ripetute, ripartenza_s, recupero_s, regola_zone }) => ({ distanza, ripetute, ripartenza_s, recupero_s, regola_zone }))(modello('5x300')),
  { distanza: 300, ripetute: 5, ripartenza_s: null, recupero_s: 60, regola_zone: null });
dice('i modelli non hanno lattato né frequenza fra le misure',
  T.MODELLI_TEST.some((m) => m.misure.includes('lattato') || m.misure.includes('frequenza')), false);
dice('le misure dei modelli stanno nell\'elenco fisso',
  T.MODELLI_TEST.every((m) => m.misure.every((x) => T.MISURE.includes(x))), true);
dice('i passaggi dividono la distanza',
  T.MODELLI_TEST.every((m) => !m.parziali_ogni || m.distanza % m.parziali_ogni === 0), true);
{
  const copia = modello('T-1000');
  copia.fattore_b1 = 0.96;
  copia.misure.push('lattato');
  dice('la copia è della società: cambiarla non tocca il modello',
    [modello('T-1000').fattore_b1, modello('T-1000').misure.includes('lattato')], [0.97, false]);
}
dice('modello sconosciuto', T.copiaModello('T-3000'), null);

// =====================================================================
// PERCENTUALI DELLA SOCIETÀ
// =====================================================================
dice('percentuali di partenza', T.PERCENTUALI_DI_PARTENZA, { A1: 93, A2: 96, B2: 103 });
dice('nessuna riga: quelle di partenza', T.percentualiSocieta([]), { A1: 93, A2: 96, B2: 103 });
dice('cambia solo A1: le altre restano di partenza',
  T.percentualiSocieta([{ zona: 'A1', percentuale: 92 }]), { A1: 92, A2: 96, B2: 103 });
dice('una zona che non è di queste si ignora',
  T.percentualiSocieta([{ zona: 'C1', percentuale: 110 }]), { A1: 93, A2: 96, B2: 103 });

// =====================================================================
// RITMI PER ZONA, SENZA LATTATO
// =====================================================================
const ritmi = (tipo, ris, pct) => {
  const r = T.ritmiZona(tipo, ris, pct);
  if (!r) return r;
  return Object.fromEntries(Object.entries(r).map(([z, v]) => [z, v ? T.scriviTempo(v.passo) : null]));
};

// T-2000 in 26:40.00 → v = 1,25 m/s, B1 1:20.0.
dice('T-2000: la velocità è B1, le altre in percentuale',
  ritmi(modello('T-2000'), risultato([160000])),
  { A1: '1:26.0', A2: '1:23.3', B1: '1:20.0', B2: '1:17.7' });
// Il conto sbagliato, passo × 1,07, darebbe A1 1:25.6.
dice('A1 è il passo di B1 diviso 0,93, non per 1,07',
  T.ritmiZona(modello('T-2000'), risultato([160000])).A1.passo, 8602);
dice('le velocità di zona',
  cifre(T.ritmiZona(modello('T-2000'), risultato([160000])).A2.velocita, 4), '1.2000');

// T-1000 in 12:30.00 → v = 1,333 m/s; B1 = v × 0,97 = 1,293, passo 1:17.3.
dice('T-1000: velocità del test', cifre(T.velocita(1000, 75000), 3), '1.333');
dice('T-1000: B1 = v × 0,97', cifre(T.velocitaB1(modello('T-1000'), risultato([75000])), 3), '1.293');
dice('T-1000: passo di B1', ritmi(modello('T-1000'), risultato([75000])).B1, '1:17.3');
{
  const tipo = { ...modello('T-1000'), fattore_b1: 0.96 };
  dice('T-1000: il fattore è del tipo, la società lo cambia',
    cifre(T.velocitaB1(tipo, risultato([75000])), 3), '1.280');
}

dice('percentuali della società: A1 al 92 %',
  ritmi(modello('T-2000'), risultato([160000]), T.percentualiSocieta([{ zona: 'A1', percentuale: 92 }])),
  { A1: '1:27.0', A2: '1:23.3', B1: '1:20.0', B2: '1:17.7' });

dice('T-2000 senza tempo: nessun ritmo', T.ritmiZona(modello('T-2000'), risultato([null])), null);
dice('T-2000 senza ripetute', T.ritmiZona(modello('T-2000'), { ripetute: [] }), null);

// 15x100: la velocità di una serie è 500 m sul tempo totale.
// 78/82/78/82/80 = 400 s → 1,25 esatto; la media delle velocità darebbe 1,2506.
{
  const serie2 = [7800, 8200, 7800, 8200, 8000];
  const v = T.velocitaSerie(modello('15x100'), risultato([...Array(5).fill(8200), ...serie2, ...Array(5).fill(7700)]));
  dice('15x100: velocità di serie = distanza sul tempo totale', cifre(v[1], 4), '1.2500');
  dice('15x100: le tre serie', v.map((x) => cifre(x, 4)), ['1.2195', '1.2500', '1.2987']);
}
dice('15x100: A2, B1, B2 dalle serie; A1 dal B1 misurato al 93 %',
  ritmi(modello('15x100'), risultato([...Array(5).fill(8200), 7800, 8200, 7800, 8200, 8000, ...Array(5).fill(7700)])),
  { A1: '1:26.0', A2: '1:22.0', B1: '1:20.0', B2: '1:17.0' });
dice('15x100 con 14 tempi: la serie incompleta è null, le altre si calcolano',
  ritmi(modello('15x100'), risultato([...Array(5).fill(8200), ...Array(5).fill(8000), ...Array(4).fill(7700)])),
  { A1: '1:26.0', A2: '1:22.0', B1: '1:20.0', B2: null });
dice('15x100 con un tempo vuoto nella seconda serie: B1 e A1 null',
  ritmi(modello('15x100'), risultato([...Array(5).fill(8200), 8000, null, 8000, 8000, 8000, ...Array(5).fill(7700)])),
  { A1: null, A2: '1:22.0', B1: null, B2: '1:17.0' });

dice('6x50: niente zone', T.ritmiZona(modello('6x50'), risultato(Array(6).fill(3000))), null);
dice('5x300: niente zone', T.ritmiZona(modello('5x300'), risultato(Array(5).fill(20000))), null);
dice('C1, C2, C3 non vengono da questi test',
  Object.keys(T.ritmiZona(modello('T-2000'), risultato([160000]))), ['A1', 'A2', 'B1', 'B2']);

// =====================================================================
// I PASSAGGI: li fissa il tipo, si possono lasciare vuoti
// =====================================================================
dice('T-2000 ogni 200: nove passaggi prima dell\'arrivo', T.passaggiAttesi(modello('T-2000')), 9);
dice('T-1000 ogni 100: nove passaggi', T.passaggiAttesi(modello('T-1000')), 9);
dice('15x100: nessun passaggio', T.passaggiAttesi(modello('15x100')), 0);
// I passaggi si scrivono come si leggono sul cronometro (progressivi);
// i tratti sono le differenze, l'ultimo arriva al tempo finale.
dice('tratti dai passaggi', T.tratti([7400, 14900], 22500), [7400, 7500, 7600]);
dice('passaggi vuoti: nessun tratto', T.tratti([], 22500), []);
dice('un passaggio mancante: i due tratti intorno sono null',
  T.tratti([7400, null, 22500], 30000), [7400, null, null, 7500]);
dice('un passaggio che torna indietro: tratto null, non negativo',
  T.tratti([7400, 7000], 15000), [7400, null, 8000]);

// =====================================================================
// IL CONTROLLO DEL 5x300: ultimo 300 entro 3 s da t400 − t100 di gara
// =====================================================================
const cinque = (ultimo, gara = { gara_100: 5800, gara_400: 26000 }) =>
  risultato([20000, 20000, 20100, 20200, ultimo], gara);
dice('5x300: atteso 3:22.0, ultimo 3:23.5 → +1,5 s, riuscito',
  T.controllo5x300(modello('5x300'), cinque(20350)), { atteso: 20200, ultimo: 20350, scarto: 150, riuscito: true });
dice('5x300: ultimo 3:25.5 → +3,5 s, non riuscito',
  T.controllo5x300(modello('5x300'), cinque(20550)).riuscito, false);
dice('5x300: ultimo 3:19.5 → −2,5 s, riuscito (entro 3 s, da tutte e due le parti)',
  T.controllo5x300(modello('5x300'), cinque(19950)).riuscito, true);
dice('5x300: esattamente 3 s, riuscito',
  T.controllo5x300(modello('5x300'), cinque(20500)).riuscito, true);
dice('5x300 senza tempi di gara: nessun controllo',
  T.controllo5x300(modello('5x300'), cinque(20350, {})), null);
dice('5x300 con un solo tempo di gara: nessun controllo',
  T.controllo5x300(modello('5x300'), cinque(20350, { gara_400: 26000 })), null);
dice('5x300 senza il quinto tempo: nessun controllo',
  T.controllo5x300(modello('5x300'), risultato([20000, 20000, 20100, 20200], { gara_100: 5800, gara_400: 26000 })), null);
dice('il controllo è solo del 5x300',
  T.controllo5x300(modello('6x50'), risultato(Array(6).fill(3000), { gara_100: 5800, gara_400: 26000 })), null);

// =====================================================================
// LO STORICO: l'atleta con sé stesso, nella stessa vasca
// =====================================================================
dice('tempo totale', T.tempoTotale(risultato([3000, 3100, 2900])), 9000);
dice('tempo totale con un tempo mancante', T.tempoTotale(risultato([3000, null, 2900])), null);
dice('tempo totale senza ripetute', T.tempoTotale({ ripetute: [] }), null);
{
  const voci = [
    { data: '2026-11-01', vasca: 25, valore: 159000 },
    { data: '2026-09-01', vasca: 25, valore: 160000 },
    { data: '2026-10-01', vasca: 50, valore: 150000 },
    { data: '2026-10-15', vasca: 25, valore: 158500 },
    { data: '2026-10-20', vasca: 25, valore: null },
  ];
  const s = T.storicoAtleta(voci, 25);
  dice('storico: solo la vasca chiesta, in ordine di data, senza i vuoti',
    s.map((v) => v.data), ['2026-09-01', '2026-10-15', '2026-11-01']);
  dice('storico: la prima volta non ha confronti',
    [s[0].diffPrecedente, s[0].diffMigliore, s[0].record], [null, null, null]);
  dice('storico: migliora di 15 s, è il migliore',
    [s[1].diffPrecedente, s[1].diffMigliore, s[1].record], [-1500, -1500, true]);
  dice('storico: peggiora di 5 s rispetto alla volta prima e al migliore',
    [s[2].diffPrecedente, s[2].diffMigliore, s[2].record], [500, 500, false]);
  dice('storico in vasca da 50: una voce sola, senza confronti',
    T.storicoAtleta(voci, 50).map((v) => [v.data, v.diffPrecedente]), [['2026-10-01', null]]);
}

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ test: tutte le prove passate');
