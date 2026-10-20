// =====================================================================
// LA STAMPA, CON IL NOME DEL FILE
//
// Il PDF è la stampa del browser, che come nome del file propone il
// titolo della pagina. Per la durata della stampa la pagina si chiama
// come il file, poi torna com'era. Si rimette a posto con afterprint; il
// focus è la rete di sicurezza per i browser dove afterprint non arriva,
// così il titolo non resta appeso.
//
// Un posto solo, per le sedute (nomeFileSeduta) e per il report presenze
// (nomeFileReport): il nome lo decide dominio.js, qui si stampa e basta.
// =====================================================================
export function stampaConNome(nome) {
  const prima = document.title;
  document.title = nome;
  const rimetti = () => {
    document.title = prima;
    window.removeEventListener('afterprint', rimetti);
    window.removeEventListener('focus', rimetti);
  };
  window.addEventListener('afterprint', rimetti);
  window.addEventListener('focus', rimetti);
  window.print();
}
