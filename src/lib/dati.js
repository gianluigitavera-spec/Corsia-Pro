// =====================================================================
// Tutte le query in un posto solo. I componenti non parlano mai
// direttamente con Supabase: così quando cambia lo schema si tocca qui.
// =====================================================================
import { sb } from './supabase';
import * as locale from './locale';
import { metriPerSpecializzazione, zonePerSpecializzazione } from './dominio';

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ------------------------------------------------------------ accesso
export async function entra(email, password) {
  return ok(await sb.auth.signInWithPassword({ email, password }));
}

export async function esci() {
  await sb.auth.signOut();
}

export async function sessione() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ------------------------------------------------------------ società
export async function mieSocieta() {
  return ok(
    await sb.from('membri').select('ruolo, societa:societa_id (id, nome, citta)')
  );
}

// --------------------------------------------------- tabelle di appoggio
export async function leggiZone() {
  return locale.conRete('zone', async () =>
    ok(await sb.from('zone').select('*').order('ordine')));
}

export async function leggiCategorie() {
  return locale.conRete('categorie', async () =>
    ok(await sb.from('categorie').select('*').order('ordine')));
}

export async function leggiFasce(stagione) {
  // Senza argomento restituisce tutte le stagioni: le mancanti si
  // proiettano lato client con fasceRisolte().
  return locale.conRete(`fasce:${stagione || 'tutte'}`, async () => {
    let q = sb.from('categorie_stagione').select('*');
    if (stagione) q = q.eq('stagione', stagione);
    return ok(await q);
  });
}


// ------------------------------------------------------------- atleti
export async function leggiAtleti(societaId) {
  return locale.conRete(`atleti:${societaId}`, async () => ok(
    await sb
      .from('atleti')
      .select('*')
      .eq('societa_id', societaId)
      .eq('attivo', true)
      .order('cognome')
  ));
}

export async function salvaAtleta(atleta) {
  if (atleta.id) {
    const { id, ...resto } = atleta;
    return ok(await sb.from('atleti').update(resto).eq('id', id).select().single());
  }
  return ok(await sb.from('atleti').insert(atleta).select().single());
}

export async function archiviaAtleta(id) {
  return ok(await sb.from('atleti').update({ attivo: false }).eq('id', id).select().single());
}

// Tutti gli atleti della società, archiviati compresi: serve all'import
// per riconoscere chi c'è già. Chi è stato archiviato non compare negli
// elenchi ma occupa lo stesso la chiave, quindi va guardato anche lui.
export async function leggiAtletiTutti(societaId) {
  return ok(
    await sb
      .from('atleti')
      .select('id, nome, cognome, anno_nascita, attivo')
      .eq('societa_id', societaId)
  );
}

export async function importaAtleti(righe) {
  if (!righe.length) return [];
  return ok(await sb.from('atleti').insert(righe).select());
}

// Quello che il gruppo ha davvero nuotato. Si salvano SOLO gli
// scostamenti: null vuol dire "andata come programmata", e il programma
// (sezioni) non viene mai riscritto.
// Va in coda come l'appello: si registra a bordo vasca, dove la linea è
// quella che è.
async function inviaSvolto({ sedutaId, svolto }) {
  return ok(await sb.from('sedute').update({ svolto }).eq('id', sedutaId).select());
}

export async function salvaSvolto(sedutaId, svolto) {
  const chiave = `svolto:${sedutaId}`;
  try {
    const esito = await Promise.race([
      inviaSvolto({ sedutaId, svolto }),
      new Promise((_, no) => setTimeout(() => no(new Error('tempo scaduto')), 4000)),
    ]);
    locale.togli(chiave);
    locale.segnalaLinea(true);
    return esito;
  } catch {
    locale.accoda(chiave, { tipo: 'svolto', sedutaId, svolto });
    locale.segnalaLinea(false);
    return null;
  }
}

// ------------------------------------------- atleti: azioni di massa
export async function aggiornaAtleti(ids, campi) {
  if (!ids.length) return [];
  return ok(await sb.from('atleti').update(campi).in('id', ids).select());
}

export async function archiviaAtleti(ids) {
  return aggiornaAtleti(ids, { attivo: false });
}

