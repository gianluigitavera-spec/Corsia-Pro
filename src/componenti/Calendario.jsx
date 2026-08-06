import { useEffect, useMemo, useState } from 'react';
import { Plus, Trophy, Timer, Waves, Medal, LifeBuoy, Anchor, X, Trash2, ChevronRight } from 'lucide-react';
import * as api from '../lib/dati';
import { MACRO_CALENDARIO, rientraNelMacro, faseDelGiorno, faseDi, RAGGRUPPAMENTI, dataItLunga } from '../lib/dominio';
import Periodizzazione from './Periodizzazione';

export const TIPI_GARA = {
  trofeo:              { nome: 'Trofeo',                          colore: '#A78BFA', Icona: Trophy },
  prove_tempi:         { nome: 'Prova tempi',                     colore: '#34D399', Icona: Timer },
  camp_regionali:      { nome: 'Campionati Regionali',            colore: '#22D3EE', Icona: Medal },
  camp_italiani:       { nome: 'Campionati Italiani',             colore: '#FBBF24', Icona: Trophy },
  camp_reg_salvamento: { nome: 'Regionali Salvamento',            colore: '#FB923C', Icona: LifeBuoy },
  camp_ita_salvamento: { nome: 'Italiani Salvamento',             colore: '#F472B6', Icona: Anchor },
};

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Calendario({
  societa, puoScrivere, apriSeduta, stagione, categorie, macro: macroFuori, cambiaMacro,
}) {
  const oggi = new Date();
  // Se la Dashboard tiene il filtro, comanda lei: così le statistiche e
  // il calendario guardano sempre la stessa categoria.
  const [macroDentro, setMacroDentro] = useState('tutte');
  const macro = macroFuori ?? macroDentro;
  const setMacro = cambiaMacro ?? setMacroDentro;
  const [mese, setMese] = useState(new Date(oggi.getFullYear(), oggi.getMonth(), 1));
  const [sedute, setSedute] = useState([]);
  const [gare, setGare] = useState([]);
  const [giorno, setGiorno] = useState(null);
  const [fasi, setFasi] = useState([]);
  const [nuovaGara, setNuovaGara] = useState(null);

  // La programmazione sta prima del calendario e lo spinge in basso.
  // Chiusa di default: diventa una riga sola che dice la fase di oggi, e
  // si apre quando la vuoi toccare. La scelta resta fra una visita e
  // l'altra, così non la richiudi ogni volta.
  const [progAperta, setProgAperta] = useState(() => {
    try { return localStorage.getItem('corsiapro:programmazione-aperta') === '1'; }
    catch { return false; }
  });

  function commutaProg() {
    setProgAperta((v) => {
      try { localStorage.setItem('corsiapro:programmazione-aperta', v ? '0' : '1'); } catch { /* niente */ }
      return !v;
    });
  }
  const [errore, setErrore] = useState(null);

  const primo = new Date(mese.getFullYear(), mese.getMonth(), 1);
  const ultimo = new Date(mese.getFullYear(), mese.getMonth() + 1, 0);

  useEffect(() => { ricarica(); }, [societa.id, mese.getTime()]);

  // Le fasce di periodizzazione esistono solo dentro una categoria:
  // su "Tutte" il calendario resta pulito, con gare e allenamenti.
  const codiciMacroSel = MACRO_CALENDARIO.find((m) => m.id === macro)?.codici || null;
  useEffect(() => {
    if (!codiciMacroSel) { setFasi([]); return; }
    api.leggiPeriodizzazione(societa.id, codiciMacroSel)
      .then(setFasi)
      .catch(() => setFasi([]));
  }, [societa.id, macro, codiciMacroSel?.join()]);

  async function ricarica() {
    try {
      const [s, g] = await Promise.all([
        api.leggiSedute(societa.id, { da: iso(primo), a: iso(ultimo) }),
        api.leggiGare(societa.id, iso(primo), iso(ultimo)),
      ]);
      setSedute(s);
      setGare(g);
      setErrore(null);
    } catch (e) { setErrore(e.message); }
  }

  const celle = useMemo(() => {
    const out = [];
    const scarto = (primo.getDay() + 6) % 7; // lunedì primo
    for (let i = 0; i < scarto; i++) out.push(null);
    for (let d = 1; d <= ultimo.getDate(); d++) {
      out.push(new Date(mese.getFullYear(), mese.getMonth(), d));
    }
    return out;
  }, [mese.getTime()]);

  const codiciMacro = codiciMacroSel;

  // Quello che si legge a riquadro chiuso: se la riga non dicesse niente,
  // tanto varrebbe non averla.
  // NB: deve stare DOPO codiciMacro. Stava sopra, e leggere una const
  // prima della sua riga non è un warning ma un errore che spacca la
  // schermata — "Cannot access 'h' before initialization".
  const faseOggi = faseDelGiorno(fasi, iso(oggi));
  const riassuntoFase = !codiciMacro
    ? ''
    : faseOggi
      ? `oggi ${faseDi(faseOggi.fase)?.nome || faseOggi.fase} · fino al ${dataItLunga(faseOggi.al)}`
      : fasi.length
        ? 'oggi fuori dalle fasi impostate'
        : 'nessuna fase impostata';

  const codiciNoti = new Set((categorie || []).map((c) => c.codice));
  const raggruppamentiNoti = RAGGRUPPAMENTI
    .map((r) => ({ ...r, codici: r.codici.filter((c) => codiciNoti.size === 0 || codiciNoti.has(c)) }))
    .filter((r) => r.codici.length > 0);
  const nelFiltro = (x) => rientraNelMacro(x.categorie, codiciMacro);

  const seduteDi = (d) => sedute.filter((s) => s.data === iso(d) && nelFiltro(s));
  const gareDi = (d) => gare.filter((g) =>
    nelFiltro(g) && (g.data === iso(d) || (g.data_fine && iso(d) >= g.data && iso(d) <= g.data_fine)));

  async function creaGara() {
    try {
      await api.salvaGara({
        societa_id: societa.id,
        data: nuovaGara.data,
        data_fine: nuovaGara.data_fine || null,
        nome: nuovaGara.nome.trim(),
        tipo: nuovaGara.tipo,
        categorie: nuovaGara.categorie || [],
        luogo: nuovaGara.luogo || null,
      });
      setNuovaGara(null);
      ricarica();
    } catch (e) { setErrore(e.message); }
  }

  const sposta = (n) => setMese(new Date(mese.getFullYear(), mese.getMonth() + n, 1));

  return (
    <div className="scheda">
      <div className="intestazione">
        <button className="mini" onClick={() => sposta(-1)} aria-label="Mese precedente">‹</button>
        <h3 style={{ minWidth: 168, textAlign: 'center' }}>{MESI[mese.getMonth()]} {mese.getFullYear()}</h3>
        <button className="mini" onClick={() => sposta(1)} aria-label="Mese successivo">›</button>
        <div style={{ flex: 1 }} />
        <button className="mini" onClick={() => setMese(new Date(oggi.getFullYear(), oggi.getMonth(), 1))}>Oggi</button>
      </div>

      <div className="corpo" style={{ paddingBottom: 0 }}>
        <div className="destinatari">
          {MACRO_CALENDARIO.map((m) => (
            <button key={m.id} className="pastiglia" aria-pressed={macro === m.id} onClick={() => setMacro(m.id)}>
              {m.nome}
            </button>
          ))}
        </div>
      </div>

      {errore && <div className="corpo"><div className="avviso errore">{errore}</div></div>}

      {codiciMacro && (
        <div className="corpo" style={{ paddingBottom: progAperta ? 0 : 14 }}>
          <button className="riga-apribile" onClick={commutaProg}
            aria-expanded={progAperta}>
            <ChevronRight size={15} className={progAperta ? 'freccia giu' : 'freccia'} />
            <b>Programmazione</b>
            <span className="riassunto-fase">{riassuntoFase}</span>
          </button>
        </div>
      )}

      {codiciMacro && progAperta && (
        <div className="corpo" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <Periodizzazione
            societa={societa}
            codici={codiciMacro}
            nomeMacro={MACRO_CALENDARIO.find((m) => m.id === macro)?.nome}
            gare={gare.filter((g) => rientraNelMacro(g.categorie, codiciMacro))}
            stagione={stagione}
            puoScrivere={puoScrivere}
            cambiata={() => api.leggiPeriodizzazione(societa.id, codiciMacro).then(setFasi).catch(() => {})}
          />
        </div>
      )}

      <div className="corpo">
        <div className="griglia-mese">
          {GIORNI.map((g) => <div className="nome-giorno" key={g}>{g}</div>)}
          {celle.map((d, i) => {
            if (!d) return <div key={`v${i}`} />;
            const ss = seduteDi(d);
            const gg = gareDi(d);
            const oggiQ = iso(d) === iso(oggi);
            const f = faseDelGiorno(fasi, iso(d));
            const tintaFase = f ? faseDi(f.fase)?.colore : null;
            return (
              <button
                key={iso(d)}
                className="giorno"
                data-oggi={oggiQ}
                data-scelto={giorno === iso(d)}
                data-fase={f ? f.fase : ''}
                style={tintaFase ? { '--tinta-fase': tintaFase } : undefined}
                title={f ? faseDi(f.fase)?.nome : undefined}
                onClick={() => setGiorno(giorno === iso(d) ? null : iso(d))}
              >
                <span className="numero mono">{d.getDate()}</span>
                {ss.length > 0 && (
                  <span className="segno-seduta">
                    <Waves size={11} /> {ss.length}
                  </span>
                )}
                {gg.map((g) => (
                  <span className="segno-gara" key={g.id} style={{ background: TIPI_GARA[g.tipo]?.colore }}>
                    {g.nome}
                  </span>
                ))}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------- giorno scelto */}
        {giorno && (
          <div className="pannello-giorno">
            <div className="barra" style={{ marginBottom: 10 }}>
              <b>{dataItLunga(giorno)}</b>
              <div style={{ flex: 1 }} />
              <button className="mini" onClick={() => setGiorno(null)} aria-label="Chiudi"><X size={14} /></button>
            </div>

            {seduteDi(new Date(giorno + 'T12:00')).map((s) => (
              <button key={s.id} className="voce-giorno" onClick={() => apriSeduta(s.id)}>
                <Waves size={15} style={{ color: 'var(--ciano)' }} />
                <span>{s.titolo || 'Seduta senza titolo'}</span>
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 12 }}>{s.origine}</span>
              </button>
            ))}

            {gareDi(new Date(giorno + 'T12:00')).map((g) => {
              const t = TIPI_GARA[g.tipo] || {};
              const Icona = t.Icona || Trophy;
              return (
                <div key={g.id} className="voce-giorno" style={{ cursor: 'default' }}>
                  <Icona size={15} style={{ color: t.colore }} />
                  <span>{g.nome}</span>
                  <span style={{ color: 'var(--testo-3)', fontSize: 12 }}>
                    {t.nome}{g.luogo ? ` · ${g.luogo}` : ''}
                    {g.categorie?.length ? ` · ${g.categorie.length} categorie` : ' · tutte'}
                  </span>
                  <span style={{ flex: 1 }} />
                  {puoScrivere && (
                    <button
                      className="mini"
                      aria-label="Elimina"
                      onClick={async () => {
                        if (!confirm(`Eliminare "${g.nome}"?`)) return;
                        await api.eliminaGara(g.id);
                        ricarica();
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            {puoScrivere && !nuovaGara && (
              <div className="barra" style={{ marginTop: 10, marginBottom: 0 }}>
                <button className="azione" onClick={() => apriSeduta(null, giorno)}>
                  <Plus size={15} style={{ verticalAlign: -3 }} /> Seduta
                </button>
                <button
                  className="azione fantasma"
                  onClick={() => setNuovaGara({
                    data: giorno, nome: '', tipo: 'trofeo', luogo: '', data_fine: '',
                    categorie: codiciMacro ? [...codiciMacro] : [],
                  })}
                >
                  <Trophy size={15} style={{ verticalAlign: -3 }} /> Competizione
                </button>
              </div>
            )}

            {nuovaGara && (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div className="tipi-gara">
                  {Object.entries(TIPI_GARA).map(([k, t]) => {
                    const Icona = t.Icona;
                    const scelto = nuovaGara.tipo === k;
                    return (
                      <button
                        key={k}
                        className="pastiglia"
                        aria-pressed={scelto}
                        style={scelto ? { borderColor: t.colore, color: t.colore, background: `${t.colore}22` } : undefined}
                        onClick={() => setNuovaGara({ ...nuovaGara, tipo: k })}
                      >
                        <Icona size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{t.nome}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label>Chi partecipa</label>
                  <div className="destinatari">
                    {raggruppamentiNoti.map((r) => {
                      const dentro = r.codici.filter((c) => (nuovaGara.categorie || []).includes(c)).length;
                      const tutto = dentro === r.codici.length;
                      return (
                        <button
                          key={r.nome}
                          className="pastiglia"
                          aria-pressed={dentro > 0}
                          data-parziale={dentro > 0 && !tutto}
                          onClick={() => {
                            const attuali = new Set(nuovaGara.categorie || []);
                            r.codici.forEach((c) => (tutto ? attuali.delete(c) : attuali.add(c)));
                            setNuovaGara({ ...nuovaGara, categorie: [...attuali] });
                          }}
                        >
                          {tutto ? '✓ ' : ''}{r.nome}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--testo-3)', margin: '6px 0 0' }}>
                    Senza nessun flag la gara compare in tutti i filtri.
                  </p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <div className="campo">
                    <label>Nome</label>
                    <input
                      autoFocus
                      value={nuovaGara.nome}
                      placeholder="es. Trofeo Città di Milano"
                      onChange={(e) => setNuovaGara({ ...nuovaGara, nome: e.target.value })}
                    />
                  </div>
                  <div className="campo">
                    <label>Luogo</label>
                    <input value={nuovaGara.luogo} onChange={(e) => setNuovaGara({ ...nuovaGara, luogo: e.target.value })} />
                  </div>
                  <div className="campo">
                    <label>Fino al (se più giorni)</label>
                    <input type="date" value={nuovaGara.data_fine} onChange={(e) => setNuovaGara({ ...nuovaGara, data_fine: e.target.value })} />
                  </div>
                </div>
                <div className="barra" style={{ marginBottom: 0 }}>
                  <button className="azione" onClick={creaGara} disabled={!nuovaGara.nome.trim()}>Salva competizione</button>
                  <button className="mini" onClick={() => setNuovaGara(null)}>Annulla</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="legenda" style={{ marginTop: 14 }}>
          {Object.entries(TIPI_GARA).map(([k, t]) => (
            <span key={k}><i className="punto" style={{ background: t.colore }} />{t.nome}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
