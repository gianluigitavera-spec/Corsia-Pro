// =====================================================================
// REGISTRA UN TEST: tipo, data, vasca e gruppo, poi una riga per atleta
// come in Appello, con tempi, passaggi e bracciate per 25.
//
// Si salva tutto insieme con «Salva», non a ogni tasto: un tempo a metà
// («1:2») non deve finire in archivio. La conversione dei campi nella
// riga di squadra.test_risultati è risultatoDaCampi (lib/test.js, sotto
// prova): con un errore non si salva niente, e si dice dove.
//
// Riaprendo una sessione il tipo non si cambia: le ripetute salvate sono
// di quel tipo. Svuotare i campi di un atleta lo toglie dalla sessione.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, FileText } from 'lucide-react';
import * as api from '../lib/dati';
import { atletaNelGruppo, codiciDelGruppo, oggiLocale } from '../lib/dominio';
import {
  campiVuoti, campiDaRisultato, risultatoDaCampi, passaggiAttesi, scriviTempo, tempoTotale,
} from '../lib/test';
import { pdfFoglioTest, precaricaPdf, condivideFile } from '../lib/pdfCondividi';
import { nomeFileFoglioTest } from '../lib/pdfTest';
import ScegliGruppi from './ScegliGruppi';

const descriviTipo = (t) => [
  t.ripetute > 1 ? `${t.ripetute}x${t.distanza}` : `${t.distanza} m`,
  t.ripartenza_s ? `ogni ${Math.floor(t.ripartenza_s / 60)}:${String(t.ripartenza_s % 60).padStart(2, '0')}` : null,
  t.recupero_s ? `con ${Math.floor(t.recupero_s / 60)}:${String(t.recupero_s % 60).padStart(2, '0')} di recupero` : null,
].filter(Boolean).join(' · ');

