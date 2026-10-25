import { useEffect, useState } from 'react';
import * as api from '../lib/dati';
import { SPECIALIZZAZIONI, sedutaNelGruppo, riepilogoCarico, famigliaDiRiga } from '../lib/dominio';
import { tinta, TINTA_FAMIGLIA, SERIE_FAMIGLIE } from '../lib/colori';
import Calendario from './Calendario';
import { BarreImpilate } from './Grafici';

const PERIODI = [
  { g: 7, nome: 'Settimana' },
  { g: 28, nome: '4 settimane' },
  { g: 90, nome: 'Trimestre' },
  { g: 365, nome: 'Stagione' },
];

const indietro = (g) => {
  const d = new Date();
  d.setDate(d.getDate() - g);
  return d.toISOString().slice(0, 10);
};

export default function Dashboard({ societa, zone, categorie, stagione, puoScrivere, apriSeduta, gruppi = [], codiciGruppi }) {
  const [giorni, setGiorni] = useState(28);
  // Si apre su Generale: è il carico comune — riscaldamento più le parti
  // per tutti — e non il ramo di una specializzazione. Era 'Mezzofondo',
  // e chi apriva l'app vedeva il carico di un gruppo che magari non
  // allena credendo di guardare la squadra: è la stessa trappola del "C3
  // dei velocisti che spariva", che era il menu fermo su Mezzofondo.
  const [spec, setSpec] = useState('Generale');
  const [righe, setRighe] = useState([]);
  const [errore, setErrore] = useState(null);
  const [caricamento, setCaricamento] = useState(true);

  // Niente più filtro qui dentro: la categoria si sceglie una volta sola
  // in testata e vale per tutte le schede.
  const codiciMacro = codiciGruppi;

  useEffect(() => {
    setCaricamento(true);
    // Non la vista v_carico_zona: quella conta il programma. Qui servono
    // i metri davvero nuotati, come in Carico atleti — se no le due
    // schede mostrano due numeri diversi per la stessa settimana.
    api.caricoReale(societa.id, { da: indietro(giorni), specializzazione: spec })
      .then(({ zone }) => {
        // Le righe per zona portano le categorie della loro seduta
        // (dati.js, caricoReale), quindi la domanda è la stessa delle
        // sedute: questa seduta sta nel gruppo scelto?
        setRighe(zone.filter((z) => sedutaNelGruppo(z, codiciMacro)));
        setErrore(null);
      })
      .catch((e) => setErrore(e.message))
      .finally(() => setCaricamento(false));
  }, [societa.id, spec, giorni, codiciMacro?.join()]);

  // Card e ripartizione dallo stesso conto (riepilogoCarico in dominio.js):
  // il 25/10/2026 la card «Passo gara» diceva 0 m e la riga D 600, perché
  // le due somme prendevano la famiglia da due posti.
  //
  // Il volume è tutto quello nuotato; le percentuali sono sui soli metri
  // delle quattro famiglie (percentualiPerFamiglia). Prima si divideva
  // per il totale e i metri senza zona abbassavano ogni famiglia.
  // Anche le percentuali delle singole zone stanno sullo stesso
  // denominatore: A1 + A2 + B1 devono dare l'aerobico che si legge sopra.
  const { perZona, perFamiglia, famiglie } = riepilogoCarico(righe);
  const totale = famiglie.totale;
  const pct = (m) => (famiglie.classificati ? ((m * 100) / famiglie.classificati).toFixed(1) : '0.0');
  const pctFamiglia = (f) => famiglie.pct[f].toFixed(1);
  // La D sta fuori dalle quattro: la sua quota è sul totale nuotato.
  const pctTotale = (m) => (totale ? ((m * 100) / totale).toFixed(1) : '0.0');

  const kpi = [
    { nome: 'Volume totale', valore: (totale / 1000).toFixed(1), unita: 'km', sotto: `${totale.toLocaleString('it-IT')} metri`, tinta: 'var(--ciano)' },
    { nome: 'Aerobico', valore: pctFamiglia('aerobico'), unita: '%', sotto: `${(perFamiglia.aerobico || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.aerobico },
    { nome: 'VO₂max', valore: pctFamiglia('vo2'), unita: '%', sotto: `${(perFamiglia.vo2 || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.vo2 },
    { nome: 'Lattacido', valore: pctFamiglia('lattacido'), unita: '%', sotto: `${(perFamiglia.lattacido || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.lattacido },
    { nome: 'Alattacido', valore: pctFamiglia('alattacido'), unita: '%', sotto: `${(perFamiglia.alattacido || 0).toLocaleString('it-IT')} m`, tinta: TINTA_FAMIGLIA.alattacido },
    { nome: 'Passo gara', valore: famiglie.pctPassoGara.toFixed(1), unita: '%', sotto: `${famiglie.passoGara.toLocaleString('it-IT')} m sul totale`, tinta: TINTA_FAMIGLIA.passo_gara },
  ];

  const massimo = Math.max(1, ...Object.values(perZona));

  // Andamento nel tempo: una colonna per settimana, composta per famiglia.
  const perSettimana = (() => {
    const lunedi = (d) => {
      const x = new Date(d + 'T12:00');
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x.toISOString().slice(0, 10);
    };
    const m = {};
    for (const r of righe) {
      const s = lunedi(r.data);
      m[s] ??= { valori: {} };
      const f = famigliaDiRiga(r) || 'nonclass';
      m[s].valori[f] = (m[s].valori[f] || 0) + (r.metri || 0);
    }
    return Object.entries(m).sort().map(([s, v]) => ({
      ...v,
      etichetta: new Date(s + 'T12:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    }));
  })();

  const SERIE = SERIE_FAMIGLIE;

  return (
    <>
      <Calendario societa={societa} gruppi={gruppi} codiciGruppi={codiciGruppi}
        puoScrivere={puoScrivere} apriSeduta={apriSeduta}
        stagione={stagione} categorie={categorie} />

      <div className="barra sezione">
        <h1>Dashboard volumi</h1>
        {gruppi.length > 0 && (
          <span className="societa" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>{gruppi.join(' · ')}</span>
        )}
        <div style={{ flex: 1 }} />
        <select value={spec} onChange={(e) => setSpec(e.target.value)}>
          {SPECIALIZZAZIONI.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={giorni} onChange={(e) => setGiorni(Number(e.target.value))}>
          {PERIODI.map((p) => <option key={p.g} value={p.g}>{p.nome}</option>)}
        </select>
      </div>

      <p style={{ color: 'var(--testo-3)', fontSize: 13, marginTop: -6 }}>
        Carico di chi fa <b style={{ color: 'var(--testo-2)' }}>{spec}</b>: riscaldamento comune più la
        sua parte centrale. {gruppi.length === 0
          ? 'Tutte le categorie insieme: scegline una in testata e i numeri seguono.'
          : <>Solo le sedute di <b style={{ color: 'var(--testo-2)' }}>{gruppi.join(' · ')}</b>.</>}
      </p>

      {errore && <div className="avviso errore">{errore}</div>}

      <div className="volumi sezione">
        {kpi.map((k) => (
          <div className="volume" key={k.nome} style={{ '--tinta': k.tinta }}>
            <div className="etichetta">{k.nome}</div>
            <div className="cifra">{k.valore}<small>{k.unita}</small></div>
            <div className="sotto">{k.sotto}</div>
          </div>
        ))}
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Ripartizione per zona</h3>
          <div style={{ flex: 1 }} />
          <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 13 }}>
            {caricamento ? '…' : `${righe.length} righe`}
          </span>
        </div>
        <div className="corpo">
          {totale === 0 ? (
            <div className="vuoto">
              <h3>Nessun metro nel periodo</h3>
              <p>
                {gruppi.length === 0
                  ? 'Le zone si riempiono man mano che salvi le sedute con la zona indicata su ogni serie.'
                  : `Nessuna seduta di ${gruppi.join(' · ')} in questo periodo: prova con "Tutte le categorie" in testata, o allarga l'orizzonte.`}
              </p>
            </div>
          ) : (
            zone.map((z) => {
              const m = perZona[z.codice] || 0;
              // La D non ha un colore in squadra.zone: prende quello della
              // sua famiglia, e la sua percentuale è sul totale.
              const c = z.colore ? tinta(z.colore) : (TINTA_FAMIGLIA[z.famiglia] || tinta(z.colore));
              const passo = z.famiglia === 'passo_gara';
              return (
                <div className="zona-riga" key={z.codice} style={{ '--tinta': c }}>
                  <div className="zona-testa">
                    <span className="nome"><b>{z.codice}</b>{z.nome}</span>
                    <span className="spazio" />
                    <span className="valore">
                      {m.toLocaleString('it-IT')} m ({passo ? `${pctTotale(m)}% del totale` : `${pct(m)}%`})
                    </span>
                  </div>
                  <div className="zona-barra">
                    <i style={{ width: `${(m / massimo) * 100}%` }} />
                  </div>
                </div>
              );
            })
          )}

          {famiglie.senzaZona > 0 && (
            <div className="avviso" style={{ marginTop: 16 }}>
              {famiglie.senzaZona.toLocaleString('it-IT')} metri senza zona su {totale.toLocaleString('it-IT')}:
              contano nel volume ma restano fuori dalle percentuali, calcolate sui{' '}
              {famiglie.classificati.toLocaleString('it-IT')} metri delle quattro famiglie. Li trovi nelle
              sedute con la serie priva di zona.
            </div>
          )}
          {famiglie.passoGara > 0 && (
            <p style={{ fontSize: 12, color: 'var(--testo-3)', marginTop: 12 }}>
              Il passo gara (D) non è né aerobico né lattacido: resta fuori dalle percentuali delle
              quattro famiglie e la sua quota è sul totale nuotato.
            </p>
          )}
        </div>
      </div>

      <div className="scheda sezione">
        <div className="intestazione">
          <h3>Andamento settimanale</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--testo-3)' }}>
            {spec}{gruppi.length ? ` · ${gruppi.join(' · ')}` : ''}
          </span>
        </div>
        <div className="corpo">
          <BarreImpilate dati={perSettimana} serie={SERIE} />
        </div>
      </div>
    </>
  );
}
