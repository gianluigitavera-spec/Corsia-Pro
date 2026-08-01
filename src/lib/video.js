// =====================================================================
// Verifica dei link ai video.
//
// Il browser non può interrogare un sito qualsiasi per sapere se una
// pagina esiste: le regole di sicurezza glielo impediscono. YouTube però
// espone un servizio pubblico (oEmbed) che risponde con un errore se il
// video è stato rimosso — e quello si può leggere.
//
// Per gli altri siti non si controlla nulla: c'è il tasto "segnala rotto"
// per chi ci clicca e non trova niente.
// =====================================================================

export function idYoutube(url) {
  const t = String(url || '');
  const m =
    t.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export const anteprimaYoutube = (url) => {
  const id = idYoutube(url);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
};

// true = vivo · false = rimosso · null = non verificabile
export async function verificaLink(url) {
  const id = idYoutube(url);
  if (!id) return null;
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`
    );
    if (r.ok) return true;
    if (r.status === 404 || r.status === 401 || r.status === 403) return false;
    return null;
  } catch {
    return null;               // niente rete: non è colpa del link
  }
}
