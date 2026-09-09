import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';

// La finestra delle novità dopo un aggiornamento. Stessa veste del
// registro consultabile dalla pillola in testata: è la stessa roba, letta
// in un momento diverso.
//
// Si becca spesso a bordo vasca, con una mano sola: si chiude col tasto
// grande in fondo, con Esc, o toccando fuori dal riquadro.
export default function Novita({ voci, chiudi }) {
  const tasto = useRef(null);

  useEffect(() => {
    tasto.current?.focus();          // Invio chiude, senza cercare niente
    const tasti = (e) => { if (e.key === 'Escape') chiudi(); };
    window.addEventListener('keydown', tasti);
    return () => window.removeEventListener('keydown', tasti);
  }, [chiudi]);

  if (!voci?.length) return null;

  return (
    <div
      className="registro"
      role="dialog"
      aria-modal="true"
      aria-label="Novità di questa versione"
      onClick={chiudi}
    >
      {/* Il tocco dentro al riquadro non deve chiudere. */}
      <div className="registro-riquadro novita" onClick={(e) => e.stopPropagation()}>
        <div className="intestazione">
          <Sparkles size={17} style={{ color: 'var(--ciano)', flex: 'none' }} />
          <h3>Cosa c'è di nuovo</h3>
        </div>

        <div className="corpo">
          {voci.map((c) => (
            <div key={c.versione} className="voce-registro">
              <div className="riga-versione">
                <span className="mono numero-versione">v{c.versione}</span>
                <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 12 }}>{c.data}</span>
              </div>
              <ul>{c.voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
            </div>
          ))}
        </div>

        <div className="piede-novita">
          <button ref={tasto} className="azione" onClick={chiudi}>Ho capito</button>
        </div>
      </div>
    </div>
  );
}
