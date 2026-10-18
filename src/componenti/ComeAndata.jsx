// =====================================================================
// COM'È ANDATA
//
// Il programma è quello che hai scritto e non si tocca. Qui si segna
// solo dove la vasca è andata diversamente: la serie chiusa all'ottavo
// cento invece che al decimo, il finale saltato perché l'acqua era
// fredda. Chi non tocchi resta com'era.
//
// Vale per il gruppo, non per il singolo: chi ha nuotato meno degli
// altri si legge dall'appello.
//
// Sta sotto l'appello di proposito — è la schermata che hai già aperto a
// fine allenamento, con la seduta e i nomi davanti.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import * as api from '../lib/dati';
import {
  chiaveRiga, metriSvolti, scartoPerZona, svoltoCollassato,
  campoAndata, volteDiBlocco, cambiaMetriSvolto, cambiaVolteSvolto,
} from '../lib/dominio';

// Metri e volte sono interi: virgola, punto, segni ed esponente non si
// battono nemmeno. È la prima difesa; la seconda sta in dominio.js
// (cambiaMetriSvolto), che rifiuta comunque quello che non è un intero —
// un incolla passa di qui senza tasti. E un valore che il browser non sa
// leggere ("12,") arriva come stringa vuota con badInput: va ignorato, o
// cancellerebbe la correzione che c'era.
const soloCifre = (e) => {
  if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
};

// Righe e volte rilevate, senza la nota: la nota ha il suo campo.
const soloRilevato = (svolto) => ({ righe: svolto?.righe || {}, volte: svolto?.volte });

