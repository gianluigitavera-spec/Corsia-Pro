import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Recinto from './componenti/Recinto';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Recinto>
      <App />
    </Recinto>
  </React.StrictMode>
);

// Installazione sul telefono: "Aggiungi a schermata Home".
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
