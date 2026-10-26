// =====================================================================
// LA SEZIONE «TEST», PRIMA FASE (decisa il 26/10/2026): regole pure,
// senza React e senza Supabase. Prove in prova_test.mjs.
//
// Il test serve a valutare l'allenamento, non a prevedere la gara: prima
// il confronto dell'atleta con sé stesso, niente classifiche in primo
// piano. Base di metodo: i test della FIN descritti in «Totalmente nuoto»
// (6x50 ogni 2', 15x100 ogni 1'30", 5x300 con 1') più i test che usa
// l'allenatore (T-1000 per i piccoli e i velocisti, T-2000 per gli altri).
//
// Le unità, una volta per tutte:
//   - i tempi sono in CENTESIMI, numeri interi, come in
//     squadra.test_risultati (migrazione 036);
//   - le velocità in metri al secondo;
//   - le bracciate sono SINGOLE, una per braccio, per 25 (come SN nel
//     libro): un ciclo sono due bracciate.
//
// Mai un numero inventato: un dato che manca dà null, mai zero e mai
// infinito. Lattato e frequenza cardiaca hanno le colonne nella 036, ma
// qui non c'è niente che li legga: aspettano il consulente.
// =====================================================================

const numero = (x) => typeof x === 'number' && Number.isFinite(x);
const positivo = (x) => numero(x) && x > 0;

// ---------------------------------------------------------------------
// I tempi: si scrivono come a bordo vasca, si salvano in centesimi
// ---------------------------------------------------------------------

// «1:20.5», «1:20,5», «26:40», «59.9», «80». Niente apici: «1'20» non è
// un tempo (la stessa regola della notazione, @1:30 e mai @1'30).
const FORMA_TEMPO = /^(?:(\d{1,2}):)?(\d{1,2})(?:[.,](\d{1,2}))?$/;

/** Il tempo scritto, in centesimi; null se non è un tempo. */
export function leggiTempo(testo) {
  const m = String(testo ?? '').trim().match(FORMA_TEMPO);
  if (!m) return null;
  const minuti = m[1] != null ? Number(m[1]) : 0;
  const secondi = Number(m[2]);
  if (m[1] != null && secondi > 59) return null;
  const frazione = m[3] != null ? Number(m[3].padEnd(2, '0')) : 0;
  return (minuti * 60 + secondi) * 100 + frazione;
}