// Chi ha già lasciato una traccia non si cancella: sparirebbero anche le
// presenze, e le percentuali di frequenza delle stagioni passate
// cambierebbero da sole. Torna l'elenco di chi è stato risparmiato.
export async function eliminaAtleti(ids) {
  if (!ids.length) return { eliminati: [], trattenuti: [] };

  const conPresenze = ok(
    await sb.from('presenze').select('atleta_id').in('atleta_id', ids)
  ).map((r) => r.atleta_id);
  const conBenessere = ok(
    await sb.from('benessere').select('atleta_id').in('atleta_id', ids)
  ).map((r) => r.atleta_id);

  const trattenuti = [...new Set([...conPresenze, ...conBenessere])];
  const eliminabili = ids.filter((id) => !trattenuti.includes(id));

  if (eliminabili.length) {
    ok(await sb.from('atleti').delete().in('id', eliminabili).select());
  }
  return { eliminati: eliminabili, trattenuti };
}

// ------------------------------------------------------------- sedute
export async function leggiSedute(societaId, { da, a } = {}) {
  return locale.conRete(`sedute:${societaId}:${da || ''}:${a || ''}`, async () => {
    // Il tetto serve solo all'elenco senza filtri, per non tirare giù
    // tutto. Quando c'è un periodo il tetto va tolto: con 60 una stagione
    // intera si fermava a febbraio e il carico risultava dimezzato senza
    // che niente lo dicesse.
    let q = sb
      .from('sedute')
      .select('id, data, titolo, origine, categorie, sezioni, svolto')
      .eq('societa_id', societaId)
      .order('data', { ascending: false })
      .limit(da || a ? 1000 : 60);
    if (da) q = q.gte('data', da);
    if (a) q = q.lte('data', a);
    return ok(await q);
  });
}

export async function leggiSeduta(id) {
  return ok(await sb.from('sedute').select('*').eq('id', id).single());
}

export async function salvaSeduta(seduta) {
  if (seduta.id) {
    const { id, creata_da, created_at, updated_at, ...resto } = seduta;
    return ok(await sb.from('sedute').update(resto).eq('id', id).select().single());
  }
  return ok(await sb.from('sedute').insert(seduta).select().single());
}

// Copia una o più sedute su date nuove. Un insert solo, così o entrano
// tutte o non entra niente: una settimana copiata a metà sarebbe peggio
// di una non copiata.
export async function duplicaSedute(copie) {
  if (!copie.length) return [];
  return ok(await sb.from('sedute').insert(copie).select());
}

export async function eliminaSeduta(id) {
  return ok(await sb.from('sedute').delete().eq('id', id).select());
}

// ----------------------------------------------------------- presenze
export async function leggiPresenze(sedutaId) {
  // Alla copia dal magazzino si sovrappone quello che hai segnato e non
  // è ancora partito, se no l'appello sembrerebbe tornare indietro.
  const salvate = await locale.conRete(`presenze:${sedutaId}`, async () =>
    ok(await sb.from('presenze').select('*').eq('seduta_id', sedutaId)));

  const inCoda = locale.coda().filter((v) => v.tipo === 'presenza' && v.sedutaId === sedutaId);
  if (!inCoda.length) return salvate;

  const per = new Map(salvate.map((p) => [p.atleta_id, p]));
  inCoda.forEach((v) => {
    if (v.stato) per.set(v.atletaId, { seduta_id: v.sedutaId, atleta_id: v.atletaId, stato: v.stato });
    else per.delete(v.atletaId);
  });
  return [...per.values()];
}

// L'invio vero, senza rete di protezione: lo usa sia il tocco a bordo
// vasca sia lo svuotamento della coda.
async function inviaPresenza({ sedutaId, atletaId, societaId, stato }) {
  if (!stato) {
    // Nessuno stato = appello non fatto: la riga si toglie, non si "azzera".
    return ok(
      await sb.from('presenze').delete().eq('seduta_id', sedutaId).eq('atleta_id', atletaId).select()
    );
  }
  return ok(
    await sb
      .from('presenze')
      .upsert(
        { seduta_id: sedutaId, atleta_id: atletaId, societa_id: societaId, stato },
        { onConflict: 'seduta_id,atleta_id' }
      )
      .select()
  );
}

// A bordo vasca non si aspetta: si prova a mandare, e se la linea non
// risponde entro poco la riga va in coda e l'appello va avanti. Non
// torna mai un errore per colpa della rete — sarebbe l'unico modo di
// far smettere di usare l'app.
export async function segnaPresenza({ sedutaId, atletaId, societaId, stato }) {
  const chiave = `presenza:${sedutaId}:${atletaId}`;
  try {
    const esito = await Promise.race([
      inviaPresenza({ sedutaId, atletaId, societaId, stato }),
      new Promise((_, no) => setTimeout(() => no(new Error('tempo scaduto')), 4000)),
    ]);
    locale.togli(chiave);
    locale.segnalaLinea(true);
    return esito;
  } catch {
    locale.accoda(chiave, { tipo: 'presenza', sedutaId, atletaId, societaId, stato });
    locale.segnalaLinea(false);
    return null;
  }
}

