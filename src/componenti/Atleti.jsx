import { useMemo, useRef, useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, Plus, Upload, Pencil, Check, X, Archive, Users } from 'lucide-react';
import * as api from '../lib/dati';
import { SPECIALIZZAZIONI, categoriaAtleta } from '../lib/dominio';

const VUOTO = { nome: '', cognome: '', sesso: 'M', anno_nascita: '', specializzazione: 'Generale' };

// "Rossi Mario" trova anche chi ha scritto "mario rossi"
const combacia = (a, q) => {
  const testo = `${a.cognome} ${a.nome} ${a.anno_nascita} ${a.specializzazione}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((p) => testo.includes(p));
};

export default function Atleti({ societa, fasce, stagione, puoScrivere, gruppi }) {
  const [atleti, setAtleti] = useState([]);
  const [cerca, setCerca] = useState('');
  const [nuovo, setNuovo] = useState(VUOTO);
  const [mostraNuovo, setMostraNuovo] = useState(false);
  const [inModifica, setInModifica] = useState(null); // {id, ...campi}
  const [messaggio, setMessaggio] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { ricarica(); }, [societa.id]);

  async function ricarica() {
    try { setAtleti(await api.leggiAtleti(societa.id)); }
    catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  const visibili = useMemo(
    () => (cerca.trim() ? atleti.filter((a) => combacia(a, cerca.trim())) : atleti),
    [atleti, cerca]
  );

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
        gruppo_id: inModifica.gruppo_id || null,
      });
      setInModifica(null);
      ricarica();
    } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
  }

  function importaCsv(file) {
    Papa.parse(file, {
      header: true,
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
          righe.push({
            societa_id: societa.id,
            nome: String(r.nome).trim(),
            cognome: String(r.cognome).trim(),
            sesso,
            anno_nascita: anno,
            specializzazione: SPECIALIZZAZIONI.includes(spec) ? spec : 'Generale',
          });
        });

        if (righe.length === 0) {
          setMessaggio({ tipo: 'errore', testo: 'Nessuna riga valida. Servono le colonne nome, cognome, sesso, anno_nascita.' });
          return;
        }
        try {
          await api.importaAtleti(righe);
          setMessaggio({
            tipo: 'ok',
            testo: `Importati ${righe.length} atleti${scarti.length ? `. Saltate ${scarti.length} righe incomplete: ${scarti.slice(0, 5).join(', ')}` : '.'}`,
          });
          ricarica();
        } catch (e) { setMessaggio({ tipo: 'errore', testo: e.message }); }
      },
    });
  }

  const completo = nuovo.nome && nuovo.cognome && Number(nuovo.anno_nascita) > 1900;

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
              <Upload size={15} style={{ verticalAlign: -3 }} /> CSV
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

      {fasce.length === 0 && (
        <div className="avviso" style={{ marginBottom: 12 }}>
          Le fasce d'età della stagione {stagione} non sono ancora inserite, quindi la colonna Categoria resta vuota.
          Si compila una volta sola in <span className="mono">squadra.categorie_stagione</span>.
        </div>
      )}

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

      <div className="scheda">
        {visibili.length === 0 ? (
          <div className="vuoto">
            <Users size={30} style={{ color: 'var(--testo-3)' }} />
            <h3 style={{ marginTop: 10 }}>{cerca ? 'Nessun risultato' : 'Squadra vuota'}</h3>
            <p>
              {cerca
                ? 'Prova con il cognome, o con l\'anno di nascita.'
                : 'Aggiungi il primo atleta, oppure carica il CSV con nome, cognome, sesso, anno_nascita.'}
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Atleta</th><th>Sesso</th><th>Anno</th><th>Categoria</th>
                <th>Specializzazione</th><th>Gruppo</th>{puoScrivere && <th />}
              </tr>
            </thead>
            <tbody>
              {visibili.map((a) => {
                const m = inModifica?.id === a.id ? inModifica : null;
                if (m) {
                  return (
                    <tr key={a.id}>
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
                      <td className="mono" style={{ color: 'var(--testo-3)' }}>
                        {categoriaAtleta({ ...m, anno_nascita: Number(m.anno_nascita) }, fasce) || '—'}
                      </td>
                      <td>
                        <select value={m.specializzazione} onChange={(e) => setInModifica({ ...m, specializzazione: e.target.value })}>
                          {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={m.gruppo_id || ''} onChange={(e) => setInModifica({ ...m, gruppo_id: e.target.value })}>
                          <option value="">—</option>
                          {(gruppi || []).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
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
                  <tr key={a.id}>
                    <td><b>{a.cognome}</b> {a.nome}</td>
                    <td style={{ color: 'var(--testo-3)' }}>{a.sesso}</td>
                    <td className="mono">{a.anno_nascita}</td>
                    <td className="mono" style={{ color: 'var(--ciano)' }}>{categoriaAtleta(a, fasce) || '—'}</td>
                    <td>{a.specializzazione}</td>
                    <td style={{ color: 'var(--testo-3)' }}>
                      {(gruppi || []).find((g) => g.id === a.gruppo_id)?.nome || '—'}
                    </td>
                    {puoScrivere && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="mini" aria-label="Modifica"
                          onClick={() => setInModifica({
                            id: a.id, nome: a.nome, cognome: a.cognome, sesso: a.sesso,
                            anno_nascita: a.anno_nascita, specializzazione: a.specializzazione,
                            gruppo_id: a.gruppo_id || '',
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
