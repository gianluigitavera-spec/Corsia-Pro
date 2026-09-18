import { useMemo, useRef, useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, Plus, Upload, Download, Pencil, Check, X, Archive, Users, Trash2 } from 'lucide-react';
import * as api from '../lib/dati';
import {
  SPECIALIZZAZIONI, CATEGORIE, categoriaAtleta, chiaveAtleta, categoriaDaCsv,
  categoriaDi, etichettaCategoria, sospettiImport,
} from '../lib/dominio';

const VUOTO = { nome: '', cognome: '', sesso: 'M', anno_nascita: '', specializzazione: 'Generale' };

// "Rossi Mario" trova anche chi ha scritto "mario rossi"
const combacia = (a, q) => {
  const testo = `${a.cognome} ${a.nome} ${a.anno_nascita} ${a.specializzazione}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((p) => testo.includes(p));
};

// Elenca i nomi per esteso fino a dieci, poi conta gli altri: serve a
// vedere chi, non solo quanti, senza riempire lo schermo.
const elenco = (nomi, quanti = 10) =>
  nomi.length <= quanti
    ? nomi.join(', ')
    : `${nomi.slice(0, quanti).join(', ')} e altri ${nomi.length - quanti}`;

export default function Atleti({ societa, fasce, stagione, proiezione, puoScrivere, codiciGruppi }) {
  const [atleti, setAtleti] = useState([]);
  const [cerca, setCerca] = useState('');
  const [nuovo, setNuovo] = useState(VUOTO);
  const [mostraNuovo, setMostraNuovo] = useState(false);
  const [inModifica, setInModifica] = useState(null); // {id, ...campi}
  const [messaggio, setMessaggio] = useState(null);
  const [selezione, setSelezione] = useState(() => new Set());
  const [inCorso, setInCorso] = useState(false);
  // Import in attesa di una decisione: { righe, scarti, esistenti, sospetti }
  const [daConfermare, setDaConfermare] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { ricarica(); }, [societa.id]);

  async function ricarica() {
    try {
      setAtleti(await api.leggiAtleti(societa.id));
      setSelezione(new Set());
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  // Prima il gruppo scelto in testata, poi la ricerca. Chi allena gli
  // Esordienti A vede solo loro, e "seleziona tutti" prende loro.
  const visibili = useMemo(() => {
    const delGruppo = codiciGruppi
      ? atleti.filter((a) => codiciGruppi.includes(categoriaAtleta(a, fasce)))
      : atleti;
    return cerca.trim() ? delGruppo.filter((a) => combacia(a, cerca.trim())) : delGruppo;
  }, [atleti, cerca, codiciGruppi, fasce]);

  async function aggiungi() {
    try {
      await api.salvaAtleta({
        societa_id: societa.id,
        nome: nuovo.nome.trim(),
        cognome: nuovo.cognome.trim(),
        sesso: nuovo.sesso,
        anno_nascita: Number(nuovo.anno_nascita),
        specializzazione: nuovo.specializzazione,
      });
      setNuovo(VUOTO);
      setMostraNuovo(false);
      setMessaggio(null);
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  async function salvaModifica() {
    try {
      await api.salvaAtleta({
        id: inModifica.id,
        nome: inModifica.nome.trim(),
        cognome: inModifica.cognome.trim(),
        sesso: inModifica.sesso,
        anno_nascita: Number(inModifica.anno_nascita),
        specializzazione: inModifica.specializzazione,
        // Sempre sull'override, mai sul derivato: null vuol dire
        // "ricalcolalo dall'anno", e null va scritto per davvero.
        categoria_override: inModifica.categoria_override || null,
      });
      setInModifica(null);
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  // ----------------------------------------------------------- selezione
  const selezionati = useMemo(() => visibili.filter((a) => selezione.has(a.id)), [visibili, selezione]);
  const tuttiScelti = visibili.length > 0 && selezionati.length === visibili.length;

  function commuta(id) {
    setSelezione((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Prende o lascia solo quelli che stai vedendo: con la ricerca attiva
  // "tutti" vuol dire tutti i trovati, non tutta la squadra.
  function commutaTuttiVisibili() {
    setSelezione(tuttiScelti ? new Set() : new Set(visibili.map((a) => a.id)));
  }

  async function inMassa(campi, descrizione) {
    const ids = selezionati.map((a) => a.id);
    if (!ids.length) return;
    setInCorso(true);
    try {
      await api.aggiornaAtleti(ids, campi);
      setMessaggio({ tipo: 'ok', testo: `${ids.length} atleti: ${descrizione}.` });
      await ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
    finally { setInCorso(false); }
  }

  async function archiviaInMassa() {
    const ids = selezionati.map((a) => a.id);
    if (!ids.length) return;
    if (!confirm(`Archiviare ${ids.length} atleti? Spariscono dagli elenchi ma lo storico resta.`)) return;
    setInCorso(true);
    try {
      await api.archiviaAtleti(ids);
      setMessaggio({ tipo: 'ok', testo: `${ids.length} atleti archiviati.` });
      await ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
    finally { setInCorso(false); }
  }

  // Cancellazione vera, per i doppioni entrati con un import sbagliato.
  // Chi ha presenze o benessere alle spalle non si tocca: lo dice dopo.
  async function eliminaInMassa() {
    const ids = selezionati.map((a) => a.id);
    if (!ids.length) return;
    if (!confirm(
      `Cancellare per sempre ${ids.length} atleti?\n\n`
      + 'Serve per i doppioni di un import sbagliato. Chi ha già presenze o '
      + 'questionari benessere non verrà cancellato: per quelli usa Archivia.'
    )) return;
    setInCorso(true);
    try {
      const { eliminati, trattenuti } = await api.eliminaAtleti(ids);
      const nomi = atleti.filter((a) => trattenuti.includes(a.id))
        .map((a) => `${a.cognome} ${a.nome}`);
      setMessaggio({
        tipo: trattenuti.length ? 'errore' : 'ok',
        testo: `${eliminati.length} atleti cancellati.`
          + (trattenuti.length
            ? ` ${trattenuti.length} lasciati dov'erano perché hanno già uno storico: ${elenco(nomi)}. Per quelli usa Archivia.`
            : ''),
      });
      await ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
    finally { setInCorso(false); }
  }

  // L'intestazione del modello è parlante — "categoria (vuoto=dall'anno,
  // MAS, TRI, TEEN_2...)" — e con header:true Papa userebbe quella
  // stringa intera come nome del campo: r.categoria diventerebbe
  // undefined e ogni categoria del foglio verrebbe ignorata in silenzio.
  // Qui si taglia via la parte fra parentesi e si normalizza, così il
  // modello nuovo, quello vecchio e un foglio scritto a mano con
  // "Categoria" o "ANNO_NASCITA" entrano tutti dalla stessa porta.
  const intestazionePulita = (h) =>
    String(h || '').split('(')[0].trim().toLowerCase().replace(/\s+/g, '_');

  function importaCsv(file) {
    Papa.parse(file, {
      header: true,
      transformHeader: intestazionePulita,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const righe = [];
        const scarti = [];
        data.forEach((r, i) => {
          const anno = Number(r.anno_nascita ?? r.anno);
          const sesso = String(r.sesso || '').trim().toUpperCase();
          if (!r.nome || !r.cognome || !anno || !['M', 'F'].includes(sesso)) {
            scarti.push(`riga ${i + 2}`);
            return;
          }
          const spec = String(r.specializzazione || 'Generale').trim();
          // La colonna categoria comanda: Teen, Master, Propaganda e
          // Triathlon non si ricavano dall'età, sono percorsi. Se è
          // vuota resta vuota, a qualsiasi età: decide il calcolo per
          // età, e l'override non si scrive.
          const override = categoriaDaCsv(r.categoria);
          righe.push({
            societa_id: societa.id,
            nome: String(r.nome).trim(),
            cognome: String(r.cognome).trim(),
            sesso,
            anno_nascita: anno,
            specializzazione: SPECIALIZZAZIONI.includes(spec) ? spec : 'Generale',
            categoria_override: override.codice,
          });
        });

        if (righe.length === 0) {
          setMessaggio({
            tipo: 'errore',
            testo: 'Nessuna riga valida. Servono le colonne nome, cognome, sesso, anno_nascita: '
              + 'scarica il modello qui sopra e compila quello.',
          });
          return;
        }

        // Il controllo si fa PRIMA di salvare. Un avviso dopo direbbe
        // cosa è già finito in archivio, e per rimediare bisognerebbe
        // ricordarsi di tornare a sistemare a mano.
        try {
          const esistenti = await api.leggiAtletiTutti(societa.id);
          const sospetti = sospettiImport(righe, esistenti, fasce);
          if (sospetti.length) {
            setDaConfermare({ righe, scarti, esistenti, sospetti });
            return;
          }
          await eseguiImport(righe, scarti, esistenti);
        } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
      },
    });
  }

  // Il salvataggio vero. Sta fuori dal lettore del file perché ci si
  // arriva da due strade: nessun sospetto, oppure l'allenatore ha
  // guardato l'elenco e ha scelto come procedere.
  async function eseguiImport(righe, scarti, esistenti) {
    setInCorso(true);
    try {
      // Chi c'è già, archiviati compresi: la chiave la calcola dominio.js,
      // la stessa che difende il database. Chi combacia non entra.
      const gia = new Map(esistenti.map((a) => [chiaveAtleta(a), a]));

      const nuovi = [];
      const daCorreggere = [];
      const doppiNelFoglio = [];
      const doppiInSquadra = [];
      const visteQui = new Set();

      righe.forEach((r) => {
        const k = chiaveAtleta(r);
        const nome = `${r.cognome} ${r.nome} ${r.anno_nascita}`;
        if (visteQui.has(k)) { doppiNelFoglio.push(nome); return; }
        visteQui.add(k);
        const vecchio = gia.get(k);
        if (vecchio) {
          doppiInSquadra.push(nome + (vecchio.attivo ? '' : ' (in archivio)'));
          // Non lo reinserisco, ma se il foglio dice una categoria e
          // quella salvata è diversa, quella la aggiorno: se no i Teen
          // e i Master importati da un foglio nuovo restano per sempre
          // nel gruppo che il calcolo per età gli aveva dato.
          if (r.categoria_override && vecchio.categoria_override !== r.categoria_override) {
            daCorreggere.push({ id: vecchio.id, codice: r.categoria_override, nome });
          }
          return;
        }
        nuovi.push(r);
      });

      await api.importaAtleti(nuovi);

      // Chi c'era già non viene reinserito, ma la sua categoria manuale
      // sì: è il caso dei Teen e dei Master importati prima che il
      // modello avesse la colonna categoria.
      const daSistemare = righe
        .filter((r) => gia.has(chiaveAtleta(r)) && r.categoria_override)
        .map((r) => ({ atleta: r, categoria: r.categoria_override }));
      const sistemati = daSistemare.length
        ? await api.aggiornaCategorieDaCsv(societa.id, daSistemare)
        : { aggiornati: [] };

      // Le correzioni di categoria, raggruppate per codice: una
      // chiamata per gruppo, non una per atleta.
      for (const codice of [...new Set(daCorreggere.map((x) => x.codice))]) {
        const ids = daCorreggere.filter((x) => x.codice === codice).map((x) => x.id);
        await api.aggiornaAtleti(ids, { categoria_override: codice });
      }

      const parti = [`Importati ${nuovi.length} atleti.`];
      if (doppiInSquadra.length) {
        parti.push(`${doppiInSquadra.length} erano già in squadra e non sono stati reinseriti: ${elenco(doppiInSquadra)}.`);
      }
      if (sistemati.aggiornati.length) {
        parti.push(`A ${sistemati.aggiornati.length} di loro è stata aggiornata la categoria dal foglio.`);
      }
      if (daCorreggere.length) {
        parti.push(`${daCorreggere.length} già in squadra hanno preso la categoria del foglio: ${elenco(daCorreggere.map((x) => x.nome))}.`);
      }
      if (doppiNelFoglio.length) {
        parti.push(`${doppiNelFoglio.length} comparivano due volte nel foglio: ${elenco(doppiNelFoglio)}.`);
      }
      if (scarti.length) {
        parti.push(`Saltate ${scarti.length} righe incomplete: ${elenco(scarti, 5)}.`);
      }
      setMessaggio({
        tipo: nuovi.length ? 'ok' : 'errore',
        testo: parti.join(' '),
      });
      setDaConfermare(null);
      await ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
    finally { setInCorso(false); }
  }

  const completo = nuovo.nome && nuovo.cognome && Number(nuovo.anno_nascita) > 1900;

  // Modello da compilare in Excel o Fogli Google. Le righe di esempio si
  // cancellano: servono a far vedere come si scrive, e soprattutto che
  // la colonna categoria si lascia VUOTA per gli agonisti — è il caso
  // più frequente ed è quello che si sbaglia.
  //
  // L'intestazione della categoria è parlante e sta fra virgolette
  // perché contiene virgole. Le istruzioni stanno lì e non in un foglio
  // a parte: un foglio di istruzioni separato non lo apre nessuno, e
  // chi compila guarda l'intestazione della colonna che ha davanti.
  // La legge `intestazionePulita` qui sopra, che taglia la parentesi.
  function scaricaModello() {
    const righe = [
      'nome,cognome,sesso,anno_nascita,specializzazione,'
        + '"categoria (vuoto=dall\'anno, MAS, TRI, TEEN_2...)"',
      'Mario,Rossi,M,2013,Velocità,',
      'Anna,Verdi,F,1988,Generale,MAS',
      'Sara,Conti,F,2001,Fondo,TRI',
    ];
    // Il BOM serve a Excel per leggere le lettere accentate.
    const testo = '\ufeff' + righe.join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([testo], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modello_atleti_corsiapro.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="barra">
        <h1>Atleti</h1>
        <span className="mono" style={{ color: 'var(--testo-3)' }}>
          {cerca ? `${visibili.length}/${atleti.length}` : atleti.length}
        </span>
        <div className="cerca">
          <Search size={16} />
          <input
            placeholder="Cerca atleta…"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            aria-label="Cerca atleta"
          />
        </div>
        <div style={{ flex: 1 }} />
        {puoScrivere && (
          <>
            <button className="azione" onClick={() => setMostraNuovo(!mostraNuovo)}>
              <Plus size={16} style={{ verticalAlign: -3 }} /> Atleta
            </button>
            <button className="azione fantasma" onClick={() => fileRef.current?.click()}>
              <Upload size={15} style={{ verticalAlign: -3 }} /> Importa CSV
            </button>
            <button className="mini" onClick={scaricaModello} title="Scarica il modello CSV vuoto">
              <Download size={14} style={{ verticalAlign: -2 }} /> Modello
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => e.target.files?.[0] && importaCsv(e.target.files[0])} />
          </>
        )}
      </div>

      {messaggio && (
        <div className={`avviso ${messaggio.tipo === 'errore' ? 'errore' : ''}`} style={{ marginBottom: 12 }}>
          {messaggio.testo}
        </div>
      )}

      {/* PRIMA di salvare: cosa vale la pena rileggere. Non blocca —
          l'import deve poter procedere — ma mette l'elenco davanti
          quando ancora si può cambiare idea. */}
      {daConfermare && (
        <div className="scheda" style={{ marginBottom: 12, borderColor: 'var(--ambra)' }}>
          <div className="intestazione">
            <b style={{ color: 'var(--ambra)' }}>Da rileggere prima di importare</b>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>
              {daConfermare.righe.length} righe nel foglio
            </span>
          </div>
          <div className="corpo">
            {(() => {
              const per = (t) => daConfermare.sospetti.filter((s) => s.tipo === t);
              const mas = per('mas_fuori_fascia');
              const tri = per('tri');
              const cambi = per('cambia_override');
              return (
                <>
                  {mas.length > 0 && (
                    <p style={{ marginTop: 0 }}>
                      <b>{mas.length} atleti marcati MAS ricadrebbero in categorie agonistiche</b>:{' '}
                      {mas.map((s) => `${s.nome} → ${s.derivato || 'nessuna fascia'}`).join(', ')}.
                      {' '}MAS va solo ai tesserati Master FIN, non agli adulti.
                    </p>
                  )}
                  {tri.length > 0 && (
                    <p>
                      <b>{tri.length} atleti marcati TRI</b>: {tri.map((s) => s.nome).join(', ')}.
                      {' '}Sono elencati sempre: il gruppo è piccolo e vale la pena rileggerlo.
                    </p>
                  )}
                  {cambi.length > 0 && (
                    <p>
                      <b>{cambi.length} già in squadra cambiano categoria fissata a mano</b>:{' '}
                      {cambi.map((s) => `${s.nome}: ${s.perdeva} → ${s.diventa}`).join(', ')}.
                    </p>
                  )}
                </>
              );
            })()}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
              <button className="azione" disabled={inCorso}
                onClick={() => eseguiImport(daConfermare.righe, daConfermare.scarti, daConfermare.esistenti)}>
                Importa comunque
              </button>
              <button className="azione fantasma" disabled={inCorso}
                onClick={() => {
                  const segnalate = new Set(daConfermare.sospetti.map((s) => s.chiave));
                  const tenute = daConfermare.righe.filter((r) => !segnalate.has(chiaveAtleta(r)));
                  eseguiImport(tenute, daConfermare.scarti, daConfermare.esistenti);
                }}>
                Salta le righe segnalate
                {' '}({new Set(daConfermare.sospetti.map((s) => s.chiave)).size})
              </button>
              <div style={{ flex: 1 }} />
              <button className="mini" disabled={inCorso} onClick={() => setDaConfermare(null)}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {fasce.length === 0 ? (
        <div className="avviso" style={{ marginBottom: 12 }}>
          Nessuna fascia d'età inserita in <span className="mono">squadra.categorie_stagione</span>:
          senza quella la colonna Categoria resta vuota. Si compila una stagione sola, le altre
          si ricavano da sé.
        </div>
      ) : proiezione ? (
        <div className="avviso" style={{ marginBottom: 12 }}>
          Categorie della stagione <b>{stagione}</b> ricavate da quelle del {proiezione.base},
          spostando gli anni di {proiezione.scarto > 0 ? '+' : ''}{proiezione.scarto}.
          Se la FIN cambia le fasce, inserisci la stagione vera e questa proiezione sparisce.
        </div>
      ) : null}

      {puoScrivere && mostraNuovo && (
        <div className="scheda" style={{ marginBottom: 12 }}>
          <div className="corpo" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', alignItems: 'end' }}>
            <div className="campo"><label>Nome</label>
              <input value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} /></div>
            <div className="campo"><label>Cognome</label>
              <input value={nuovo.cognome} onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })} /></div>
            <div className="campo"><label>Sesso</label>
              <select value={nuovo.sesso} onChange={(e) => setNuovo({ ...nuovo, sesso: e.target.value })}>
                <option value="M">M</option><option value="F">F</option>
              </select></div>
            <div className="campo"><label>Anno</label>
              <input className="mono" type="number" inputMode="numeric" value={nuovo.anno_nascita}
                onChange={(e) => setNuovo({ ...nuovo, anno_nascita: e.target.value })} /></div>
            <div className="campo"><label>Specializzazione</label>
              <select value={nuovo.specializzazione} onChange={(e) => setNuovo({ ...nuovo, specializzazione: e.target.value })}>
                {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <button className="azione" onClick={aggiungi} disabled={!completo}>Aggiungi</button>
          </div>
        </div>
      )}

      {puoScrivere && selezionati.length > 0 && (
        <div className="scheda" style={{ marginBottom: 12, borderColor: 'var(--ciano)' }}>
          <div className="corpo" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <b className="mono" style={{ color: 'var(--ciano)' }}>{selezionati.length} selezionati</b>

            <select disabled={inCorso} value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                inMassa(
                  { categoria_override: v === 'auto' ? null : v },
                  v === 'auto' ? 'categoria di nuovo calcolata dall\'età' : `categoria fissata a ${v}`
                );
              }}>
              <option value="">Categoria…</option>
              <option value="auto">Torna al calcolo per età</option>
              {CATEGORIE.map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
            </select>

            <select disabled={inCorso} value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) inMassa({ specializzazione: v }, `specializzazione ${v}`);
              }}>
              <option value="">Specializzazione…</option>
              {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className="azione fantasma" disabled={inCorso} onClick={archiviaInMassa}>
              <Archive size={15} style={{ verticalAlign: -3 }} /> Archivia
            </button>
            <button className="mini" disabled={inCorso} onClick={eliminaInMassa}
              title="Solo per i doppioni: chi ha uno storico non viene cancellato">
              <Trash2 size={14} style={{ verticalAlign: -2 }} /> Cancella
            </button>

            <div style={{ flex: 1 }} />
            <button className="mini" onClick={() => setSelezione(new Set())}>Deseleziona</button>
          </div>
        </div>
      )}

      <div className="scheda">
        {visibili.length === 0 ? (
          <div className="vuoto">
            <Users size={30} style={{ color: 'var(--testo-3)' }} />
            <h3 style={{ marginTop: 10 }}>{cerca ? 'Nessun risultato' : 'Squadra vuota'}</h3>
            <p>
              {cerca
                ? 'Prova con il cognome, o con l\'anno di nascita.'
                : 'Aggiungi il primo atleta, oppure scarica il modello CSV, compilalo e ricaricalo.'}
            </p>
            {!cerca && puoScrivere && (
              <button className="azione fantasma" onClick={scaricaModello}>
                <Download size={15} style={{ verticalAlign: -3 }} /> Scarica il modello
              </button>
            )}
          </div>
        ) : (
          <table className="tabella-atleti">
            <thead>
              <tr>
                {puoScrivere && (
                  <th style={{ width: 34 }}>
                    <input type="checkbox" checked={tuttiScelti} onChange={commutaTuttiVisibili}
                      aria-label="Seleziona tutti quelli che vedi" />
                  </th>
                )}
                <th>Atleta</th><th className="col-stretta">Sesso</th>
                <th className="col-stretta">Anno</th><th>Categoria</th>
                <th>Specializzazione</th>{puoScrivere && <th />}
              </tr>
            </thead>
            <tbody>
              {visibili.map((a) => {
                const m = inModifica?.id === a.id ? inModifica : null;
                if (m) {
                  return (
                    <tr key={a.id}>
                      {puoScrivere && <td />}
                      <td style={{ display: 'flex', gap: 6 }}>
                        <input style={{ width: '48%' }} value={m.cognome} placeholder="Cognome"
                          onChange={(e) => setInModifica({ ...m, cognome: e.target.value })} />
                        <input style={{ width: '48%' }} value={m.nome} placeholder="Nome"
                          onChange={(e) => setInModifica({ ...m, nome: e.target.value })} />
                      </td>
                      <td>
                        <select value={m.sesso} onChange={(e) => setInModifica({ ...m, sesso: e.target.value })}>
                          <option value="M">M</option><option value="F">F</option>
                        </select>
                      </td>
                      <td>
                        <input className="mono" style={{ width: 80 }} type="number" value={m.anno_nascita}
                          onChange={(e) => setInModifica({ ...m, anno_nascita: e.target.value })} />
                      </td>
                      {/* La categoria si SCEGLIE, e quello che si scrive
                          è sempre categoria_override: il derivato non si
                          tocca, si ricalcola da sé. "— (dall'anno)" lo
                          riporta a null, cioè lascia decidere all'età. */}
                      <td>
                        <select
                          value={m.categoria_override || ''}
                          onChange={(e) => setInModifica({ ...m, categoria_override: e.target.value || null })}
                          aria-label="Categoria">
                          <option value="">
                            — (dall'anno{(() => {
                              const d = categoriaDi(Number(m.anno_nascita), m.sesso, fasce);
                              return d ? `: ${d}` : '';
                            })()})
                          </option>
                          {CATEGORIE.map((c) => <option key={c.codice} value={c.codice}>{c.nome}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={m.specializzazione} onChange={(e) => setInModifica({ ...m, specializzazione: e.target.value })}>
                          {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="mini" onClick={() => setInModifica(null)} aria-label="Annulla"><X size={14} /></button>{' '}
                        <button className="azione" style={{ padding: '7px 12px', minHeight: 34 }} onClick={salvaModifica} aria-label="Salva">
                          <Check size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={a.id} className={selezione.has(a.id) ? 'scelta' : undefined}>
                    {puoScrivere && (
                      <td>
                        <input type="checkbox" checked={selezione.has(a.id)}
                          onChange={() => commuta(a.id)}
                          aria-label={`Seleziona ${a.cognome} ${a.nome}`} />
                      </td>
                    )}
                    <td><b>{a.cognome}</b> {a.nome}</td>
                    <td className="col-stretta" style={{ color: 'var(--testo-3)' }}>{a.sesso}</td>
                    <td className="mono col-stretta">{a.anno_nascita}</td>
                    {/* Con un override attivo, accanto va il derivato
                        dall'età: "Master (SEN_1)". Serve a sapere dove
                        ricade l'atleta PRIMA di azzerarglielo. */}
                    <td className="mono">
                      {(() => {
                        const e = etichettaCategoria(a, fasce);
                        if (!e.testo) return <span style={{ color: 'var(--ciano)' }}>—</span>;
                        return (
                          <>
                            <span style={{ color: 'var(--ciano)' }}>{e.testo}</span>
                            {e.derivato && (
                              <span style={{ color: 'var(--testo-3)' }} title="Dove ricadrebbe per età, senza la categoria fissata a mano">
                                {' '}({e.derivato})
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td>{a.specializzazione}</td>
                    {puoScrivere && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="mini" aria-label="Modifica"
                          onClick={() => setInModifica({
                            id: a.id, nome: a.nome, cognome: a.cognome, sesso: a.sesso,
                            anno_nascita: a.anno_nascita, specializzazione: a.specializzazione,
                            categoria_override: a.categoria_override || null,
                          })}>
                          <Pencil size={14} />
                        </button>{' '}
                        <button className="mini" aria-label="Archivia"
                          onClick={async () => {
                            if (!confirm(`Archiviare ${a.cognome} ${a.nome}? Sparisce dagli elenchi ma lo storico resta.`)) return;
                            await api.archiviaAtleta(a.id);
                            ricarica();
                          }}>
                          <Archive size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
