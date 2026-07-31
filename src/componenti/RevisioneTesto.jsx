import { useMemo, useState } from 'react';
import { Wand2, ArrowLeft, Check, AlertTriangle, CircleHelp } from 'lucide-react';
import { analizzaTesto } from '../lib/analizzatore';
import { TUTTI } from '../lib/dominio';

const ESEMPIO = `300 stile

6x100 boccaglio @2:00
25 remate 25 completo stile 25gb ps streamline 25 ps completo

4 partenze
4 virate

4x
2x50 pull @0:50
4x25 2 tecnica 2 spinta e arrivo forte @0:35`;

const SEMAFORO = {
  verde: { colore: 'var(--menta)', Icona: Check, testo: 'letta' },
  gialla: { colore: 'var(--ambra)', Icona: CircleHelp, testo: 'da confermare' },
  rossa: { colore: 'var(--rosso)', Icona: AlertTriangle, testo: 'non capita' },
};

export default function RevisioneTesto({ zone, indietro, usaSeduta }) {
  const [testo, setTesto] = useState('');
  const [correzioni, setCorrezioni] = useState({});   // "sez:serie" -> { zona, metri }

  const letto = useMemo(() => analizzaTesto(testo), [testo]);

  const chiave = (i, j) => `${i}:${j}`;
  const valore = (i, j, campo, difetto) => {
    const c = correzioni[chiave(i, j)];
    return c && c[campo] !== undefined ? c[campo] : difetto;
  };
  const correggi = (i, j, campo, v) =>
    setCorrezioni((c) => ({ ...c, [chiave(i, j)]: { ...c[chiave(i, j)], [campo]: v } }));

  // Metri totali tenendo conto delle correzioni fatte qui
  const metri = letto.sezioni.reduce((t, sez, i) =>
    t + sez.serie.reduce((x, s, j) => x + Number(valore(i, j, 'metri', s.metri) || 0), 0), 0);

  const daVedere = letto.sezioni.reduce((t, sez, i) =>
    t + sez.serie.filter((s, j) => s.fiducia !== 'verde' && !valore(i, j, 'confermata', false)).length, 0);

  function conferma() {
    const sezioni = letto.sezioni.map((sez, i) => ({
      titolo: sez.titolo,
      destinatari: [TUTTI],
      serie: sez.serie.map((s, j) => ({
        notazione: s.notazione,
        metri: Number(valore(i, j, 'metri', s.metri)) || 0,
        zona: valore(i, j, 'zona', s.zona) || '',
        recupero: s.recupero || '',
        note: [s.note, (s.modalita || []).join(', '), (s.attrezzi || []).join(', ')]
          .filter(Boolean).join(' · '),
        metriManuali: true,          // vengono dal testo: non ricalcolarli
      })).filter((s) => s.notazione),
    })).filter((sez) => sez.serie.length > 0);

    usaSeduta(sezioni);
  }

  return (
    <>
      <div className="barra">
        <button className="mini" onClick={indietro}>
          <ArrowLeft size={14} style={{ verticalAlign: -2 }} /> Sedute
        </button>
        <h1 style={{ marginLeft: 6 }}>Scrivi o incolla</h1>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ color: 'var(--testo-2)' }}>{metri.toLocaleString('it-IT')} m</span>
        {daVedere > 0 && (
          <span className="mono" style={{ color: 'var(--ambra)', fontSize: 13 }}>{daVedere} da vedere</span>
        )}
        <button className="azione" onClick={conferma} disabled={letto.sezioni.length === 0}>
          Usa questa seduta
        </button>
      </div>

      <div className="revisione">
        <div className="scheda">
          <div className="intestazione">
            <h3>Il tuo testo</h3>
            <div style={{ flex: 1 }} />
            {!testo && (
              <button className="mini" onClick={() => setTesto(ESEMPIO)}>
                <Wand2 size={13} style={{ verticalAlign: -2 }} /> Esempio
              </button>
            )}
          </div>
          <div className="corpo">
            <textarea
              className="testo-seduta"
              rows={22}
              value={testo}
              placeholder={'Scrivi come sei abituato.\n\nUna riga vuota chiude un blocco.\n"4x" da solo moltiplica quello che segue.'}
              onChange={(e) => { setTesto(e.target.value); setCorrezioni({}); }}
            />
            <p style={{ fontSize: 12, color: 'var(--testo-3)', margin: '8px 0 0' }}>
              Le sotto-righe che sommano la distanza della riga sopra vengono lette come
              composizione e non aggiungono metri.
            </p>
          </div>
        </div>

        <div className="scheda">
          <div className="intestazione">
            <h3>Come l'ho capita</h3>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>correggi qui, poi conferma</span>
          </div>
          <div className="corpo">
            {letto.sezioni.length === 0 ? (
              <div className="vuoto">
                <h3>Niente da leggere</h3>
                <p>Scrivi la seduta a sinistra: qui compare interpretata mentre digiti.</p>
              </div>
            ) : (
              letto.sezioni.map((sez, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div className="titolo-letto">
                    {sez.titolo}
                    <span className="mono">
                      {sez.serie.reduce((t, s, j) => t + Number(valore(i, j, 'metri', s.metri) || 0), 0)} m
                    </span>
                  </div>

                  {sez.serie.map((s, j) => {
                    const stato = SEMAFORO[s.fiducia] || SEMAFORO.gialla;
                    const { Icona } = stato;
                    return (
                      <div className="riga-letta" key={j} style={{ '--tinta': stato.colore }}>
                        <Icona size={14} style={{ color: stato.colore, flex: 'none' }} />
                        <span className="testo-letto">
                          {s.notazione}
                          {(s.modalita?.length || s.attrezzi?.length) && (
                            <span className="dettagli-letti">
                              {[...(s.attrezzi || []), ...(s.modalita || [])].join(' · ')}
                            </span>
                          )}
                          {s.note && <span className="dettagli-letti">{s.note}</span>}
                        </span>

                        <input
                          className="mono metri-letti"
                          type="number"
                          value={valore(i, j, 'metri', s.metri)}
                          onChange={(e) => correggi(i, j, 'metri', e.target.value)}
                          aria-label="Metri"
                        />
                        <select
                          value={valore(i, j, 'zona', s.zona) || ''}
                          onChange={(e) => { correggi(i, j, 'zona', e.target.value); correggi(i, j, 'confermata', true); }}
                          aria-label="Zona"
                        >
                          <option value="">—</option>
                          {zone.map((z) => <option key={z.codice} value={z.codice}>{z.codice}</option>)}
                        </select>
                        <span className="mono rec-letto">{s.recupero || ''}</span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
