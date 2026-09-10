// Prove dei blocchi ripetuti. Gira prima di ogni build.
//
// Il guasto da cui nasce tutto: una riga "3x" battuta nelle mascherine
// restava un lavoro qualunque e le righe sotto non si moltiplicavano —
// sezione da 1003 invece di 3000, e così finiva salvata. Nel testo la
// stessa cosa funzionava. Due regole scritte in due posti divergono
// sempre: la prova che conta di più, qui sotto, è la PARITÀ fra le due
// strade. Se qualcuno ne cambia una sola, deve fermarsi qui.
import { analizzaTesto } from './src/lib/analizzatore.js';
import {
  aperturaDiBlocco, applicaAperturaBlocco, apertureNude,
  figlieDelBlocco, metriInBlocco, metriPerSpecializzazione,
} from './src/lib/dominio.js';

let male = 0;
const dice = (cosa, avuto, atteso) => {
  const a = JSON.stringify(avuto);
  const b = JSON.stringify(atteso);
  if (a !== b) { male++; console.error(`✗ ${cosa}:\n    atteso ${b}\n    avuto  ${a}`); }
};

// Come l'editor costruisce una riga qualunque.
const riga = (notazione, extra = {}) => ({
  notazione, zona: '', metri: 0, recupero: '', note: '', ...extra,
});

// ====================================================================
// LA PARITÀ: stesso blocco, due strade, stesso dato
// ====================================================================
// Nel testo: "3x" e sotto le righe. Nell'editor: le stesse righe, e
// l'apertura applicata con applicaAperturaBlocco. Devono uscire uguali
// nei campi che contano — metri, moltiplicato, apreBlocco, senzaMetri.
const CONTANO = ['notazione', 'metri', 'apreBlocco', 'moltiplicato', 'senzaMetri'];
const nudo = (serie) => serie.map((s) => {
  const o = {};
  for (const c of CONTANO) if (s[c] !== undefined) o[c] = s[c];
  return o;
});

for (const [testo, righe] of [
  ['3x\n8x50\n4x100', ['8x50', '4x100']],
  ['4x\n200\n8x25',   ['200', '8x25']],
  ['2x\n1x400',       ['1x400']],
]) {
  const n = +testo.match(/^(\d+)x/)[1];

  const daTesto = analizzaTesto(`Centrale\n${testo}`).sezioni[0].serie;

  const sezione = { titolo: 'Centrale', serie: [riga(`${n}x`), ...righe.map((r) => riga(r))] };
  applicaAperturaBlocco(sezione, 0);

  dice(`parità editor↔testo per "${testo.split('\n')[0]}"`, nudo(sezione.serie), nudo(daTesto));
}

// ====================================================================
// L'apertura non è un lavoro
// ====================================================================
// Le righe del racconto vero: 8x50 (400) + 600 fanno 1000 a giro. Non
// moltiplicate, con il 3 residuo dell'apertura, la sezione fa 1003.
// Moltiplicate per 3 ne fa 3000.
const sez = { serie: [riga('3x', { metri: 3 }), riga('8x50'), riga('600')] };
applicaAperturaBlocco(sez, 0);

// Il 3 residuo: battendo "3" la riga prende 3 metri, e "3x" torna
// illeggibile senza toglierli più. È da lì che veniva il 1003.
dice('l\'apertura azzera i metri residui', sez.serie[0].metri, 0);
dice('l\'apertura è senzaMetri', sez.serie[0].senzaMetri, true);
dice('l\'apertura porta apreBlocco', sez.serie[0].apreBlocco, 3);
dice('l\'apertura non ha zona', sez.serie[0].zona, '');

// Le figlie: metri GIÀ moltiplicati, come nel testo.
dice('8x50 dentro un ×3', sez.serie[1].metri, 1200);
dice('600 dentro un ×3', sez.serie[2].metri, 1800);
dice('le figlie portano moltiplicato', sez.serie.slice(1).map((s) => s.moltiplicato), [3, 3]);

// E il totale della sezione è quello giusto: 3000, non 1003.
dice('la sezione fa 3000, non 1003',
  metriPerSpecializzazione([sez], 'Generale'), 3000);

// ====================================================================
// I metri scritti a mano non si toccano
// ====================================================================
const fissi = { serie: [riga('3x'), riga('8x50'), riga('boh', { metri: 700, metriManuali: true })] };
applicaAperturaBlocco(fissi, 0);
dice('la riga a metri fissi resta com\'è', fissi.serie[2].metri, 700);
dice('ma entra comunque nel blocco', fissi.serie[2].moltiplicato, 3);
dice('metriInBlocco rispetta i metri fissi',
  metriInBlocco({ notazione: '8x50', metri: 700, metriManuali: true }, 3), 700);

