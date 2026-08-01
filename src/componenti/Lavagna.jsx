import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { TUTTI, SPECIALIZZAZIONI, metriPerSpecializzazione, dataIt } from '../lib/dominio';
import { TINTA_FAMIGLIA } from '../lib/colori';

// La lavagna del bordo vasca: una sezione per volta, caratteri grandi,
// niente da leggere se non quello che si nuota adesso.
export default function Lavagna({ seduta, zone, chiudi }) {
  const [i, setI] = useState(0);
  const [scala, setScala] = useState(1);

  const sezioni = (seduta.sezioni || []).filter((s) => (s.serie || []).length > 0);
  const sez = sezioni[i];

  useEffect(() => {
    const tasti = (e) => {
      if (e.key === 'Escape') chiudi();
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, sezioni.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener('keydown', tasti);
    return () => window.removeEventListener('keydown', tasti);
  }, [sezioni.length, chiudi]);

  const famiglia = (codice) => zone.find((z) => z.codice === codice)?.famiglia;

  if (!sez) {
    return (
      <div className="lavagna">
        <button className="chiudi-lavagna" onClick={chiudi} aria-label="Chiudi"><X size={22} /></button>
        <div className="vuoto"><h3>Seduta vuota</h3><p>Aggiungi almeno una serie e la lavagna si riempie.</p></div>
      </div>
    );
  }

  const dest = sez.destinatari?.length ? sez.destinatari : [TUTTI];
  const metriSez = (sez.serie || []).reduce((t, s) => t + (Number(s.metri) || 0), 0);

  return (
    <div className="lavagna" style={{ '--scala': scala }}>
      <div className="barra-lavagna">
        <span className="titolo-lavagna">{seduta.titolo || 'Seduta'}</span>
        <span className="mono" style={{ color: 'var(--testo-3)' }}>
          {dataIt(seduta.data)}
        </span>
        <span style={{ flex: 1 }} />
        <button className="mini" onClick={() => setScala((s) => Math.max(0.7, s - 0.15))} aria-label="Più piccolo"><Minus size={14} /></button>
        <button className="mini" onClick={() => setScala((s) => Math.min(1.8, s + 0.15))} aria-label="Più grande"><Plus size={14} /></button>
        <button className="chiudi-lavagna" onClick={chiudi} aria-label="Chiudi"><X size={22} /></button>
      </div>

      <div className="corpo-lavagna">
        <div className="testa-lavagna">
          <h2>{sez.titolo || `Sezione ${i + 1}`}</h2>
          {!dest.includes(TUTTI) && <span className="chi-lavagna">{dest.join(' · ')}</span>}
          <span className="mono metri-lavagna">{metriSez.toLocaleString('it-IT')} m</span>
        </div>

        <ol className="serie-lavagna">
          {(sez.serie || []).map((s, j) => (
            <li key={j}>
              <span className="notaz">{s.notazione || '—'}</span>
              {s.recupero && <span className="rec mono">{s.recupero}</span>}
              {s.zona && (
                <span className="zona" style={{ background: TINTA_FAMIGLIA[famiglia(s.zona)] || 'var(--nonclass)' }}>
                  {s.zona}
                </span>
              )}
              {s.note && <span className="nota">{s.note}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="piede-lavagna">
        <button className="azione fantasma" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft size={18} />
        </button>
        <span className="punti-lavagna">
          {sezioni.map((_, k) => <i key={k} data-attivo={k === i} />)}
        </span>
        <button className="azione fantasma" disabled={i === sezioni.length - 1} onClick={() => setI(i + 1)}>
          <ChevronRight size={18} />
        </button>
        <span style={{ flex: 1 }} />
        <span className="totali-lavagna mono">
          {SPECIALIZZAZIONI.map((spec) => {
            const m = metriPerSpecializzazione(seduta.sezioni, spec);
            return m > 0 ? <span key={spec}>{spec.slice(0, 4)} {(m / 1000).toFixed(1)}km</span> : null;
          })}
        </span>
      </div>
    </div>
  );
}
