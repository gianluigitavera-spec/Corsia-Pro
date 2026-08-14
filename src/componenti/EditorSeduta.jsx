import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, ArrowLeft, Waves, X, AlertTriangle, Check,
  Printer, Share2, Presentation, PenLine, Copy, CalendarRange } from 'lucide-react';
import * as api from '../lib/dati';
import CopiaSedute from './CopiaSedute';
import {
  TUTTI, SPECIALIZZAZIONI, sedutaVuota, serieVuota, metriPerSpecializzazione,
  caricoPerFamiglia, validaSeduta, metriDaNotazione, normalizzaRecupero, RAGGRUPPAMENTI,
  ripartenzaDaBase, dataIt, durataStimata, inOreMinuti,
} from '../lib/dominio';
import { TINTA_FAMIGLIA } from '../lib/colori';
import RevisioneTesto from './RevisioneTesto';
import { condividiSeduta } from '../lib/testoSeduta';
import Lavagna from './Lavagna';
import FoglioStampa from './FoglioStampa';

function coloreSezione(sezione, zone) {
  const mappa = Object.fromEntries(zone.map((z) => [z.codice, z.famiglia]));
  const conta = {};
  for (const s of sezione.serie || []) {
    const fam = mappa[s.zona] || 'nonClassificati';
    conta[fam] = (conta[fam] || 0) + (Number(s.metri) || 0);
  }
  const vincente = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  return TINTA_FAMIGLIA[vincente?.[0]] || 'var(--ciano)';
}

const muovi = (arr, da, a) => {
  if (a < 0 || a >= arr.length) return arr;
  const copia = [...arr];
  const [x] = copia.splice(da, 1);
  copia.splice(a, 0, x);
  return copia;
};