// ====================================================================
// Il confine del blocco
// ====================================================================
const due = {
  serie: [riga('3x'), riga('8x50'), riga('2x'), riga('4x100'), riga('200')],
};
dice('il blocco finisce alla prossima apertura', figlieDelBlocco(due, 0), [1]);
dice('il secondo blocco arriva a fine sezione', figlieDelBlocco(due, 2), [3, 4]);

// ====================================================================
// LE APERTURE NUDE — quello che l'avviso mostra
// ====================================================================
const conNuda = {
  sezioni: [{
    titolo: 'Parte centrale',
    serie: [riga('3x', { metri: 3 }), riga('8x50', { metri: 400 }), riga('4x100', { metri: 400 })],
  }],
};
const [trovata] = apertureNude(conNuda);
dice('trova l\'apertura nuda', !!trovata, true);
dice('quante volte', trovata.ripetizioni, 3);
dice('quante righe sotto', trovata.righe, 2);
dice('metri ora', trovata.metriOra, 803);
dice('metri dopo', trovata.metriDopo, 2400);
dice('metri mancanti', trovata.metriMancanti, 1597);
dice('il tasto si può premere', trovata.applicabile, true);

// Il numero mostrato e l'effetto del tasto devono coincidere: se
// l'anteprima si calcolasse a parte, prima o poi mentirebbe.
const prima = metriPerSpecializzazione(conNuda.sezioni, 'Generale');
applicaAperturaBlocco(conNuda.sezioni[0], trovata.serM);
const dopo = metriPerSpecializzazione(conNuda.sezioni, 'Generale');
dice('l\'avviso promette esattamente quello che il tasto consegna',
  dopo - prima, trovata.metriMancanti);

// E applicata, l'avviso sparisce da solo.
dice('applicata, non è più nuda', apertureNude(conNuda).length, 0);

// ====================================================================
// SEDUTA CON svolto: l'avviso c'è, il tasto no
// ====================================================================
const conSvolto = {
  svolto: { righe: { '0-1': 350 } },
  sezioni: [{
    titolo: 'Parte centrale',
    serie: [riga('3x'), riga('8x50', { metri: 400 }), riga('4x100', { metri: 400 })],
  }],
};
const [conRilevato] = apertureNude(conSvolto);
dice('l\'avviso si vede lo stesso', !!conRilevato, true);
dice('ma il tasto non compare', conRilevato.applicabile, false);
dice('e dice perché', conRilevato.perche, 'svolto');

// Stessa cosa per chi non può scrivere.
const [inLettura] = apertureNude(conNuda.sezioni ? {
  sezioni: [{ serie: [riga('3x'), riga('8x50', { metri: 400 })] }],
} : {}, { puoScrivere: false });
dice('in sola lettura il tasto non c\'è', inLettura.applicabile, false);
dice('e dice perché', inLettura.perche, 'sola-lettura');

// ====================================================================
// Quello che NON è un'apertura nuda
// ====================================================================
const niente = (sezioni) => apertureNude({ sezioni }).length;

dice('un blocco già a posto non si segnala',
  niente([{ serie: [riga('3x', { apreBlocco: 3, senzaMetri: true }), riga('8x50', { metri: 1200, moltiplicato: 3 })] }]), 0);
dice('"1x" non ripete niente',
  niente([{ serie: [riga('1x'), riga('8x50', { metri: 400 })] }]), 0);
dice('un\'apertura senza righe sotto non serve a niente',
  niente([{ serie: [riga('3x')] }]), 0);
dice('nelle sezioni a secco non ci sono metri da moltiplicare',
  niente([{ aSecco: true, durataMin: 20, serie: [riga('3x'), riga('12 trazioni')] }]), 0);
dice('"4x100" è un lavoro, non un blocco',
  niente([{ serie: [riga('4x100', { metri: 400 }), riga('8x50', { metri: 400 })] }]), 0);

// ====================================================================
// aperturaDiBlocco: la regola sola, usata da tutte e due le strade
// ====================================================================
dice('"3x"', aperturaDiBlocco('3x'), { ripetizioni: 3, zona: null });
dice('"4x A2" porta la zona del blocco', aperturaDiBlocco('4x A2'), { ripetizioni: 4, zona: 'A2' });
dice('"6x (gio 4 volte)"', aperturaDiBlocco('6x (gio 4 volte)'), { ripetizioni: 6, zona: null });
dice('"4x100" no', aperturaDiBlocco('4x100'), null);
dice('"4x(2x50)" è un gruppo, non un\'apertura', aperturaDiBlocco('4x(2x50)'), null);
dice('vuoto', aperturaDiBlocco(''), null);

if (male) {
  console.error(`\n${male} prove fallite. Pacchetto non costruito.`);
  process.exit(1);
}
console.log('✓ blocchi ripetuti: tutte le prove passate');
