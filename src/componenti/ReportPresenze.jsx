// =====================================================================
// REPORT PRESENZE (deciso il 19/10/2026) — tempo 2, l'interfaccia
//
// Si apre dal pulsante «Report» in Appello. Si sceglie la forma (giorno,
// mese, stagione), il periodo e il gruppo — di default quello in
// testata. Le regole stanno tutte in dominio.js (reportGiornaliero,
// reportMensile, reportStagione), sotto prova: qui si legge, si sceglie e
// si disegna. Il PDF è la stampa del browser, col nome del file di
// nomeFileReport, come per le sedute.
//
// Gli atleti sono quelli che Appello ha già letto (gli attivi); dal
// database si leggono solo le presenze del periodo scelto.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import * as api from '../lib/dati';
import {
  RAGGRUPPAMENTI, codiciDelGruppo, sedutaNelGruppo, dataIt, dataItLunga, oggiLocale,
  stagioneCorrente, stagioneDa, annoInizialeDi,
  reportGiornaliero, reportMensile, reportStagione, nomeFileReport,
} from '../lib/dominio';
import { stampaConNome } from '../lib/stampa';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const GIORNI_BREVI = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const NOMI_STATO = { P: 'Presente', R: 'Ritardo', G: 'Giustificato', A: 'Assente' };

const nomeMese = (m) => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const meseBreve = (m) => MESI_BREVI[Number(m.slice(5, 7)) - 1];
const percentuale = (pct) => (pct == null ? '—' : `${pct}%`);
const ultimoDelMese = (m) => {
  const giorni = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  return `${m}-${String(giorni).padStart(2, '0')}`;
};

