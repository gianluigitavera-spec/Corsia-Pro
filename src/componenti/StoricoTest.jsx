// =====================================================================
// LO STORICO DEI TEST DI UN ATLETA
//
// Sta nella scheda Test e, uguale, aprendo l'atleta in Atleti: per
// questo legge da sé tipi, percentuali e risultati, e non dipende da chi
// lo apre. Il test serve a valutare l'allenamento: qui l'atleta si
// confronta con sé stesso, nella stessa vasca, e niente classifica.
//
// I calcoli stanno tutti in lib/test.js, sotto prova. Lattato e
// frequenza non si vedono: aspettano il consulente.
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import * as api from '../lib/dati';
import { dataIt } from '../lib/dominio';
import {
  scriviTempo, velocita, passo100, storicoAtleta, valoreStorico, ritmiZona,
  percentualiSocieta, tecnicaRisultato, controllo5x300,
} from '../lib/test';
import { Linea } from './Grafici';

const differenza = (cs) => {
  if (cs == null) return '—';
  if (cs === 0) return '=';
  return `${cs < 0 ? '−' : '+'}${(Math.abs(cs) / 100).toFixed(1)} s`;
};
const tintaDifferenza = (cs) => (cs == null || cs === 0 ? 'var(--testo-3)' : cs < 0 ? 'var(--menta)' : 'var(--ambra)');
const cifra = (n, k) => (n == null ? '—' : n.toFixed(k).replace('.', ','));

