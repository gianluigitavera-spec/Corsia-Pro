// Due controlli, e sono i due che ci hanno già spaccato la schermata:
//
//  no-use-before-define — leggere una const prima della riga che la
//    dichiara. A runtime diventa "Cannot access 'h' before
//    initialization" e si vede solo aprendo quella scheda.
//
//  react-hooks/rules-of-hooks — un hook chiamato dopo un return
//    anticipato. React conta gli hook a ogni render: se il numero
//    cambia esce "Rendered fewer hooks than expected" (errore #300) e
//    la schermata resta bianca. È successo con la 0.56.7: la useMemo
//    dell'elenco sedute era finita sotto il return di "Scrivi o
//    incolla", e quella vista si apriva rotta mentre l'editor a
//    blocchi funzionava. La build era verde, perché questa regola non
//    c'era.
//
//  no-undef — usare una variabile che non esiste più. È successo
//    togliendo il filtro locale dalla Dashboard: lo stato "macro" era
//    sparito ma tre righe di JSX lo nominavano ancora, e in pagina
//    usciva "Can't find variable: macro". Il pacchetto si costruiva
//    lo stesso, perché per il compilatore è un nome come un altro.
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
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
      // Solo questa del plugin: è l'unica che, se violata, rompe lo
      // schermo. Le altre (exhaustive-deps e compagnia) sono consigli, e
      // accenderle adesso vorrebbe dire sistemare mezzo progetto in un
      // rilascio che ne corregge un difetto.
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
