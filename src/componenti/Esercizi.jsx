import { useEffect, useMemo, useState } from 'react';
import {
  Dumbbell, Plus, Search, Link2, Link2Off, Trash2, Pencil, Check, X,
  CalendarDays, RefreshCw, AlertTriangle, Building2, Globe,
} from 'lucide-react';
import * as api from '../lib/dati';
import { verificaLink, anteprimaYoutube, idYoutube } from '../lib/video';
import { dataIt } from '../lib/dominio';

const VUOTO = { codice: '', nome: '', descrizione: '', stile: '', video_url: '' };
const STILI = ['', 'SL', 'DO', 'RA', 'FA', 'MI'];

const lunediDi = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};

function Collegamento({ esercizio, onSegnala }) {
  if (!esercizio.video_url) return <span style={{ color: 'var(--testo-3)', fontSize: 12 }}>—</span>;
  const rotto = esercizio.link_ok === false;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <a
        href={esercizio.video_url}
        target="_blank"
        rel="noreferrer"
        className={`collegamento${rotto ? ' rotto' : ''}`}
        title={rotto
          ? `Non funzionava il ${dataIt(String(esercizio.link_visto_il || '').slice(0, 10))}`
          : esercizio.video_url}
      >
        {rotto ? <Link2Off size={14} /> : <Link2 size={14} />}
        {rotto ? 'rotto' : 'video'}
      </a>
      {!rotto && (
        <button
          className="segnala"
          title="Il video non c'è più? Segnalalo"
          onClick={() => onSegnala(esercizio.id, false)}
        >
          <AlertTriangle size={12} />
        </button>
      )}
    </span>
  );
}

