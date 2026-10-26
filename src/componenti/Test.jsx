// =====================================================================
// LA SCHEDA «TEST», PRIMA FASE (decisa il 26/10/2026)
//
// I test della società, con «copia» dai cinque modelli (T-1000, T-2000,
// 15x100, 6x50, 5x300); le percentuali di zona; le ultime sessioni; lo
// storico di un atleta. Registrare un test prende il posto della scheda,
// come il report presenze in Appello.
//
// Il test serve a valutare l'allenamento, non a prevedere la gara:
// niente classifiche, prima l'atleta con sé stesso. Scrivono allenatore
// e collega; il lettore guarda. Lattato e frequenza non si vedono.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Pencil, Archive, RotateCcw, Trash2, Check, X, Timer, FileText } from 'lucide-react';
import * as api from '../lib/dati';
import { atletaNelGruppo, dataIt } from '../lib/dominio';
import { MODELLI_TEST, copiaModello, PERCENTUALI_DI_PARTENZA, percentualiSocieta, azioniTipo } from '../lib/test';
import { pdfFoglioTest, precaricaPdf, condivideFile } from '../lib/pdfCondividi';
import { nomeFileFoglioTest } from '../lib/pdfTest';
import RegistraTest from './RegistraTest';
import StoricoTest from './StoricoTest';

const minSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Il tipo in una riga, come lo direbbe l'allenatore.
const descrivi = (t) => [
  t.ripetute > 1 ? `${t.ripetute}x${t.distanza}` : `${t.distanza} m`,
  t.ripartenza_s ? `ogni ${minSec(t.ripartenza_s)}` : null,
  t.recupero_s ? `con ${minSec(t.recupero_s)}` : null,
  t.vasca ? `vasca da ${t.vasca}` : null,
  t.parziali_ogni ? `passaggi ogni ${t.parziali_ogni}` : null,
  t.regola_zone === 'b1'
    ? `B1 = velocità${t.fattore_b1 && t.fattore_b1 !== 1 ? ` × ${String(t.fattore_b1).replace('.', ',')}` : ''}`
    : t.regola_zone === 'serie' ? 'A2, B1, B2 dalle serie' : 'niente zone',
].filter(Boolean).join(' · ');

