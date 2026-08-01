import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarRange } from 'lucide-react';
import { sb } from '../lib/supabase';
import * as api from '../lib/dati';
import { metriPerSpecializzazione } from '../lib/dominio';
import { TINTA_FAMIGLIA } from '../lib/colori';
import { BarreImpilate, BarreOrizzontali, km } from './Grafici';
import Confronto from './Confronto';

const iso = (d) => d.toISOString().slice(0, 10);
const giorniFa = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// Lunedì della settimana di una data
const lunedi = (isoData) => {
  const d = new Date(isoData + 'T12:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export default function Volumi({ societa, stagione }) {
  const [modo, setModo] = useState('mese');      // settimana | mese | periodo | stagione
  const [settimana, setSettimana] = useState(lunedi(iso(new Date())));
  const [mese, setMese] = useState(iso(new Date()).slice(0, 7));
  const [da, setDa] = useState(giorniFa(90));
  const [a, setA] = useState(iso(new Date()));

  const [righe, setRighe] = useState([]);
  const [sedute, setSedute] = useState([]);
  const [zone, setZone] = useState([]);
  const [errore, setErrore] = useState(null);

  // L'intervallo effettivo, qualunque modo sia scelto
  const periodo = useMemo(() => {
    if (modo === 'settimana') {
      const f = new Date(settimana + 'T12:00'); f.setDate(f.getDate() + 6);
      return { dal: settimana, al: iso(f) };
    }
    if (modo === 'mese') {
      const [y, m] = mese.split('-').map(Number);
      return { dal: `${mese}-01`, al: iso(new Date(y, m, 0)) };
    }
    if (modo === 'stagione') {
      const anno = parseInt(stagione, 10);
      return { dal: `${anno}-09-01`, al: `${anno + 1}-08-31` };
    }
    return { dal: da, al: a };
  }, [modo, settimana, mese, da, a, stagione]);

  useEffect(() => {
    setErrore(null);
    Promise.all([
      sb.from('v_carico_atleta').select('*').eq('societa_id', societa.id)
        .gte('data', periodo.dal).lte('data', periodo.al),
      api.leggiSedute(societa.id, { da: periodo.dal, a: periodo.al }),
      sb.from('v_carico_zona').select('data, zona, famiglia, metri, specializzazione')
        .eq('societa_id', societa.id).eq('specializzazione', 'Generale')
        .gte('data', periodo.dal).lte('data', periodo.al),
    ])
      .then(([c, s, z]) => {
        if (c.error) throw new Error(c.error.message);
        if (z.error) throw new Error(z.error.message);
        setRighe(c.data || []); setSedute(s || []); setZone(z.data || []);
      })
      .catch((e) => setErrore(e.message));
  }, [societa.id, periodo.dal, periodo.al]);

  // ------------------------------------------------ km delle sedute
  // Il volume del programma, non moltiplicato per gli atleti: per ogni
  // seduta il percorso comune (riscaldamento + parti per tutti).
  const kmSedute = sedute.reduce((t, s) => t + metriPerSpecializzazione(s.sezioni, 'Generale'), 0);

  // ------------------------------------------------ righe per atleta
  const perAtleta = useMemo(() => Object.values(
    righe.reduce((acc, r) => {
      const k = r.atleta_id;
      acc[k] ??= { nome: `${r.cognome} ${r.nome}`, spec: r.specializzazione, nuotati: 0, previsti: 0, rilevate: 0, presenze: 0, ritardi: 0 };
      acc[k].nuotati += r.metri_nuotati || 0;
      acc[k].previsti += r.metri_previsti || 0;
      acc[k].rilevate += 1;
      if (['P', 'R', 'G'].includes(r.stato)) acc[k].presenze += 1;
      if (r.stato === 'R') acc[k].ritardi += 1;
      return acc;
    }, {})
  ).sort((x, y) => y.nuotati - x.nuotati), [righe]);

  const freq = (r) => (r.rilevate ? Math.round((r.presenze / r.rilevate) * 100) : null);
  const tintaFreq = (p) => p == null ? 'var(--testo-3)'
    : p >= 90 ? 'var(--menta)' : p >= 75 ? 'var(--ciano)' : p >= 60 ? 'var(--ambra)' : 'var(--rosso)';

  // ------------------------------------------------ grafico settimanale
  const perSettimana = useMemo(() => {
    const m = {};
    for (const z of zone) {
      const s = lunedi(z.data);
      m[s] ??= { etichetta: '', valori: {} };
      const f = z.famiglia || 'nonclass';
      m[s].valori[f] = (m[s].valori[f] || 0) + (z.metri || 0);
    }
    return Object.entries(m).sort().map(([s, v]) => ({
      ...v,
      etichetta: new Date(s + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    }));
  }, [zone]);

  const SERIE = [
    { chiave: 'aerobico', nome: 'Aerobico', colore: TINTA_FAMIGLIA.aerobico },
    { chiave: 'vo2', nome: 'VO₂max', colore: TINTA_FAMIGLIA.vo2 },
    { chiave: 'lattacido', nome: 'Lattacido', colore: TINTA_FAMIGLIA.lattacido },
    { chiave: 'alattacido', nome: 'Alattacido', colore: TINTA_FAMIGLIA.alattacido },
    { chiave: 'nonclass', nome: 'Senza zona', colore: TINTA_FAMIGLIA.altro },
  ];

  const freqMedia = perAtleta.length
    ? Math.round(perAtleta.reduce((t, x) => t + (freq(x) || 0), 0) / perAtleta.length) : null;

  if (errore) return <div className="avviso errore">{errore}</div>;

  return (
    <>
      <div className="barra">
        <h1>Carico atleti</h1>
        <div style={{ flex: 1 }} />
        <div className="destinatari">
          {[['settimana', 'Settimana'], ['mese', 'Mese'], ['periodo', 'Periodo'], ['stagione', 'Stagione']].map(([k, n]) => (
            <button key={k} className="pastiglia" aria-pressed={modo === k} onClick={() => setModo(k)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="barra" style={{ gap: 8 }}>
        <CalendarRange size={15} style={{ color: 'var(--testo-3)' }} />
        {modo === 'settimana' && (
          <input type="date" value={settimana} onChange={(e) => setSettimana(lunedi(e.target.value))}
            style={{ minHeight: 36, fontSize: 13 }} aria-label="Scegli la settimana" />
        )}
        {modo === 'mese' && (
          <input type="month" value={mese} onChange={(e) => setMese(e.target.value)}
            style={{ minHeight: 36, fontSize: 13 }} aria-label="Scegli il mese" />
        )}
        {modo === 'periodo' && (
          <>
            <input type="date" value={da} onChange={(e) => setDa(e.target.value)} style={{ minHeight: 36, fontSize: 13 }} />
            <span style={{ color: 'var(--testo-3)' }}>→</span>
            <input type="date" value={a} onChange={(e) => setA(e.target.value)} style={{ minHeight: 36, fontSize: 13 }} />
          </>
        )}
        <span style={{ fontSize: 13, color: 'var(--testo-3)' }}>
          {modo === 'settimana' && `settimana dal ${new Date(periodo.dal + 'T12:00').toLocaleDateString('it-IT')}`}
          {modo === 'mese' && MESI[Number(mese.slice(5, 7)) - 1] + ' ' + mese.slice(0, 4)}
          {modo === 'stagione' && `stagione ${stagione}`}
          {modo === 'periodo' && `${sedute.length} sedute nel periodo`}
        </span>
      </div>

      <div className="volumi sezione">
        <div className="volume" style={{ '--tinta': 'var(--ciano)' }}>
          <div className="etichetta">Km delle sedute</div>
          <div className="cifra">{km(kmSedute)}<small>km</small></div>
          <div className="sotto">{sedute.length} sedute programmate</div>
        </div>
        <div className="volume" style={{ '--tinta': 'var(--menta)' }}>
          <div className="etichetta">Frequenza media</div>
          <div className="cifra">{freqMedia ?? '—'}<small>%</small></div>
          <div className="sotto">{perAtleta.length} atleti con rilevazioni</div>
        </div>
        <div className="volume" style={{ '--tinta': 'var(--ambra)' }}>
          <div className="etichetta">Sedute</div>
          <div className="cifra">{sedute.length}</div>
          <div className="sotto">nel periodo scelto</div>
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <BarChart3 size={16} style={{ color: 'var(--ciano)' }} />
          <h3>Atleti</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>metri della propria specializzazione, solo da presente</span>
        </div>
        {perAtleta.length === 0 ? (
          <div className="vuoto">
            <h3>Nessuna rilevazione</h3>
            <p>I numeri nascono dall'incrocio fra sedute e appello: segna una presenza e compaiono.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Atleta</th><th>Spec.</th>
                <th style={{ textAlign: 'right' }}>Presenze</th>
                <th style={{ textAlign: 'right' }}>Frequenza</th>
                <th style={{ textAlign: 'right' }}>Rit.</th>
                <th style={{ textAlign: 'right' }}>Previsti</th>
                <th style={{ textAlign: 'right' }}>Nuotati</th>
              </tr>
            </thead>
            <tbody>
              {perAtleta.map((r) => {
                const p = freq(r);
                return (
                  <tr key={r.nome}>
                    <td><b>{r.nome}</b></td>
                    <td style={{ color: 'var(--testo-3)' }}>{r.spec}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{r.presenze}/{r.rilevate}</td>
                    <td className="mono" style={{ textAlign: 'right', color: tintaFreq(p) }}>{p == null ? '—' : `${p}%`}</td>
                    <td className="mono" style={{ textAlign: 'right', color: r.ritardi ? 'var(--ciano)' : 'var(--testo-3)' }}>{r.ritardi}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--testo-3)' }}>{km(r.previsti)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{km(r.nuotati)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="scheda sezione">
        <div className="intestazione"><h3>Volume settimanale del programma</h3></div>
        <div className="corpo">
          <BarreImpilate dati={perSettimana} serie={SERIE} />
        </div>
      </div>

      <Confronto societa={societa} />

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Km nuotati per atleta</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>la barra chiara è quanto era previsto</span>
        </div>
        <div className="corpo">
          <BarreOrizzontali
            dati={perAtleta.slice(0, 25).map((r) => ({
              etichetta: r.nome, valore: r.nuotati, riferimento: r.previsti,
            }))}
          />
        </div>
      </div>
    </>
  );
}
