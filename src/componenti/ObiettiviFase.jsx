import { useEffect, useState } from 'react';
import { Target, Save, RotateCcw } from 'lucide-react';
import * as api from '../lib/dati';
import { FASI, faseDi } from '../lib/dominio';
import { TINTA_FAMIGLIA } from '../lib/colori';

// Le famiglie su cui si ragiona. Nessun valore di partenza: la
// ripartizione è una scelta di metodo dell'allenatore, non un numero
// che decide l'app.
const FAMIGLIE = [
  { chiave: 'aerobico', nome: 'Aerobico', sotto: 'A1 · A2 · B1' },
  { chiave: 'vo2', nome: 'VO₂max', sotto: 'B2' },
  { chiave: 'lattacido', nome: 'Lattacido', sotto: 'C1 · C2' },
  { chiave: 'alattacido', nome: 'Alattacido', sotto: 'C3' },
];

export default function ObiettiviFase({ societa, codici, nomeMacro, puoScrivere }) {
  const [obiettivi, setObiettivi] = useState({});     // fase -> {ripartizione, km_settimana}
  const [bozza, setBozza] = useState({});
  const [salvo, setSalvo] = useState(null);
  const [messaggio, setMessaggio] = useState(null);

  useEffect(() => {
    if (!codici?.length) return;
    api.leggiObiettivi(societa.id, codici)
      .then((righe) => {
        const perFase = {};
        for (const r of righe) {
          // Solo gli obiettivi di ESATTAMENTE queste categorie
          if (JSON.stringify([...r.categorie].sort()) !== JSON.stringify([...codici].sort())) continue;
          perFase[r.fase] = { ripartizione: r.ripartizione || {}, km: r.km_settimana };
        }
        setObiettivi(perFase);
        setBozza(perFase);
      })
      .catch((e) => setMessaggio({ testo: e.message, errore: true }));
  }, [societa.id, codici?.join()]);

  const valore = (fase, chiave) => bozza[fase]?.ripartizione?.[chiave] ?? '';
  const totale = (fase) =>
    FAMIGLIE.reduce((t, f) => t + (Number(bozza[fase]?.ripartizione?.[f.chiave]) || 0), 0);

  const cambia = (fase, chiave, v) =>
    setBozza((b) => ({
      ...b,
      [fase]: {
        ...b[fase],
        ripartizione: { ...(b[fase]?.ripartizione || {}), [chiave]: v === '' ? undefined : Number(v) },
      },
    }));

  async function salva(fase) {
    setSalvo(fase);
    try {
      const pulita = {};
      FAMIGLIE.forEach((f) => {
        const v = bozza[fase]?.ripartizione?.[f.chiave];
        if (v !== undefined && v !== '' && !isNaN(v)) pulita[f.chiave] = Number(v);
      });
      await api.salvaObiettivo(societa.id, codici, fase, pulita, bozza[fase]?.km || null);
      setObiettivi((o) => ({ ...o, [fase]: { ripartizione: pulita, km: bozza[fase]?.km || null } }));
      setMessaggio({ testo: `Obiettivi della fase ${faseDi(fase).nome} salvati.` });
    } catch (e) {
      setMessaggio({ testo: e.message, errore: true });
    } finally { setSalvo(null); }
  }

  const modificata = (fase) =>
    JSON.stringify(bozza[fase] || {}) !== JSON.stringify(obiettivi[fase] || {});

  return (
    <div className="scheda" style={{ marginTop: 12 }}>
      <div className="intestazione">
        <Target size={16} style={{ color: 'var(--ambra)' }} />
        <h3>Obiettivi di fase · {nomeMacro}</h3>
      </div>
      <div className="corpo">
        <p style={{ fontSize: 13, color: 'var(--testo-3)', marginTop: 0 }}>
          Quanto lavoro ti aspetti in ogni fase, in percentuale sui metri. Sono i <b>tuoi</b> numeri
          per <b>questa</b> categoria: servono a confrontare quello che avevi in testa con quello che
          è stato davvero nuotato. Lascia vuoto ciò su cui non vuoi porre un obiettivo.
        </p>

        {FASI.map((f) => {
          const somma = totale(f.codice);
          const fuori = somma > 0 && Math.abs(somma - 100) > 2;
          return (
            <div className="obiettivo-fase" key={f.codice} style={{ '--tinta': f.colore }}>
              <div className="testa-obiettivo">
                <span className="punto" style={{ background: f.colore }} />
                <b>{f.nome}</b>
                <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>{f.zone}</span>
                <div style={{ flex: 1 }} />
                {somma > 0 && (
                  <span className="mono" style={{ fontSize: 12, color: fuori ? 'var(--ambra)' : 'var(--menta)' }}>
                    {somma}%
                  </span>
                )}
                {puoScrivere && modificata(f.codice) && (
                  <>
                    <button className="mini" onClick={() => setBozza((b) => ({ ...b, [f.codice]: obiettivi[f.codice] }))}
                      aria-label="Annulla">
                      <RotateCcw size={13} />
                    </button>
                    <button className="azione" style={{ minHeight: 32, padding: '5px 12px' }}
                      onClick={() => salva(f.codice)} disabled={salvo === f.codice}>
                      <Save size={13} style={{ verticalAlign: -2 }} /> Salva
                    </button>
                  </>
                )}
              </div>

              <div className="campi-obiettivo">
                {FAMIGLIE.map((fam) => (
                  <label className="campo-obiettivo" key={fam.chiave}>
                    <span style={{ color: TINTA_FAMIGLIA[fam.chiave] }}>{fam.nome}</span>
                    <span className="sotto-famiglia">{fam.sotto}</span>
                    <span className="con-percento">
                      <input
                        className="mono"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="—"
                        disabled={!puoScrivere}
                        value={valore(f.codice, fam.chiave)}
                        onChange={(e) => cambia(f.codice, fam.chiave, e.target.value)}
                      />
                    </span>
                  </label>
                ))}
                <label className="campo-obiettivo">
                  <span style={{ color: 'var(--testo-2)' }}>Km a settimana</span>
                  <span className="sotto-famiglia">facoltativo</span>
                  <span className="con-percento senza">
                    <input
                      className="mono"
                      type="number"
                      step="0.5"
                      placeholder="—"
                      disabled={!puoScrivere}
                      value={bozza[f.codice]?.km ?? ''}
                      onChange={(e) => setBozza((b) => ({
                        ...b, [f.codice]: { ...b[f.codice], km: e.target.value === '' ? null : Number(e.target.value) },
                      }))}
                    />
                  </span>
                </label>
              </div>

              {fuori && (
                <p className="nota-obiettivo">
                  Le percentuali sommano {somma}%: se non è voluto, controlla i numeri.
                </p>
              )}
            </div>
          );
        })}

        {messaggio && (
          <div className={`avviso ${messaggio.errore ? 'errore' : ''}`} style={{ marginTop: 12 }}>
            {messaggio.testo}
          </div>
        )}
      </div>
    </div>
  );
}
