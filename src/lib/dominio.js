// =====================================================================
// dominio.js — fonte di verità condivisa fra CorsiaPro e SwimCoach AI.
//
// REGOLA: questo file si modifica in UN SOLO POSTO. Copialo identico nei
// due progetti (o mettilo in un package quando i due si stabilizzano).
// Le funzioni qui dentro rispecchiano esattamente quelle SQL di
// 003_viste_volumi.sql: se cambia una, cambia l'altra.
//
// Nessuna dipendenza: importabile da qualsiasi front-end.
// =====================================================================

export const TUTTI = "*";

export const SPECIALIZZAZIONI = ["Velocità", "Mezzofondo", "Salvamento", "Generale"];

// Fallback locale: a runtime le zone si leggono da squadra.zone.
// Qui servono solo per rendering offline e per i test.
export const ZONE = [
  { codice: "A1", nome: "Aerobico lento / ripristino", famiglia: "aerobico" },
  { codice: "A2", nome: "Aerobico medio", famiglia: "aerobico" },
  { codice: "B1", nome: "Soglia anaerobica", famiglia: "aerobico" },
  { codice: "B2", nome: "Massimo consumo di ossigeno", famiglia: "vo2" },
  { codice: "C1", nome: "Tolleranza lattacida", famiglia: "lattacido" },
  { codice: "C2", nome: "Potenza lattacida", famiglia: "lattacido" },
  { codice: "C3", nome: "Velocità alattacida", famiglia: "alattacido" },
];

export const FAMIGLIE = ["aerobico", "vo2", "lattacido", "alattacido"];

export const CATEGORIE = [
  { codice: "PROP_01", nome: "Propaganda 0-1", ordine: 10 },
  { codice: "PROP_2", nome: "Propaganda 2", ordine: 20 },
  { codice: "TEEN_0", nome: "Teen 0", ordine: 30 },
  { codice: "TEEN_1", nome: "Teen 1", ordine: 40 },
  { codice: "TEEN_2", nome: "Teen 2", ordine: 50 },
  { codice: "ESO_B1", nome: "Esordienti B1", ordine: 60 },
  { codice: "ESO_B2", nome: "Esordienti B2", ordine: 70 },
  { codice: "ESO_A1", nome: "Esordienti A1", ordine: 80 },
  { codice: "ESO_A2", nome: "Esordienti A2", ordine: 90 },
  { codice: "RAG_1", nome: "Ragazzi 1", ordine: 100 },
  { codice: "RAG_2", nome: "Ragazzi 2", ordine: 110 },
  { codice: "RAG_3M", nome: "Ragazzi 3 (M)", ordine: 120 },
  { codice: "JUN_1", nome: "Junior 1", ordine: 130 },
  { codice: "JUN_2", nome: "Junior 2", ordine: 140 },
  { codice: "CAD_1", nome: "Cadetti 1", ordine: 150 },
  { codice: "CAD_2", nome: "Cadetti 2", ordine: 160 },
  { codice: "SEN_1", nome: "Senior 1", ordine: 170 },
  { codice: "SEN_2", nome: "Senior 2", ordine: 180 },
  { codice: "ASS", nome: "Assoluti", ordine: 190 },
  // Master: unica categoria, non le fasce quinquennali FIN. Non ha fasce
  // d'età in categorie_stagione ed è di proposito: Master è un tipo di
  // tesseramento, non un'età. Si assegna a mano con categoria_override,
  // altrimenti ci finirebbe dentro ogni agonista adulto.
  { codice: "MAS", nome: "Master", ordine: 200 },
];

// ---------------------------------------------------------------------
// Seduta — il contratto. Stessa forma se scritta a mano o generata.
// ---------------------------------------------------------------------
export function sedutaVuota({ data, categorie = [] } = {}) {
  return {
    data: data || new Date().toISOString().slice(0, 10),
    categorie,
    origine: "manuale",
    titolo: "",
    sezioni: [
      { titolo: "Warm Up", destinatari: [TUTTI], serie: [] },
      { titolo: "Parte centrale", destinatari: [TUTTI], serie: [] },
      { titolo: "Sciolto", destinatari: [TUTTI], serie: [] },
    ],
  };
}