export default function EditorSeduta({ societa, zone, puoScrivere, categorie, apertura, consumaApertura }) {
  const [elenco, setElenco] = useState([]);
  const [copia, setCopia] = useState(null);   // { seduta } oppure {} per la settimana
  const [seduta, setSeduta] = useState(null);
  const [messaggio, setMessaggio] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [lavagna, setLavagna] = useState(false);
  const [daTesto, setDaTesto] = useState(false);
  const [bozzaRipresa, setBozzaRipresa] = useState(false);

  const codiciZona = zone.map((z) => z.codice);

  useEffect(() => { ricarica(); }, [societa.id]);

  // Arrivo dal calendario: apri una seduta esistente o creane una per quel giorno.
  useEffect(() => {
    if (!apertura) return;
    if (apertura.id) {
      api.leggiSeduta(apertura.id).then(setSeduta).catch((e) => setMessaggio({ tipo: 'errore', testo: e.message }));
    } else {
      setSeduta(sedutaVuota({ data: apertura.data }));
    }
    consumaApertura();
  }, [apertura]);

  async function ricarica() {
    try { setElenco(await api.leggiSedute(societa.id)); }
    catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  const problemi = useMemo(() => (seduta ? validaSeduta(seduta, codiciZona) : []), [seduta, codiciZona.join()]);

  function aggiorna(fn) {
    setSeduta((s) => { const c = structuredClone(s); fn(c); return c; });
  }

  // La notazione comanda i metri, finché non li scrivi a mano.
  function cambiaNotazione(i, j, valore) {
    aggiorna((s) => {
      const serie = s.sezioni[i].serie[j];
      serie.notazione = valore;
      if (!serie.metriManuali) {
        const m = metriDaNotazione(valore);
        if (m !== null) serie.metri = m;
      }
      // Se la partenza nasce da un passo base, cambiando la distanza si rifà.
      if (serie.base) {
        try {
          const r = ripartenzaDaBase('@@' + serie.base, valore);
          if (r) serie.recupero = r.recupero;
        } catch { /* la partenza resta com'è */ }
      }
    });
  }

  // Fuori dal render: qui un errore è un errore, non uno schermo nero.
  function sistemaRecupero(i, j, valore) {
    let recupero = valore;
    let base = null;
    try {
      const dalBase = ripartenzaDaBase(valore, seduta.sezioni[i]?.serie[j]?.notazione);
      if (dalBase) { recupero = dalBase.recupero; base = dalBase.base; }
      else recupero = normalizzaRecupero(valore);
    } catch (e) {
      console.error('Recupero non interpretato:', e);
      recupero = String(valore || '');
    }
    aggiorna((st) => {
      const serie = st.sezioni[i]?.serie[j];
      if (!serie) return;
      serie.recupero = recupero;
      if (base) serie.base = base; else delete serie.base;
    });
  }

  function cambiaMetri(i, j, valore) {
    aggiorna((s) => {
      const serie = s.sezioni[i].serie[j];
      serie.metri = Number(valore) || 0;
      serie.metriManuali = true;   // da qui in poi decidi tu
    });
  }

  const togliDestinatario = (i, spec) =>
    aggiorna((s) => {
      const sez = s.sezioni[i];
      const attuali = sez.destinatari?.length ? sez.destinatari : [TUTTI];
      if (spec === TUTTI) { sez.destinatari = [TUTTI]; return; }
      const senza = attuali.filter((d) => d !== TUTTI);
      sez.destinatari = senza.includes(spec) ? senza.filter((d) => d !== spec) : [...senza, spec];
      if (sez.destinatari.length === 0) sez.destinatari = [TUTTI];
    });

  // La bozza: una copia locale di quello che stai scrivendo, finché non
  // è salvata sul server. Chiave diversa per la seduta nuova e per quelle
  // già esistenti, così non si sovrascrivono a vicenda.
  const chiaveBozza = seduta ? `${societa.id}:${seduta.id || 'nuova'}` : null;

  useEffect(() => {
    if (!chiaveBozza || !seduta) return;
    const attesa = setTimeout(() => api.salvaBozza(chiaveBozza, seduta), 800);
    return () => clearTimeout(attesa);
  }, [seduta, chiaveBozza]);

  // All'apertura di una seduta nuova, se una bozza c'è la si riprende.
  useEffect(() => {
    if (!seduta || seduta.id || bozzaRipresa) return;
    const b = api.leggiBozza(`${societa.id}:nuova`);
    const scritta = b?.dati && (b.dati.sezioni || []).some((s) => (s.serie || []).length);
    if (!scritta) return;
    setBozzaRipresa(true);
    setSeduta(b.dati);
    setMessaggio({
      tipo: 'ok',
      testo: `Ripresa la seduta che stavi scrivendo (${dataIt(b.dati.data)}). Se non la vuoi, ricomincia da "Nuova seduta".`,
    });
  }, [seduta?.id]);

  async function salva() {
    setSalvataggio(true);
    setMessaggio(null);
    try {
      // Senza titolo, prende il nome delle categorie a cui è rivolta.
      const titolo = seduta.titolo?.trim() || (seduta.categorie || [])
        .map((c) => (categorie || []).find((x) => x.codice === c)?.nome || c)
        .join(' · ');
      const salvata = await api.salvaSeduta({ ...seduta, titolo, societa_id: societa.id });
      api.buttaBozza(`${societa.id}:nuova`);
      api.buttaBozza(`${societa.id}:${salvata.id}`);
      setSeduta(salvata);
      await ricarica();
      setMessaggio({ tipo: 'ok', testo: "Seduta salvata: la trovi nell'elenco e sul calendario." });
    } catch (e) {
      const testo = /check/i.test(e.message)
        ? 'Scegli almeno una categoria: il database non accetta sedute senza destinatario.'
        : e.message;
      setMessaggio({ tipo: 'errore', testo });
    } finally { setSalvataggio(false); }
  }

  const senzaDestinatario = seduta && !(seduta.categorie || []).length;

  // I flag lavorano sui raggruppamenti: un tocco accende o spegne tutti i
  // codici che stanno insieme in vasca.
  const codiciNoti = new Set((categorie || []).map((c) => c.codice));
  const raggruppamenti = RAGGRUPPAMENTI
    .map((r) => ({ ...r, codici: r.codici.filter((c) => codiciNoti.has(c)) }))
    .filter((r) => r.codici.length > 0);

  const scelte = new Set(seduta?.categorie || []);
  const statoRaggruppamento = (r) => {
    const dentro = r.codici.filter((c) => scelte.has(c)).length;
    return dentro === 0 ? 'no' : dentro === r.codici.length ? 'tutto' : 'parte';
  };
  const togliRaggruppamento = (r) => aggiorna((s) => {
    const attuali = new Set(s.categorie || []);
    const pieno = r.codici.every((c) => attuali.has(c));
    r.codici.forEach((c) => (pieno ? attuali.delete(c) : attuali.add(c)));
    s.categorie = [...attuali];
  });

  // Dal testo libero all'editor: stessa seduta, stessa forma.
  if (daTesto) {
    return (
      <RevisioneTesto
        zone={zone}
        indietro={() => setDaTesto(false)}
        usaSeduta={(sezioni) => {
          setSeduta({ ...sedutaVuota(), sezioni });
          setDaTesto(false);
        }}
      />
    );
  }

  // ------------------------------------------------------------- elenco
  if (!seduta) {
    return (
      <>
        <div className="barra">
          <h1>Sedute</h1>
          <div style={{ flex: 1 }} />
          {puoScrivere && (
            <>
              {elenco.length > 0 && (
                <button className="azione fantasma" onClick={() => setCopia({})}>
                  <CalendarRange size={15} style={{ verticalAlign: -3 }} /> Copia settimana
                </button>
              )}
              <button className="azione fantasma" onClick={() => setDaTesto(true)}>
                <PenLine size={15} style={{ verticalAlign: -3 }} /> Scrivi o incolla
              </button>
              <button className="azione" onClick={() => setSeduta(sedutaVuota())}>
                <Plus size={16} style={{ verticalAlign: -3 }} /> Nuova seduta
              </button>
            </>
          )}
        </div>

        {messaggio && <div className={`avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`}>{messaggio.testo}</div>}

        {copia && puoScrivere && (
          <CopiaSedute
            societa={societa}
            elenco={elenco}
            seduta={copia.seduta}
            chiudi={() => setCopia(null)}
            fatto={(quante) => {
              setCopia(null);
              setMessaggio({ tipo: 'ok', testo: quante === 1 ? 'Seduta duplicata.' : `${quante} sedute copiate.` });
              ricarica?.();
            }}
          />
        )}

        {elenco.length === 0 ? (
          <div className="scheda">
            <div className="vuoto">
              <Waves size={30} style={{ color: 'var(--testo-3)' }} />
              <h3 style={{ marginTop: 10 }}>Nessuna seduta</h3>
              <p>La prima la scrivi a mano. Quelle generate da SwimCoach arriveranno qui con la stessa forma.</p>
              {puoScrivere && (
                <div className="barra" style={{ justifyContent: 'center' }}>
                  <button className="azione" onClick={() => setSeduta(sedutaVuota())}>A corsie</button>
                  <button className="azione fantasma" onClick={() => setDaTesto(true)}>Scrivi o incolla</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="scheda">
            <table>
              <thead>
                <tr><th>Data</th><th>Titolo</th><th>Categorie</th><th style={{ textAlign: 'right' }}>Sezioni</th><th /></tr>
              </thead>
              <tbody>
                {elenco.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{dataIt(s.data)}</td>
                    <td>{s.titolo || '—'}</td>
                    <td style={{ color: 'var(--testo-3)', fontSize: 13 }}>{(s.categorie || []).join(' · ') || '—'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{(s.sezioni || []).length}</td>
                    <td style={{ textAlign: 'right' }}>
                      {puoScrivere && (
                        <button className="mini" title="Duplica su un'altra data"
                          onClick={() => api.leggiSeduta(s.id).then((piena) => setCopia({ seduta: piena }))}>
                          <Copy size={13} />
                        </button>
                      )}
                      <button className="mini" onClick={() => api.leggiSeduta(s.id).then(setSeduta)}>Apri</button>
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
          <ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Sedute
        </button>
        <button className="mini" onClick={() => setLavagna(true)} title="Lavagna a bordo vasca">
          <Presentation size={14} style={{ verticalAlign: -2 }} /> Lavagna
        </button>
        <button className="mini" onClick={() => window.print()} title="Stampa o salva in PDF">
          <Printer size={14} style={{ verticalAlign: -2 }} /> PDF
        </button>
        <button
          className="mini"
          title="Invia la seduta come testo"
          onClick={async () => {
            const esito = await condividiSeduta(seduta, { nomeSquadra: societa.nome });
            if (esito === 'copiato') setMessaggio({ tipo: 'ok', testo: 'Seduta copiata: incollala dove vuoi.' });
          }}
        >
          <Share2 size={14} style={{ verticalAlign: -2 }} /> Invia
        </button>
        <div style={{ flex: 1 }} />
        {seduta.id && puoScrivere && (
          <button
            className="azione pericolo"
            aria-label="Elimina seduta"
            onClick={async () => {
              if (!confirm('Eliminare questa seduta?')) return;
              await api.eliminaSeduta(seduta.id);
              setSeduta(null);
              ricarica();
            }}
          >
            <Trash2 size={15} style={{ verticalAlign: -3 }} />
          </button>
        )}
        <button className="azione" onClick={salva} disabled={!puoScrivere || salvataggio || senzaDestinatario}>
          <Save size={16} style={{ verticalAlign: -3 }} /> {salvataggio ? 'Salvo…' : 'Salva seduta'}
        </button>
      </div>

      <div className="scheda">
        <div className="corpo" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="campo">
            <label>Data</label>
            <input type="date" value={seduta.data || ''} onChange={(e) => aggiorna((s) => { s.data = e.target.value; })} />
          </div>
          <div className="campo" style={{ gridColumn: 'span 2' }}>
            <label>Titolo</label>
            <input
              value={seduta.titolo || ''}
              placeholder="es. Soglia + tecnica gambe"
              onChange={(e) => aggiorna((s) => { s.titolo = e.target.value; })}
            />
          </div>
        </div>

        <div className="corpo" style={{ paddingTop: 0 }}>
          <label>Categorie a cui è rivolta</label>
          <div className="destinatari">
            {raggruppamenti.map((r) => {
              const st = statoRaggruppamento(r);
              return (
                <button
                  key={r.nome}
                  className="pastiglia"
                  aria-pressed={st !== 'no'}
                  data-parziale={st === 'parte'}
                  onClick={() => togliRaggruppamento(r)}
                >
                  {st === 'tutto' ? <Check size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> : null}
                  {r.nome}
                </button>
              );
            })}
          </div>
        </div>

        {senzaDestinatario && (
          <div className="corpo" style={{ paddingTop: 0 }}>
            <div className="avviso">
              <AlertTriangle size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              Scegli almeno una categoria: senza destinatario la seduta non si salva.
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------- le corsie */}
      <div className="sezione">
        {(seduta.sezioni || []).map((sez, i) => {
          const dest = sez.destinatari?.length ? sez.destinatari : [TUTTI];
          return (
            <div className="corsia" key={i} style={{ '--colore-corsia': coloreSezione(sez, zone) }}>
              <div className="testa">
                <span className="maniglie">
                  <button disabled={i === 0} aria-label="Sposta sezione su"
                    onClick={() => aggiorna((s) => { s.sezioni = muovi(s.sezioni, i, i - 1); })}>
                    <ChevronUp size={15} />
                  </button>
                  <button disabled={i === seduta.sezioni.length - 1} aria-label="Sposta sezione giù"
                    onClick={() => aggiorna((s) => { s.sezioni = muovi(s.sezioni, i, i + 1); })}>
                    <ChevronDown size={15} />
                  </button>
                </span>
                <input
                  className="titolo-corsia"
                  style={{ border: 0, background: 'transparent', padding: 0, minHeight: 'auto', flex: '1 1 150px' }}
                  value={sez.titolo || ''}
                  placeholder="Titolo sezione"
                  onChange={(e) => aggiorna((s) => { s.sezioni[i].titolo = e.target.value; })}
                />
                <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 13 }}>
                  {(sez.serie || []).reduce((t, x) => t + (Number(x.metri) || 0), 0)} m
                </span>
                <div className="destinatari">
                  <button className="pastiglia" aria-pressed={dest.includes(TUTTI)} onClick={() => togliDestinatario(i, TUTTI)}>Tutti</button>
                  {SPECIALIZZAZIONI.filter((x) => x !== 'Generale').map((spec) => (
                    <button key={spec} className="pastiglia" aria-pressed={dest.includes(spec)} onClick={() => togliDestinatario(i, spec)}>
                      {spec}
                    </button>
                  ))}
                </div>
                <button className="mini" onClick={() => aggiorna((s) => { s.sezioni.splice(i, 1); })} aria-label="Elimina sezione">
                  <X size={14} />
                </button>
              </div>

              <div className="serie">
                {(sez.serie || []).length > 0 && (
                  <div className="intestazione-serie">
                    <span>Serie</span><span>Zona</span><span>Metri</span><span className="rec">Recupero</span><span />
                  </div>
                )}

                {(sez.serie || []).map((s, j) => (
                  <div className="riga-serie" key={j}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="maniglie">
                        <button disabled={j === 0} aria-label="Sposta serie su"
                          onClick={() => aggiorna((st) => { st.sezioni[i].serie = muovi(st.sezioni[i].serie, j, j - 1); })}>
                          <ChevronUp size={13} />
                        </button>
                        <button disabled={j === sez.serie.length - 1} aria-label="Sposta serie giù"
                          onClick={() => aggiorna((st) => { st.sezioni[i].serie = muovi(st.sezioni[i].serie, j, j + 1); })}>
                          <ChevronDown size={13} />
                        </button>
                      </span>
                      <input
                        style={{ flex: 1, minWidth: 0 }}
                        value={s.notazione || ''}
                        placeholder="4x(1x100 + 2x50)"
                        onChange={(e) => cambiaNotazione(i, j, e.target.value)}
                      />
                    </span>
                    <select value={s.zona || ''} onChange={(e) => aggiorna((st) => { st.sezioni[i].serie[j].zona = e.target.value; })}>
                      <option value="">—</option>
                      {zone.map((z) => <option key={z.codice} value={z.codice} title={z.nome}>{z.codice}</option>)}
                    </select>
                    <input
                      className="mono"
                      type="number"
                      inputMode="numeric"
                      value={s.metri || ''}
                      placeholder="0"
                      title={s.metriManuali ? 'Metri scritti a mano' : 'Calcolati dalla notazione'}
                      onChange={(e) => cambiaMetri(i, j, e.target.value)}
                    />
                    <input
                      className="mono rec"
                      value={s.recupero || ''}
                      placeholder="@1:40 o @@2:00"
                      onChange={(e) => aggiorna((st) => { st.sezioni[i].serie[j].recupero = e.target.value; })}
                      onBlur={(e) => sistemaRecupero(i, j, e.target.value)}
                    />
                    {s.base && <span className="base-passo mono" title={`Passo base ${s.base}`}>base {s.base}</span>}
                    <button className="togli" aria-label="Togli serie" onClick={() => aggiorna((st) => { st.sezioni[i].serie.splice(j, 1); })}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  className="mini"
                  style={{ marginTop: 9 }}
                  onClick={() => aggiorna((s) => { s.sezioni[i].serie = [...(s.sezioni[i].serie || []), serieVuota()]; })}
                >
                  <Plus size={13} style={{ verticalAlign: -2 }} /> serie
                </button>
              </div>
            </div>
          );
        })}

        <button
          className="azione fantasma"
          style={{ marginTop: 12 }}
          onClick={() => aggiorna((s) => { s.sezioni.push({ titolo: '', destinatari: [TUTTI], serie: [] }); })}
        >
          <Plus size={15} style={{ verticalAlign: -3 }} /> sezione
        </button>
      </div>

      {/* ------------------------------- volumi per specializzazione */}
      <div className="sezione">
        <div className="barra" style={{ marginBottom: 11 }}>
          <h3 style={{ margin: 0 }}>Volume per specializzazione</h3>
          <div style={{ flex: 1 }} />
          {(() => {
            const d = durataStimata(seduta.sezioni);
            if (!d.secondi) return null;
            return (
              <span style={{ fontSize: 13, color: 'var(--testo-2)' }}>
                durata stimata <b className="mono" style={{ color: 'var(--ciano)' }}>{inOreMinuti(d.secondi)}</b>
                {d.senzaPartenza > 0 && (
                  <span style={{ color: 'var(--testo-3)' }}> · {d.senzaPartenza} serie senza partenza non contate</span>
                )}
              </span>
            );
          })()}
        </div>
        <div className="volumi">
          {SPECIALIZZAZIONI.map((spec) => {
            const metri = metriPerSpecializzazione(seduta.sezioni, spec);
            const fam = caricoPerFamiglia(seduta.sezioni, spec, zone);
            const tot = Object.values(fam).reduce((a, b) => a + b, 0) || 1;
            return (
              <div className="volume" key={spec}>
                <div className="etichetta">{spec}</div>
                <div className="cifra">{metri.toLocaleString('it-IT')}<small>m</small></div>
                <div className="nastro">
                  {Object.entries(fam).map(([f, m]) => (m > 0 ? (
                    <i key={f} style={{ width: `${(m / tot) * 100}%`, background: TINTA_FAMIGLIA[f] }} />
                  ) : null))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {problemi.length > 0 && (
        <div className="sezione avviso">
          <b>Da sistemare prima di fidarsi dei numeri</b>
          <ul>
            {problemi.slice(0, 8).map((p, k) => <li key={k}>{p.campo}: {p.msg}</li>)}
            {problemi.length > 8 && <li>…e altri {problemi.length - 8}</li>}
          </ul>
        </div>
      )}

      {messaggio && (
        <div className={`sezione avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`}>{messaggio.testo}</div>
      )}

      {lavagna && <Lavagna seduta={seduta} zone={zone} chiudi={() => setLavagna(false)} />}
      <FoglioStampa seduta={seduta} societa={societa} categorie={categorie} />
    </>
  );
}
