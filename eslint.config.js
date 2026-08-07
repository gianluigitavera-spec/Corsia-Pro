// Due controlli, e sono i due che ci hanno già spaccato la schermata:
//
//  no-use-before-define — leggere una const prima della riga che la
//    dichiara. A runtime diventa "Cannot access 'h' before
//    initialization" e si vede solo aprendo quella scheda.
//
//  no-undef — usare una variabile che non esiste più. È successo
//    togliendo il filtro locale dalla Dashboard: lo stato "macro" era
//    sparito ma tre righe di JSX lo nominavano ancora, e in pagina
//    usciva "Can't find variable: macro". Il pacchetto si costruiva
//    lo stesso, perché per il compilatore è un nome come un altro.
export default [
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Quello che esiste davvero nel browser e non va dichiarato.
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', location: 'readonly', fetch: 'readonly',
        console: 'readonly', alert: 'readonly', confirm: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        URL: 'readonly', Blob: 'readonly', FileReader: 'readonly',
        Image: 'readonly', Audio: 'readonly', structuredClone: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        crypto: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
        __VERSIONE__: 'readonly', __BUILD__: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
      'no-undef': 'error',
    },
  },
];