export function serieVuota() {
  // La zona parte da A1: è il caso più frequente, si cambia solo quando serve.
  return { notazione: "", zona: "A1", metri: 0, recupero: "", note: "" };
}

// ---------------------------------------------------------------------
// METRI DALLA NOTAZIONE
// "1x400" = 400 · "2x200" = 400 · "4x(1x100 + 2x50)" = 800
// "12/10/8x100" = 3000 (scaletta) · "8x50 sl" = 400 (il testo si ignora)
// Restituisce null se non riesce a leggere: in quel caso i metri restano
// quelli scritti a mano, senza inventare nulla.
// ---------------------------------------------------------------------
export function metriDaNotazione(testo) {
  if (!testo) return null;

  // Via lo stile, restano cifre e operatori. Lo spazio conta: "4x100 @1'40"
  // deve dare 400, non attaccare il recupero alla distanza.
  const grezzo = String(testo)
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/[^0-9x()+/]/g, " ");

  let s = "";
  let prof = 0;
  for (let k = 0; k < grezzo.length; k++) {
    const ch = grezzo[k];
    if (ch === " ") {
      if (prof > 0) continue;                    // dentro parentesi lo spazio non conta
      let j = k;
      while (j < grezzo.length && grezzo[j] === " ") j++;
      if (j >= grezzo.length) break;
      const dopo = grezzo[j];
      const prima = s[s.length - 1];
      // Lo spazio si ignora solo attorno a un operatore.
      if ("+x/)".includes(dopo) || s === "" || "+x/(".includes(prima || "")) {
        k = j - 1;
        continue;
      }
      break;                                     // un numero staccato: l'espressione finisce qui
    }
    if (ch === "(") prof++;
    if (ch === ")") prof = Math.max(0, prof - 1);
    s += ch;
  }

  if (!s) return null;

  let i = 0;
  const fine = () => i >= s.length;
  const guarda = () => s[i];

  function numero() {
    let n = "";
    while (!fine() && /[0-9]/.test(guarda())) n += s[i++];
    return n === "" ? null : parseInt(n, 10);
  }

  // fattore := numero | ( somma )
  function fattore() {
    if (guarda() === "(") {
      i++;
      const v = somma();
      if (guarda() === ")") i++;
      return v;
    }
    return numero();
  }

  // termine := [ripetizioni x] fattore   (ripetizioni anche "12/10/8")
  function termine() {
    const partenza = i;
    let reps = [];
    let n = numero();
    if (n === null) return fattore();

    reps.push(n);
    while (guarda() === "/") {
      i++;
      const m = numero();
      if (m === null) { i = partenza; return fattore(); }
      reps.push(m);
    }

    if (guarda() === "x") {
      i++;
      const f = fattore();
      if (f === null) return null;
      return reps.reduce((t, r) => t + r * f, 0);
    }

    // Nessuna "x": era una distanza secca, e la scaletta non aveva senso.
    if (reps.length > 1) { i = partenza; return numero(); }
    return n;
  }

  // somma := termine { + termine }
  function somma() {
    let tot = termine();
    if (tot === null) return null;
    while (guarda() === "+") {
      i++;
      const t = termine();
      if (t === null) return null;
      tot += t;
    }
    return tot;
  }

  const risultato = somma();
  if (risultato === null || !isFinite(risultato) || risultato <= 0) return null;
  return risultato;
}

