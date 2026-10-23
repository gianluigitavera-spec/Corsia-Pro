// =====================================================================
// PROVA iOS, PASSO 0 DEL PDF (ramo prova-ios, non per sviluppo)
//
// Prima di costruire il PDF della seduta generato dall'app, una domanda
// sola: dall'app installata su iOS 27 il foglio di condivisione accetta
// un FILE? Il testo sì (0.58.1). Qui un PDF minuscolo, una riga, scritto
// a mano senza librerie, passato a navigator.share come file.
//
// Il PDF si crea in modo sincrono e share si chiama subito, senza await
// prima: iOS vuole la condivisione attaccata al tocco, e un'attesa in
// mezzo la farebbe rifiutare per un motivo che non è quello che cerchiamo.
// =====================================================================

const NOME = 'CorsiaPro_prova_23-10-26.pdf';

// Un PDF 1.4 valido: catalogo, pagine, una pagina A4, Helvetica, una riga.
// Solo ASCII, così le posizioni della tabella xref sono byte esatti.
function pdfMinuscolo(riga) {
  const testo = riga.replace(/[\\()]/g, (c) => `\\${c}`);
  const flusso = `BT /F1 14 Tf 56 780 Td (${testo}) Tj ET`;
  const oggetti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const posizioni = oggetti.map((o, i) => {
    const qui = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return qui;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
  pdf += posizioni.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

const comeAperta = () => {
  const installata = window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches;
  return installata ? 'app installata' : 'browser';
};

// Torna una promessa con { tipo, testo } da mostrare a schermo, sempre:
// anche «Annulla» si vede, perché in prova serve sapere cos'è successo.
export function provaPdfCondiviso() {
  const dove = comeAperta();
  let file;
  try {
    file = new File([pdfMinuscolo('CorsiaPro - prova PDF del 23-10-26')], NOME, { type: 'application/pdf' });
  } catch (e) {
    return Promise.resolve({ tipo: 'errore', testo: `File non creato: ${e?.name || 'errore senza nome'} — ${e?.message || 'nessun messaggio'} (${dove})` });
  }
  if (!navigator.share) {
    return Promise.resolve({ tipo: 'errore', testo: `navigator.share non disponibile (${dove})` });
  }
  if (!navigator.canShare) {
    return Promise.resolve({ tipo: 'errore', testo: `navigator.canShare non disponibile (${dove})` });
  }
  if (!navigator.canShare({ files: [file] })) {
    return Promise.resolve({ tipo: 'errore', testo: `canShare({ files }) dice no: questo telefono non condivide file da qui (${dove})` });
  }
  return navigator.share({ files: [file], title: NOME })
    .then(() => ({ tipo: 'ok', testo: `Condiviso: ${NOME} (${dove})` }))
    .catch((e) => ({ tipo: 'errore', testo: `navigator.share con file: ${e?.name || 'errore senza nome'} — ${e?.message || 'nessun messaggio'} (${dove})` }));
}
