// Controllo prima della consegna: ogni nome usato da un componente e
// preso dai moduli di libreria dev'essere davvero importato ed esportato.
// La build non se ne accorge — l'app sì, e crolla a schermo.
import { readFileSync, readdirSync } from 'fs';

const esportati = (file) => {
  const t = readFileSync(file, 'utf8');
  return new Set([
    ...t.matchAll(/export\s+(?:async\s+)?(?:const|function|let|class)\s+(\w+)/g),
    ...t.matchAll(/export\s*\{([^}]+)\}/g),
  ].flatMap((m) => (m[1].includes(',') || m[0].startsWith('export {')
    ? m[1].split(',').map((x) => x.trim().split(' as ').pop())
    : [m[1]])));
};

const librerie = {
  '../lib/dominio': esportati('src/lib/dominio.js'),
  '../lib/analizzatore': esportati('src/lib/analizzatore.js'),
  '../lib/colori': esportati('src/lib/colori.js'),
  '../lib/video': esportati('src/lib/video.js'),
  '../lib/testoSeduta': esportati('src/lib/testoSeduta.js'),
};

let problemi = 0;
for (const nome of readdirSync('src/componenti')) {
  const file = `src/componenti/${nome}`;
  const testo = readFileSync(file, 'utf8');
  // Via gli import E le definizioni locali: un nome definito nel file
  // non è un uso mancante, anche se la libreria esporta lo stesso nome.
  const senzaImport = testo.replace(/^import[\s\S]*?from\s+'[^']+';/gm, '');
  const locali = new Set([
    ...senzaImport.matchAll(/(?:const|let|function)\s+(\w+)/g),
  ].map((m) => m[1]));

  for (const [modulo, disponibili] of Object.entries(librerie)) {
    const imp = testo.match(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${modulo}'`));
    const presi = imp ? imp[1].split(',').map((x) => x.trim().split(' as ')[0]).filter(Boolean) : [];

    // usato ma non importato
    for (const simbolo of disponibili) {
      if (presi.includes(simbolo) || locali.has(simbolo)) continue;
      if (new RegExp(`(?<![\\w.])${simbolo}\\s*\\(`).test(senzaImport)) {
        console.log(`✗ ${nome}: usa ${simbolo}() ma non lo importa da ${modulo}`);
        problemi++;
      }
    }
    // importato ma inesistente
    for (const simbolo of presi) {
      if (!disponibili.has(simbolo)) {
        console.log(`✗ ${nome}: importa ${simbolo} da ${modulo}, che non lo esporta`);
        problemi++;
      }
    }
  }
}
console.log(problemi === 0 ? '✓ import a posto' : `${problemi} problemi trovati`);
process.exit(problemi ? 1 : 0);