/** I centesimi come m:ss.d (al decimo); sotto il minuto ss.d. */
export function scriviTempo(cs) {
  if (!numero(cs) || cs < 0) return '';
  const decimi = Math.round(cs / 10);
  const minuti = Math.floor(decimi / 600);
  const resto = (decimi % 600) / 10;
  if (!minuti) return resto.toFixed(1);
  return `${minuti}:${resto.toFixed(1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------
// Velocità e passo
// ---------------------------------------------------------------------

/** Metri al secondo; null senza metri o senza tempo. */
export const velocita = (metri, cs) => (positivo(metri) && positivo(cs) ? metri / (cs / 100) : null);

/** Il passo ai 100 in centesimi, interi. */
export const passo100 = (v) => (positivo(v) ? Math.round(10000 / v) : null);

// ---------------------------------------------------------------------
// Tecnica: DS, SWOLF, indice di efficienza
// ---------------------------------------------------------------------

/** Distanza per ciclo, in metri: 25 / (bracciate singole per 25 / 2). */
export const dsDaBracciate = (bracciate25) => (positivo(bracciate25) ? 25 / (bracciate25 / 2) : null);

/** Distanza per ciclo dalla frequenza in cicli al minuto: v × 60 / SF. */
export const dsDaFrequenza = (v, cicliAlMinuto) =>
  (positivo(v) && positivo(cicliAlMinuto) ? (v * 60) / cicliAlMinuto : null);

/** SWOLF: tempo medio per 25, in secondi, più bracciate per 25. */
export const swolf = (metri, cs, bracciate25) =>
  (positivo(metri) && positivo(cs) && positivo(bracciate25) ? cs / 100 / (metri / 25) + bracciate25 : null);

/** Indice di efficienza, definizione del libro: v² × DS. */
export const indiceEfficienza = (v, ds) => (positivo(v) && positivo(ds) ? v * v * ds : null);

// ---------------------------------------------------------------------
// I test pronti da copiare
// ---------------------------------------------------------------------

/** Cosa si può misurare: l'elenco fisso, lo stesso del vincolo nella 036. */
export const MISURE = ['tempo', 'parziali', 'bracciate', 'respiri', 'lattato', 'frequenza'];

// I campi hanno i nomi delle colonne di squadra.test_tipi: una copia è
// una riga pronta, a cui manca solo la società. Vasca vuota: la sceglie
// la sessione. Lattato e frequenza non stanno fra le misure di nessuno.
//
// regola_zone: 'b1' = la velocità del test, per fattore_b1, è B1;
// 'serie' = le medie delle tre serie sono A2, B1, B2; null = niente zone.
export const MODELLI_TEST = [
  {
    modello: 'T-1000', nome: 'T-1000', descrizione: '1000 a tempo: per i piccoli e i velocisti',
    vasca: null, distanza: 1000, ripetute: 1, serie: 1, ripartenza_s: null, recupero_s: null,
    parziali_ogni: 100, misure: ['tempo', 'parziali', 'bracciate', 'respiri'],
    regola_zone: 'b1', fattore_b1: 0.97,
  },
  {
    modello: 'T-2000', nome: 'T-2000', descrizione: '2000 a tempo',
    vasca: null, distanza: 2000, ripetute: 1, serie: 1, ripartenza_s: null, recupero_s: null,
    parziali_ogni: 200, misure: ['tempo', 'parziali', 'bracciate', 'respiri'],
    regola_zone: 'b1', fattore_b1: 1,
  },
  {
    modello: '15x100', nome: '15x100', descrizione: '15x100 ogni 1\'30", tre serie da cinque (FIN)',
    vasca: null, distanza: 100, ripetute: 15, serie: 3, ripartenza_s: 90, recupero_s: null,
    parziali_ogni: null, misure: ['tempo', 'bracciate', 'respiri'],
    regola_zone: 'serie', fattore_b1: null,
  },
  {
    modello: '6x50', nome: '6x50', descrizione: '6x50 ogni 2\' (FIN)',
    vasca: null, distanza: 50, ripetute: 6, serie: 1, ripartenza_s: 120, recupero_s: null,
    parziali_ogni: null, misure: ['tempo', 'bracciate', 'respiri'],
    regola_zone: null, fattore_b1: null,
  },
  {
    modello: '5x300', nome: '5x300', descrizione: '5x300 con 1\' di recupero (FIN)',
    vasca: null, distanza: 300, ripetute: 5, serie: 1, ripartenza_s: null, recupero_s: 60,
    parziali_ogni: null, misure: ['tempo', 'bracciate', 'respiri'],
    regola_zone: null, fattore_b1: null,
  },
];

/** Una copia del modello, della società: cambiarla non tocca il modello. */
export function copiaModello(codice) {
  const m = MODELLI_TEST.find((x) => x.modello === codice);
  return m ? { ...m, misure: [...m.misure] } : null;
}

// ---------------------------------------------------------------------
// Percentuali della società
// ---------------------------------------------------------------------

// Della VELOCITÀ di B1, non del passo. Sono quelle di partenza: la
// società le cambia in squadra.test_percentuali, e una zona senza riga
// resta a queste.
export const PERCENTUALI_DI_PARTENZA = { A1: 93, A2: 96, B2: 103 };

/** Le percentuali della società dalle sue righe, sopra quelle di partenza. */
export function percentualiSocieta(righe) {
  const pct = { ...PERCENTUALI_DI_PARTENZA };
  for (const r of righe || []) {
    if (r && r.zona in pct && positivo(Number(r.percentuale))) pct[r.zona] = Number(r.percentuale);
  }
  return pct;
}

// ---------------------------------------------------------------------
// I tempi di un risultato
// ---------------------------------------------------------------------

const tempi = (ris) => (Array.isArray(ris?.ripetute) ? ris.ripetute.map((r) => r?.t) : []);

/** La somma dei tempi delle ripetute; null se ne manca uno. */
export function tempoTotale(ris) {
  const t = tempi(ris);
  return t.length && t.every(positivo) ? t.reduce((a, b) => a + b, 0) : null;
}

// ---------------------------------------------------------------------
// Ritmi per zona, senza lattato. C1, C2 e C3 non vengono da questi test.
// ---------------------------------------------------------------------

/** La velocità di B1 di un test continuo: quella del test per il fattore. */
export function velocitaB1(tipo, ris) {
  if (tipo?.regola_zone !== 'b1') return null;
  const v = velocita(tipo.distanza * (tipo.ripetute || 1), tempoTotale(ris));
  return v == null ? null : v * (numero(tipo.fattore_b1) ? tipo.fattore_b1 : 1);
}

/**
 * La velocità di ogni serie: la distanza della serie sul suo tempo
 * totale, non la media delle velocità. Una serie incompleta è null.
 */
export function velocitaSerie(tipo, ris) {
  const n = tipo?.serie || 1;
  const perSerie = (tipo?.ripetute || 0) / n;
  if (!Number.isInteger(perSerie) || perSerie < 1) return null;
  const t = tempi(ris);
  return Array.from({ length: n }, (_, i) => {
    const pezzo = t.slice(i * perSerie, (i + 1) * perSerie);
    if (pezzo.length < perSerie || !pezzo.every(positivo)) return null;
    return velocita(tipo.distanza * perSerie, pezzo.reduce((a, b) => a + b, 0));
  });
}

const ritmo = (v) => (v == null ? null : { velocita: v, passo: passo100(v) });

/**
 * I ritmi per zona di un risultato: { A1, A2, B1, B2 }, ognuno
 * { velocita, passo } o null; null per i test che non danno zone
 * (6x50, 5x300) e per un test continuo senza tempo.
 */
export function ritmiZona(tipo, ris, pct = PERCENTUALI_DI_PARTENZA) {
  if (tipo?.regola_zone === 'b1') {
    const b1 = velocitaB1(tipo, ris);
    if (b1 == null) return null;
    return {
      A1: ritmo((b1 * pct.A1) / 100),
      A2: ritmo((b1 * pct.A2) / 100),
      B1: ritmo(b1),
      B2: ritmo((b1 * pct.B2) / 100),
    };
  }
  if (tipo?.regola_zone === 'serie') {
    const v = velocitaSerie(tipo, ris);
    if (!v || v.length !== 3) return null;
    const [a2, b1, b2] = v;
    // A1 dal B1 misurato con la percentuale, come per i test continui.
    return { A1: ritmo(b1 == null ? null : (b1 * pct.A1) / 100), A2: ritmo(a2), B1: ritmo(b1), B2: ritmo(b2) };
  }
  return null;
}

// ---------------------------------------------------------------------
// I passaggi: li fissa il tipo, si possono lasciare vuoti
// ---------------------------------------------------------------------

/** Quanti passaggi prima dell'arrivo: T-2000 ogni 200 ne ha nove. */
export const passaggiAttesi = (tipo) => (positivo(tipo?.parziali_ogni)
  ? Math.max(0, Math.round(tipo.distanza / tipo.parziali_ogni) - 1)
  : 0);

/**
 * I tratti dai passaggi: i passaggi sono progressivi, come si leggono
 * sul cronometro, e l'ultimo tratto arriva al tempo finale. Un tratto
 * che non si può calcolare (passaggio mancante o che torna indietro) è
 * null, mai negativo.
 */
export function tratti(passaggi, tempo) {
  if (!Array.isArray(passaggi) || !passaggi.length) return [];
  const punti = [...passaggi, tempo];
  return punti.map((b, i) => {
    const a = i === 0 ? 0 : punti[i - 1];
    return numero(a) && numero(b) && b > a ? b - a : null;
  });
}

// ---------------------------------------------------------------------
// Il controllo del 5x300
// ---------------------------------------------------------------------

/** Riuscito se l'ultimo 300 sta entro 3 secondi da t400 − t100 di gara. */
export const TOLLERANZA_5X300 = 300;

/**
 * { atteso, ultimo, scarto, riuscito }, in centesimi; null se il test
 * non è il 5x300, se manca uno dei due tempi di gara o l'ultimo 300.
 */
export function controllo5x300(tipo, ris) {
  if (tipo?.modello !== '5x300') return null;
  const { gara_100: t100, gara_400: t400 } = ris || {};
  if (!positivo(t100) || !positivo(t400)) return null;
  const t = tempi(ris);
  const ultimo = t.length === tipo.ripetute ? t[t.length - 1] : null;
  if (!positivo(ultimo)) return null;
  const atteso = t400 - t100;
  const scarto = ultimo - atteso;
  return { atteso, ultimo, scarto, riuscito: Math.abs(scarto) <= TOLLERANZA_5X300 };
}

// ---------------------------------------------------------------------
// Dal modulo alla riga, e ritorno
// ---------------------------------------------------------------------

/**
 * Il tempo nei campi del modulo: al centesimo quando c'è, se no al
 * decimo. A schermo si legge al decimo (scriviTempo); nei campi no,
 * perché riaprire una sessione e risalvarla non deve cambiare un
 * centesimo.
 */
export function scriviTempoCampo(cs) {
  if (!numero(cs) || cs < 0) return '';
  const minuti = Math.floor(cs / 6000);
  const secondi = Math.floor((cs % 6000) / 100);
  const centesimi = cs % 100;
  const frazione = centesimi % 10 === 0 ? String(centesimi / 10) : String(centesimi).padStart(2, '0');
  return `${minuti ? `${minuti}:${String(secondi).padStart(2, '0')}` : secondi}.${frazione}`;
}

/** I campi vuoti di un atleta: per ripetuta tempo, passaggi e bracciate. */
export function campiVuoti(tipo) {
  const n = tipo?.ripetute || 1;
  const p = passaggiAttesi(tipo);
  return {
    tempi: Array(n).fill(''),
    passaggi: Array.from({ length: n }, () => Array(p).fill('')),
    bracciate: Array(n).fill(''),
    gara_100: '',
    gara_400: '',
  };
}

/** I campi di un risultato già salvato, per riaprirlo. */
export function campiDaRisultato(tipo, ris) {
  const campi = campiVuoti(tipo);
  (ris?.ripetute || []).slice(0, campi.tempi.length).forEach((r, i) => {
    campi.tempi[i] = scriviTempoCampo(r?.t);
    (r?.passaggi || []).slice(0, campi.passaggi[i].length).forEach((x, k) => {
      campi.passaggi[i][k] = scriviTempoCampo(x);
    });
    campi.bracciate[i] = positivo(r?.bracciate) ? String(r.bracciate) : '';
  });
  campi.gara_100 = scriviTempoCampo(ris?.gara_100);
  campi.gara_400 = scriviTempoCampo(ris?.gara_400);
  return campi;
}

const testo = (x) => String(x ?? '').trim();

// Sopra i 2,5 m/s non è un tempo nuotato (il record dei 50 sta sotto i
// 2,4): è quasi sempre «1.20» scritto per 1:20, perché sul tastierino
// dei numeri i due punti non ci sono. Letto così sarebbe 1,2 secondi.
export const VELOCITA_MASSIMA = 2.5;

/**
 * La riga per squadra.test_risultati dai campi di un atleta:
 * { vuoto, errori, ripetute, gara_100, gara_400 }. La lista ha sempre
 * tante voci quante ripetute del tipo, nell'ordine: una ripetuta non
 * scritta resta al suo posto con t null. Passaggi e bracciate entrano
 * nella voce solo se scritti. I tempi di gara solo nel 5x300. Con un
 * errore non si salva: la riga dice dove.
 */
export function risultatoDaCampi(tipo, campi) {
  const n = tipo?.ripetute || 1;
  const p = passaggiAttesi(tipo);
  const errori = [];
  let qualcosa = false;
  const tempo = (s, dove) => {
    qualcosa = true;
    const t = leggiTempo(s);
    if (t == null) errori.push(`${dove}: «${s}» non è un tempo`);
    return t;
  };

  const ripetute = Array.from({ length: n }, (_, i) => {
    const dove = `Ripetuta ${i + 1}`;
    const s = testo(campi?.tempi?.[i]);
    const voce = { t: s ? tempo(s, dove) : null };
    if (voce.t != null && velocita(tipo?.distanza, voce.t) > VELOCITA_MASSIMA) {
      errori.push(`${dove}: «${s}» è troppo veloce per ${tipo.distanza} m (i minuti vanno coi due punti, es. 1:20)`);
    }
    const passaggi = (campi?.passaggi?.[i] || []).slice(0, p);
    if (passaggi.some((x) => testo(x))) {
      voce.passaggi = Array.from({ length: p }, (__, k) => {
        const x = testo(passaggi[k]);
        return x ? tempo(x, `${dove}, passaggio ${k + 1}`) : null;
      });
    }
    const b = testo(campi?.bracciate?.[i]);
    if (b) {
      qualcosa = true;
      const v = Number(b.replace(',', '.'));
      if (positivo(v) && v < 100) voce.bracciate = v;
      else errori.push(`${dove}: «${b}» non sono bracciate`);
    }
    return voce;
  });

  const gara = (campo, nome) => {
    if (tipo?.modello !== '5x300') return null;
    const s = testo(campi?.[campo]);
    return s ? tempo(s, `Tempo di gara dei ${nome}`) : null;
  };
  const gara_100 = gara('gara_100', '100');
  const gara_400 = gara('gara_400', '400');

  return { vuoto: !qualcosa, errori, ripetute, gara_100, gara_400 };
}

// ---------------------------------------------------------------------
// Il valore dello storico e la tecnica di un risultato
// ---------------------------------------------------------------------

/**
 * Il numero che lo storico confronta, in centesimi: il tempo del test
 * continuo, il tempo medio della ripetuta negli altri. null se manca
 * una ripetuta: una media su meno ripetute non è lo stesso test.
 */
export function valoreStorico(tipo, ris) {
  const n = tipo?.ripetute || 1;
  const tot = tempoTotale(ris);
  return tot != null && tempi(ris).length === n ? Math.round(tot / n) : null;
}

/**
 * La tecnica di un risultato, dalle ripetute che hanno tempo E
 * bracciate: la velocità è la distanza sul tempo totale, le bracciate
 * la media. { ripetute, bracciate, velocita, ds, swolf, indice }, o null.
 */
export function tecnicaRisultato(tipo, ris) {
  const buone = (ris?.ripetute || []).filter((r) => positivo(r?.t) && positivo(r?.bracciate));
  if (!buone.length || !positivo(tipo?.distanza)) return null;
  const k = buone.length;
  const tTot = buone.reduce((a, r) => a + r.t, 0);
  const bracciate = buone.reduce((a, r) => a + r.bracciate, 0) / k;
  const v = velocita(tipo.distanza * k, tTot);
  const ds = dsDaBracciate(bracciate);
  return {
    ripetute: k,
    bracciate,
    velocita: v,
    ds,
    swolf: swolf(tipo.distanza, tTot / k, bracciate),
    indice: indiceEfficienza(v, ds),
  };
}

// ---------------------------------------------------------------------
// I tasti di un test nella scheda
// ---------------------------------------------------------------------

/**
 * I tasti di un tipo di test, nell'ordine: 'foglio', 'modifica',
 * 'archivia' su un test attivo, 'riattiva' su uno archiviato. Il foglio
 * è una stampa, non una scrittura: lo vede chiunque, lettore compreso.
 * Il resto solo chi scrive (allenatore e collega).
 */
export function azioniTipo(tipo, puoScrivere) {
  if (!tipo?.attivo) return puoScrivere ? ['riattiva'] : [];
  return puoScrivere ? ['foglio', 'modifica', 'archivia'] : ['foglio'];
}

// ---------------------------------------------------------------------
// Lo storico: l'atleta con sé stesso, nella stessa vasca
// ---------------------------------------------------------------------

/**
 * Le voci { data, vasca, valore } di un atleta per un tipo, nella vasca
 * chiesta e in ordine di data. Ogni voce porta la differenza con la
 * volta prima e col migliore fino a lì (valori più bassi = meglio), e
 * se è il migliore. La prima volta non ha confronti: null.
 */
export function storicoAtleta(voci, vasca) {
  const scelte = (voci || [])
    .filter((v) => v && v.vasca === vasca && positivo(v.valore))
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  let prima = null;
  let migliore = null;
  return scelte.map((v) => {
    const voce = {
      ...v,
      diffPrecedente: prima == null ? null : v.valore - prima,
      diffMigliore: migliore == null ? null : v.valore - migliore,
      record: migliore == null ? null : v.valore < migliore,
    };
    prima = v.valore;
    migliore = migliore == null ? v.valore : Math.min(migliore, v.valore);
    return voce;
  });
}
