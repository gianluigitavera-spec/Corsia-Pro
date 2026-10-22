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

// Su iOS 27, dall'app installata sulla Home, «Invia» non faceva niente:
// l'errore della condivisione veniva inghiottito insieme ad «Annulla».
// Dalla 0.58.1 «Annulla» (AbortError) resta in silenzio, ogni altro
// errore torna a chi chiama col suo nome e messaggio, e accanto si dice
// se l'app è aperta installata o nel browser: è quello che serve sapere
// quando arriva una segnalazione dal campo.
const comeAperta = () => {
  const installata = window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches;
  return installata ? 'app installata' : 'browser';
};

const descriviErrore = (via, e) =>
  `${via}: ${e?.name || 'errore senza nome'} — ${e?.message || 'nessun messaggio'} (${comeAperta()})`;

export async function condividiSeduta(seduta, opzioni) {
  const testo = sedutaInTesto(seduta, opzioni);
  const titolo = `${seduta.titolo || 'Seduta'} — ${dataIt(seduta.data)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: titolo, text: testo });
      return 'condiviso';
    } catch (e) {
      if (e?.name === 'AbortError') return null;
      return { errore: descriviErrore('Invio non riuscito', e) };
    }
  }
  try {
    await navigator.clipboard.writeText(testo);
    return 'copiato';
  } catch (e) {
    return { errore: descriviErrore('Condivisione non disponibile e copia non riuscita', e) };
  }
}
