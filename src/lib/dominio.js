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
export function sedutaVuota({ data, gruppoId = null, categoria = null } = {}) {
  return {
    data: data || new Date().toISOString().slice(0, 10),
    gruppo_id: gruppoId,
    categoria,
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
  return { notazione: "", zona: "", metri: 0, recupero: "", note: "" };
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
  if (!seduta?.gruppo_id && !seduta?.categoria)
    problemi.push({ campo: "gruppo", msg: "Serve un gruppo o una categoria" });

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
export function daSwimCoach(workout, { societaId, gruppoId, categoria = null }) {
  return {
    societa_id: societaId,
    data: workout.data || new Date().toISOString().slice(0, 10),
    gruppo_id: gruppoId,
    categoria,
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
