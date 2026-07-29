import { useEffect, useState } from 'react';
import * as api from '../lib/dati';

const GIORNI = 28;

function dataIndietro(giorni) {
  const d = new Date();
  d.setDate(d.getDate() - giorni);
  return d.toISOString().slice(0, 10);
}

const km = (m) => (m / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 });

export default function Volumi({ societa }) {
  const [righe, setRighe] = useState([]);
  const [settimane, setSettimane] = useState([]);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    const da = dataIndietro(GIORNI);
    Promise.all([api.caricoAtleti(societa.id, da), api.settimaneAtleti(societa.id, da)])
      .then(([c, s]) => { setRighe(c); setSettimane(s); })
      .catch((e) => setErrore(e.message));
  }, [societa.id]);

  // Aggregazione per atleta sugli ultimi 28 giorni
  const perAtleta = Object.values(
    righe.reduce((acc, r) => {
      const k = r.atleta_id;
      acc[k] ??= {
        nome: `${r.cognome} ${r.nome}`,
        spec: r.specializzazione,
        previsti: 0,
        nuotati: 0,
        sedute: 0,
        presenze: 0,
      };
      acc[k].previsti += r.metri_previsti || 0;
      acc[k].nuotati += r.metri_nuotati || 0;
      acc[k].sedute += 1;
      if (r.stato === 'P') acc[k].presenze += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.nuotati - a.nuotati);

  const totNuotati = perAtleta.reduce((t, a) => t + a.nuotati, 0);

  if (errore) return <div className="avviso errore">{errore}</div>;

  if (perAtleta.length === 0) {
    return (
      <div className="scheda">
        <div className="vuoto">
          <h3>Ancora niente da contare</h3>
          <p>I volumi nascono dall'incrocio fra le sedute e l'appello. Registra una presenza e i numeri compaiono qui.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="barra">
        <h1>Carico atleti</h1>
        <span style={{ color: 'var(--testo-2)', fontSize: 14 }}>ultimi {GIORNI} giorni</span>
      </div>

      <div className="volumi" style={{ marginBottom: 18 }}>
        <div className="volume" style={{ '--tinta': 'var(--ciano)' }}>
          <div className="etichetta">Nuotati dalla squadra</div>
          <div className="cifra">{km(totNuotati)}<small>km</small></div>
        </div>
        <div className="volume" style={{ '--tinta': 'var(--menta)' }}>
          <div className="etichetta">Atleti seguiti</div>
          <div className="cifra">{perAtleta.length}</div>
        </div>
        <div className="volume" style={{ '--tinta': 'var(--ambra)' }}>
          <div className="etichetta">Frequenza media</div>
          <div className="cifra">
            {Math.round(
              (perAtleta.reduce((t, a) => t + a.presenze / (a.sedute || 1), 0) / perAtleta.length) * 100
            )}
            <small>%</small>
          </div>
        </div>
      </div>

      <div className="scheda">
        <div className="intestazione">
          <h3>Carico reale per atleta</h3>
          <span style={{ fontSize: 13, color: 'var(--testo-2)' }}>
            metri della sua specializzazione, contati solo quando era presente
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Atleta</th>
              <th>Spec.</th>
              <th style={{ textAlign: 'right' }}>Presenze</th>
              <th style={{ textAlign: 'right' }}>Previsti</th>
              <th style={{ textAlign: 'right' }}>Nuotati</th>
            </tr>
          </thead>
          <tbody>
            {perAtleta.map((a) => (
              <tr key={a.nome}>
                <td><b>{a.nome}</b></td>
                <td style={{ color: 'var(--testo-2)' }}>{a.spec}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{a.presenze}/{a.sedute}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--testo-2)' }}>{km(a.previsti)} km</td>
                <td className="mono" style={{ textAlign: 'right' }}>{km(a.nuotati)} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settimane.length > 0 && (
        <div className="scheda" style={{ marginTop: 12 }}>
          <div className="intestazione"><h3>Settimane</h3></div>
          <table>
            <thead>
              <tr>
                <th>Settimana</th>
                <th>Atleta</th>
                <th style={{ textAlign: 'right' }}>Frequenza</th>
                <th style={{ textAlign: 'right' }}>Nuotati</th>
              </tr>
            </thead>
            <tbody>
              {settimane.slice(0, 40).map((s, i) => (
                <tr key={i}>
                  <td className="mono">{s.settimana}</td>
                  <td>{s.cognome} {s.nome}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{s.frequenza_pct ?? '—'}%</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{km(s.metri_nuotati || 0)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
