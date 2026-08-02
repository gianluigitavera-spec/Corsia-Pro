// =====================================================================
// Tutte le query in un posto solo. I componenti non parlano mai
// direttamente con Supabase: così quando cambia lo schema si tocca qui.
// =====================================================================
import { sb } from './supabase';

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
  return ok(await sb.from('zone').select('*').order('ordine'));
}

export async function leggiCategorie() {
  return ok(await sb.from('categorie').select('*').order('ordine'));
}

export async function leggiFasce(stagione) {
  // Senza argomento restituisce tutte le stagioni: le mancanti si
  // proiettano lato client con fasceRisolte().
  let q = sb.from('categorie_stagione').select('*');
  if (stagione) q = q.eq('stagione', stagione);
  return ok(await q);
}


// ------------------------------------------------------------- atleti
export async function leggiAtleti(societaId) {
  return ok(
    await sb
      .from('atleti')
      .select('*')
      .eq('societa_id', societaId)
      .eq('attivo', true)
      .order('cognome')
  );
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
  let q = sb
    .from('sedute')
    .select('id, data, titolo, origine, categorie, sezioni')
    .eq('societa_id', societaId)
    .order('data', { ascending: false })
    .limit(60);
  if (da) q = q.gte('data', da);
  if (a) q = q.lte('data', a);
  return ok(await q);
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

export async function eliminaSeduta(id) {
  return ok(await sb.from('sedute').delete().eq('id', id).select());
}

// ----------------------------------------------------------- presenze
export async function leggiPresenze(sedutaId) {
  return ok(await sb.from('presenze').select('*').eq('seduta_id', sedutaId));
}

export async function segnaPresenza({ sedutaId, atletaId, societaId, stato }) {
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

// ------------------------------------------------------------- volumi
export async function volumiSeduta(sedutaId) {
  return ok(await sb.from('v_volume_seduta').select('*').eq('seduta_id', sedutaId));
}

export async function settimaneAtleti(societaId, dallaData) {
  return ok(
    await sb
      .from('v_settimana_atleta')
      .select('*')
      .eq('societa_id', societaId)
      .gte('settimana', dallaData)
      .order('settimana', { ascending: false })
  );
}

export async function caricoAtleti(societaId, dallaData) {
  return ok(
    await sb
      .from('v_carico_atleta')
      .select('*')
      .eq('societa_id', societaId)
      .gte('data', dallaData)
  );
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
export async function registrati(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
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

export async function tendenzaBenessere(societaId) {
  return ok(await sb.from('v_benessere_tendenza').select('*').eq('societa_id', societaId));
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
