// Prova delle DITA BAGNATE: sul tocco nessun tasto o campo sotto i 44 px.
// Gira prima di ogni build (la trova prove.mjs).
//
// La regola sta in styles.css, in @media (pointer: coarse): tasti, campi
// e tendine almeno 44 px. Ma una regola più specifica fuori da quel
// blocco la batte in silenzio: `button.mini { min-height: 36px }` vince
// su `.mini { min-height: 44px }`, e sull'iPhone i tasti «mini» erano
// alti 36. Lo stesso per i campi a 32 e 34 px dell'editor e del
// revisore, e per ogni `style={{ minHeight: 34 }}` scritto in un
// componente: uno stile sull'elemento batte qualunque regola.
//
// Quindi due controlli, statici, sul testo:
//   1. styles.css — ogni regola che dà a qualcosa di toccabile
//      un'altezza sotto i 44 px deve essere battuta, dentro
//      @media (pointer: coarse), da una regola che la prende davvero:
//      stesso elemento finale, specificità almeno uguale, e se uguale
//      scritta dopo. Le regole DENTRO il blocco del tocco sotto i 44 px
//      sono già un errore.
//   2. i componenti — nessun minHeight sotto i 44 scritto sull'elemento,
//      salvo le caselle di spunta (la riga intorno è il bersaglio).
// Toccabile: input, select, textarea, button, e le classi che nei
// componenti stanno su un tasto o un campo (lette dai .jsx).
import { readFileSync, readdirSync } from 'node:fs';

const SOGLIA = 44;
let male = 0;
const segnala = (testo) => { male++; console.error(`✗ ${testo}`); };

// ---------------------------------------------------------------------
// Le classi che stanno su un tasto o un campo, dai componenti
// ---------------------------------------------------------------------
const componenti = readdirSync('./src/componenti').filter((f) => f.endsWith('.jsx'))
  .map((f) => ({ nome: f, testo: readFileSync(`./src/componenti/${f}`, 'utf8') }));
const classiToccabili = new Set();
for (const { testo } of componenti) {
  // Il tag d'apertura fino al primo `>` che non sia di una freccia.
  for (const m of testo.matchAll(/<(button|select|input|textarea)\b((?:[^>]|=>)*)>/g)) {
    const c = m[2].match(/className=(?:"([^"]+)"|\{`([^`]+)`\})/);
    const testoClassi = c ? (c[1] || c[2].replace(/\$\{[^}]*\}/g, ' ')) : '';
    for (const k of testoClassi.split(/\s+/).filter(Boolean)) classiToccabili.add(k);
  }
}