export default function RegistraTest({ societa, fasce, tipi, atleti, gruppiTestata, sessione, puoScrivere, chiudi }) {
  const [tipoId, setTipoId] = useState(sessione?.tipo_id || tipi[0]?.id || '');
  const [data, setData] = useState(sessione?.data || oggiLocale());
  const [vasca, setVasca] = useState(sessione?.vasca || tipi.find((t) => t.id === (sessione?.tipo_id || tipi[0]?.id))?.vasca || 25);
  const [gruppi, setGruppi] = useState(gruppiTestata || []);
  const [campi, setCampi] = useState({});          // atleta_id -> campi del modulo
  const [iniziali, setIniziali] = useState([]);    // chi aveva già una riga in questa sessione
  const [aperto, setAperto] = useState(null);
  const [errori, setErrori] = useState([]);
  const [messaggio, setMessaggio] = useState(null);
  const [inCorso, setInCorso] = useState(false);

  const tipo = tipi.find((t) => t.id === tipoId);

  // Sul telefono jsPDF e i caratteri si scaricano prima del tocco: iOS
  // vuole la condivisione attaccata al gesto (pdfCondividi.js).
  useEffect(() => { if (condivideFile()) precaricaPdf().catch(() => {}); }, []);

  // Una sessione già salvata: i suoi risultati nei campi, al centesimo.
  useEffect(() => {
    if (!sessione || !tipo) return;
    api.leggiRisultatiSessione(sessione.id)
      .then((righe) => {
        setCampi(Object.fromEntries(righe.map((r) => [r.atleta_id, campiDaRisultato(tipo, r)])));
        setIniziali(righe.map((r) => r.atleta_id));
      })
      .catch((e) => setMessaggio(e.message));
  }, [sessione?.id, tipo?.id]);

  // Il gruppo di questa registrazione, più chi ha già una riga: riaprendo
  // una sessione nessun risultato resta nascosto da un filtro.
  const codici = codiciDelGruppo(gruppi);
  const elenco = useMemo(
    () => atleti.filter((a) => atletaNelGruppo(a, codici, fasce) || iniziali.includes(a.id)),
    [atleti, codici?.join(), fasce, iniziali],
  );

  function cambiaTipo(id) {
    setTipoId(id);
    setCampi({});
    setErrori([]);
    const t = tipi.find((x) => x.id === id);
    if (t?.vasca) setVasca(t.vasca);
  }

  const campiDi = (id) => campi[id] || campiVuoti(tipo);
  function scrivi(id, cambia) {
    setCampi((c) => {
      const attuali = c[id] || campiVuoti(tipo);
      const nuovi = { ...attuali, tempi: [...attuali.tempi], bracciate: [...attuali.bracciate],
        passaggi: attuali.passaggi.map((p) => [...p]) };
      cambia(nuovi);
      return { ...c, [id]: nuovi };
    });
  }

  async function salva() {
    if (!tipo) return;
    const problemi = [];
    const risultati = [];
    const daTogliere = [];
    for (const a of elenco) {
      const r = risultatoDaCampi(tipo, campiDi(a.id));
      r.errori.forEach((e) => problemi.push(`${a.cognome} ${a.nome} — ${e}`));
      if (r.vuoto) {
        if (iniziali.includes(a.id)) daTogliere.push(a.id);
      } else {
        risultati.push({ atleta_id: a.id, ripetute: r.ripetute, gara_100: r.gara_100, gara_400: r.gara_400 });
      }
    }
    setErrori(problemi);
    if (problemi.length) return;
    if (!risultati.length && !sessione) {
      setMessaggio('Nessun tempo scritto: niente da salvare.');
      return;
    }
    if (daTogliere.length && !confirm(`${daTogliere.length} atleti hanno i campi vuoti: i loro risultati di questa sessione vengono tolti. Procedo?`)) return;
    setInCorso(true);
    try {
      await api.salvaTestSessione({
        sessione: { ...(sessione ? { id: sessione.id } : {}), societa_id: societa.id, tipo_id: tipo.id, data, vasca },
        risultati,
        daTogliere,
      });
      chiudi(true);
    } catch (e) { setMessaggio(`Non salvato: ${e.message}`); }
    finally { setInCorso(false); }
  }

  // Il foglio da bordo vasca: gli stessi atleti, nello stesso ordine.
  async function foglio() {
    const f = { tipo, data, vasca, gruppi, societa: societa.nome, atleti: elenco };
    const esito = await pdfFoglioTest(f, nomeFileFoglioTest(f));
    setMessaggio(esito ? esito.testo : null);
  }

  if (!tipo) {
    return (
      <div className="scheda"><div className="vuoto">
        <h3>Nessun test della società</h3>
        <p>Prima copia uno dei modelli, o crea un test, nella scheda Test.</p>
        <button className="azione fantasma" onClick={() => chiudi(false)}>Torna ai test</button>
      </div></div>
    );
  }

  const p = passaggiAttesi(tipo);
  const scritti = elenco.filter((a) => !risultatoDaCampi(tipo, campiDi(a.id)).vuoto).length;

  return (
    <>
      <div className="barra">
        <button className="mini" onClick={() => chiudi(false)} aria-label="Torna ai test"><ArrowLeft size={15} /></button>
        <h1>{sessione ? 'Sessione di test' : 'Registra un test'}</h1>
        <div style={{ flex: 1 }} />
        <button className="mini" onClick={foglio} disabled={!elenco.length}
          title="Il foglio da stampare per bordo vasca: i nomi del gruppo e le caselle vuote">
          <FileText size={14} style={{ verticalAlign: -2 }} /> Foglio
        </button>
        {puoScrivere && (
          <button className="azione" onClick={salva} disabled={inCorso}>
            <Check size={16} style={{ verticalAlign: -3 }} /> Salva
          </button>
        )}
      </div>

      <div className="scheda sezione">
        <div className="corpo testata-test">
          <div className="campo">
            <label>Test</label>
            <select value={tipoId} onChange={(e) => cambiaTipo(e.target.value)} disabled={!!sessione || !puoScrivere}>
              {tipi.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={!puoScrivere} />
          </div>
          <div className="campo">
            <label>Vasca</label>
            <select value={vasca} onChange={(e) => setVasca(Number(e.target.value))} disabled={!puoScrivere}>
              <option value={25}>25 m</option>
              <option value={50}>50 m</option>
            </select>
          </div>
          <div className="campo">
            <label>Gruppo</label>
            <ScegliGruppi scelti={gruppi} cambia={setGruppi} />
          </div>
        </div>
        <p className="nota-storico" style={{ padding: '0 18px 14px', margin: 0 }}>
          {descriviTipo(tipo)}{p ? ` · passaggi ogni ${tipo.parziali_ogni} m, progressivi come sul cronometro` : ''}.
          {' '}Tempi come «1:20.5» o «26:40»; bracciate singole per 25. Chi lasci vuoto non entra.
        </p>
      </div>

      {messaggio && <div className="avviso errore" style={{ marginBottom: 12 }}>{messaggio}</div>}
      {errori.length > 0 && (
        <div className="avviso errore" style={{ marginBottom: 12 }}>
          <b>Non salvato, da correggere:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{errori.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <div className="barra" style={{ color: 'var(--testo-3)', fontSize: 13 }}>
        <span className="mono">{scritti}/{elenco.length}</span> con almeno un tempo
      </div>

      <div className="scheda">
        {elenco.length === 0 ? (
          <div className="vuoto"><h3>Nessun atleta</h3><p>Nessuno nel gruppo scelto: cambialo qui sopra.</p></div>
        ) : (
          <div className="corpo" style={{ display: 'grid', gap: 8 }}>
            {elenco.map((a) => {
              const c = campiDi(a.id);
              const r = risultatoDaCampi(tipo, c);
              const tot = tempoTotale(r);
              const espanso = aperto === a.id;
              const quanti = r.ripetute.filter((x) => x.t != null).length;
              return (
                <div key={a.id} className="riga-benessere" data-espanso={espanso}>
                  <button className="testa-benessere" onClick={() => setAperto(espanso ? null : a.id)}>
                    <span><b>{a.cognome}</b> {a.nome}</span>
                    <span style={{ flex: 1 }} />
                    <span className="mono" style={{ fontSize: 13, color: r.errori.length ? 'var(--rosso)' : 'var(--testo-2)' }}>
                      {r.errori.length ? 'da correggere'
                        : tot != null ? scriviTempo(tipo.ripetute > 1 ? Math.round(tot / tipo.ripetute) : tot) + (tipo.ripetute > 1 ? ' medio' : '')
                          : quanti ? `${quanti}/${tipo.ripetute}` : ''}
                    </span>
                    {!r.vuoto && !r.errori.length && <Check size={15} style={{ color: 'var(--menta)' }} />}
                  </button>

                  {espanso && (
                    <div className="corpo-test">
                      {c.tempi.map((_, i) => (
                        <div key={i} className="ripetuta-test">
                          <span className="numero-ripetuta mono">{tipo.ripetute > 1 ? i + 1 : ''}</span>
                          <input className="mono" value={c.tempi[i]} placeholder="tempo" aria-label={`Tempo ripetuta ${i + 1}`}
                            autoComplete="off" autoCorrect="off" spellCheck={false} disabled={!puoScrivere}
                            onChange={(e) => scrivi(a.id, (n) => { n.tempi[i] = e.target.value; })} />
                          <input className="mono bracciate" value={c.bracciate[i]} placeholder="br/25" inputMode="decimal"
                            aria-label={`Bracciate per 25, ripetuta ${i + 1}`} disabled={!puoScrivere}
                            onChange={(e) => scrivi(a.id, (n) => { n.bracciate[i] = e.target.value; })} />
                          {p > 0 && (
                            <div className="passaggi-test">
                              {c.passaggi[i].map((x, k) => (
                                <input key={k} className="mono" value={x} placeholder={`${(k + 1) * tipo.parziali_ogni}`}
                                  aria-label={`Passaggio ai ${(k + 1) * tipo.parziali_ogni} m`}
                                  autoComplete="off" autoCorrect="off" spellCheck={false} disabled={!puoScrivere}
                                  onChange={(e) => scrivi(a.id, (n) => { n.passaggi[i][k] = e.target.value; })} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {tipo.modello === '5x300' && (
                        <div className="ripetuta-test">
                          <span className="numero-ripetuta" />
                          <input className="mono" value={c.gara_100} placeholder="100 di gara" aria-label="Tempo di gara dei 100"
                            autoComplete="off" disabled={!puoScrivere}
                            onChange={(e) => scrivi(a.id, (n) => { n.gara_100 = e.target.value; })} />
                          <input className="mono" value={c.gara_400} placeholder="400 di gara" aria-label="Tempo di gara dei 400"
                            autoComplete="off" disabled={!puoScrivere}
                            onChange={(e) => scrivi(a.id, (n) => { n.gara_400 = e.target.value; })} />
                        </div>
                      )}
                      {r.errori.map((e, i) => <div key={i} className="errore-test">{e}</div>)}
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
