import { Component } from 'react';

// Rete di sicurezza: se qualcosa esplode durante il disegno, invece dello
// schermo nero si vede cosa è successo e si riparte. Meglio un messaggio
// brutto di una pagina vuota a bordo vasca.
export default class Recinto extends Component {
  constructor(props) {
    super(props);
    this.state = { errore: null };
  }

  static getDerivedStateFromError(errore) {
    return { errore };
  }

  componentDidCatch(errore, info) {
    console.error('CorsiaPro — errore non gestito:', errore, info);
  }

  render() {
    if (!this.state.errore) return this.props.children;

    return (
      <div className="accesso">
        <div className="riquadro">
          <div className="marchio">Corsia<span>Pro</span></div>
          <p className="sotto">Qualcosa si è rotto.</p>
          <div className="avviso errore" style={{ marginBottom: 16 }}>
            {String(this.state.errore?.message || this.state.errore)}
          </div>
          <p style={{ fontSize: 13, color: 'var(--testo-3)' }}>
            Il lavoro non salvato in questa schermata è perso, ma i dati sul
            server sono intatti. Se il messaggio parla di una funzione che non
            esiste, sul sito c'è un aggiornamento caricato a metà: ricarica
            tutta la cartella <span className="mono">src</span>.
          </p>
          <button className="azione" onClick={() => window.location.reload()}>
            Ricarica l'app
          </button>
        </div>
      </div>
    );
  }
}
