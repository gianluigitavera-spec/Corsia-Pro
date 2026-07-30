import { useEffect, useRef, useState } from 'react';
import { Wand2, Save, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../lib/dati';
import {
  FASI, faseDi, proponiFasi, giorniFra, settimaneFra, spostaConfine,
  inizioStagionePredefinito,
} from '../lib/dominio';
import { TIPI_GARA } from './Calendario';

const iso = (d) => d.toISOString().slice(0, 10);
const dataIt = (s) => new Date(s + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export default function Periodizzazione({ societa, codici, nomeMacro, gare, stagione, puoScrivere, cambiata }) {
  const [blocchi, setBlocchi] = useState([]);
  const [salvati, setSalvati] = useState([]);
  const [garaScelta, setGaraScelta] = useState('');
  const [messaggio, setMessaggio] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [inizioStagione, setInizioStagione] = useState(inizioStagionePredefinito(stagione));
  const barra = useRef(null);
  const trascino = useRef(null);

  useEffect(() => {
    if (!codici?.length) return;
    api.leggiPeriodizzazione(societa.id, codici)
      .then((r) => {
        const b = r.map((x) => ({ fase: x.fase, dal: x.dal, al: x.al, gara_id: x.gara_id }));
        setBlocchi(b);
        setSalvati(b);
      })
      .catch((e) => setMessaggio({ testo: e.message, errore: true }));
  }, [societa.id, codici?.join()]);

  // L'inizio stagione vale per tutta la società: la generale parte da lì.
  useEffect(() => {
    api.leggiImpostazioniStagione(societa.id, stagione)
      .then((r) => setInizioStagione(r?.inizio || inizioStagionePredefinito(stagione)))
      .catch(() => setInizioStagione(inizioStagionePredefinito(stagione)));
  }, [societa.id, stagione]);

  // Le gare future di questa categoria, come possibili obiettivi.
  const oggi = iso(new Date());
  const obiettivi = (gare || [])
    .filter((g) => g.data >= oggi || blocchi.length === 0)
    .sort((a, b) => a.data.localeCompare(b.data));

  async function proponi() {
    const g = obiettivi.find((x) => x.id === garaScelta);
    if (!g) return;
    try { await api.salvaInizioStagione(societa.id, stagione, inizioStagione); } catch { /* non blocca */ }
    setBlocchi(proponiFasi(g.data, { inizioStagione }).map((b) => ({ ...b, gara_id: g.id })));
    setMessaggio({
      testo: inizioStagione < g.data
        ? 'Proposta pronta: la generale parte dall\u2019inizio stagione. Trascina i confini e salva.'
        : 'Proposta pronta: trascina i confini e poi salva.',
    });
  }

  async function salva() {
    setSalvo(true);
    try {
      await api.salvaPeriodizzazione(societa.id, codici, blocchi);
      setSalvati(blocchi);
      setMessaggio({ testo: 'Periodizzazione salvata.' });
      cambiata?.();
    } catch (e) { setMessaggio({ testo: e.message, errore: true }); }
    finally { setSalvo(false); }
  }

  async function cancella() {
    if (!confirm(`Eliminare la periodizzazione di ${nomeMacro}?`)) return;
    try {
      await api.salvaPeriodizzazione(societa.id, codici, []);
      setBlocchi([]); setSalvati([]);
      setMessaggio({ testo: 'Periodizzazione eliminata.' });
      cambiata?.();
    } catch (e) { setMessaggio({ testo: e.message, errore: true }); }
  }

  // ---------------------------------------------------- trascinamento
  const inizio = blocchi[0]?.dal;
  const fine = blocchi[blocchi.length - 1]?.al;
  const totale = inizio && fine ? giorniFra(inizio, fine) : 0;

  const dataDaX = (clientX) => {
    const r = barra.current.getBoundingClientRect();
    const frazione = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const d = new Date(inizio + 'T12:00');
    d.setDate(d.getDate() + Math.round(frazione * (totale - 1)));
    return iso(d);
  };

  useEffect(() => {
    const muovi = (e) => {
      if (trascino.current == null || !barra.current) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setBlocchi((b) => spostaConfine(b, trascino.current, dataDaX(x)));
      e.preventDefault();
    };
    const molla = () => { trascino.current = null; };
    window.addEventListener('pointermove', muovi);
    window.addEventListener('pointerup', molla);
    window.addEventListener('touchmove', muovi, { passive: false });
    window.addEventListener('touchend', molla);
    return () => {
      window.removeEventListener('pointermove', muovi);
      window.removeEventListener('pointerup', molla);
      window.removeEventListener('touchmove', muovi);
      window.removeEventListener('touchend', molla);
    };
  }, [inizio, totale]);

  // Sposta il confine di una settimana, per chi preferisce i tasti
  const settimana = (indice, verso) => {
    const d = new Date(blocchi[indice].dal + 'T12:00');
    d.setDate(d.getDate() + 7 * verso);
    setBlocchi((b) => spostaConfine(b, indice, iso(d)));
  };

  const modificato = JSON.stringify(blocchi) !== JSON.stringify(salvati);

  return (
    <div className="periodizzazione">
      <div className="barra" style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 14 }}>Periodizzazione · {nomeMacro}</b>
        <div style={{ flex: 1 }} />
        {puoScrivere && (
          <>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ whiteSpace: 'nowrap' }}>Stagione dal</span>
              <input
                type="date"
                value={inizioStagione || ''}
                onChange={(e) => setInizioStagione(e.target.value)}
                onBlur={(e) => api.salvaInizioStagione(societa.id, stagione, e.target.value).catch(() => {})}
                style={{ minHeight: 36, fontSize: 13 }}
              />
            </label>
            <select value={garaScelta} onChange={(e) => setGaraScelta(e.target.value)} style={{ minHeight: 36, fontSize: 13, maxWidth: 230 }}>
              <option value="">Gara obiettivo…</option>
              {obiettivi.map((g) => (
                <option key={g.id} value={g.id}>
                  {dataIt(g.data)} · {g.nome}
                </option>
              ))}
            </select>
            <button className="mini" onClick={proponi} disabled={!garaScelta}>
              <Wand2 size={13} style={{ verticalAlign: -2 }} /> Proponi
            </button>
            {blocchi.length > 0 && (
              <>
                <button className="azione" style={{ minHeight: 36, padding: '7px 14px' }} onClick={salva} disabled={!modificato || salvo}>
                  <Save size={14} style={{ verticalAlign: -2 }} /> {salvo ? 'Salvo…' : 'Salva'}
                </button>
                <button className="mini" onClick={cancella} aria-label="Elimina"><Trash2 size={13} /></button>
              </>
            )}
          </>
        )}
      </div>

      {blocchi.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--testo-3)', margin: 0 }}>
          {obiettivi.length === 0
            ? 'Aggiungi prima una competizione sul calendario: le fasi si costruiscono a ritroso da quella.'
            : 'Scegli la gara obiettivo e premi Proponi: le quattro fasi si dispongono all\u2019indietro, poi le aggiusti trascinando.'}
        </p>
      ) : (
        <>
          <div className="nastro-fasi" ref={barra}>
            {blocchi.map((b, i) => {
              const f = faseDi(b.fase);
              const larghezza = (giorniFra(b.dal, b.al) / totale) * 100;
              return (
                <div key={b.fase} className="blocco-fase" style={{ width: `${larghezza}%`, background: f.colore }}>
                  <span className="nome-fase">{f.nome}</span>
                  <span className="durata-fase mono">{settimaneFra(b.dal, b.al)} sett.</span>
                  {i > 0 && puoScrivere && (
                    <span
                      className="maniglia-fase"
                      onPointerDown={(e) => { trascino.current = i; e.currentTarget.setPointerCapture?.(e.pointerId); }}
                      onTouchStart={() => { trascino.current = i; }}
                      role="separator"
                      aria-label={`Sposta l'inizio della fase ${f.nome}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="righe-fasi">
            {blocchi.map((b, i) => {
              const f = faseDi(b.fase);
              return (
                <div className="riga-fase" key={b.fase}>
                  <span className="punto" style={{ background: f.colore }} />
                  <b style={{ minWidth: 76 }}>{f.nome}</b>
                  <span className="mono" style={{ color: 'var(--testo-2)' }}>
                    {dataIt(b.dal)} → {dataIt(b.al)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>{f.zone}</span>
                  <span style={{ flex: 1 }} />
                  {i > 0 && puoScrivere && (
                    <span className="maniglie">
                      <button onClick={() => settimana(i, -1)} aria-label="Anticipa di una settimana"><ChevronLeft size={13} /></button>
                      <button onClick={() => settimana(i, 1)} aria-label="Posticipa di una settimana"><ChevronRight size={13} /></button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {messaggio && (
        <div className={`avviso ${messaggio.errore ? 'errore' : ''}`} style={{ marginTop: 10 }}>{messaggio.testo}</div>
      )}
    </div>
  );
}
