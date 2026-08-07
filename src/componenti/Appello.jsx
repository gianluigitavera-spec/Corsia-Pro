import { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Check } from 'lucide-react';
import * as api from '../lib/dati';
import ComeAndata from './ComeAndata';
import { RAGGRUPPAMENTI, categoriaAtleta, dataIt } from '../lib/dominio';

// Quattro stati. L'assenza non conta come presenza; ritardo e
// giustificato sì — il ritardo però viene contato a parte.
const STATI = [
  { codice: 'P', nome: 'Presente',     breve: 'P', tinta: 'var(--menta)' },
  { codice: 'R', nome: 'Ritardo',      breve: 'R', tinta: 'var(--ciano)' },
  { codice: 'G', nome: 'Giustificato', breve: 'G', tinta: 'var(--ambra)' },
  { codice: 'A', nome: 'Assente',      breve: 'A', tinta: 'var(--rosso)' },
];

const pct = (presenti, rilevate) =>
  rilevate > 0 ? Math.round((presenti / rilevate) * 100) : null;

const tintaPct = (p) =>
  p == null ? 'var(--testo-3)'
    : p >= 90 ? 'var(--menta)'
    : p >= 75 ? 'var(--ciano)'
    : p >= 60 ? 'var(--ambra)'
    : 'var(--rosso)';