export default function ComeAndata({ seduta, puoScrivere, suSalvato }) {
  const [rilevato, setRilevato] = useState({ righe: {} });
  const [nota, setNota] = useState('');
  const [salvato, setSalvato] = useState(true);
  const [nonRiscalate, setNonRiscalate] = useState([]);
  // Il campo delle volte cambia a ogni tasto, e per scrivere "12" si
  // passa da "1". Ogni tasto riparte da com'era la seduta quando il campo
  // è stato toccato, non dal tasto prima: altrimenti una divisione non
  // esatta a metà strada resterebbe nel risultato.
  const partenza = useRef(null);

  useEffect(() => {
    setRilevato(soloRilevato(seduta?.svolto));
    setNota(seduta?.svolto?.nota || '');
    setSalvato(true);
    setNonRiscalate([]);
    partenza.current = null;
  }, [seduta?.id]);
  const righe = rilevato.righe;

  // Rete di sicurezza: se esci con qualcosa in sospeso, parte lo stesso.
  // Sta SOPRA il return di sotto, come ogni hook: Appello monta questa
  // scheda solo quando c'è una seduta, quindi oggi nessun render passa
  // davvero dal return — ma un hook sotto un return è la forma
  // dell'errore #300, e non si tiene perché "tanto non ci arriva".
  // Le dipendenze stanno in un ref e non nell'array: se ci fossero, la
  // pulizia scatterebbe a ogni tasto e salverebbe di continuo, che è
  // esattamente quello che il tasto Salva serviva a evitare.
  const ultimo = useRef({ salvato: true, rilevato: { righe: {} }, nota: '' });
  ultimo.current = { salvato, rilevato, nota };
  useEffect(() => () => {
    const u = ultimo.current;
    if (!u.salvato) salva(u.rilevato, u.nota);
  }, []);

  if (!seduta) return null;

  const sezioni = seduta.sezioni || [];
  const previsti = metriSvolti(sezioni, null);
  const fatti = metriSvolti(sezioni, { righe });
  const scarto = fatti - previsti;
  const perZona = scartoPerZona(sezioni, { righe });

  async function salva(nuovoRilevato, nuovaNota) {
    if (!seduta?.id) return;
    setSalvato(false);
    // Una seduta andata come scritta non salva niente: svolto resta
    // vuoto invece di riempirsi di righe uguali al programma. La regola
    // sta in dominio.js e la usa anche l'editor dopo aver rimappato le
    // chiavi: un posto solo decide quando svolto smette di esistere.
    const corpo = svoltoCollassato({ ...nuovoRilevato, nota: nuovaNota });
    try {
      await api.salvaSvolto(seduta.id, corpo);
      setSalvato(true);
      suSalvato?.(corpo);
    } catch { /* resta in coda, la spia in testata lo dice */ }
  }

  function cambia(i, j, valore) {
    setRilevato(soloRilevato(cambiaMetriSvolto(rilevato, i, j, valore)));
    setNonRiscalate((n) => n.filter((k) => k !== chiaveRiga(i, j)));
    setSalvato(false);
  }

  function cambiaVolte(i, m, valore) {
    const k = chiaveRiga(i, m);
    if (partenza.current?.chiave !== k) partenza.current = { chiave: k, rilevato };
    const esito = cambiaVolteSvolto(sezioni, partenza.current.rilevato, i, m, valore);
    setRilevato(soloRilevato(esito.svolto));
    setNonRiscalate(esito.nonRiscalate);
    setSalvato(false);
  }

  return (
    <div className="scheda" style={{ marginTop: 14 }}>
      <div className="intestazione">
        <b>Com'è andata</b>
        <span style={{ color: 'var(--testo-3)', fontSize: 13 }}>
          tocca solo le righe andate diversamente
        </span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ color: scarto ? 'var(--ambra)' : 'var(--menta)' }}>
          {fatti} m {scarto ? `(${scarto > 0 ? '+' : ''}${scarto})` : '· come scritta'}
        </span>
      </div>

      <div className="corpo">
        {sezioni.map((sezione, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div className="mono" style={{ color: 'var(--ciano)', fontSize: 12, marginBottom: 6 }}>
              {sezione.titolo || 'Sezione'}
            </div>

            {(sezione.serie || []).map((serie, j) => {
              const k = chiaveRiga(i, j);
              const campo = campoAndata(sezione, j);
              // L'apertura: il campo è delle volte, e muove le righe sotto.
              if (campo === 'volte') {
                const scritte = serie.apreBlocco;
                const rilevate = rilevato.volte?.[k];
                const diverse = rilevate !== undefined && volteDiBlocco(sezioni, rilevato, i, j) !== scritte;
                return (
                  <div key={k} className="riga-andata">
                    <span className="testo-riga">{serie.notazione}</span>
                    <span className="mono previsto">{scritte} volte</span>
                    <input
                      className="mono"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      onKeyDown={soloCifre}
                      title="Quante volte è stato fatto il blocco: le righe sotto si ricalcolano"
                      disabled={!puoScrivere}
                      placeholder={String(scritte)}
                      value={rilevate ?? ''}
                      onChange={(e) => { if (!e.target.validity?.badInput) cambiaVolte(i, j, e.target.value); }}
                      onBlur={() => { partenza.current = null; }}
                      style={{ borderColor: diverse ? 'var(--ambra)' : undefined }}
                    />
                    {diverse && (
                      <button className="mini" title="Rimetti come programmato"
                        onClick={() => { partenza.current = null; cambiaVolte(i, j, ''); }}>
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                );
              }
              // Nessun campo: apertura a secco o nuda, fine della ripetizione.
              if (campo === null) {
                return (
                  <div key={k} className="riga-andata">
                    <span className="testo-riga">{serie.notazione}</span>
                  </div>
                );
              }
              const previsto = +serie.metri || 0;
              const corretto = righe[k];
              const diverso = corretto !== undefined && +corretto !== previsto;
              const daScrivere = nonRiscalate.includes(k);
              // Lavoro, zona e metri sono colonne (styles.css, "com'è
              // andata"): erano tre span inline senza spazio fra loro e si
              // leggevano attaccati. Il segnaposto che teneva il posto del
              // tasto non serve più — con la griglia la colonna resta al
              // suo posto anche vuota.
              return (
                <div key={k} className="riga-andata">
                  <span className="testo-riga">{serie.notazione}</span>
                  {serie.zona && <span className="mono pastiglia-zona">{serie.zona}</span>}
                  <span className="mono previsto">{previsto} m</span>
                  <input
                    className="mono"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    onKeyDown={soloCifre}
                    disabled={!puoScrivere}
                    placeholder={String(previsto)}
                    value={corretto ?? ''}
                    onChange={(e) => { if (!e.target.validity?.badInput) cambia(i, j, e.target.value); }}
                    title={daScrivere ? 'Non si divide in parti uguali per le volte nuove: scrivi tu i metri' : undefined}
                    style={{ borderColor: diverso || daScrivere ? 'var(--ambra)' : undefined }}
                  />
                  {diverso && (
                    <button className="mini" title="Rimetti come programmato"
                      onClick={() => cambia(i, j, '')}>
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            {nonRiscalate.some((x) => x.startsWith(`${i}-`)) && (
              <div style={{ color: 'var(--ambra)', fontSize: 13, marginTop: 4 }}>
                Alcune righe del blocco non si dividono in parti uguali per le volte
                nuove e sono rimaste com'erano: scrivi tu i metri.
              </div>
            )}
          </div>
        ))}

        {Object.keys(perZona).length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--testo-2)' }}>
            Dove è cambiato:{' '}
            {Object.entries(perZona).map(([zona, m]) => (
              <span key={zona} className="mono" style={{ marginRight: 10 }}>
                {zona} {m > 0 ? '+' : ''}{m}
              </span>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Una riga sul perché, se serve"
          value={nota}
          disabled={!puoScrivere}
          onChange={(e) => { setNota(e.target.value); setSalvato(false); }}
          style={{ width: '100%' }}
        />

        {puoScrivere && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button
              className={salvato ? 'azione fantasma' : 'azione'}
              disabled={salvato}
              onClick={() => salva(righe, nota)}
            >
              {salvato ? <><Check size={15} style={{ verticalAlign: -3 }} /> Salvato</> : 'Salva'}
            </button>
            {!salvato && (
              <span style={{ color: 'var(--ambra)', fontSize: 13 }}>
                ci sono modifiche non salvate
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
