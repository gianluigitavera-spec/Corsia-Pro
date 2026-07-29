import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as api from '../lib/dati';
import { SPECIALIZZAZIONI, categoriaAtleta } from '../lib/dominio';

const VUOTO = { nome: '', cognome: '', sesso: 'M', anno_nascita: '', specializzazione: 'Generale' };

export default function Atleti({ societa, fasce, stagione, puoScrivere }) {
  const [atleti, setAtleti] = useState([]);
  const [nuovo, setNuovo] = useState(VUOTO);
  const [messaggio, setMessaggio] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { ricarica(); }, [societa.id]);

  async function ricarica() {
    try {
      setAtleti(await api.leggiAtleti(societa.id));
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: e.message });
    }
  }

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
      setMessaggio(null);
      ricarica();
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: e.message });
    }
  }

  // CSV atteso: nome,cognome,sesso,anno_nascita,specializzazione
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
        } catch (e) {
          setMessaggio({ tipo: 'errore', testo: e.message });
        }
      },
    });
  }

  const completo = nuovo.nome && nuovo.cognome && Number(nuovo.anno_nascita) > 1900;

  return (
    <>
      <div className="barra">
        <h1>Atleti</h1>
        <span className="mono" style={{ color: 'var(--inchiostro-2)' }}>{atleti.length}</span>
        <div style={{ flex: 1 }} />
        {puoScrivere && (
          <>
            <button className="azione fantasma" onClick={() => fileRef.current?.click()}>
              Importa CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => e.target.files?.[0] && importaCsv(e.target.files[0])}
            />
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
          Si compila una volta in <span className="mono">squadra.categorie_stagione</span>.
        </div>
      )}

      {puoScrivere && (
        <div className="scheda">
          <div className="corpo" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', alignItems: 'end' }}>
            <div className="campo">
              <label htmlFor="n">Nome</label>
              <input id="n" value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="c">Cognome</label>
              <input id="c" value={nuovo.cognome} onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="s">Sesso</label>
              <select id="s" value={nuovo.sesso} onChange={(e) => setNuovo({ ...nuovo, sesso: e.target.value })}>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="a">Anno</label>
              <input
                id="a"
                className="mono"
                type="number"
                inputMode="numeric"
                value={nuovo.anno_nascita}
                onChange={(e) => setNuovo({ ...nuovo, anno_nascita: e.target.value })}
              />
            </div>
            <div className="campo">
              <label htmlFor="sp">Specializzazione</label>
              <select
                id="sp"
                value={nuovo.specializzazione}
                onChange={(e) => setNuovo({ ...nuovo, specializzazione: e.target.value })}
              >
                {SPECIALIZZAZIONI.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button className="azione" onClick={aggiungi} disabled={!completo}>
              Aggiungi
            </button>
          </div>
        </div>
      )}

      <div className="scheda" style={{ marginTop: 12 }}>
        {atleti.length === 0 ? (
          <div className="vuoto">
            <h3>Squadra vuota</h3>
            <p>Aggiungi il primo atleta qui sopra, oppure carica un CSV con nome, cognome, sesso, anno_nascita.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Anno</th>
                <th>Categoria</th>
                <th>Specializzazione</th>
                {puoScrivere && <th />}
              </tr>
            </thead>
            <tbody>
              {atleti.map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.cognome}</b> {a.nome} <span style={{ color: 'var(--inchiostro-2)' }}>({a.sesso})</span>
                  </td>
                  <td className="mono">{a.anno_nascita}</td>
                  <td className="mono">{categoriaAtleta(a, fasce) || '—'}</td>
                  <td>{a.specializzazione}</td>
                  {puoScrivere && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="mini"
                        onClick={async () => {
                          await api.archiviaAtleta(a.id);
                          ricarica();
                        }}
                      >
                        Archivia
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
