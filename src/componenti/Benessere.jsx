import { useEffect, useState } from 'react';
import { HeartPulse, Moon, BatteryLow, Activity, Smile, Check } from 'lucide-react';
import * as api from '../lib/dati';

const VOCI = [
  { chiave: 'sonno',  nome: 'Sonno',  Icona: Moon,       basso: 'male',    alto: 'benissimo', inverti: false },
  { chiave: 'fatica', nome: 'Fatica', Icona: BatteryLow, basso: 'fresco',  alto: 'distrutto', inverti: true },
  { chiave: 'dolori', nome: 'Dolori', Icona: Activity,   basso: 'nessuno', alto: 'molti',     inverti: true },
  { chiave: 'umore',  nome: 'Umore',  Icona: Smile,      basso: 'giù',     alto: 'carico',    inverti: false },
];

const oggiIso = () => new Date().toISOString().slice(0, 10);

const prontezzaDi = (r) => {
  if (!r) return null;
  const v = (x, inv) => (x == null ? 3 : inv ? 6 - x : x);
  return (v(r.sonno) + v(r.fatica, true) + v(r.dolori, true) + v(r.umore)) / 4;
};

const tinta = (p) =>
  p == null ? 'var(--testo-3)'
    : p >= 4 ? 'var(--menta)'
    : p >= 3 ? 'var(--ciano)'
    : p >= 2.25 ? 'var(--ambra)'
    : 'var(--rosso)';

export default function Benessere({ societa, puoScrivere }) {
  const [data, setData] = useState(oggiIso());
  const [atleti, setAtleti] = useState([]);
  const [righe, setRighe] = useState({});         // atleta_id -> riga
  const [aperto, setAperto] = useState(null);
  const [messaggio, setMessaggio] = useState(null);

  useEffect(() => { api.leggiAtleti(societa.id).then(setAtleti).catch((e) => setMessaggio(e.message)); }, [societa.id]);

  useEffect(() => {
    api.leggiBenessere(societa.id, data)
      .then((r) => setRighe(Object.fromEntries(r.map((x) => [x.atleta_id, x]))))
      .catch((e) => setMessaggio(e.message));
  }, [societa.id, data]);

  async function segna(atletaId, chiave, valore) {
    const attuale = righe[atletaId] || {};
    const nuova = { ...attuale, [chiave]: valore };
    setRighe({ ...righe, [atletaId]: nuova });     // ottimistico
    try {
      await api.salvaBenessere({
        societa_id: societa.id,
        atleta_id: atletaId,
        data,
        sonno: nuova.sonno ?? null,
        fatica: nuova.fatica ?? null,
        dolori: nuova.dolori ?? null,
        umore: nuova.umore ?? null,
      });
      setMessaggio(null);
    } catch (e) { setMessaggio(`Non salvato: ${e.message}`); }
  }

  // I meno pronti in cima: è l'ordine con cui guardi la squadra.
  const ordinati = [...atleti].sort((a, b) => {
    const pa = prontezzaDi(righe[a.id]);
    const pb = prontezzaDi(righe[b.id]);
    if (pa == null && pb == null) return a.cognome.localeCompare(b.cognome);
    if (pa == null) return 1;
    if (pb == null) return -1;
    return pa - pb;
  });

  const rilevati = Object.keys(righe).length;
  const daGuardare = ordinati.filter((a) => {
    const p = prontezzaDi(righe[a.id]);
    return p != null && p < 3;
  });

  return (
    <>
      <div className="barra">
        <h1>Benessere</h1>
        <div style={{ flex: 1 }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Giorno" />
      </div>

      <p style={{ color: 'var(--testo-3)', fontSize: 13, marginTop: -8 }}>
        Quattro tocchi per atleta prima di entrare in acqua. Non è una valutazione clinica:
        è un indicatore di prontezza, da leggere accanto al carico.
      </p>

      {messaggio && <div className="avviso errore" style={{ marginBottom: 12 }}>{messaggio}</div>}

      <div className="volumi sezione">
        <div className="volume" style={{ '--tinta': 'var(--ciano)' }}>
          <div className="etichetta">Rilevati</div>
          <div className="cifra">{rilevati}<small>/{atleti.length}</small></div>
        </div>
        <div className="volume" style={{ '--tinta': daGuardare.length ? 'var(--ambra)' : 'var(--menta)' }}>
          <div className="etichetta">Sotto la media</div>
          <div className="cifra">{daGuardare.length}</div>
          <div className="sotto">{daGuardare.slice(0, 3).map((a) => a.cognome).join(', ') || 'nessuno'}</div>
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <HeartPulse size={16} style={{ color: 'var(--rosa)' }} />
          <h3>Squadra</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>i meno pronti in cima</span>
        </div>

        {atleti.length === 0 ? (
          <div className="vuoto"><h3>Nessun atleta</h3><p>Carica prima la squadra dalla scheda Atleti.</p></div>
        ) : (
          <div className="corpo" style={{ display: 'grid', gap: 8 }}>
            {ordinati.map((a) => {
              const r = righe[a.id];
              const p = prontezzaDi(r);
              const espanso = aperto === a.id;
              return (
                <div key={a.id} className="riga-benessere" data-espanso={espanso}>
                  <button className="testa-benessere" onClick={() => setAperto(espanso ? null : a.id)}>
                    <span className="punteggio mono" style={{ color: tinta(p), borderColor: tinta(p) }}>
                      {p == null ? '·' : p.toFixed(1)}
                    </span>
                    <span><b>{a.cognome}</b> {a.nome}</span>
                    <span style={{ flex: 1 }} />
                    {r && <Check size={15} style={{ color: 'var(--menta)' }} />}
                  </button>

                  {espanso && (
                    <div className="corpo-benessere">
                      {VOCI.map(({ chiave, nome, Icona, basso, alto }) => (
                        <div className="voce-benessere" key={chiave}>
                          <span className="nome-voce">
                            <Icona size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{nome}
                          </span>
                          <span className="scala">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                className="mono"
                                aria-pressed={r?.[chiave] === n}
                                disabled={!puoScrivere}
                                onClick={() => segna(a.id, chiave, n)}
                              >
                                {n}
                              </button>
                            ))}
                          </span>
                          <span className="estremi">{basso} → {alto}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