export default function ReportPresenze({ societa, atleti, fasce, sedute, gruppi, sedutaIniziale, chiudi }) {
  const oggi = oggiLocale();
  const [forma, setForma] = useState('mese');                 // giorno | mese | stagione
  const [sedutaId, setSedutaId] = useState(sedutaIniziale || '');
  const [mese, setMese] = useState(oggi.slice(0, 7));
  const [stagione, setStagione] = useState(stagioneCorrente());
  const [gruppo, setGruppo] = useState('testata');            // testata | '' (tutte) | nome
  const [dati, setDati] = useState({ chiave: null, presenze: [], sedute: [] });
  const [errore, setErrore] = useState(null);

  const nomiGruppo = gruppo === 'testata' ? (gruppi || []) : gruppo ? [gruppo] : [];
  const codici = codiciDelGruppo(nomiGruppo);
  const annoStagione = annoInizialeDi(stagione);
  const stagioni = useMemo(() => {
    const anno = annoInizialeDi(stagioneCorrente());
    return [anno, anno - 1, anno - 2].map(stagioneDa);
  }, []);

  // Le sedute fra cui scegliere il giorno: quelle del gruppo, più quella
  // da cui si è partiti se fosse fuori.
  const seduteDelGruppo = useMemo(() => (sedute || [])
    .filter((s) => sedutaNelGruppo(s, codici) || s.id === sedutaId), [sedute, codici?.join(), sedutaId]);
  const seduta = (sedute || []).find((s) => s.id === sedutaId) || null;

  // Cosa leggere: una seduta, un mese, una stagione. La chiave dice se
  // quello che c'è a schermo è ancora quello scelto.
  const chiave = forma === 'giorno' ? `g:${sedutaId}` : forma === 'mese' ? `m:${mese}` : `s:${stagione}`;
  useEffect(() => {
    let vivo = true;
    setErrore(null);
    (async () => {
      try {
        let presenze = [];
        let seduteMese = [];
        if (forma === 'giorno') {
          if (sedutaId) presenze = await api.leggiPresenze(sedutaId);
        } else if (forma === 'mese') {
          // L'ultimo giorno vero del mese: "-31" a novembre è una data che
          // il database rifiuta.
          const da = `${mese}-01`;
          const a = ultimoDelMese(mese);
          [seduteMese, presenze] = await Promise.all([
            api.leggiSedute(societa.id, { da, a }),
            api.leggiPresenzePeriodo(societa.id, da, a),
          ]);
        } else {
          presenze = await api.leggiPresenzePeriodo(societa.id, `${annoStagione}-09-01`, `${annoStagione + 1}-08-31`);
        }
        if (vivo) setDati({ chiave, presenze, sedute: seduteMese });
      } catch (e) { if (vivo) setErrore(e.message); }
    })();
    return () => { vivo = false; };
  }, [chiave, societa.id]);

  const pronto = dati.chiave === chiave;
  const report = useMemo(() => {
    if (!pronto) return null;
    const comune = { atleti, codici, fasce, presenze: dati.presenze };
    if (forma === 'giorno') return seduta ? reportGiornaliero({ ...comune, seduta }) : null;
    if (forma === 'mese') return reportMensile({ ...comune, mese, oggi, sedute: dati.sedute });
    return reportStagione({ ...comune, stagione, oggi });
  }, [pronto, dati, forma, seduta, mese, stagione, oggi, atleti, fasce, codici?.join()]);

  const periodo = forma === 'giorno' ? (seduta?.data || '') : forma === 'mese' ? mese : stagione;
  const titoloPeriodo = forma === 'giorno'
    ? (seduta ? `${dataItLunga(seduta.data)}${seduta.titolo ? ` · ${seduta.titolo}` : ''}` : '')
    : forma === 'mese' ? nomeMese(mese) : `Stagione ${stagione}`;
  const nomeGruppo = nomiGruppo.length ? nomiGruppo.join(' · ') : 'Tutte le categorie';

  return (
    <>
      <div className="barra solo-schermo">
        <button className="mini" onClick={chiudi}>
          <ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Appello
        </button>
        <h1 style={{ margin: 0 }}>Report presenze</h1>
        <div style={{ flex: 1 }} />
        <button
          className="mini"
          disabled={!report}
          onClick={() => stampaConNome(nomeFileReport({ periodo, gruppi: nomiGruppo }))}
          title="Stampa o salva in PDF"
        >
          <Printer size={14} style={{ verticalAlign: -2 }} /> PDF
        </button>
      </div>

      <div className="scelte-report solo-schermo">
        <div className="gruppo-pastiglie" role="group" aria-label="Forma del report">
          {[['giorno', 'Giorno'], ['mese', 'Mese'], ['stagione', 'Stagione']].map(([k, nome]) => (
            <button key={k} className="pastiglia" aria-pressed={forma === k} onClick={() => setForma(k)}>{nome}</button>
          ))}
        </div>

        {forma === 'giorno' && (
          <select value={sedutaId} onChange={(e) => setSedutaId(e.target.value)} aria-label="Seduta">
            {!sedutaId && <option value="">Scegli una seduta</option>}
            {seduteDelGruppo.map((s) => (
              <option key={s.id} value={s.id}>{dataIt(s.data)} · {s.titolo || 'senza titolo'}</option>
            ))}
          </select>
        )}
        {forma === 'mese' && (
          <input type="month" value={mese} max={oggi.slice(0, 7)} aria-label="Mese"
            onChange={(e) => e.target.value && setMese(e.target.value)} />
        )}
        {forma === 'stagione' && (
          <select value={stagione} onChange={(e) => setStagione(e.target.value)} aria-label="Stagione">
            {stagioni.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <select value={gruppo} onChange={(e) => setGruppo(e.target.value)} aria-label="Gruppo">
          <option value="testata">
            Come in testata{gruppi?.length ? ` (${gruppi.join(' · ')})` : ' (tutte)'}
          </option>
          <option value="">Tutte le categorie</option>
          {RAGGRUPPAMENTI.map((r) => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
        </select>
      </div>

      {errore && <div className="avviso errore solo-schermo" style={{ marginBottom: 12 }}>{errore}</div>}

      <div className="foglio-report scheda" data-forma={forma}>
        <div className="testata-report">
          <div>
            <h2>Presenze · {titoloPeriodo || '—'}</h2>
            <p>{nomeGruppo}</p>
          </div>
          <p className="societa-report">{societa.nome}</p>
        </div>

        {!pronto && !errore && <p className="nota-report">Lettura in corso…</p>}
        {pronto && !report && forma === 'giorno' && <p className="nota-report">Scegli una seduta.</p>}
        {report && forma === 'giorno' && <Giornaliero r={report} />}
        {report && forma === 'mese' && <Mensile r={report} />}
        {report && forma === 'stagione' && <Stagione r={report} />}

        <p className="nota-report">
          Percentuale: presenti e ritardi su presenti, ritardi e assenti. Il giustificato non entra
          nel conto; «—» vuol dire nessun appello da contare. I giorni e i mesi che devono ancora
          venire restano vuoti.
        </p>
      </div>
    </>
  );
}

function Giornaliero({ r }) {
  if (!r.righe.length) return <p className="nota-report">Nessun atleta in questo gruppo.</p>;
  return (
    <>
      <p className="riepilogo-report mono">
        {r.presenti} presenti · {r.conti.a} assenti · {r.conti.g} giustificati
        {r.conti.nonRilevati ? ` · ${r.conti.nonRilevati} non rilevati` : ''} · {percentuale(r.conti.pct)}
      </p>
      <div className="scorre-report">
        <table className="tabella-report">
          <thead><tr><th>Atleta</th><th>Stato</th></tr></thead>
          <tbody>
            {r.righe.map((x) => (
              <tr key={x.atleta_id}>
                <td><b>{x.cognome}</b> {x.nome}</td>
                <td className="stato-report" data-stato={x.stato || ''}>
                  {x.stato ? NOMI_STATO[x.stato] : 'non rilevato'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Mensile({ r }) {
  if (!r.righe.length) return <p className="nota-report">Nessun atleta in questo gruppo.</p>;
  return (
    <div className="scorre-report">
      <table className="tabella-report griglia-report">
        <thead>
          <tr>
            <th className="atleta-report">Atleta</th>
            {r.giorni.map((g) => (
              <th key={g.data} className="giorno-report" data-futuro={g.futuro}>
                <span>{GIORNI_BREVI[new Date(`${g.data}T12:00`).getDay()]}</span>{g.numero}
              </th>
            ))}
            <th className="pct-report">%</th>
          </tr>
        </thead>
        <tbody>
          {r.righe.map((x) => (
            <tr key={x.atleta_id}>
              <td className="atleta-report"><b>{x.cognome}</b> {x.nome}</td>
              {x.caselle.map((c, i) => (
                <td key={i} className="casella-report" data-futuro={c === null}>
                  {(c || []).map((s, k) => <span key={k} data-stato={s}>{s}</span>)}
                </td>
              ))}
              <td className="pct-report mono">{percentuale(x.frequenza.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stagione({ r }) {
  if (!r.righe.length) return <p className="nota-report">Nessun atleta in questo gruppo.</p>;
  return (
    <div className="scorre-report">
      <table className="tabella-report griglia-report">
        <thead>
          <tr>
            <th className="atleta-report">Atleta</th>
            {r.mesi.map((m) => (
              <th key={m.mese} className="mese-report" data-futuro={m.futuro}>{meseBreve(m.mese)}</th>
            ))}
            <th className="pct-report">Tot.</th>
          </tr>
        </thead>
        <tbody>
          {r.righe.map((x) => (
            <tr key={x.atleta_id}>
              <td className="atleta-report"><b>{x.cognome}</b> {x.nome}</td>
              {x.mesi.map((f, i) => (
                <td key={i} className="mese-report mono" data-futuro={f === null}>
                  {f === null ? '' : percentuale(f.pct)}
                </td>
              ))}
              <td className="pct-report mono">{percentuale(x.totale.pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
