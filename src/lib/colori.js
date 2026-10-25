// Mappa i nomi colore della tabella squadra.zone (e squadra.categorie)
// alle tinte effettive. Cambi il nome nel database, cambia la UI.
export const TINTE = {
  sky: '#7DD3FC',
  blue: '#3B82F6',
  'blue-dark': '#2563EB',
  cyan: '#22D3EE',
  teal: '#2DD4BF',
  emerald: '#34D399',
  lime: '#A3E635',
  yellow: '#FDE047',
  amber: '#FBBF24',
  orange: '#FB923C',
  red: '#F87171',
  rose: '#FB7185',
  pink: '#F472B6',
  purple: '#C084FC',
  fuchsia: '#E879F9',
  violet: '#A78BFA',
  indigo: '#818CF8',
  slate: '#94A3B8',
  'slate-dark': '#64748B',
  gold: '#EAB308',
};

export const tinta = (nome, fallback = '#22D3EE') => TINTE[nome] || fallback;

export const TINTA_FAMIGLIA = {
  aerobico: '#22D3EE',
  vo2: '#FBBF24',
  lattacido: '#F87171',
  alattacido: '#F472B6',
  // La D, il passo gara: né aerobico né lattacido, un colore suo.
  passo_gara: '#818CF8',
  altro: '#94A3B8',
  nonClassificati: '#94A3B8',
};

// Le colonne dei grafici per famiglia, in Dashboard e in Volumi: le
// stesse, nello stesso ordine. Erano scritte due volte, una per scheda.
export const SERIE_FAMIGLIE = [
  { chiave: 'aerobico', nome: 'Aerobico', colore: TINTA_FAMIGLIA.aerobico },
  { chiave: 'vo2', nome: 'VO₂max', colore: TINTA_FAMIGLIA.vo2 },
  { chiave: 'lattacido', nome: 'Lattacido', colore: TINTA_FAMIGLIA.lattacido },
  { chiave: 'alattacido', nome: 'Alattacido', colore: TINTA_FAMIGLIA.alattacido },
  { chiave: 'passo_gara', nome: 'Passo gara', colore: TINTA_FAMIGLIA.passo_gara },
  { chiave: 'nonclass', nome: 'Senza zona', colore: TINTA_FAMIGLIA.altro },
];