export default function StoricoTest({ societaId, atleta }) {
  const [tipi, setTipi] = useState([]);
  const [percentuali, setPercentuali] = useState([]);
  const [risultati, setRisultati] = useState(null);
  const [tipoId, setTipoId] = useState('');
  const [vasca, setVasca] = useState(null);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    let vivo = true;
    setRisultati(null);
    Promise.all([api.leggiTestTipi(societaId), api.leggiTestPercentuali(societaId), api.leggiStoricoTest(atleta.id)])
      .then(([t, p, r]) => {
        if (!vivo) return;
        setTipi(t);
        setPercentuali(p);
        setRisultati(r.filter((x) => x.sessione));
        setErrore(null);
      })
      .catch((e) => vivo && setErrore(e.message));
    return () => { vivo = false; };
  }, [societaId, atleta.id]);

  // I tipi che l'atleta ha fatto, dal più recente. Si apre sull'ultimo
  // test fatto: è quello di cui si vuole sapere.
  const fatti = useMemo(() => {
    const ultimo = {};
    for (const r of risultati || []) {
      const t = r.sessione.tipo_id;
      if (!ultimo[t] || r.sessione.data > ultimo[t]) ultimo[t] = r.sessione.data;
    }
    return tipi.filter((t) => ultimo[t.id]).sort((a, b) => (ultimo[a.id] < ultimo[b.id] ? 1 : -1));
  }, [risultati, tipi]);

  useEffect(() => {
    if (fatti.length && !fatti.some((t) => t.id === tipoId)) setTipoId(fatti[0].id);
  }, [fatti, tipoId]);

  const tipo = tipi.find((t) => t.id === tipoId);
  const delTipo = useMemo(
    () => (risultati || []).filter((r) => r.sessione.tipo_id === tipoId),
    [risultati, tipoId],
  );
  const vasche = [...new Set(delTipo.map((r) => r.sessione.vasca))].sort();

  // La vasca dell'ultimo test, finché non se ne sceglie un'altra.
  useEffect(() => {
    if (!delTipo.length) return;
    if (vasche.includes(vasca)) return;
    const ultimo = [...delTipo].sort((a, b) => (a.sessione.data < b.sessione.data ? 1 : -1))[0];
    setVasca(ultimo.sessione.vasca);
  }, [delTipo, vasca]);

  const storico = useMemo(() => {
    if (!tipo) return [];
    const voci = delTipo.map((r) => ({
      data: r.sessione.data, vasca: r.sessione.vasca, valore: valoreStorico(tipo, r), risultato: r,
    }));
    return storicoAtleta(voci, vasca);
  }, [tipo, delTipo, vasca]);

  if (errore) return <div className="avviso errore">{errore}</div>;
  if (risultati == null) return <p style={{ color: 'var(--testo-3)', fontSize: 13 }}>Lettura dei test…</p>;
  if (!fatti.length) {
    return <p style={{ color: 'var(--testo-3)', fontSize: 13, margin: 0 }}>Nessun test registrato per {atleta.cognome} {atleta.nome}.</p>;
  }

  const unaSola = (tipo?.ripetute || 1) === 1;
  const ultimo = storico[storico.length - 1];
  const ritmi = ultimo ? ritmiZona(tipo, ultimo.risultato, percentualiSocieta(percentuali)) : null;
  const tecnica = ultimo ? tecnicaRisultato(tipo, ultimo.risultato) : null;
  const passoDi = (cs) => passo100(velocita(tipo.distanza, cs));

  return (
    <div className="storico-test">
      <div className="barra" style={{ marginBottom: 10 }}>
        <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} aria-label="Test">
          {fatti.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.attivo ? '' : ' (archiviato)'}</option>)}
        </select>
        {vasche.length > 1 ? (
          <select value={vasca ?? ''} onChange={(e) => setVasca(Number(e.target.value))} aria-label="Vasca">
            {vasche.map((v) => <option key={v} value={v}>vasca da {v}</option>)}
          </select>
        ) : (
          <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 13 }}>vasca da {vasca}</span>
        )}
      </div>

      {storico.length === 0 ? (
        <p style={{ color: 'var(--testo-3)', fontSize: 13 }}>
          In questa vasca nessun risultato completo: lo storico confronta solo i test con tutti i tempi.
        </p>
      ) : (
        <>
          <p className="nota-storico">
            {unaSola ? 'Tempo' : 'Tempo medio della ripetuta'}: più in alto, più veloce. Solo i test in vasca da {vasca}.
          </p>
          <Linea
            punti={storico.map((v) => ({ etichetta: dataIt(v.data), valore: v.valore, record: v.record }))}
            formato={scriviTempo}
          />

          <table className="tabella-test">
            <thead>
              <tr>
                <th>Data</th><th>{unaSola ? 'Tempo' : 'Medio'}</th><th>Passo 100</th>
                <th>Dalla volta prima</th><th className="col-stretta">Dal migliore</th>
              </tr>
            </thead>
            <tbody>
              {[...storico].reverse().map((v) => {
                const c = controllo5x300(tipo, v.risultato);
                return (
                  <tr key={v.risultato.id}>
                    <td className="mono">{dataIt(v.data)}</td>
                    <td className="mono">
                      {scriviTempo(v.valore)}
                      {v.record && <Award size={13} style={{ color: 'var(--menta)', verticalAlign: -2, marginLeft: 5 }} aria-label="Il migliore fin qui" />}
                    </td>
                    <td className="mono">{scriviTempo(passoDi(v.valore))}</td>
                    <td className="mono" style={{ color: tintaDifferenza(v.diffPrecedente) }}>{differenza(v.diffPrecedente)}</td>
                    <td className="mono col-stretta" style={{ color: tintaDifferenza(v.diffMigliore) }}>
                      {differenza(v.diffMigliore)}
                      {c && (
                        <span style={{ color: c.riuscito ? 'var(--menta)' : 'var(--ambra)', marginLeft: 8 }}>
                          ultimo 300 {differenza(c.scarto)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {ultimo && controllo5x300(tipo, ultimo.risultato) && (() => {
            const c = controllo5x300(tipo, ultimo.risultato);
            return (
              <p className="nota-storico">
                Controllo dell'ultimo 5x300: ultimo 300 in {scriviTempo(c.ultimo)}, atteso {scriviTempo(c.atteso)}
                {' '}(400 − 100 di gara): {differenza(c.scarto)}, {c.riuscito ? 'riuscito' : 'fuori dai 3 secondi'}.
              </p>
            );
          })()}

          {ritmi && (
            <div className="ritmi-zona">
              <h4>Ritmi per zona dal test del {dataIt(ultimo.data)} <span>vasca da {vasca}</span></h4>
              <div className="griglia-ritmi">
                {['A1', 'A2', 'B1', 'B2'].map((z) => (
                  <div key={z} className="ritmo">
                    <b>{z}</b>
                    <span className="mono">{ritmi[z] ? scriviTempo(ritmi[z].passo) : '—'}</span>
                    <small className="mono">{ritmi[z] ? `${cifra(ritmi[z].velocita, 2)} m/s` : 'serie incompleta'}</small>
                  </div>
                ))}
              </div>
              <p className="nota-storico">
                Passo ai 100. {tipo.regola_zone === 'serie'
                  ? 'A2, B1 e B2 dalle tre serie; A1 dal B1 misurato.'
                  : `B1 dalla velocità del test${tipo.fattore_b1 && tipo.fattore_b1 !== 1 ? ` × ${cifra(tipo.fattore_b1, 2)}` : ''}; le altre in percentuale.`}
                {' '}C1, C2 e C3 non vengono da questo test.
              </p>
            </div>
          )}
          {!ritmi && !tipo.regola_zone && (
            <p className="nota-storico">Questo test non dà ritmi per zona: serve allo storico e alla tecnica.</p>
          )}

          {tecnica && (
            <div className="ritmi-zona">
              <h4>Tecnica dell'ultimo test <span>{tecnica.ripetute} {tecnica.ripetute === 1 ? 'ripetuta' : 'ripetute'} con le bracciate</span></h4>
              <div className="griglia-ritmi">
                <div className="ritmo"><b>Bracciate</b><span className="mono">{cifra(tecnica.bracciate, 1)}</span><small>per 25</small></div>
                <div className="ritmo"><b>DS</b><span className="mono">{cifra(tecnica.ds, 2)}</span><small>m per ciclo</small></div>
                <div className="ritmo"><b>SWOLF</b><span className="mono">{cifra(tecnica.swolf, 1)}</span><small>per 25</small></div>
                <div className="ritmo"><b>Efficienza</b><span className="mono">{cifra(tecnica.indice, 1)}</span><small>v² × DS</small></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
