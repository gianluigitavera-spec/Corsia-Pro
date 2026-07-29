import { useEffect, useMemo, useState } from 'react';
import * as api from '../lib/dati';
import {
  TUTTI,
  SPECIALIZZAZIONI,
  sedutaVuota,
  serieVuota,
  metriPerSpecializzazione,
  caricoPerFamiglia,
  validaSeduta,
} from '../lib/dominio';

const COLORI_FAMIGLIA = {
  aerobico: 'var(--aerobico)',
  vo2: 'var(--vo2)',
  lattacido: 'var(--lattacido)',
  alattacido: 'var(--alattacido)',
  nonClassificati: 'var(--nonclass)',
};

// Il colore della corsia viene dalla zona prevalente della sezione.
function coloreSezione(sezione, zone) {
  const mappa = Object.fromEntries(zone.map((z) => [z.codice, z.famiglia]));
  const conta = {};
  for (const s of sezione.serie || []) {
    const fam = mappa[s.zona] || 'nonClassificati';
    conta[fam] = (conta[fam] || 0) + (Number(s.metri) || 0);
  }
  const vincente = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  return COLORI_FAMIGLIA[vincente?.[0]] || 'var(--vasca)';
}

export default function EditorSeduta({ societa, zone, puoScrivere }) {
  const [elenco, setElenco] = useState([]);
  const [gruppi, setGruppi] = useState([]);
  const [seduta, setSeduta] = useState(null);
  const [messaggio, setMessaggio] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const codiciZona = zone.map((z) => z.codice);

  useEffect(() => {
    ricarica();
    api.leggiGruppi(societa.id).then(setGruppi).catch(() => {});
  }, [societa.id]);

  async function ricarica() {
    try {
      setElenco(await api.leggiSedute(societa.id));
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: e.message });
    }
  }

  const problemi = useMemo(
    () => (seduta ? validaSeduta(seduta, codiciZona) : []),
    [seduta, codiciZona.join()]
  );

  // ---------------------------------------------------------- modifiche
  function aggiorna(fn) {
    setSeduta((s) => {
      const copia = structuredClone(s);
      fn(copia);
      return copia;
    });
  }

  const cambiaSerie = (i, j, campo, valore) =>
    aggiorna((s) => {
      s.sezioni[i].serie[j][campo] = campo === 'metri' ? Number(valore) || 0 : valore;
    });

  const togliDestinatario = (i, spec) =>
    aggiorna((s) => {
      const sez = s.sezioni[i];
      const attuali = sez.destinatari?.length ? sez.destinatari : [TUTTI];
      if (spec === TUTTI) {
        sez.destinatari = [TUTTI];
        return;
      }
      const senzaTutti = attuali.filter((d) => d !== TUTTI);
      sez.destinatari = senzaTutti.includes(spec)
        ? senzaTutti.filter((d) => d !== spec)
        : [...senzaTutti, spec];
      if (sez.destinatari.length === 0) sez.destinatari = [TUTTI];
    });

  async function salva() {
    setSalvataggio(true);
    setMessaggio(null);
    try {
      const payload = { ...seduta, societa_id: societa.id };
      const salvata = await api.salvaSeduta(payload);
      setSeduta(salvata);
      await ricarica();
      setMessaggio({ tipo: 'ok', testo: 'Seduta salvata.' });
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: e.message });
    } finally {
      setSalvataggio(false);
    }
  }

  // ------------------------------------------------------------- elenco
  if (!seduta) {
    return (
      <>
        <div className="barra">
          <h1>Sedute</h1>
          <div style={{ flex: 1 }} />
          {puoScrivere && (
            <button className="azione" onClick={() => setSeduta(sedutaVuota())}>
              Nuova seduta
            </button>
          )}
        </div>

        {messaggio && <div className={`avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`}>{messaggio.testo}</div>}

        {elenco.length === 0 ? (
          <div className="scheda">
            <div className="vuoto">
              <h3>Nessuna seduta</h3>
              <p>La prima la scrivi a mano. Quelle generate da SwimCoach arriveranno qui dentro con la stessa forma.</p>
              {puoScrivere && (
                <button className="azione" onClick={() => setSeduta(sedutaVuota())}>
                  Scrivi la prima
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="scheda">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Titolo</th>
                  <th>Origine</th>
                  <th style={{ textAlign: 'right' }}>Sezioni</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {elenco.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.data}</td>
                    <td>{s.titolo || '—'}</td>
                    <td style={{ color: 'var(--inchiostro-2)' }}>{s.origine}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{(s.sezioni || []).length}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="mini" onClick={() => api.leggiSeduta(s.id).then(setSeduta)}>
                        Apri
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  // ------------------------------------------------------------- editor
  return (
    <>
      <div className="barra">
        <button className="mini" onClick={() => { setSeduta(null); setMessaggio(null); }}>
          ← Sedute
        </button>
        <div style={{ flex: 1 }} />
        <button className="azione" onClick={salva} disabled={!puoScrivere || salvataggio}>
          {salvataggio ? 'Salvo…' : 'Salva seduta'}
        </button>
      </div>

      <div className="scheda">
        <div className="corpo" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div className="campo">
            <label htmlFor="data">Data</label>
            <input
              id="data"
              type="date"
              value={seduta.data || ''}
              onChange={(e) => aggiorna((s) => { s.data = e.target.value; })}
            />
          </div>
          <div className="campo">
            <label htmlFor="gruppo">Gruppo</label>
            <select
              id="gruppo"
              value={seduta.gruppo_id || ''}
              onChange={(e) => aggiorna((s) => { s.gruppo_id = e.target.value || null; })}
            >
              <option value="">—</option>
              {gruppi.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="titolo">Titolo</label>
            <input
              id="titolo"
              value={seduta.titolo || ''}
              placeholder="es. Soglia + tecnica gambe"
              onChange={(e) => aggiorna((s) => { s.titolo = e.target.value; })}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ le corsie */}
      <div className="sezione">
        {(seduta.sezioni || []).map((sez, i) => {
          const dest = sez.destinatari?.length ? sez.destinatari : [TUTTI];
          return (
            <div className="corsia" key={i} style={{ '--colore-corsia': coloreSezione(sez, zone) }}>
              <div className="testa">
                <input
                  className="titolo-corsia"
                  style={{ border: 0, background: 'transparent', padding: 0, minHeight: 'auto', flex: '1 1 160px' }}
                  value={sez.titolo || ''}
                  placeholder="Titolo sezione"
                  onChange={(e) => aggiorna((s) => { s.sezioni[i].titolo = e.target.value; })}
                />
                <div className="destinatari">
                  <button
                    className="pastiglia"
                    aria-pressed={dest.includes(TUTTI)}
                    onClick={() => togliDestinatario(i, TUTTI)}
                  >
                    Tutti
                  </button>
                  {SPECIALIZZAZIONI.filter((s) => s !== 'Generale').map((spec) => (
                    <button
                      key={spec}
                      className="pastiglia"
                      aria-pressed={dest.includes(spec)}
                      onClick={() => togliDestinatario(i, spec)}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
                <button
                  className="mini"
                  onClick={() => aggiorna((s) => { s.sezioni.splice(i, 1); })}
                  aria-label="Elimina sezione"
                >
                  ✕
                </button>
              </div>

              <div className="serie">
                {(sez.serie || []).length > 0 && (
                  <div className="intestazione-serie">
                    <span>Serie</span>
                    <span>Zona</span>
                    <span>Metri</span>
                    <span className="rec">Recupero</span>
                    <span />
                  </div>
                )}

                {(sez.serie || []).map((s, j) => (
                  <div className="riga-serie" key={j}>
                    <input
                      value={s.notazione || ''}
                      placeholder="8x100 sl"
                      onChange={(e) => cambiaSerie(i, j, 'notazione', e.target.value)}
                    />
                    <select value={s.zona || ''} onChange={(e) => cambiaSerie(i, j, 'zona', e.target.value)}>
                      <option value="">—</option>
                      {zone.map((z) => (
                        <option key={z.codice} value={z.codice} title={z.nome}>{z.codice}</option>
                      ))}
                    </select>
                    <input
                      className="mono"
                      type="number"
                      inputMode="numeric"
                      value={s.metri || ''}
                      placeholder="0"
                      onChange={(e) => cambiaSerie(i, j, 'metri', e.target.value)}
                    />
                    <input
                      className="mono rec"
                      value={s.recupero || ''}
                      placeholder={'p.1\'40"'}
                      onChange={(e) => cambiaSerie(i, j, 'recupero', e.target.value)}
                    />
                    <button
                      className="togli"
                      aria-label="Togli serie"
                      onClick={() => aggiorna((st) => { st.sezioni[i].serie.splice(j, 1); })}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  className="mini"
                  style={{ marginTop: 9 }}
                  onClick={() => aggiorna((s) => { s.sezioni[i].serie = [...(s.sezioni[i].serie || []), serieVuota()]; })}
                >
                  + serie
                </button>
              </div>
            </div>
          );
        })}

        <button
          className="azione fantasma"
          style={{ marginTop: 12 }}
          onClick={() =>
            aggiorna((s) => {
              s.sezioni.push({ titolo: '', destinatari: [TUTTI], serie: [] });
            })
          }
        >
          + sezione
        </button>
      </div>

      {/* --------------------------------------- volumi per specializzazione */}
      <div className="sezione">
        <h3 style={{ marginBottom: 10 }}>Volume per specializzazione</h3>
        <div className="volumi">
          {SPECIALIZZAZIONI.map((spec) => {
            const metri = metriPerSpecializzazione(seduta.sezioni, spec);
            const fam = caricoPerFamiglia(seduta.sezioni, spec, zone);
            const tot = Object.values(fam).reduce((a, b) => a + b, 0) || 1;
            return (
              <div className="volume" key={spec}>
                <div className="etichetta">{spec}</div>
                <div className="cifra">
                  {metri.toLocaleString('it-IT')}<small>m</small>
                </div>
                <div className="nastro">
                  {Object.entries(fam).map(([f, m]) =>
                    m > 0 ? (
                      <i key={f} style={{ width: `${(m / tot) * 100}%`, background: COLORI_FAMIGLIA[f] }} />
                    ) : null
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="legenda">
          {[
            ['aerobico', 'aerobico'],
            ['vo2', 'VO₂max'],
            ['lattacido', 'lattacido'],
            ['alattacido', 'alattacido'],
          ].map(([k, nome]) => (
            <span key={k}>
              <i className="punto" style={{ background: COLORI_FAMIGLIA[k] }} />
              <b>{nome}</b>
            </span>
          ))}
        </div>
      </div>

      {problemi.length > 0 && (
        <div className="sezione avviso">
          <b>Da sistemare prima di fidarsi dei numeri</b>
          <ul>
            {problemi.slice(0, 8).map((p, k) => (
              <li key={k}>
                {p.campo}: {p.msg}
              </li>
            ))}
            {problemi.length > 8 && <li>…e altri {problemi.length - 8}</li>}
          </ul>
        </div>
      )}

      {messaggio && (
        <div className={`sezione avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`}>{messaggio.testo}</div>
      )}
    </>
  );
}
