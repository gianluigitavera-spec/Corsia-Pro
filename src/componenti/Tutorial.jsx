import { useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, LayoutDashboard, Waves, ClipboardCheck,
  HeartPulse, Users, BarChart3, Settings2, Sparkles, KeyRound, Smartphone,
} from 'lucide-react';

// Il tutorial cambia scheda mentre spiega: dietro al riquadro c'è la
// schermata vera, non un disegno.
const PASSI = [
  {
    scheda: 'dashboard',
    Icona: Sparkles,
    titolo: 'Benvenuto in CorsiaPro',
    testo: 'Il registro della squadra: sedute, presenze, volumi. Due minuti e sai dov\u2019è ogni cosa. Puoi chiudere quando vuoi con la ✕ in alto.',
  },
  {
    scheda: 'dashboard',
    Icona: LayoutDashboard,
    titolo: 'Dashboard',
    testo: 'Il calendario del mese con allenamenti e competizioni. I filtri in cima — Propaganda, Teen, Esordienti… — comandano tutta la scheda: scegli una categoria e anche i volumi qui sotto parlano solo di lei. Dentro una categoria compare la periodizzazione: scegli la gara obiettivo, premi Proponi e trascini le fasi.',
  },
  {
    scheda: 'sedute',
    Icona: Waves,
    titolo: 'Sedute',
    testo: 'Ogni sezione è una corsia. Scrivi 4x(1x100 + 2x50) e i metri si calcolano da soli; la zona parte da A1, il recupero si scrive @1\u201940. Con le pastiglie decidi chi la nuota — se separi velocisti e mezzofondisti, i volumi in fondo li contano separatamente. Da qui esci in Lavagna, PDF o la mandi su WhatsApp.',
  },
  {
    scheda: 'appello',
    Icona: ClipboardCheck,
    titolo: 'Appello',
    testo: 'Quattro stati: Presente, Ritardo, Giustificato, Assente. Solo l\u2019assenza fa scendere la frequenza; i ritardi restano presenze ma vengono contati a parte. Chi non tocchi resta "non rilevato" e non falsa le percentuali.',
  },
  {
    scheda: 'benessere',
    Icona: HeartPulse,
    titolo: 'Benessere',
    testo: 'Quattro tocchi per atleta prima di entrare in acqua: sonno, fatica, dolori, umore. L\u2019elenco mette in cima i meno pronti, e il numero ricompare accanto al nome durante l\u2019appello — dove ti serve davvero.',
  },
  {
    scheda: 'atleti',
    Icona: Users,
    titolo: 'Atleti',
    testo: 'Anagrafica e import da CSV. La categoria non si scrive mai: nasce da anno di nascita e sesso, e cambiando stagione tutta la squadra passa di categoria da sola.',
  },
  {
    scheda: 'volumi',
    Icona: BarChart3,
    titolo: 'Carico atleti',
    testo: 'Settimana, mese, periodo o stagione intera. I km delle sedute sono il volume del programma; i km nuotati sono quelli che ogni atleta ha fatto davvero, contati solo quando era presente. La distanza fra le due colonne è la cosa più utile della schermata.',
  },
  {
    scheda: 'squadra',
    Icona: KeyRound,
    titolo: 'Invitare un altro allenatore',
    testo: 'Qui trovi il codice di ingresso della squadra, tipo AQ13-7K2M. Passalo al collega: lui apre CorsiaPro, si registra, sceglie "Entra con un codice" e lo incolla. A te arriva la richiesta in questa stessa schermata: Approva, e decidi se farlo Allenatore (scrive tutto) o Solo lettura. Chi non ha il codice non trova nemmeno la squadra.',
  },
  {
    scheda: 'dashboard',
    Icona: Smartphone,
    titolo: 'Mettila sul telefono',
    testo: 'CorsiaPro si installa come un\u2019app vera, senza passare da nessuno store. Su iPhone: apri l\u2019indirizzo in Safari, tocca il tasto Condividi in basso e scegli "Aggiungi a schermata Home". Su Android, dal menù ⋮ di Chrome, "Installa app" o "Aggiungi a schermata Home". Compare l\u2019icona e si apre a schermo pieno, senza la barra del browser: a bordo vasca guadagni due centimetri di schermo.',
  },
  {
    scheda: 'squadra',
    Icona: Settings2,
    titolo: 'Tutto qui',
    testo: 'Il numero di versione in alto apre l\u2019elenco delle novità, e il punto interrogativo riapre questo tutorial quando vuoi.',
    ultimo: true,
  },
];

export default function Tutorial({ vaiA, chiudi }) {
  const [i, setI] = useState(0);
  const [nonPiu, setNonPiu] = useState(false);
  const passo = PASSI[i];

  useEffect(() => { vaiA(passo.scheda); }, [i]);

  useEffect(() => {
    const tasti = (e) => {
      if (e.key === 'Escape') chiudi(nonPiu);
      if (e.key === 'ArrowRight' && i < PASSI.length - 1) setI(i + 1);
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', tasti);
    return () => window.removeEventListener('keydown', tasti);
  }, [i, nonPiu, chiudi]);

  const { Icona } = passo;

  return (
    <div className="velo-tutorial" onClick={(e) => e.target === e.currentTarget && chiudi(nonPiu)}>
      <div className="riquadro-tutorial" role="dialog" aria-label="Tutorial">
        <button className="chiudi-tutorial" onClick={() => chiudi(nonPiu)} aria-label="Chiudi il tutorial">
          <X size={18} />
        </button>

        <div className="testa-tutorial">
          <span className="icona-tutorial"><Icona size={20} /></span>
          <div>
            <span className="passo-tutorial mono">{i + 1} di {PASSI.length}</span>
            <h3>{passo.titolo}</h3>
          </div>
        </div>

        <p className="testo-tutorial">{passo.testo}</p>

        <div className="punti-tutorial">
          {PASSI.map((_, k) => (
            <button key={k} data-attivo={k === i} onClick={() => setI(k)} aria-label={`Passo ${k + 1}`} />
          ))}
        </div>

        <div className="piede-tutorial">
          <label className="flag-tutorial">
            <input type="checkbox" checked={nonPiu} onChange={(e) => setNonPiu(e.target.checked)} />
            Non mostrare più
          </label>
          <div style={{ flex: 1 }} />
          <button className="mini" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="Indietro">
            <ChevronLeft size={15} />
          </button>
          {passo.ultimo ? (
            <button className="azione" onClick={() => chiudi(nonPiu)}>Comincia</button>
          ) : (
            <button className="azione" onClick={() => setI(i + 1)}>
              Avanti <ChevronRight size={15} style={{ verticalAlign: -3 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
