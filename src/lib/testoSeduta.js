// La seduta in testo semplice: per WhatsApp, per un'email, per gli appunti.
import { TUTTI, metriPerSpecializzazione, SPECIALIZZAZIONI, dataIt, durataStimata, inOreMinuti, eSecco } from './dominio';


export function sedutaInTesto(seduta, { nomeSquadra } = {}) {
  const r = [];
  r.push(`${seduta.titolo || 'Seduta'} — ${dataIt(seduta.data)}`);
  if (nomeSquadra) r.push(nomeSquadra);
  if (seduta.categorie?.length) r.push(seduta.categorie.join(' · '));
  r.push('');

  for (const sez of seduta.sezioni || []) {
    const dest = sez.destinatari?.length ? sez.destinatari : [TUTTI];
    const chi = dest.includes(TUTTI) ? '' : ` [${dest.join(', ')}]`;
    const metri = (sez.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0);
    const quanto = eSecco(sez)
      ? `a secco${sez.durataMin ? ` · ${sez.durataMin}'` : ''}`
      : `${metri} m`;
    r.push(`${(sez.titolo || 'Sezione').toUpperCase()}${chi} — ${quanto}`);
    for (const s of sez.serie || []) {
      // Nel testo il rientro non c'è: la fine della ripetizione si scrive.
      if (s.chiudeBlocco) { r.push('  · (fine ripetizione)'); continue; }
      const pezzi = [s.notazione];
      if (s.recupero) pezzi.push(s.recupero);
      if (s.zona) pezzi.push(`(${s.zona})`);
      r.push(`  · ${pezzi.filter(Boolean).join(' ')}`);
      if (s.note) r.push(`      ${s.note}`);
    }
    r.push('');
  }

  const durata = durataStimata(seduta.sezioni);
  if (durata.secondi) r.push(`Durata stimata: ~${inOreMinuti(durata.secondi)}`);
  r.push('Volumi:');
  for (const spec of SPECIALIZZAZIONI) {
    const m = metriPerSpecializzazione(seduta.sezioni, spec);
    if (m > 0) r.push(`  ${spec}: ${m} m`);
  }
  return r.join('\n');
}

// PROVA iOS (ramo prova-ios, non per sviluppo): su iOS 27.0.1, dall'app
// installata sulla Home, «Invia» non fa niente. Qui l'errore non si
// inghiotte più: torna a chi chiama, che lo mostra a schermo col nome
// esatto, insieme a come è aperta l'app (installata o Safari).
const comeAperta = () => {
  const installata = window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches;
  return installata ? 'app installata' : 'browser';
};

export async function condividiSeduta(seduta, opzioni) {
  const testo = sedutaInTesto(seduta, opzioni);
  const titolo = `${seduta.titolo || 'Seduta'} — ${dataIt(seduta.data)}`;
  if (!navigator.share) {
    try { await navigator.clipboard.writeText(testo); } catch { /* sotto */ }
    return { errore: `navigator.share non disponibile (${comeAperta()}). Testo copiato negli appunti, se il telefono l'ha permesso.` };
  }
  try {
    await navigator.share({ title: titolo, text: testo });
    return 'condiviso';
  } catch (e) {
    // AbortError è anche il tasto Annulla: in prova si mostra comunque.
    return { errore: `navigator.share: ${e?.name || 'errore senza nome'} — ${e?.message || 'nessun messaggio'} (${comeAperta()})` };
  }
}
