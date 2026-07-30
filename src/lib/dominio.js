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
  const t = String(testo || "").trim();
  if (!t) return "";
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

// Elenco per il selettore: quelle presenti nel database più le due
// adiacenti a quella corrente, senza doppioni.
export function stagioniProposte(daDatabase = [], corrente = stagioneCorrente()) {
  const a = annoInizialeDi(corrente);
  const insieme = new Set([...daDatabase, corrente]);
  if (a) { insieme.add(stagioneDa(a - 1)); insieme.add(stagioneDa(a + 1)); }
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
