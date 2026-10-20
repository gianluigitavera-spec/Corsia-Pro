import { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Check } from 'lucide-react';
import * as api from '../lib/dati';
import ComeAndata from './ComeAndata';
import {
  categoriaAtleta, dataIt, sedutaNelGruppo, atletaNelGruppo, frequenzaAppello, periodoFrequenza,
} from '../lib/dominio';

// Quattro stati. In Sett. e Mese (frequenzaAppello in dominio.js) il
// ritardo è una presenza, l'assenza no, e il giustificato non entra nel
// conto. Tot. viene da v_frequenza, che conta con le stesse regole dalla
// migrazione 034 — da eseguire il giorno del rilascio: prima di allora
// Tot. conta ancora G fra i presenti.
// Il ritardo si conta anche a parte, nella colonna Rit.

// La data di oggi sul telefono. toISOString è in UTC: fra mezzanotte e
// le due, in Italia, direbbe ancora ieri — e il lunedì appena passata la
// mezzanotte la settimana sarebbe quella di prima.
const oggiQui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
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

export default function Appello({ societa, fasce, puoScrivere, codiciGruppi }) {
  const [sedute, setSedute] = useState([]);
  const [sedutaId, setSedutaId] = useState('');
  const [atleti, setAtleti] = useState([]);
  const [stati, setStati] = useState({});
  const [prontezza, setProntezza] = useState({});
  const [frequenza, setFrequenza] = useState({});
  // Le presenze della settimana e del mese, per Sett. e Mese.
  const [presenzePeriodo, setPresenzePeriodo] = useState([]);
  const [messaggio, setMessaggio] = useState(null);
  const oggiFrequenza = oggiQui();

  useEffect(() => {
    (async () => {
      try {
        const { da, a: al } = periodoFrequenza(oggiQui());
        // Le presenze del periodo vanno per conto loro: se la lettura
        // fallisce l'appello si fa lo stesso, e il messaggio lo dice —
        // un "—" muto sembrerebbe "nessun appello".
        const [s, a, f, pp] = await Promise.all([
          api.leggiSedute(societa.id), api.leggiAtleti(societa.id), api.leggiFrequenza(societa.id),
          api.leggiPresenzePeriodo(societa.id, da, al).catch(() => null),
        ]);
        setSedute(s);
        setAtleti(a);
        setFrequenza(Object.fromEntries(f.map((x) => [x.atleta_id, x])));
        setPresenzePeriodo(pp || []);
        if (!pp) setMessaggio('Percentuali di Sett. e Mese non lette: riprova riaprendo l’Appello.');
      } catch (e) { setMessaggio(e.message); }
    })();
  }, [societa.id]);

  const frequenzaPeriodo = useMemo(
    () => frequenzaAppello(presenzePeriodo, oggiFrequenza),
    [presenzePeriodo, oggiFrequenza],
  );

  // Solo le sedute della categoria scelta: se alleni gli Esordienti A non
  // devi scorrere quelle dei Ragazzi per trovare la tua.
  const seduteDelGruppo = useMemo(
    () => sedute.filter((s) => sedutaNelGruppo(s, codiciGruppi)),
    [sedute, codiciGruppi],
  );

  // Scelta da sola: quella di oggi se c'è, se no la più recente. Solo
  // quando quella corrente non appartiene più al gruppo scelto, così non
  // ti scippa la seduta che stavi guardando.
  useEffect(() => {
    if (!seduteDelGruppo.length) { setSedutaId(''); return; }
    if (seduteDelGruppo.some((s) => s.id === sedutaId)) return;
    const oggi = oggiQui();
    setSedutaId((seduteDelGruppo.find((s) => s.data === oggi) || seduteDelGruppo[0]).id);
  }, [seduteDelGruppo, sedutaId]);

  const seduta = sedute.find((s) => s.id === sedutaId);
  const oggiIso = oggiQui();

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

  // La categoria non si sceglie più qui: arriva dalla testata e vale per
  // tutte le schede.
  const categoriaDi = (a) => categoriaAtleta(a, fasce);

  const visibili = useMemo(() => {
    // Seduta per pochi atleti (doppia): l'elenco esplicito vince e ignora
    // il filtro per categoria di testata, così chi non c'è non entra né
    // nell'appello né nel suo denominatore di frequenza.
    if (seduta?.atleti?.length) {
      return atleti.filter((a) => seduta.atleti.includes(a.id));
    }
    return atleti.filter((a) => atletaNelGruppo(a, codiciGruppi, fasce));
  }, [atleti, codiciGruppi, fasce, seduta?.atleti]);

  async function segna(atletaId, codice) {
    const prossimo = stati[atletaId] === codice ? null : codice;  // ritocca = annulla
    setStati((s) => ({ ...s, [atletaId]: prossimo }));
    try {
      await api.segnaPresenza({ sedutaId, atletaId, societaId: societa.id, stato: prossimo });
      setMessaggio(null);
      // Sett. e Mese si rifanno qui, senza rileggere: la riga di questa
      // seduta si sostituisce (o se ne va, se lo stato è stato tolto), e
      // frequenzaAppello guarda da sé se la data cade nel periodo.
      setPresenzePeriodo((tutte) => [
        ...tutte.filter((x) => !(x.seduta_id === sedutaId && x.atleta_id === atletaId)),
        ...(prossimo && seduta ? [{ seduta_id: sedutaId, atleta_id: atletaId, stato: prossimo, data: seduta.data }] : []),
      ]);
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

      <div className="barra" style={{ marginBottom: 12 }}>
        {seduteDelGruppo.length === 0 ? (
          <span style={{ color: 'var(--testo-3)', fontSize: 13 }}>
            Nessuna seduta per la categoria scelta in testata: l'appello si segna
            su una seduta, quindi prima creala nella scheda Sedute.
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
          const ps = frequenzaPeriodo[a.id]?.sett.pct ?? null;
          const pm = frequenzaPeriodo[a.id]?.mese.pct ?? null;
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
        Presenti e ritardi su presenti, ritardi e assenti: il giustificato non entra nel conto,
        e senza nessun appello la percentuale è «—». La settimana riparte ogni lunedì, il mese è
        quello del calendario, Tot. è tutto lo storico. La colonna Rit. è il totale dei ritardi,
        che restano presenze ma si vedono.
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