export default function Test({ societa, fasce, puoScrivere, gruppi, codiciGruppi }) {
  const [tipi, setTipi] = useState([]);
  const [percentuali, setPercentuali] = useState([]);
  const [sessioni, setSessioni] = useState([]);
  const [atleti, setAtleti] = useState([]);
  const [registra, setRegistra] = useState(null);     // null, { nuova: true } o la sessione da riaprire
  const [inModifica, setInModifica] = useState(null);
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [atletaId, setAtletaId] = useState('');
  const [giro, setGiro] = useState(0);                 // ricarica lo storico dopo un salvataggio
  const [messaggio, setMessaggio] = useState(null);

  async function ricarica() {
    try {
      const [t, p, s, a] = await Promise.all([
        api.leggiTestTipi(societa.id), api.leggiTestPercentuali(societa.id),
        api.leggiTestSessioni(societa.id), api.leggiAtleti(societa.id),
      ]);
      setTipi(t); setPercentuali(p); setSessioni(s); setAtleti(a);
      setGiro((n) => n + 1);
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }
  useEffect(() => { ricarica(); }, [societa.id]);
  useEffect(() => { if (condivideFile()) precaricaPdf().catch(() => {}); }, []);

  const attivi = tipi.filter((t) => t.attivo);
  const visibili = mostraArchiviati ? tipi : attivi;
  const copiati = new Set(tipi.map((t) => t.modello).filter(Boolean));
  const delGruppo = useMemo(
    () => atleti.filter((a) => atletaNelGruppo(a, codiciGruppi, fasce)),
    [atleti, codiciGruppi, fasce],
  );
  const pct = percentualiSocieta(percentuali);

  async function copia(codice) {
    try {
      await api.salvaTestTipo({ ...copiaModello(codice), societa_id: societa.id });
      setMessaggio({ tipo: 'ok', testo: `${codice} copiato fra i test della società: puoi modificarlo.` });
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  async function salvaModifica() {
    const m = inModifica;
    const numero = (x) => (String(x ?? '').trim() === '' ? null : Number(String(x).replace(',', '.')));
    try {
      await api.salvaTestTipo({
        id: m.id,
        nome: m.nome.trim(),
        descrizione: m.descrizione?.trim() || null,
        vasca: m.vasca ? Number(m.vasca) : null,
        parziali_ogni: numero(m.parziali_ogni),
        fattore_b1: m.regola_zone === 'b1' ? numero(m.fattore_b1) ?? 1 : m.fattore_b1,
      });
      setInModifica(null);
      setMessaggio(null);
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  // Il foglio senza nomi, dal tipo: data, vasca e gruppo si scrivono a mano.
  async function foglioVuoto(t) {
    const f = { tipo: t, societa: societa.nome, atleti: null };
    const esito = await pdfFoglioTest(f, nomeFileFoglioTest(f));
    setMessaggio(esito ? { tipo: esito.tipo, testo: esito.testo } : null);
  }

  async function archivia(t, attivo) {
    try { await api.salvaTestTipo({ id: t.id, attivo }); ricarica(); }
    catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  async function cambiaPercentuale(zona, valore) {
    const v = String(valore).trim() === '' ? null : Number(String(valore).replace(',', '.'));
    if (v != null && !(v >= 50 && v <= 150)) {
      setMessaggio({ tipo: 'errore', testo: `${zona}: la percentuale va fra 50 e 150.` });
      return;
    }
    try {
      // Tornare al valore di partenza è togliere la riga.
      await api.salvaTestPercentuale(societa.id, zona, v === PERCENTUALI_DI_PARTENZA[zona] ? null : v);
      setMessaggio(null);
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  async function eliminaSessione(s) {
    const t = tipi.find((x) => x.id === s.tipo_id);
    if (!confirm(`Cancellare la sessione ${t?.nome || ''} del ${dataIt(s.data)} con tutti i suoi risultati?`)) return;
    try { await api.eliminaTestSessione(s.id); ricarica(); }
    catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  // Registrare prende il posto della scheda. Dopo tutti gli hook: un hook
  // sotto un return anticipato è l'errore #300 (CLAUDE.md, eslint).
  if (registra) {
    const sessione = registra.nuova ? null : registra;
    return (
      <RegistraTest
        societa={societa}
        fasce={fasce}
        // Una sessione già salvata può essere di un tipo archiviato.
        tipi={sessione ? tipi : attivi}
        atleti={atleti}
        gruppiTestata={gruppi}
        sessione={sessione}
        puoScrivere={puoScrivere}
        chiudi={(salvato) => {
          setRegistra(null);
          if (salvato) {
            setMessaggio({ tipo: 'ok', testo: 'Test salvato.' });
            ricarica();
          }
        }}
      />
    );
  }

  const atleta = atleti.find((a) => a.id === atletaId);

  return (
    <>
      <div className="barra">
        <h1>Test</h1>
        <div style={{ flex: 1 }} />
        {puoScrivere && (
          <button className="azione" onClick={() => setRegistra({ nuova: true })} disabled={!attivi.length}
            title={attivi.length ? 'Registra un test fatto' : 'Prima copia un modello qui sotto'}>
            <Plus size={16} style={{ verticalAlign: -3 }} /> Registra
          </button>
        )}
      </div>

      <p style={{ color: 'var(--testo-3)', fontSize: 13, marginTop: -8 }}>
        Il test serve a valutare l'allenamento, non a prevedere la gara: prima di tutto
        l'atleta confrontato con sé stesso, nella stessa vasca.
      </p>

      {messaggio && (
        <div className={`avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`} style={{ marginBottom: 12 }}>
          {messaggio.testo}
        </div>
      )}

      <div className="scheda sezione">
        <div className="intestazione">
          <Timer size={16} style={{ color: 'var(--ciano)' }} />
          <h3>I test della società</h3>
          <div style={{ flex: 1 }} />
          {tipi.length > attivi.length && (
            <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={mostraArchiviati} onChange={(e) => setMostraArchiviati(e.target.checked)}
                style={{ minHeight: 0 }} />
              archiviati
            </label>
          )}
        </div>
        <div className="corpo" style={{ display: 'grid', gap: 8 }}>
          {visibili.length === 0 && (
            <p style={{ color: 'var(--testo-3)', margin: 0, fontSize: 14 }}>
              Nessun test ancora. Copia uno dei modelli qui sotto: diventa un test della società, e lo puoi modificare.
            </p>
          )}
          {visibili.map((t) => {
            const m = inModifica?.id === t.id ? inModifica : null;
            if (m) {
              return (
                <div key={t.id} className="tipo-test" data-modifica="true">
                  <div className="modifica-tipo">
                    <div className="campo"><label>Nome</label>
                      <input value={m.nome} onChange={(e) => setInModifica({ ...m, nome: e.target.value })} /></div>
                    <div className="campo"><label>Vasca proposta</label>
                      <select value={m.vasca || ''} onChange={(e) => setInModifica({ ...m, vasca: e.target.value })}>
                        <option value="">si sceglie ogni volta</option>
                        <option value="25">25 m</option><option value="50">50 m</option>
                      </select></div>
                    <div className="campo"><label>Passaggi ogni (m)</label>
                      <input className="mono" inputMode="numeric" value={m.parziali_ogni ?? ''} placeholder="nessuno"
                        onChange={(e) => setInModifica({ ...m, parziali_ogni: e.target.value })} /></div>
                    {m.regola_zone === 'b1' && (
                      <div className="campo"><label>B1 = velocità ×</label>
                        <input className="mono" inputMode="decimal" value={m.fattore_b1 ?? ''}
                          onChange={(e) => setInModifica({ ...m, fattore_b1: e.target.value })} /></div>
                    )}
                    <div className="campo" style={{ gridColumn: '1 / -1' }}><label>Descrizione</label>
                      <input value={m.descrizione || ''} onChange={(e) => setInModifica({ ...m, descrizione: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="mini" onClick={() => setInModifica(null)} aria-label="Annulla"><X size={14} /></button>
                    <button className="azione" style={{ minHeight: 36, padding: '7px 14px' }} onClick={salvaModifica}
                      disabled={!m.nome.trim()} aria-label="Salva"><Check size={15} /></button>
                  </div>
                </div>
              );
            }
            return (
              <div key={t.id} className="tipo-test" data-archiviato={!t.attivo}>
                <div style={{ minWidth: 0 }}>
                  <b>{t.nome}</b>{!t.attivo && <span style={{ color: 'var(--testo-3)' }}> · archiviato</span>}
                  <div className="sotto-tipo">{descrivi(t)}</div>
                  {t.descrizione && <div className="sotto-tipo">{t.descrizione}</div>}
                </div>
                {/* Quali tasti, lo decide azioniTipo (lib/test.js, sotto
                    prova): il foglio lo vede chiunque, il resto chi scrive. */}
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  {azioniTipo(t, puoScrivere).map((azione) => ({
                    foglio: (
                      <button key={azione} className="mini" onClick={() => foglioVuoto(t)} title="Il foglio da stampare, senza nomi">
                        <FileText size={14} style={{ verticalAlign: -2 }} /> Foglio
                      </button>
                    ),
                    modifica: <button key={azione} className="mini" aria-label="Modifica" onClick={() => setInModifica({ ...t })}><Pencil size={14} /></button>,
                    archivia: (
                      <button key={azione} className="mini" aria-label="Archivia" title="Archivia: i risultati restano"
                        onClick={() => archivia(t, false)}><Archive size={14} /></button>
                    ),
                    riattiva: (
                      <button key={azione} className="mini" onClick={() => archivia(t, true)}>
                        <RotateCcw size={14} style={{ verticalAlign: -2 }} /> Riattiva
                      </button>
                    ),
                  }[azione]))}
                </div>
              </div>
            );
          })}

          {puoScrivere && MODELLI_TEST.some((m) => !copiati.has(m.modello)) && (
            <div className="modelli-test">
              <span>Modelli da copiare:</span>
              {MODELLI_TEST.filter((m) => !copiati.has(m.modello)).map((m) => (
                <button key={m.modello} className="mini" onClick={() => copia(m.modello)} title={m.descrizione}>
                  <Copy size={13} style={{ verticalAlign: -2 }} /> {m.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Storico di un atleta</h3>
          <div style={{ flex: 1 }} />
          <select value={atletaId} onChange={(e) => setAtletaId(e.target.value)} aria-label="Atleta" style={{ maxWidth: 260 }}>
            <option value="">Scegli un atleta…</option>
            {delGruppo.map((a) => <option key={a.id} value={a.id}>{a.cognome} {a.nome}</option>)}
          </select>
        </div>
        <div className="corpo">
          {atleta
            ? <StoricoTest key={`${atleta.id}-${giro}`} societaId={societa.id} atleta={atleta} />
            : <p style={{ color: 'var(--testo-3)', margin: 0, fontSize: 14 }}>
                Lo stesso storico si apre anche dalla scheda Atleti, toccando il nome.
              </p>}
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Ultime sessioni</h3>
        </div>
        <div className="corpo" style={{ display: 'grid', gap: 6 }}>
          {sessioni.length === 0 && <p style={{ color: 'var(--testo-3)', margin: 0, fontSize: 14 }}>Nessuna sessione registrata.</p>}
          {sessioni.map((s) => {
            const t = tipi.find((x) => x.id === s.tipo_id);
            return (
              <div key={s.id} className="tipo-test">
                <span className="mono" style={{ color: 'var(--testo-2)' }}>{dataIt(s.data)}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b>{t?.nome || '—'}</b> <span className="sotto-tipo">vasca da {s.vasca}</span></span>
                <button className="mini" onClick={() => setRegistra(s)}>{puoScrivere ? 'Apri' : 'Vedi'}</button>
                {puoScrivere && (
                  <button className="mini" aria-label="Cancella la sessione" onClick={() => eliminaSessione(s)}><Trash2 size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Percentuali di zona</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>della velocità di B1</span>
        </div>
        <div className="corpo">
          <div className="griglia-ritmi">
            {['A1', 'A2', 'B2'].map((z) => (
              <div key={z} className="ritmo">
                <b>{z}</b>
                {puoScrivere ? (
                  <input key={`${z}-${pct[z]}`} className="mono" inputMode="decimal" defaultValue={pct[z]}
                    aria-label={`Percentuale ${z}`}
                    onBlur={(e) => { if (Number(e.target.value.replace(',', '.')) !== pct[z]) cambiaPercentuale(z, e.target.value); }} />
                ) : <span className="mono">{pct[z]} %</span>}
                <small>{pct[z] === PERCENTUALI_DI_PARTENZA[z] ? 'di partenza' : `partenza ${PERCENTUALI_DI_PARTENZA[z]}`}</small>
              </div>
            ))}
          </div>
          <p className="nota-storico">
            B1 viene dal test: T-2000 la sua velocità, T-1000 la velocità per il fattore del tipo (0,97 di
            partenza), 15x100 la seconda serie. Lasciare vuoto riporta al valore di partenza.
          </p>
        </div>
      </div>
    </>
  );
}