export default function Esercizi({ societa, puoScrivere }) {
  const [esercizi, setEsercizi] = useState([]);
  const [settimana, setSettimana] = useState(lunediDi());
  const [dellaSettimana, setDellaSettimana] = useState([]);
  const [cerca, setCerca] = useState('');
  const [nuovo, setNuovo] = useState(null);
  const [messaggio, setMessaggio] = useState(null);
  const [controllo, setControllo] = useState(false);

  useEffect(() => { ricarica(); }, [societa.id]);
  useEffect(() => { ricaricaSettimana(); }, [societa.id, settimana]);

  async function ricarica() {
    try { setEsercizi(await api.leggiEsercizi(societa.id)); }
    catch (e) { setMessaggio({ testo: e.message, errore: true }); }
  }
  async function ricaricaSettimana() {
    try { setDellaSettimana(await api.leggiSettimana(societa.id, settimana)); }
    catch { setDellaSettimana([]); }
  }

  const comuni = esercizi.filter((e) => !e.societa_id);
  const nostri = esercizi.filter((e) => e.societa_id);
  const inSettimana = new Set(dellaSettimana.map((r) => r.esercizio_id));

  const filtra = (elenco) => {
    const q = cerca.trim().toLowerCase();
    if (!q) return elenco;
    return elenco.filter((e) =>
      `${e.codice} ${e.nome} ${e.stile || ''} ${(e.attrezzi || []).join(' ')}`.toLowerCase().includes(q));
  };

  // Il prossimo codice libero per la sigla scelta: DO-01, DO-02…
  const prossimoCodice = (prefisso) => {
    const usati = esercizi
      .filter((e) => e.codice?.toUpperCase().startsWith(prefisso + '-'))
      .map((e) => parseInt(e.codice.split('-')[1], 10) || 0);
    const n = Math.max(0, ...usati) + 1;
    return `${prefisso}-${String(n).padStart(2, '0')}`;
  };

  async function salva() {
    try {
      await api.salvaEsercizio({
        ...(nuovo.id ? { id: nuovo.id } : { societa_id: societa.id }),
        codice: nuovo.codice.trim().toUpperCase(),
        nome: nuovo.nome.trim(),
        descrizione: nuovo.descrizione?.trim() || null,
        stile: nuovo.stile || null,
        video_url: nuovo.video_url?.trim() || null,
        link_ok: nuovo.video_url?.trim() ? null : null,
      });
      setNuovo(null);
      setMessaggio(null);
      ricarica();
    } catch (e) {
      setMessaggio({
        testo: /duplicate|unique/i.test(e.message)
          ? `Il codice ${nuovo.codice} è già usato: scegline un altro.`
          : e.message,
        errore: true,
      });
    }
  }

  async function segnala(id, stato) {
    await api.segnaStatoLink(id, stato);
    ricarica();
  }

  // Controlla i link YouTube uno per uno: gli altri non sono verificabili.
  async function controllaTutti() {
    setControllo(true);
    let rotti = 0;
    let saltati = 0;
    for (const e of esercizi.filter((x) => x.video_url)) {
      const esito = await verificaLink(e.video_url);
      if (esito === null) { saltati += 1; continue; }
      if (esito === false) rotti += 1;
      await api.segnaStatoLink(e.id, esito);
    }
    setControllo(false);
    await ricarica();
    setMessaggio({
      testo: rotti === 0
        ? `Tutti i video controllati funzionano${saltati ? ` (${saltati} non verificabili: non sono YouTube)` : ''}.`
        : `${rotti} video non esistono più${saltati ? `, ${saltati} non verificabili` : ''}.`,
      errore: rotti > 0,
    });
  }

  const Tabella = ({ titolo, Icona, elenco, propri }) => (
    <div className="scheda" style={{ marginTop: 12 }}>
      <div className="intestazione">
        <Icona size={16} style={{ color: propri ? 'var(--ciano)' : 'var(--testo-2)' }} />
        <h3>{titolo}</h3>
        <span className="mono" style={{ color: 'var(--testo-3)' }}>{elenco.length}</span>
        <div style={{ flex: 1 }} />
        {propri && puoScrivere && (
          <button className="mini" onClick={() => setNuovo({ ...VUOTO, codice: prossimoCodice('TC') })}>
            <Plus size={13} style={{ verticalAlign: -2 }} /> Aggiungi
          </button>
        )}
      </div>
      {elenco.length === 0 ? (
        <div className="corpo" style={{ color: 'var(--testo-3)', fontSize: 14 }}>
          {propri ? 'Nessun esercizio della squadra. Aggiungi il primo qui sopra.' : 'Nessun esercizio comune.'}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 74 }}>Codice</th>
              <th>Esercizio</th>
              <th style={{ width: 52 }}>Stile</th>
              <th style={{ width: 96 }}>Video</th>
              <th style={{ width: 92 }} />
            </tr>
          </thead>
          <tbody>
            {filtra(elenco).map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ color: 'var(--ciano)' }}>{e.codice}</td>
                <td>
                  <b>{e.nome}</b>
                  {e.descrizione && <div className="dettagli-letti">{e.descrizione}</div>}
                </td>
                <td className="mono" style={{ color: 'var(--testo-3)' }}>{e.stile || '—'}</td>
                <td><Collegamento esercizio={e} onSegnala={segnala} /></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {puoScrivere && (
                    <button
                      className="mini"
                      title={inSettimana.has(e.id) ? 'Togli dalla settimana' : 'Metti in settimana'}
                      onClick={async () => {
                        if (inSettimana.has(e.id)) await api.togliDallaSettimana(societa.id, settimana, e.id);
                        else await api.aggiungiAllaSettimana(societa.id, settimana, e.id, dellaSettimana.length);
                        ricaricaSettimana();
                      }}
                    >
                      {inSettimana.has(e.id) ? <Check size={13} style={{ color: 'var(--menta)' }} /> : <CalendarDays size={13} />}
                    </button>
                  )}{' '}
                  {propri && puoScrivere && (
                    <>
                      <button className="mini" onClick={() => setNuovo({ ...e })} aria-label="Modifica">
                        <Pencil size={13} />
                      </button>{' '}
                      <button
                        className="mini"
                        aria-label="Archivia"
                        onClick={async () => {
                          if (!confirm(`Archiviare "${e.nome}"?`)) return;
                          await api.archiviaEsercizio(e.id);
                          ricarica();
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <div className="barra">
        <h1>Esercizi</h1>
        <div className="cerca">
          <Search size={16} />
          <input placeholder="Cerca esercizio…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        {puoScrivere && (
          <button className="mini" onClick={controllaTutti} disabled={controllo}>
            <RefreshCw size={13} style={{ verticalAlign: -2 }} /> {controllo ? 'Controllo…' : 'Controlla i video'}
          </button>
        )}
      </div>

      {messaggio && (
        <div className={`avviso ${messaggio.errore ? 'errore' : ''}`} style={{ marginBottom: 12 }}>
          {messaggio.testo}
        </div>
      )}

      {/* ------------------------------------- 1. della settimana */}
      <div className="scheda">
        <div className="intestazione">
          <CalendarDays size={16} style={{ color: 'var(--menta)' }} />
          <h3>Questa settimana</h3>
          <span className="mono" style={{ color: 'var(--testo-3)' }}>{dellaSettimana.length}</span>
          <div style={{ flex: 1 }} />
          <input
            type="date"
            value={settimana}
            onChange={(e) => setSettimana(lunediDi(new Date(e.target.value + 'T12:00')))}
            style={{ minHeight: 34, fontSize: 13 }}
            aria-label="Settimana"
          />
        </div>
        <div className="corpo">
          {dellaSettimana.length === 0 ? (
            <p style={{ color: 'var(--testo-3)', fontSize: 14, margin: 0 }}>
              Nessun esercizio scelto per la settimana del {dataIt(settimana)}. Usa il tasto calendario
              nelle tabelle qui sotto: quello che scegli qui è ciò che l'allenatore trova sulla lavagna.
            </p>
          ) : (
            <div className="griglia-esercizi">
              {dellaSettimana.map(({ esercizio: e }) => e && (
                <div className="scheda-esercizio" key={e.id}>
                  {anteprimaYoutube(e.video_url) && e.link_ok !== false && (
                    <a href={e.video_url} target="_blank" rel="noreferrer">
                      <img src={anteprimaYoutube(e.video_url)} alt="" loading="lazy" />
                    </a>
                  )}
                  <div className="corpo-esercizio">
                    <span className="mono codice-esercizio">{e.codice}</span>
                    <b>{e.nome}</b>
                    {e.descrizione && <p>{e.descrizione}</p>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Collegamento esercizio={e} onSegnala={segnala} />
                      <div style={{ flex: 1 }} />
                      {puoScrivere && (
                        <button
                          className="mini"
                          aria-label="Togli dalla settimana"
                          onClick={async () => {
                            await api.togliDallaSettimana(societa.id, settimana, e.id);
                            ricaricaSettimana();
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------- modulo nuovo/modifica */}
      {nuovo && (
        <div className="scheda" style={{ marginTop: 12 }}>
          <div className="intestazione">
            <h3>{nuovo.id ? 'Modifica esercizio' : 'Nuovo esercizio della squadra'}</h3>
            <div style={{ flex: 1 }} />
            <button className="mini" onClick={() => setNuovo(null)}><X size={13} /></button>
          </div>
          <div className="corpo" style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="campo">
              <label>Codice</label>
              <input className="mono" value={nuovo.codice}
                onChange={(e) => setNuovo({ ...nuovo, codice: e.target.value.toUpperCase() })} />
            </div>
            <div className="campo" style={{ gridColumn: 'span 2' }}>
              <label>Nome</label>
              <input value={nuovo.nome} placeholder="es. Remate alternate pallina-paletta"
                onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label>Stile</label>
              <select value={nuovo.stile || ''} onChange={(e) => {
                const stile = e.target.value;
                setNuovo({
                  ...nuovo, stile,
                  codice: nuovo.id ? nuovo.codice : prossimoCodice(stile || 'TC'),
                });
              }}>
                {STILI.map((x) => <option key={x} value={x}>{x || '—'}</option>)}
              </select>
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label>Descrizione</label>
              <textarea rows={2} value={nuovo.descrizione || ''}
                onChange={(e) => setNuovo({ ...nuovo, descrizione: e.target.value })} />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label>Link al video</label>
              <input value={nuovo.video_url || ''} placeholder="https://youtu.be/…"
                onChange={(e) => setNuovo({ ...nuovo, video_url: e.target.value })} />
              {nuovo.video_url && !idYoutube(nuovo.video_url) && (
                <span style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 4 }}>
                  Non è un link YouTube: si potrà segnalare a mano, ma non verificare da solo.
                </span>
              )}
            </div>
            <button className="azione" onClick={salva} disabled={!nuovo.codice.trim() || !nuovo.nome.trim()}>
              {nuovo.id ? 'Salva' : 'Aggiungi'}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------- 2. della squadra · 3. comuni */}
      <Tabella titolo="Esercizi della squadra" Icona={Building2} elenco={nostri} propri />
      <Tabella titolo="Esercizi comuni" Icona={Globe} elenco={comuni} />

      <p style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 12 }}>
        Il codice nasce con l'esercizio e non cambia: è quello che citerai nelle sedute.
        I comuni valgono per tutte le squadre e si modificano solo dal pannello del database.
      </p>
    </>
  );
}
