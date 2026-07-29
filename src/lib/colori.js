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
  altro: '#94A3B8',
  nonClassificati: '#94A3B8',
};