export default function Appello({ societa, fasce, puoScrivere }) {
  const [sedute, setSedute] = useState([]);
  const [sedutaId, setSedutaId] = useState('');
  const [atleti, setAtleti] = useState([]);
  const [stati, setStati] = useState({});
  const [prontezza, setProntezza] = useState({});
  const [frequenza, setFrequenza] = useState({});
  // La categoria è la prima scelta della giornata e cambia raramente:
  // se la si ricorda, all'apertura sei già dove lavori.
  const [filtro, setFiltro] = useState(() => {
    try { return localStorage.getItem('corsiapro:appello-categoria') || 'tutti'; }
    catch { return 'tutti'; }
  });

  function scegliCategoria(nome) {
    setFiltro(nome);
    try { localStorage.setItem('corsiapro:appello-categoria', nome); } catch { /* niente */ }
  }
  const [messaggio, setMessaggio] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, a, f] = await Promise.all([
          api.leggiSedute(societa.id), api.leggiAtleti(societa.id), api.leggiFrequenza(societa.id),
        ]);
        setSedute(s);
        setAtleti(a);
        setFrequenza(Object.fromEntries(f.map((x) => [x.atleta_id, x])));
      } catch (e) { setMessaggio(e.message); }
    })();
  }, [societa.id]);

  // Solo le sedute della categoria scelta: se alleni gli Esordienti A non
  // devi scorrere quelle dei Ragazzi per trovare la tua.
  const seduteDelGruppo = useMemo(() => {
    if (filtro === 'tutti') return sedute;
    const r = RAGGRUPPAMENTI.find((x) => x.nome === filtro);
    if (!r) return sedute;
    return sedute.filter((s) => (s.categorie || []).some((c) => r.codici.includes(c)));
  }, [sedute, filtro]);

  // Scelta da sola: quella di oggi se c'è, se no la più recente. Solo
  // quando quella corrente non appartiene più al gruppo scelto, così non
  // ti scippa la seduta che stavi guardando.
  useEffect(() => {
    if (!seduteDelGruppo.length) { setSedutaId(''); return; }
    if (seduteDelGruppo.some((s) => s.id === sedutaId)) return;
    const oggi = new Date().toISOString().slice(0, 10);
    setSedutaId((seduteDelGruppo.find((s) => s.data === oggi) || seduteDelGruppo[0]).id);
  }, [seduteDelGruppo, sedutaId]);

  const seduta = sedute.find((s) => s.id === sedutaId);
  const oggiIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!sedutaId) return;
    api.leggiPresenze(sedutaId)
      .then((righe) => setStati(Object.fromEntries(righe.map((r) => [r.atleta_id, r.stato]))))
      .catch((e) => setMessaggio(e.message));
  }, [sedutaId]);

  useEffect(() => {
    if (!seduta) return;
    api.leggiBenessere(societa.id, seduta.data)
      .then((righe) => setProntezza(Object.fromEntries(righe.map((r) => [r.atleta_id, Number(r.prontezza)]))))
      .catch(() => setProntezza({}));
  }, [seduta?.data, societa.id]);

  // Filtri: Tutti più i raggruppamenti che hanno davvero qualcuno dentro.
  const categoriaDi = (a) => categoriaAtleta(a, fasce);
  const gruppiConAtleti = useMemo(() => {
    const presenti = new Set(atleti.map(categoriaDi).filter(Boolean));
    return RAGGRUPPAMENTI.filter((r) => r.codici.some((c) => presenti.has(c)));
  }, [atleti, fasce]);

  const visibili = useMemo(() => {
    if (filtro === 'tutti') return atleti;
    const r = RAGGRUPPAMENTI.find((x) => x.nome === filtro);
    if (!r) return atleti;
    return atleti.filter((a) => r.codici.includes(categoriaDi(a)));
  }, [atleti, filtro, fasce]);

  async function segna(atletaId, codice) {
    const prossimo = stati[atletaId] === codice ? null : codice;  // ritocca = annulla
    setStati((s) => ({ ...s, [atletaId]: prossimo }));
    try {
      await api.segnaPresenza({ sedutaId, atletaId, societaId: societa.id, stato: prossimo });
      setMessaggio(null);
      api.leggiFrequenza(societa.id)
        .then((f) => setFrequenza(Object.fromEntries(f.map((x) => [x.atleta_id, x]))))
        .catch(() => {});
    } catch (e) { setMessaggio(`Non salvato: ${e.message}`); }
  }

  const rilevati = visibili.filter((a) => stati[a.id]).length;
  const inAcqua = visibili.filter((a) => ['P', 'R'].includes(stati[a.id])).length;

  if (sedute.length === 0) {
    return (
      <div className="scheda">
        <div className="vuoto">
          <h3>Nessuna seduta da appellare</h3>
          <p>L'appello si fa su una seduta. Creane una nella scheda Sedute.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="barra">
        <h1>Appello</h1>
      </div>

      <div className="destinatari" style={{ marginBottom: 10 }}>
        <button className="pastiglia" aria-pressed={filtro === 'tutti'} onClick={() => scegliCategoria('tutti')}>
          {filtro === 'tutti' && <Check size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}Tutti
        </button>
        {gruppiConAtleti.map((r) => (
          <button key={r.nome} className="pastiglia" aria-pressed={filtro === r.nome} onClick={() => scegliCategoria(r.nome)}>
            {filtro === r.nome && <Check size={13} style={{ verticalAlign: -2, marginRight: 5 }} />}{r.nome}
          </button>
        ))}
      </div>

      <div className="barra" style={{ marginBottom: 12 }}>
        {seduteDelGruppo.length === 0 ? (
          <span style={{ color: 'var(--testo-3)', fontSize: 13 }}>
            Nessuna seduta per {filtro === 'tutti' ? 'la squadra' : filtro}: l'appello
            si segna su una seduta, quindi prima creala nella scheda Sedute.
          </span>
        ) : (
          <>
            <select value={sedutaId} onChange={(e) => setSedutaId(e.target.value)} style={{ maxWidth: 320 }}>
              {seduteDelGruppo.map((s) => (
                <option key={s.id} value={s.id}>
                  {dataIt(s.data)}{s.data === oggiIso ? ' · oggi' : ''} · {s.titolo || 'senza titolo'}
                </option>
              ))}
            </select>
            {seduta?.data === oggiIso && (
              <span className="mono" style={{ color: 'var(--menta)', fontSize: 12 }}>seduta di oggi</span>
            )}
          </>
        )}
      </div>

      <div className="barra" style={{ color: 'var(--testo-3)', fontSize: 13 }}>
        <span className="mono">{rilevati}/{visibili.length}</span> rilevati ·
        <span className="mono"> {inAcqua}</span> in acqua
        {rilevati < visibili.length && <span>· chi non tocchi resta “non rilevato”</span>}
      </div>

      {messaggio && <div className="avviso errore" style={{ marginBottom: 12 }}>{messaggio}</div>}

      <div className="scheda">
        <div className="intestazione-appello">
          <span>Atleta</span>
          <span className="cella-stati">Stato</span>
          <span className="cella-freq">Sett.</span>
          <span className="cella-freq">Mese</span>
          <span className="cella-freq">Tot.</span>
          <span className="cella-freq">Rit.</span>
        </div>

        {visibili.map((a) => {
          const stato = stati[a.id] || null;
          const f = frequenza[a.id];
          const p = prontezza[a.id];
          const ps = f ? pct(f.presenti_sett, f.rilevate_sett) : null;
          const pm = f ? pct(f.presenti_mese, f.rilevate_mese) : null;
          const pt = f ? pct(f.presenti_tot, f.rilevate_tot) : null;
          return (
            <div className="riga-appello" key={a.id} data-stato={stato || ''}>
              <span className="nome-appello">
                <b>{a.cognome}</b> {a.nome}
                <span className="sotto-appello">
                  <span className="mono">{categoriaDi(a) || '—'}</span>
                  {p != null && (
                    <span className="mono" style={{ color: p >= 3 ? 'var(--menta)' : 'var(--ambra)' }}>
                      <HeartPulse size={11} style={{ verticalAlign: -1 }} /> {p.toFixed(1)}
                    </span>
                  )}
                </span>
              </span>

              <span className="cella-stati">
                {STATI.map((s) => (
                  <button
                    key={s.codice}
                    className="bottone-stato"
                    aria-pressed={stato === s.codice}
                    disabled={!puoScrivere}
                    title={s.nome}
                    style={stato === s.codice ? { background: s.tinta, borderColor: s.tinta, color: '#06121F' } : undefined}
                    onClick={() => segna(a.id, s.codice)}
                  >
                    {s.breve}
                  </button>
                ))}
              </span>

              <span className="cella-freq mono" style={{ color: tintaPct(ps) }}>
                {ps == null ? '—' : `${ps}%`}
              </span>
              <span className="cella-freq mono" style={{ color: tintaPct(pm) }}>
                {pm == null ? '—' : `${pm}%`}
              </span>
              <span className="cella-freq mono" style={{ color: tintaPct(pt) }}>
                {pt == null ? '—' : `${pt}%`}
              </span>
              <span className="cella-freq mono" style={{ color: f?.ritardi_tot ? 'var(--ciano)' : 'var(--testo-3)' }}>
                {f?.ritardi_tot || 0}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 12 }}>
        La percentuale conta come presenza P, R e G: l'assenza è l'unico stato che la fa scendere.
        La colonna Rit. è il totale dei ritardi, che restano presenze ma si vedono.
      </p>

      {seduta && (
        <ComeAndata
          seduta={seduta}
          puoScrivere={puoScrivere}
          suSalvato={(svolto) => setSedute((tutte) =>
            tutte.map((s) => (s.id === seduta.id ? { ...s, svolto } : s)))}
        />
      )}
    </>
  );
}
