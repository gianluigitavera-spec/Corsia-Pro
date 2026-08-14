// =====================================================================
// COPIARE
//
// Il punto uno dell'elenco: le sedute si somigliano e riscriverle da
// capo ogni volta è la cosa che costa più tempo. Due modi:
//
//   una seduta  → la stessa su un'altra data
//   la settimana → tutte quelle di una settimana spostate su un'altra
//
// Si copia il programma e basta. Presenze e "com'è andata" restano dove
// sono successe: sono il registro di quel giorno, non della seduta.
// =====================================================================
import { useState } from 'react';
import { Copy, X, CalendarRange } from 'lucide-react';
import * as api from '../lib/dati';
import { copiaSeduta, perSettimana, lunediDi, giorno, dataIt } from '../lib/dominio';

export default function CopiaSedute({ societa, elenco, seduta, chiudi, fatto }) {
  const settimane = perSettimana(elenco);
  const unaSola = Boolean(seduta);

  const [quando, setQuando] = useState(
    unaSola ? giorno(seduta.data, 7) : giorno(lunediDi(new Date().toISOString().slice(0, 10)), 7)
  );
  const [origine, setOrigine] = useState(settimane[0]?.lunedi || '');
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  const settimanaScelta = settimane.find((s) => s.lunedi === origine);
  const lunediDestinazione = lunediDi(quando);

  // Quello che si andrebbe a creare, con le date già calcolate: meglio
  // vederlo prima che scoprirlo dopo.
  const anteprima = unaSola
    ? [{ da: seduta.data, a: quando, titolo: seduta.titolo || 'senza titolo' }]
    : (settimanaScelta?.sedute || []).map((s) => ({
      da: s.data,
      a: giorno(s.data, (new Date(lunediDestinazione + 'T12:00') - new Date(origine + 'T12:00')) / 86400000),
      titolo: s.titolo || 'senza titolo',
    }));

  // Se sulla destinazione c'è già qualcosa, lo si dice invece di
  // accorgersene dopo con due sedute sullo stesso giorno.
  const gia = anteprima.filter((r) => elenco.some((s) => s.data === r.a));

  async function copia() {
    setInCorso(true);
    setErrore(null);
    try {
      const sorgenti = unaSola ? [seduta] : settimanaScelta.sedute;
      const copie = sorgenti.map((s, i) => copiaSeduta(s, anteprima[i].a));
      await api.duplicaSedute(copie);
      fatto?.(copie.length);
    } catch (e) {
      setErrore(e.message);
      setInCorso(false);
    }
  }

  return (
    <div className="scheda" style={{ marginBottom: 14, borderColor: 'var(--ciano)' }}>
      <div className="intestazione">
        {unaSola ? <Copy size={16} /> : <CalendarRange size={16} />}
        <b>{unaSola ? 'Duplica la seduta' : 'Copia una settimana'}</b>
        <div style={{ flex: 1 }} />
        <button className="mini" onClick={chiudi} aria-label="Chiudi"><X size={14} /></button>
      </div>

      <div className="corpo">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {!unaSola && (
            <label className="campo" style={{ margin: 0 }}>
              <span>Settimana da copiare</span>
              <select value={origine} onChange={(e) => setOrigine(e.target.value)}>
                {settimane.map((s) => (
                  <option key={s.lunedi} value={s.lunedi}>
                    {dataIt(s.lunedi)} · {s.sedute.length} sedute
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="campo" style={{ margin: 0 }}>
            <span>{unaSola ? 'Nuova data' : 'Settimana di destinazione'}</span>
            <input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </label>

          <button className="azione" onClick={copia}
            disabled={inCorso || !anteprima.length || (!unaSola && !settimanaScelta)}>
            {inCorso ? 'Copio…' : `Copia ${anteprima.length > 1 ? `${anteprima.length} sedute` : 'la seduta'}`}
          </button>
        </div>

        {!unaSola && (
          <p style={{ fontSize: 12, color: 'var(--testo-3)', marginBottom: 0 }}>
            Le sedute mantengono il giorno della settimana: il martedì resta martedì.
            Destinazione: settimana del {dataIt(lunediDestinazione)}.
          </p>
        )}

        {anteprima.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {anteprima.map((r, i) => (
              <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>
                <span className="mono" style={{ color: 'var(--testo-3)' }}>{dataIt(r.da)}</span>
                <span style={{ margin: '0 8px', color: 'var(--ciano)' }}>→</span>
                <span className="mono">{dataIt(r.a)}</span>
                <span style={{ marginLeft: 10 }}>{r.titolo}</span>
              </div>
            ))}
          </div>
        )}

        {gia.length > 0 && (
          <div className="avviso" style={{ marginTop: 10 }}>
            Su {gia.length === 1 ? 'quella data' : 'quelle date'} c'è già una seduta.
            La copia si aggiunge, non la sostituisce: te ne ritrovi due nello stesso giorno.
          </div>
        )}

        {errore && <div className="avviso errore" style={{ marginTop: 10 }}>{errore}</div>}

        <p style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 12, marginBottom: 0 }}>
          Si copia il programma. Presenze e "com'è andata" restano sulla seduta di partenza.
        </p>
      </div>
    </div>
  );
}
