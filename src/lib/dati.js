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
  return ok(await sb.from('categorie_stagione').select('*').eq('stagione', stagione));
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

export async function importaAtleti(righe) {
  return ok(await sb.from('atleti').insert(righe).select());
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
  const { data: u } = await sb.auth.getUser();
  return ok(
    await sb.from('societa')
      .insert({ nome: nome.trim(), citta: citta?.trim() || null, creata_da: u.user.id })
      .select().single()
  );
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
