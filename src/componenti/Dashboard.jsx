import { useEffect, useState } from 'react';
import * as api from '../lib/dati';
import { SPECIALIZZAZIONI, MACRO_CALENDARIO } from '../lib/dominio';
import { tinta, TINTA_FAMIGLIA } from '../lib/colori';
import Calendario from './Calendario';
import { BarreImpilate } from './Grafici';

const PERIODI = [
  { g: 7, nome: 'Settimana' },
  { g: 28, nome: '4 settimane' },
  { g: 90, nome: 'Trimestre' },
  { g: 365, nome: 'Stagione' },
];

const indietro = (g) => {
  const d = new Date();
  d.setDate(d.getDate() - g);
  return d.toISOString().slice(0, 10);
};

export default function Dashboard({ societa, zone, categorie, stagione, puoScrivere, apriSeduta }) {
  const [giorni, setGiorni] = useState(28);
  const [spec, setSpec] = useState('Mezzofondo');
  const [macro, setMacro] = useState('tutte');
  const [righe, setRighe] = useState([]);
  const [errore, setErrore] = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  const macroScelto = MACRO_CALENDARIO.find((m) => m.id === macro);
  const codiciMacro = macroScelto?.codici || null;

  useEffect(() => {
    setCaricamento(true);
    // Non la vista v_carico_zona: quella conta il programma. Qui servono
    // i metri davvero nuotati, come in Carico atleti — se no le due
    // schede mostrano due numeri diversi per la stessa settimana.
    api.caricoReale(societa.id, { da: indietro(giorni), specializzazione: spec })
      .then(({ zone }) => {
        const filtrate = codiciMacro
          ? zone.filter((z) => (z.categorie || []).some((c) => codiciMacro.includes(c)))
          : zone;
        setRighe(filtrate);
        setErrore(null);
      })
      .catch((e) => setErrore(e.message))
      .finally(() => setCaricamento(false));
  }, [societa.id, spec, giorni, codiciMacro?.join()]);

  const perZona = righe.reduce((acc, r) => {
    const k = r.zona || '?';
    acc[k] = (acc[k] || 0) + (r.metri || 0);
    return acc;
  }, {});

  const perFamiglia = righe.reduce((acc, r) => {
    const k = r.famiglia || 'nonClassificati';
    acc[k] = (acc[k] || 0) + (r.metri || 0);
    return acc;
  }, {});

  const totale = Object.values(perZona).reduce((a, b) => a + b, 0);
  const pct = (m) => (totale ? ((m / totale) * 100).toFixed(1) : '0.0');

  const kpi = [
    { nome: 'Volume totale', valore: (totale / 1000).toFixed(1), unita: 'km', sotto: `${totale.toLocaleString('it-IT')} metri`, tinta: 'var(--ciano)' },
    { nome: 'Aerobico', valore: pct(perFamiglia.aerobico || 0), unita: '%', sotto: `${(perFamiglia.aerobico || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.aerobico },
    { nome: 'VO₂max', valore: pct(perFamiglia.vo2 || 0), unita: '%', sotto: `${(perFamiglia.vo2 || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.vo2 },
    { nome: 'Lattacido', valore: pct(perFamiglia.lattacido || 0), unita: '%', sotto: `${(perFamiglia.lattacido || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.lattacido },
    { nome: 'Alattacido', valore: pct(perFamiglia.alattacido || 0), unita: '%', sotto: `${(perFamiglia.alattacido || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.alattacido },
  ];

  const massimo = Math.max(1, ...Object.values(perZona));

  // Andamento nel tempo: una colonna per settimana, composta per famiglia.
  const perSettimana = (() => {
    const lunedi = (d) => {
      const x = new Date(d + 'T12:00');
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x.toISOString().slice(0, 10);
    };
    const m = {};
    for (const r of righe) {
      const s = lunedi(r.data);
      m[s] ??= { valori: {} };
      const f = r.famiglia || 'nonclass';
      m[s].valori[f] = (m[s].valori[f] || 0) + (r.metri || 0);
    }
    return Object.entries(m).sort().map(([s, v]) => ({
      ...v,
      etichetta: new Date(s + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    }));
  })();

  const SERIE = [
    { chiave: 'aerobico', nome: 'Aerobico', colore: TINTA_FAMIGLIA.aerobico },
    { chiave: 'vo2', nome: 'VO₂max', colore: TINTA_FAMIGLIA.vo2 },
    { chiave: 'lattacido', nome: 'Lattacido', colore: TINTA_FAMIGLIA.lattacido },
    { chiave: 'alattacido', nome: 'Alattacido', colore: TINTA_FAMIGLIA.alattacido },
    { chiave: 'nonclass', nome: 'Senza zona', colore: TINTA_FAMIGLIA.altro },
  ];

  return (
    <>
      <Calendario societa={societa} puoScrivere={puoScrivere} apriSeduta={apriSeduta}
        stagione={stagione} categorie={categorie} macro={macro} cambiaMacro={setMacro} />

      <div className="barra sezione">
        <h1>Dashboard volumi</h1>
        {macroScelto && macro !== 'tutte' && (
          <span className="societa" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>{macroScelto.nome}</span>
        )}
        <div style={{ flex: 1 }} />
        <select value={spec} onChange={(e) => setSpec(e.target.value)}>
          {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={giorni} onChange={(e) => setGiorni(Number(e.target.value))}>
          {PERIODI.map((p) => <option key={p.g} value={p.g}>{p.nome}</option>)}
        </select>
      </div>

      <p style={{ color: 'var(--testo-3)', fontSize: 13, marginTop: -6 }}>
        Carico di chi fa <b style={{ color: 'var(--testo-2)' }}>{spec}</b>: riscaldamento comune più la
        sua parte centrale. {macro === 'tutte'
          ? 'Tutte le categorie insieme: scegline una sopra e i numeri seguono.'
          : <>Solo le sedute di <b style={{ color: 'var(--testo-2)' }}>{macroScelto.nome}</b>.</>}
      </p>

      {errore && <div className="avviso errore">{errore}</div>}

      <div className="volumi sezione">
        {kpi.map((k) => (
          <div className="volume" key={k.nome} style={{ '--tinta': k.tinta }}>
            <div className="etichetta">{k.nome}</div>
            <div className="cifra">{k.valore}<small>{k.unita}</small></div>
            <div className="sotto">{k.sotto}</div>
          </div>
        ))}
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Ripartizione per zona</h3>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 13 }}>
            {caricamento ? '…' : `${righe.length} righe`}
          </span>
        </div>
        <div className="corpo">
          {totale === 0 ? (
            <div className="vuoto">
              <h3>Nessun metro nel periodo</h3>
              <p>
                {macro === 'tutte'
                  ? 'Le zone si riempiono man mano che salvi le sedute con la zona indicata su ogni serie.'
                  : `Nessuna seduta di ${macroScelto.nome} in questo periodo: prova con "Tutte" o allarga l'orizzonte.`}
              </p>
            </div>
          ) : (
            zone.map((z) => {
              const m = perZona[z.codice] || 0;
              const c = tinta(z.colore);
              return (
                <div className="zona-riga" key={z.codice} style={{ '--tinta': c }}>
                  <div className="zona-testa">
                    <span className="nome"><b>{z.codice}</b>{z.nome}</span>
                    <span className="spazio" />
                    <span className="valore">{m.toLocaleString('it-IT')} m ({pct(m)}%)</span>
                  </div>
                  <div className="zona-barra">
                    <i style={{ width: `${(m / massimo) * 100}%` }} />
                  </div>
                </div>
              );
            })
          )}

          {perZona['?'] > 0 && (
            <div className="avviso" style={{ marginTop: 16 }}>
              {perZona['?'].toLocaleString('it-IT')} metri senza zona indicata: non entrano in nessuna
              percentuale. Li trovi nelle sedute con la serie priva di zona.
            </div>
          )}
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Andamento settimanale</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>
            {spec}{macro !== 'tutte' ? ` · ${macroScelto.nome}` : ''}
          </span>
        </div>
        <div className="corpo">
          <BarreImpilate dati={perSettimana} serie={SERIE} />
        </div>
      </div>
    </>
  );
}
