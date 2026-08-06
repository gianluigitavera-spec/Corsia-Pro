// Un solo controllo, ma è quello che ci ha già spaccato la schermata due
// volte: leggere una const prima della riga che la dichiara. Non è un
// warning, è un errore a runtime — "Cannot access 'h' before
// initialization" — e si vede solo aprendo quella scheda.
// Nato dopo il crash della 0.34 in Calendario.jsx.
export default [
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    },
  },
];