// ------------------------------------------------------------- volumi

// IL CARICO, CONTATO SUI METRI VERI
//
// Le viste v_carico_atleta e v_carico_zona leggono le sedute e basta:
// non sanno niente della colonna svolto, quindi danno il programma. Il
// conto lo rifacciamo qui, dove svolto lo abbiamo: stesse regole di
// prima (i metri sono quelli della propria specializzazione; il ritardo
// conta perché in acqua c'era, il giustificato no), ma sui metri
// davvero nuotati.
//
// Torna le righe nella stessa forma della vista, così le schede che le
// leggono non cambiano di una virgola.
export async function caricoReale(societaId, { da, a, specializzazione = 'Generale' }) {
  const sedute = await leggiSedute(societaId, { da, a });
  if (!sedute.length) return { righe: [], zone: [] };

  const [atleti, presenze] = await Promise.all([
    leggiAtleti(societaId),
    leggiPresenzeSedute(sedute.map((s) => s.id)),
  ]);

  const perAtleta = new Map(atleti.map((x) => [x.id, x]));
  const perSeduta = new Map(sedute.map((s) => [s.id, s]));

  const righe = [];
  for (const p of presenze) {
    const seduta = perSeduta.get(p.seduta_id);
    const atleta = perAtleta.get(p.atleta_id);
    if (!seduta || !atleta) continue;
    const spec = atleta.specializzazione || 'Generale';
    const inAcqua = p.stato === 'P' || p.stato === 'R';
    righe.push({
      atleta_id: atleta.id,
      cognome: atleta.cognome,
      nome: atleta.nome,
      specializzazione: spec,
      stato: p.stato,
      data: seduta.data,
      metri_previsti: metriPerSpecializzazione(seduta.sezioni, spec),
      metri_nuotati: inAcqua ? metriPerSpecializzazione(seduta.sezioni, spec, seduta.svolto) : 0,
    });
  }

  // Ripartizione per zona, seduta per seduta. Porta anche le categorie
  // della seduta, così chi filtra per gruppo non deve riandare a leggerle.
  const zone = sedute.flatMap((s) =>
    zonePerSpecializzazione(s.sezioni, specializzazione, s.svolto)
      .map((z) => ({ ...z, data: s.data, categorie: s.categorie || [], specializzazione }))
  );

  return { righe, zone };
}

export async function leggiPresenzeSedute(sedutaIds) {
  if (!sedutaIds.length) return [];
  return locale.conRete(`presenze-periodo:${sedutaIds.length}:${sedutaIds[0]}`, async () =>
    ok(await sb.from('presenze').select('seduta_id, atleta_id, stato').in('seduta_id', sedutaIds)));
}



