// La seduta in testo semplice: per WhatsApp, per un'email, per gli appunti.
import { TUTTI, metriPerSpecializzazione, SPECIALIZZAZIONI } from './dominio';

const dataIt = (d) => (d ? new Date(d + 'T12:00').toLocaleDateString('it-IT') : '');

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
    r.push(`${(sez.titolo || 'Sezione').toUpperCase()}${chi} — ${metri} m`);
    for (const s of sez.serie || []) {
      const pezzi = [s.notazione];
      if (s.recupero) pezzi.push(s.recupero);
      if (s.zona) pezzi.push(`(${s.zona})`);
      r.push(`  · ${pezzi.filter(Boolean).join(' ')}`);
      if (s.note) r.push(`      ${s.note}`);
    }
    r.push('');
  }

  r.push('Volumi:');
  for (const spec of SPECIALIZZAZIONI) {
    const m = metriPerSpecializzazione(seduta.sezioni, spec);
    if (m > 0) r.push(`  ${spec}: ${m} m`);
  }
  return r.join('\n');
}

export async function condividiSeduta(seduta, opzioni) {
  const testo = sedutaInTesto(seduta, opzioni);
  const titolo = `${seduta.titolo || 'Seduta'} — ${dataIt(seduta.data)}`;
  if (navigator.share) {
    try { await navigator.share({ title: titolo, text: testo }); return 'condiviso'; }
    catch { /* annullato dall'utente */ return null; }
  }
  await navigator.clipboard.writeText(testo);
  return 'copiato';
}