// ---------------------------------------------------------------------
// styles.css in regole: { selettori, dichiarazioni, media, posizione }
// ---------------------------------------------------------------------
const css = readFileSync('./src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const regole = [];
(function leggi(testo, media) {
  let i = 0;
  while (i < testo.length) {
    const apre = testo.indexOf('{', i);
    if (apre < 0) break;
    const testa = testo.slice(i, apre).trim();
    let profondita = 1;
    let j = apre + 1;
    while (j < testo.length && profondita) {
      if (testo[j] === '{') profondita++;
      else if (testo[j] === '}') profondita--;
      j++;
    }
    const corpo = testo.slice(apre + 1, j - 1);
    if (testa.startsWith('@media')) leggi(corpo, testa.replace(/^@media\s*/, ''));
    else if (!testa.startsWith('@')) {
      regole.push({
        selettori: testa.split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
        dichiarazioni: Object.fromEntries(corpo.split(';').map((d) => d.split(':')).filter((d) => d.length >= 2)
          .map(([k, ...v]) => [k.trim(), v.join(':').trim()])),
        media,
        posizione: regole.length,
      });
    }
    i = j;
  }
})(css, '');

const normale = (media) => media.trim().replace(/\s+/g, ' ');
const soloTocco = (media) => /^\(pointer: ?coarse\)$/.test(normale(media));
// Il tocco con un'altra condizione: «(pointer: coarse) and (max-width:
// 620px)» vale per il tocco in quella fascia di larghezza.
const toccoE = (media) => normale(media).match(/^\(pointer: ?coarse\) and (.+)$/)?.[1] ?? null;
const delTocco = (media) => soloTocco(media) || toccoE(media) !== null;
const ancheTocco = (media) => media === '' || !/pointer:\s*fine|hover|print/.test(media);
// La regola del tocco t vale dove vale r: il tocco senza condizioni vale
// ovunque; quello «and X» solo per le regole scritte in X.
const valeDove = (t, r) => soloTocco(t.media) || (toccoE(t.media) !== null && toccoE(t.media) === normale(r.media));

// L'ultimo pezzo del selettore: tag, classi, attributi, pseudo.
const ultimo = (sel) => sel.split(/\s*[\s>+~]\s*/).filter(Boolean).pop() || '';
const pezzi = (comp) => ({
  tag: (comp.match(/^[a-z][a-z0-9-]*/i) || [''])[0].toLowerCase(),
  classi: [...comp.matchAll(/\.([\w-]+)/g)].map((m) => m[1]),
  attributi: [...comp.matchAll(/\[[^\]]+\]/g)].map((m) => m[0].replace(/\s/g, '')),
});
const specificita = (sel) => {
  const id = (sel.match(/#[\w-]+/g) || []).length;
  const classi = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(\([^)]*\))?/g) || [])
    .filter((x) => !/^:(not|is|where)\(/.test(x)).length;
  const tag = (sel.replace(/\[[^\]]+\]|\([^)]*\)/g, '').match(/(^|[\s>+~(])([a-z][a-z0-9-]*)/gi) || []).length;
  return id * 10000 + classi * 100 + tag;
};
const toccabile = (sel) => {
  const p = pezzi(ultimo(sel));
  if (p.attributi.some((a) => /type=["']?(checkbox|radio)/.test(a))) return false;
  if (/:(disabled|hover|focus|placeholder)|::/.test(ultimo(sel))) return false;
  return ['input', 'select', 'textarea', 'button'].includes(p.tag) || p.classi.some((c) => classiToccabili.has(c));
};
// Quanto alto lascia la regola: il numero in px di min-height o height,
// 0 per auto/0, null se non dice niente.
const altezza = (d) => {
  const valori = ['min-height', 'height'].map((k) => d[k]).filter((v) => v != null);
  if (!valori.length) return null;
  const px = valori.map((v) => (/^(auto|0)$/.test(v) ? 0 : /^[\d.]+px$/.test(v) ? Number.parseFloat(v) : null));
  if (px.some((x) => x === null)) return null;
  return Math.max(...px);
};
// La regola del tocco T prende gli stessi elementi di S e la batte?
const batte = (t, selT, s, selS) => {
  const a = pezzi(ultimo(selT));
  const b = pezzi(ultimo(selS));
  if (a.tag && a.tag !== b.tag) return false;
  if (!a.classi.every((c) => b.classi.includes(c))) return false;
  if (!a.attributi.every((x) => b.attributi.includes(x))) return false;
  // Un antenato nel selettore del tocco deve esserci anche nell'altro.
  const antenatiT = selT.slice(0, selT.length - ultimo(selT).length).trim();
  if (antenatiT && !selS.includes(antenatiT)) return false;
  const st = specificita(selT);
  const ss = specificita(selS);
  return st > ss || (st === ss && t.posizione > s.posizione);
};

const alTocco = regole.filter((r) => delTocco(r.media) && (altezza(r.dichiarazioni) ?? 0) >= SOGLIA);
for (const r of regole) {
  if (!ancheTocco(r.media)) continue;
  const h = altezza(r.dichiarazioni);
  if (h === null || h >= SOGLIA) continue;
  for (const sel of r.selettori.filter(toccabile)) {
    if (delTocco(r.media)) {
      segnala(`styles.css: «${sel}» porta ${h} px DENTRO il blocco del tocco (sotto i ${SOGLIA})`);
      continue;
    }
    const coperta = alTocco.some((t) => valeDove(t, r) && t.selettori.some((selT) => batte(t, selT, r, sel)));
    if (!coperta) {
      segnala(`styles.css: «${sel}» porta ${h} px${r.media ? ` in @media ${r.media}` : ''}, e nessuna regola del tocco la riporta a ${SOGLIA}`);
    }
  }
}

// ---------------------------------------------------------------------
// I componenti: niente altezze sotto i 44 scritte sull'elemento
// ---------------------------------------------------------------------
for (const { nome, testo } of componenti) {
  const righe = testo.split('\n');
  righe.forEach((riga, n) => {
    for (const m of riga.matchAll(/minHeight:\s*('auto'|"auto"|\d+)/g)) {
      const v = /auto/.test(m[1]) ? 0 : Number(m[1]);
      if (v >= SOGLIA) continue;
      // La casella di spunta: la riga intorno è il bersaglio.
      const intorno = righe.slice(Math.max(0, n - 3), n + 1).join(' ');
      if (/type="(checkbox|radio)"/.test(intorno)) continue;
      segnala(`${nome}:${n + 1}: minHeight ${m[1]} scritto sull'elemento batte la regola del tocco`);
    }
  });
}

if (male) {
  console.error(`\n${male} bersagli sotto i ${SOGLIA} px sul tocco. Pacchetto non costruito.`);
  process.exit(1);
}
console.log(`✓ tocco: nessun tasto o campo sotto i ${SOGLIA} px`);