// ----------------------------------------------------------- adesioni
export async function chiediAccesso(codice, messaggio) {
  const { data, error } = await sb.rpc('richiedi_accesso', {
    p_codice: codice,
    p_messaggio: messaggio || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function mieRichieste() {
  return ok(await sb.from('richieste').select('*').order('created_at', { ascending: false }));
}

export async function richiesteDaDecidere(societaId) {
  return ok(
    await sb
      .from('richieste')
      .select('*')
      .eq('societa_id', societaId)
      .eq('stato', 'in_attesa')
      .order('created_at')
  );
}

export async function decidiRichiesta(richiestaId, approva, ruolo = 'collega') {
  const { data, error } = await sb.rpc('decidi_richiesta', {
    p_richiesta: richiestaId,
    p_approva: approva,
    p_ruolo: ruolo,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function elencoMembri(societaId) {
  const { data, error } = await sb.rpc('elenco_membri', { p_societa: societaId });
  if (error) throw new Error(error.message);
  return data;
}

export async function rigeneraCodice(societaId) {
  const { data, error } = await sb.rpc('rigenera_codice', { p_societa: societaId });
  if (error) throw new Error(error.message);
  return data;
}

export async function impostaRuolo(societaId, utenteId, ruolo) {
  const { error } = await sb.rpc('imposta_ruolo', {
    p_societa: societaId,
    p_utente: utenteId,
    p_ruolo: ruolo,
  });
  if (error) throw new Error(error.message);
}

export async function rimuoviMembro(societaId, utenteId) {
  const { error } = await sb.rpc('rimuovi_membro', { p_societa: societaId, p_utente: utenteId });
  if (error) throw new Error(error.message);
}

export async function leggiSocieta(societaId) {
  return ok(await sb.from('societa').select('*').eq('id', societaId).single());
}

// --------------------------------------------------------------- gare
export async function leggiGare(societaId, da, a) {
  return ok(
    await sb.from('gare').select('*').eq('societa_id', societaId)
      .gte('data', da).lte('data', a).order('data')
  );
}

export async function salvaGara(gara) {
  if (gara.id) {
    const { id, creata_da, created_at, ...resto } = gara;
    return ok(await sb.from('gare').update(resto).eq('id', id).select().single());
  }
  return ok(await sb.from('gare').insert(gara).select().single());
}

export async function eliminaGara(id) {
  return ok(await sb.from('gare').delete().eq('id', id).select());
}


// ------------------------------------------------------------ account
// Il nome finisce nei metadati dell'utente: nessuna tabella nuova,
// nessuna migrazione. Da lì lo legge la query degli iscritti, e serve a
// sapere chi è chi senza doverlo indovinare dall'indirizzo email.
export async function registrati(email, password, nome) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: nome ? { data: { nome_completo: nome.trim() } } : undefined,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function creaSocieta(nome, citta) {
  // Passa da una funzione lato server: l'insert dal browser inciampava
  // nella policy RLS e non riusciva a rileggere la riga appena creata.
  const { data, error } = await sb.rpc('crea_societa', {
    p_nome: nome,
    p_citta: citta || null,
  });
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
      throw new Error(
        'Sul database manca la funzione crea_societa: lancia la migrazione 010_crea_societa.sql nel SQL Editor.'
      );
    }
    throw new Error(error.message);
  }
  return data;
}

export async function aggiornaSocieta(id, campi) {
  return ok(await sb.from('societa').update(campi).eq('id', id).select().single());
}

export async function leggiStagioni() {
  const { data, error } = await sb.from('v_stagioni').select('stagione');
  if (error) return [];
  return (data || []).map((r) => r.stagione);
}

// ------------------------------------------------------------ benessere
export async function leggiBenessere(societaId, data) {
  return ok(await sb.from('v_benessere').select('*').eq('societa_id', societaId).eq('data', data));
}

export async function salvaBenessere(riga) {
  return ok(
    await sb.from('benessere')
      .upsert(riga, { onConflict: 'atleta_id,data' })
      .select()
  );
}


// ----------------------------------------------------------- frequenza
export async function leggiFrequenza(societaId) {
  return ok(await sb.from('v_frequenza').select('*').eq('societa_id', societaId));
}

// ----------------------------------------------------- periodizzazione
export async function leggiPeriodizzazione(societaId, codici) {
  let q = sb.from('periodizzazione').select('*').eq('societa_id', societaId).order('dal');
  if (codici?.length) q = q.overlaps('categorie', codici);
  return ok(await q);
}

// Le fasi di una categoria si riscrivono in blocco: prima si tolgono
// quelle che si sovrappongono, poi si inseriscono le nuove.
export async function salvaPeriodizzazione(societaId, codici, blocchi) {
  const { error: errCanc } = await sb
    .from('periodizzazione')
    .delete()
    .eq('societa_id', societaId)
    .overlaps('categorie', codici);
  if (errCanc) throw new Error(errCanc.message);

  if (!blocchi?.length) return [];
  return ok(
    await sb.from('periodizzazione').insert(
      blocchi.map((b) => ({
        societa_id: societaId,
        categorie: codici,
        fase: b.fase,
        dal: b.dal,
        al: b.al,
        gara_id: b.gara_id || null,
      }))
    ).select()
  );
}


// ------------------------------------------------------ inizio stagione
export async function leggiImpostazioniStagione(societaId, stagione) {
  const { data, error } = await sb
    .from('impostazioni_stagione')
    .select('*')
    .eq('societa_id', societaId)
    .eq('stagione', stagione)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function salvaInizioStagione(societaId, stagione, inizio) {
  return ok(
    await sb.from('impostazioni_stagione')
      .upsert({ societa_id: societaId, stagione, inizio, updated_at: new Date().toISOString() },
              { onConflict: 'societa_id,stagione' })
      .select()
  );
}

// ----------------------------------------------------------- esercizi
export async function leggiEsercizi(societaId) {
  // Comuni (societa_id null) più quelli della squadra, in un colpo solo.
  return ok(
    await sb.from('esercizi').select('*').eq('attivo', true)
      .or(`societa_id.is.null,societa_id.eq.${societaId}`)
      .order('codice')
  );
}

export async function salvaEsercizio(esercizio) {
  if (esercizio.id) {
    const { id, created_at, creato_da, ...resto } = esercizio;
    return ok(await sb.from('esercizi').update(resto).eq('id', id).select().single());
  }
  return ok(await sb.from('esercizi').insert(esercizio).select().single());
}

export async function archiviaEsercizio(id) {
  return ok(await sb.from('esercizi').update({ attivo: false }).eq('id', id).select());
}

export async function segnaStatoLink(id, ok_) {
  return ok(
    await sb.from('esercizi')
      .update({ link_ok: ok_, link_visto_il: new Date().toISOString() })
      .eq('id', id).select()
  );
}

export async function leggiSettimana(societaId, settimana) {
  return ok(
    await sb.from('esercizi_settimana')
      .select('*, esercizio:esercizio_id (*)')
      .eq('societa_id', societaId).eq('settimana', settimana)
      .order('ordine')
  );
}

export async function aggiungiAllaSettimana(societaId, settimana, esercizioId, ordine = 0) {
  return ok(
    await sb.from('esercizi_settimana')
      .upsert({ societa_id: societaId, settimana, esercizio_id: esercizioId, ordine },
              { onConflict: 'societa_id,settimana,esercizio_id' })
      .select()
  );
}

export async function togliDallaSettimana(societaId, settimana, esercizioId) {
  return ok(
    await sb.from('esercizi_settimana').delete()
      .eq('societa_id', societaId).eq('settimana', settimana).eq('esercizio_id', esercizioId)
      .select()
  );
}

// ------------------------------------------------------ obiettivi fase
export async function leggiObiettivi(societaId, codici) {
  let q = sb.from('obiettivi_fase').select('*').eq('societa_id', societaId);
  if (codici?.length) q = q.overlaps('categorie', codici);
  return ok(await q);
}

export async function salvaObiettivo(societaId, codici, fase, ripartizione, kmSettimana) {
  return ok(
    await sb.from('obiettivi_fase')
      .upsert({
        societa_id: societaId,
        categorie: codici,
        fase,
        ripartizione,
        km_settimana: kmSettimana ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'societa_id,categorie,fase' })
      .select()
  );
}

export async function confrontoFasi(societaId, codici) {
  let q = sb.from('v_fase_confronto').select('*').eq('societa_id', societaId);
  if (codici?.length) q = q.overlaps('categorie', codici);
  return ok(await q);
}

// ----------------------------------------------------------- feedback
export async function inviaFeedback({ tipo, testo, versione, contesto, societa }) {
  const { data: u } = await sb.auth.getUser();
  // La tabella sta in public: è condivisa con SwimCoach.
  const { error } = await sb.schema('public').from('feedback').insert({
    app: 'corsiapro',
    tipo,
    testo: testo.trim(),
    versione,
    contesto,
    dispositivo: `${navigator.userAgent.slice(0, 180)} · ${window.innerWidth}x${window.innerHeight}`,
    user_id: u?.user?.id,
    email: u?.user?.email,
    societa: societa || null,
  });
  if (error) throw new Error(error.message);
}


// ---------------------------------------------------- svuotare la coda
// Si prova una voce alla volta e in ordine. Al primo fallimento ci si
// ferma: se la linea non c'è, insistere sulle altre serve solo a
// consumare batteria. Niente viene mai buttato via per un errore —
// resta in coda, con il numero dei tentativi, finché non passa.
export async function sincronizza() {
  const voci = locale.coda();
  if (!voci.length) return { inviate: 0, rimaste: 0 };

  let inviate = 0;
  for (const v of voci) {
    try {
      if (v.tipo === 'presenza') await inviaPresenza(v);
      else if (v.tipo === 'svolto') await inviaSvolto(v);
      else if (v.tipo === 'benessere') await salvaBenessere(v.riga);
      else { locale.togli(v.chiave); continue; }
      locale.togli(v.chiave);
      inviate++;
    } catch {
      locale.segnaTentativo(v.chiave);
      locale.segnalaLinea(false);
      break;
    }
  }
  if (inviate) locale.segnalaLinea(true);
  return { inviate, rimaste: locale.coda().length };
}

export { osservaLinea, coda, salvaBozza, leggiBozza, buttaBozza } from './locale';