// ---------------------------------------------------------------------
// RECUPERO — si scrive @1'40, e chi scrive 1'40 lo ottiene lo stesso.
// ---------------------------------------------------------------------
export function normalizzaRecupero(testo) {
  let t = String(testo || "").trim();
  if (!t) return "";
  // "3'" da solo sono tre MINUTI: l'apice è il segno dei minuti.
  t = t.replace(/^@?\s*(\d{1,2})\s*'\s*$/, "@$1:00");
  // Convenzione unica: @1:30. L'apice e il punto diventano due punti.
  t = t.replace(/(\d{1,2})\s*['.]\s*(\d{2})\s*"?/, "$1:$2");
  // "@3'" senza secondi vuol dire tre minuti, non tre secondi.
  t = t.replace(/^@?(\d{1,2})'\s*$/, "@$1:00");
  return t.startsWith("@") ? t : "@" + t;
}

// Una sezione senza "destinatari" vale per tutti.
function destinatariDi(sezione) {
  const d = sezione?.destinatari;
  if (!Array.isArray(d) || d.length === 0) return [TUTTI];
  return d;
}

export function sezionePer(sezione, specializzazione) {
  const d = destinatariDi(sezione);
  return d.includes(TUTTI) || d.includes(specializzazione);
}

// ---------------------------------------------------------------------
// VOLUMI — la regola che il prototipo sbagliava.
// Il volume di chi fa velocità è warm-up comune + sezione velocisti,
// NON la somma di tutte le sezioni della seduta.
// ---------------------------------------------------------------------
export function metriPerSpecializzazione(sezioni, specializzazione) {
  return (sezioni || [])
    .filter((sez) => sezionePer(sez, specializzazione))
    .flatMap((sez) => sez.serie || [])
    .reduce((tot, s) => tot + (Number(s.metri) || 0), 0);
}

export function caricoPerZona(sezioni, specializzazione) {
  const out = {};
  for (const sez of sezioni || []) {
    if (!sezionePer(sez, specializzazione)) continue;
    for (const s of sez.serie || []) {
      const z = (s.zona || "").trim() || "?";
      out[z] = (out[z] || 0) + (Number(s.metri) || 0);
    }
  }
  return out;
}

export function caricoPerFamiglia(sezioni, specializzazione, zone = ZONE) {
  const mappa = Object.fromEntries(zone.map((z) => [z.codice, z.famiglia]));
  const perZona = caricoPerZona(sezioni, specializzazione);
  const out = { aerobico: 0, vo2: 0, lattacido: 0, alattacido: 0, nonClassificati: 0 };
  for (const [codice, metri] of Object.entries(perZona)) {
    const fam = mappa[codice];
    if (fam && fam in out) out[fam] += metri;
    else out.nonClassificati += metri;
  }
  return out;
}

// Metri realmente nuotati dalla squadra in una seduta, dati gli atleti
// presenti (ognuno col proprio percorso).
export function volumeEffettivoSquadra(sezioni, atletiPresenti) {
  return (atletiPresenti || []).reduce(
    (tot, a) => tot + metriPerSpecializzazione(sezioni, a.specializzazione || "Generale"),
    0
  );
}

// ---------------------------------------------------------------------
// CATEGORIE — derivate, mai salvate sull'atleta.
// "fasce" arriva da squadra.categorie_stagione.
// ---------------------------------------------------------------------
export function categoriaDi(annoNascita, sesso, fasce) {
  const match = (fasce || []).find(
    (f) =>
      f.sesso === sesso &&
      annoNascita >= f.anno_nascita_da &&
      annoNascita <= f.anno_nascita_a
  );
  return match ? match.categoria : null;
}

// ---------------------------------------------------------------------
// CHIAVE ANTI-DOPPIONE
// Stessa persona scritta in due modi dev'essere la stessa chiave:
// "D'Amico Luca 2012" e "d' amico  luca 2012" → damicoluca2012.
// Deve restare allineata a squadra.chiave_atleta() in SQL (migrazione 021):
// se cambi qui, cambia anche là, o il vincolo del database e l'anteprima
// dell'import smettono di dire la stessa cosa.
// ---------------------------------------------------------------------
const ACCENTI = { à:'a', á:'a', â:'a', ä:'a', ã:'a', è:'e', é:'e', ê:'e', ë:'e',
  ì:'i', í:'i', î:'i', ï:'i', ò:'o', ó:'o', ô:'o', ö:'o', õ:'o',
  ù:'u', ú:'u', û:'u', ü:'u', ç:'c', ñ:'n' };

export function chiaveAtleta({ cognome, nome, anno_nascita } = {}) {
  return `${cognome || ''}${nome || ''}${anno_nascita ?? ''}`
    .toLowerCase()
    .replace(/[àáâäãèéêëìíîïòóôöõùúûüçñ]/g, (c) => ACCENTI[c])
    .replace(/[^a-z0-9]/g, '');
}

export function categoriaAtleta(atleta, fasce) {
  if (atleta?.categoria_override) return atleta.categoria_override;
  return categoriaDi(atleta?.anno_nascita, atleta?.sesso, fasce);
}

// Stagione FIN corrente: parte a settembre.
export function stagioneCorrente(oggi = new Date()) {
  const anno = oggi.getFullYear();
  const inizio = oggi.getMonth() >= 8 ? anno : anno - 1;
  return `${inizio}/${String(inizio + 1).slice(2)}`;
}

// ---------------------------------------------------------------------
// VALIDAZIONE — stesse regole per la seduta scritta a mano e per quella
// generata. Se passa di qui, i volumi si calcolano.
// ---------------------------------------------------------------------
export function validaSeduta(seduta, zoneValide = ZONE.map((z) => z.codice)) {
  const problemi = [];
  if (!seduta?.data) problemi.push({ campo: "data", msg: "Manca la data" });
  if (!seduta?.categorie?.length)
    problemi.push({ campo: "categorie", msg: "Scegli almeno una categoria" });

  const sezioni = seduta?.sezioni || [];
  if (sezioni.length === 0) problemi.push({ campo: "sezioni", msg: "Seduta vuota" });

  sezioni.forEach((sez, i) => {
    const dest = destinatariDi(sez);
    const ignoti = dest.filter((d) => d !== TUTTI && !SPECIALIZZAZIONI.includes(d));
    if (ignoti.length)
      problemi.push({ campo: `sezioni[${i}].destinatari`, msg: `Destinatari sconosciuti: ${ignoti.join(", ")}` });

    (sez.serie || []).forEach((s, j) => {
      const dove = `${sez.titolo || "sezione " + (i + 1)} → serie ${j + 1}`;
      if (!s.notazione) problemi.push({ campo: dove, msg: "Manca la notazione" });
      // Partenze, virate, lavoro a secco: stanno nella seduta senza fare metri.
      if (s.senzaMetri) return;
      if (!Number(s.metri)) problemi.push({ campo: dove, msg: "Metri a zero" });
      if (!s.zona) problemi.push({ campo: dove, msg: "Zona non indicata" });
      else if (!zoneValide.includes(s.zona))
        problemi.push({ campo: dove, msg: `Zona "${s.zona}" non riconosciuta` });
    });
  });

  return problemi;
}

// ---------------------------------------------------------------------
// Da SwimCoach AI a CorsiaPro: un solo punto di contatto.
// Adatta i nomi dei campi alla forma delle sezioni di SwimCoach.
// ---------------------------------------------------------------------
export function daSwimCoach(workout, { societaId, categorie = [] }) {
  return {
    societa_id: societaId,
    data: workout.data || new Date().toISOString().slice(0, 10),
    categorie,
    origine: "swimcoach",
    riferimento_esterno: workout.id ? String(workout.id) : null,
    titolo: workout.titolo || workout.nome || "",
    fase: workout.fase || null,
    sezioni: (workout.sezioni || []).map((sez) => ({
      titolo: sez.titolo || sez.nome || "",
      destinatari: sez.destinatari?.length ? sez.destinatari : [TUTTI],
      serie: (sez.serie || sez.items || []).map((s) => ({
        notazione: s.notazione || "",
        zona: s.zona || "",
        metri: Number(s.metri) || 0,
        recupero: s.recupero || s.partenza || "",
        note: s.note || "",
      })),
    })),
  };
}


// ---------------------------------------------------------------------
// RAGGRUPPAMENTI PER LA SCELTA DELLE CATEGORIE
// Un flag seleziona più codici insieme, come li tratti in vasca:
// gli Esordienti B nuotano assieme, i Ragazzi 3 restano a parte.
// ---------------------------------------------------------------------
export const RAGGRUPPAMENTI = [
  { nome: "Propaganda",   codici: ["PROP_01", "PROP_2"] },
  { nome: "Teen",         codici: ["TEEN_0", "TEEN_1", "TEEN_2"] },
  { nome: "Esordienti B", codici: ["ESO_B1", "ESO_B2"] },
  { nome: "Esordienti A", codici: ["ESO_A1", "ESO_A2"] },
  { nome: "Ragazzi 1-2",  codici: ["RAG_1", "RAG_2"] },
  { nome: "Ragazzi 3",    codici: ["RAG_3M"] },
  { nome: "Juniores",     codici: ["JUN_1", "JUN_2"] },
  { nome: "Cadetti",      codici: ["CAD_1", "CAD_2"] },
  { nome: "Senior",       codici: ["SEN_1", "SEN_2"] },
  { nome: "Assoluti",     codici: ["ASS"] },
  { nome: "Master",       codici: ["MAS"] },
];

// Filtri del calendario: come guardi la settimana quando pianifichi.
export const MACRO_CALENDARIO = [
  { id: "tutte",      nome: "Tutte",        codici: null },
  { id: "propaganda", nome: "Propaganda",   codici: ["PROP_01", "PROP_2"] },
  { id: "teen",       nome: "Teen",         codici: ["TEEN_0", "TEEN_1", "TEEN_2"] },
  { id: "eso_b",      nome: "Esordienti B", codici: ["ESO_B1", "ESO_B2"] },
  { id: "eso_a",      nome: "Esordienti A", codici: ["ESO_A1", "ESO_A2"] },
  { id: "ragazzi",    nome: "Ragazzi",      codici: ["RAG_1", "RAG_2", "RAG_3M"] },
  { id: "jcs",        nome: "J/C/S e Assoluti", codici: ["JUN_1", "JUN_2", "CAD_1", "CAD_2", "SEN_1", "SEN_2", "ASS"] },
  { id: "master",     nome: "Master",       codici: ["MAS"] },
];

// Un elemento (seduta o gara) rientra nel filtro se una delle sue
// categorie è fra quelle del macro-gruppo.
export function rientraNelMacro(categorie, codici) {
  if (!codici) return true;
  const c = categorie || [];
  if (c.length === 0) return true;        // senza categorie resta sempre visibile
  return c.some((x) => codici.includes(x));
}

// ---------------------------------------------------------------------
// STAGIONI — partono a settembre. "2025/26", "2026/27", ...
// ---------------------------------------------------------------------
export function stagioneDa(annoIniziale) {
  return `${annoIniziale}/${String(annoIniziale + 1).slice(2)}`;
}

export function annoInizialeDi(stagione) {
  const n = parseInt(String(stagione).slice(0, 4), 10);
  return isNaN(n) ? null : n;
}

// La prima stagione gestita: prima non c'erano dati.
export const STAGIONE_MINIMA = "2025/26";

// Elenco per il selettore: tre stagioni, dalla corrente in avanti, mai
// prima della minima. Le stagioni già presenti nel database entrano
// comunque, purché non siano più vecchie della minima.
export function stagioniProposte(daDatabase = [], corrente = stagioneCorrente(), quante = 3) {
  const minimo = annoInizialeDi(STAGIONE_MINIMA);
  const partenza = Math.max(minimo, annoInizialeDi(corrente) || minimo);

  const insieme = new Set();
  for (let i = 0; i < quante; i++) insieme.add(stagioneDa(partenza + i));
  for (const s of daDatabase) {
    const a = annoInizialeDi(s);
    if (a && a >= minimo) insieme.add(stagioneDa(a));
  }
  return [...insieme].sort().reverse();
}


// ---------------------------------------------------------------------
// FASCE DI UNA STAGIONE QUALSIASI
// Le fasce d'età scalano di un anno esatto ogni stagione. Basta averle
// inserite UNA volta: per le altre stagioni si proiettano spostando gli
// anni della differenza. Così cambiando stagione tutta la squadra passa
// di categoria, senza compilare nuove tabelle a settembre.
// ---------------------------------------------------------------------
export function fasceRisolte(tutte, stagione) {
  const perStagione = {};
  for (const r of tutte || []) {
    (perStagione[r.stagione] ||= []).push(r);
  }

  if (perStagione[stagione]?.length) {
    return { fasce: perStagione[stagione], proiettata: false, base: stagione, scarto: 0 };
  }

  const target = annoInizialeDi(stagione);
  const anni = Object.keys(perStagione).map(annoInizialeDi).filter((x) => x != null);
  if (!target || anni.length === 0) return { fasce: [], proiettata: false, base: null, scarto: 0 };

  // La stagione compilata più vicina fa da riferimento.
  const base = anni.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const scarto = target - base;

  const fasce = perStagione[stagioneDa(base)].map((r) => ({
    ...r,
    stagione,
    anno_nascita_da: r.anno_nascita_da + scarto,
    anno_nascita_a: r.anno_nascita_a + scarto,
  }));

  return { fasce, proiettata: true, base: stagioneDa(base), scarto };
}

// ---------------------------------------------------------------------
// PERIODIZZAZIONE
// Quattro fasi, generate a ritroso dalla gara obiettivo. Le durate sono
// una PROPOSTA: si trascinano. Il totale (21 settimane) segue il
// macrociclo che usiamo anche in SwimCoach.
// ---------------------------------------------------------------------
export const FASI = [
  { codice: 'generale',  nome: 'Generale',  settimane: 6, colore: '#3B82F6',
    zone: 'A1 · A2, volume alto, tecnica' },
  { codice: 'speciale',  nome: 'Speciale',  settimane: 8, colore: '#06B6D4',
    zone: 'A2 · B1 su fondo aerobico' },
  { codice: 'specifica', nome: 'Specifica', settimane: 5, colore: '#F59E0B',
    zone: 'B1 · B2 e ritmo gara, volume in calo' },
  { codice: 'tapering',  nome: 'Tapering',  settimane: 2, colore: '#EF4444',
    zone: 'C1 · C3, volume ridotto, freschezza' },
];

export const faseDi = (codice) => FASI.find((f) => f.codice === codice);

const giorno = (iso, delta) => {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

// Costruisce le quattro fasce all'indietro: il tapering finisce il
// giorno prima della gara, e a ritroso si incastrano le altre.
//
// Il macrociclo dura 21 settimane, ma la stagione comincia prima: se
// passi inizioStagione, la fase generale parte da lì e si allunga fino
// all'attacco del macrociclo. Con un obiettivo ad aprile e la stagione
// aperta a settembre, la generale copre da settembre a fine novembre.
export function proponiFasi(dataGara, { durate = null, inizioStagione = null } = {}) {
  const settimane = durate || Object.fromEntries(FASI.map((f) => [f.codice, f.settimane]));
  const blocchi = [];
  let fine = giorno(dataGara, -1);

  for (const f of [...FASI].reverse()) {
    const giorni = (settimane[f.codice] || f.settimane) * 7;
    const inizio = giorno(fine, -(giorni - 1));
    blocchi.unshift({ fase: f.codice, dal: inizio, al: fine });
    fine = giorno(inizio, -1);
  }

  if (inizioStagione) {
    const primo = blocchi[0];
    if (inizioStagione < primo.dal) {
      primo.dal = inizioStagione;                       // generale allungata
    } else {
      // Stagione aperta tardi: la generale si accorcia, mai sotto la settimana.
      const minimo = giorno(primo.al, -6);
      primo.dal = inizioStagione > minimo ? minimo : inizioStagione;
    }
  }

  return blocchi;
}

// Il 1° settembre dell'anno di apertura, come punto di partenza.
export function inizioStagionePredefinito(stagione) {
  const anno = annoInizialeDi(stagione);
  return anno ? `${anno}-09-01` : null;
}

export const giorniFra = (dal, al) =>
  Math.round((new Date(al + 'T12:00') - new Date(dal + 'T12:00')) / 86400000) + 1;

export const settimaneFra = (dal, al) => (giorniFra(dal, al) / 7).toFixed(1).replace('.0', '');

// Sposta il confine fra due fasi adiacenti, senza farle sparire.
export function spostaConfine(blocchi, indice, nuovoInizio) {
  const copia = blocchi.map((b) => ({ ...b }));
  const prima = copia[indice - 1];
  const dopo = copia[indice];
  if (!prima || !dopo) return copia;

  const minimo = giorno(prima.dal, 6);           // almeno una settimana
  const massimo = giorno(dopo.al, -6);
  let data = nuovoInizio;
  if (data < minimo) data = minimo;
  if (data > massimo) data = massimo;

  dopo.dal = data;
  prima.al = giorno(data, -1);
  return copia;
}

export const faseDelGiorno = (blocchi, iso) =>
  (blocchi || []).find((b) => iso >= b.dal && iso <= b.al) || null;


// ---------------------------------------------------------------------
// RIPARTENZA CALCOLATA DAL PASSO BASE
// Si scrive @@2:00 nel campo recupero: è il tempo base sui 100. L'app
// lo scala sulla distanza della singola ripetizione — 250 con base 2:00
// diventa @5:00 — e arrotonda ai 5 secondi, come si legge sul cronometro.
// La base resta memorizzata: se cambi la distanza, la partenza si rifà.
// ---------------------------------------------------------------------

// La distanza di UNA ripetizione: "12x75" → 75 · "300 stile" → 300
export function distanzaSingola(notazione) {
  const t = String(notazione || '').replace(/[×*]/g, 'x');
  let m = t.match(/(\d{1,3})\s*x\s*(\d{2,4})/);
  if (m) return +m[2];
  m = t.match(/(\d{2,4})/);
  return m ? +m[1] : null;
}

const inSecondi = (testo) => {
  const m = String(testo || '').match(/(\d{1,2})[:.'](\d{2})/);
  if (m) return +m[1] * 60 + +m[2];
  const soli = String(testo || '').match(/^(\d{1,3})$/);
  return soli ? +soli[1] : null;
};

const inTempo = (secondi) => {
  const s = Math.max(5, Math.round(secondi / 5) * 5);       // ai 5 secondi
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Restituisce { recupero, base } oppure null se non è una base.
export function ripartenzaDaBase(testo, notazione, suMetriPredefiniti = 100) {
  // "@@2:00" = base sui 100 · "@@0:35/25" = base sui 25
  const m = String(testo || '').trim().match(/^@@\s*([^/]+?)(?:\s*\/\s*(\d{2,3}))?$/);
  if (!m) return null;
  const suMetri = m[2] ? +m[2] : suMetriPredefiniti;
  const base = inSecondi(m[1]);
  const distanza = distanzaSingola(notazione);
  if (!base || !distanza) return null;
  return {
    recupero: `@${inTempo(base * (distanza / suMetri))}`,
    base: `${inTempo(base)}/${suMetri}`,
  };
}


// ---------------------------------------------------------------------
// DATE — sempre gg.mm.aaaa
// ---------------------------------------------------------------------
export function dataIt(iso) {
  if (!iso) return "";
  const [a, m, g] = String(iso).slice(0, 10).split("-");
  return g && m && a ? `${g}.${m}.${a}` : String(iso);
}

export function dataItLunga(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00").toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ---------------------------------------------------------------------
// DURATA STIMATA
// Si somma solo quello che ha una ripartenza: ripetizioni × tempo. Le
// serie senza partenza non si contano, e l'app lo dice invece di
// inventare un'andatura.
// ---------------------------------------------------------------------
const secondiDaRipartenza = (testo) => {
  const t = String(testo || "").replace("@", "").trim();
  let m = t.match(/^(\d{1,2})[:.'](\d{2})/);
  if (m) return +m[1] * 60 + +m[2];
  m = t.match(/^(\d{1,2})'\s*$/);              // "3'" = tre minuti
  if (m) return +m[1] * 60;
  m = t.match(/^(\d{1,3})"?\s*$/);             // "45" = quarantacinque secondi
  return m ? +m[1] : null;
};

export function ripetizioniDa(notazione) {
  const t = String(notazione || "").replace(/[×*]/g, "x");
  const m = t.match(/^\s*(\d{1,3})\s*x\s*\d/);
  return m ? +m[1] : 1;
}

export function durataStimata(sezioni) {
  let secondi = 0;
  let conRipartenza = 0;
  let senza = 0;

  for (const sez of sezioni || []) {
    for (const s of sez.serie || []) {
      if (!s.metri && !s.senzaMetri) continue;
      const base = secondiDaRipartenza(s.recupero);
      if (base) {
        secondi += base * ripetizioniDa(s.notazione);
        conRipartenza += 1;
      } else if (s.metri) {
        senza += 1;
      }
    }
  }
  return { secondi, conPartenza: conRipartenza, senzaPartenza: senza };
}

export function inOreMinuti(secondi) {
  const m = Math.round(secondi / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}'` : `${m}'`;
}
