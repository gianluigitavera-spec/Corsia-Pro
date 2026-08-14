import { useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, LayoutDashboard, Waves, ClipboardCheck,
  HeartPulse, Users, BarChart3, Settings2, Sparkles, KeyRound, Smartphone,
  PencilLine, WifiOff, Dumbbell,
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
    testo: 'Prima cosa, in alto: la CATEGORIA si sceglie una volta sola, accanto alla stagione, e vale per tutte le schede — calendario, appello, benessere, atleti, carico. Puoi spuntarne più d\u2019una se segui due gruppi, e la scelta ti aspetta anche domani. Qui sotto il calendario del mese con allenamenti e gare; con una categoria sola spuntata compare la programmazione: scegli la gara obiettivo, premi Proponi e trascini le fasi.',
  },
  {
    scheda: 'sedute',
    Icona: Waves,
    titolo: 'Sedute',
    testo: 'Ogni sezione è una corsia. Scrivi 4x(1x100 + 2x50), 12/10/8x100 o 3x(2x50+4x25) e i metri si contano da soli; la zona parte da A1, il recupero si scrive @1:40. Se su una riga metti due andature — 4x(8x50 B1 + 4x50 B2) — la riga si apre da sola in due, una per andatura. Con le pastiglie decidi chi la nuota: separando velocisti e mezzofondisti i volumi li contano separatamente. Da qui esci in Lavagna, PDF o la mandi su WhatsApp.',
  },
  {
    scheda: 'appello',
    Icona: ClipboardCheck,
    titolo: 'Appello',
    testo: 'Prima la categoria, poi la seduta di quel gruppo — se è di oggi la trova da sola. Quattro stati: Presente, Ritardo, Giustificato, Assente. Solo l\u2019assenza fa scendere la frequenza; i ritardi restano presenze ma vengono contati a parte. Chi non tocchi resta "non rilevato" e non falsa le percentuali.',
  },
  {
    scheda: 'appello',
    Icona: PencilLine,
    titolo: 'Com\u2019è andata',
    testo: 'Sotto l\u2019appello. Quello che hai scritto è il programma e non si riscrive mai; qui correggi riga per riga soltanto quello che in vasca è andato diversamente — la serie chiusa prima, il finale saltato. Se la seduta è filata liscia non tocchi niente. È da qui che il carico per zona diventa quello vero invece di quello previsto.',
  },
  {
    scheda: 'appello',
    Icona: WifiOff,
    titolo: 'Quando il wifi molla',
    testo: 'In piscina la linea c\u2019è ma ogni tanto sparisce, che è peggio di non averla. L\u2019app non aspetta: se il database non risponde in pochi secondi il tocco va in coda e tu vai avanti. In testata compare la spia con quante cose devono ancora partire, e partono da sole appena la linea torna. Scrivere una seduta nuova, invece, vuole la rete: quello che stai scrivendo però resta salvato sul dispositivo.',
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
    testo: 'Anagrafica e import da CSV. La categoria non si scrive quasi mai: nasce da anno di nascita e sesso, e cambiando stagione tutta la squadra passa di categoria da sola. Le uniche due da mettere a mano sono Teen e Master, che non sono un\u2019età ma un percorso: un agonista di 28 anni è Senior, un Master di 28 è Master. Reimportando il foglio nessuno viene duplicato. Con le caselle a sinistra ne prendi tanti insieme e li sistemi in un colpo solo, invece che uno per volta.',
  },
  {
    scheda: 'volumi',
    Icona: BarChart3,
    titolo: 'Carico atleti',
    testo: 'Settimana, mese, periodo o stagione intera. I km delle sedute sono il volume del programma; i km nuotati sono quelli che ogni atleta ha fatto davvero, contati solo quando era presente. La distanza fra le due colonne è la cosa più utile della schermata.',
  },
  {
    scheda: 'esercizi',
    Icona: Dumbbell,
    titolo: 'Esercizi',
    testo: 'Tre livelli: quelli che hai scelto per QUESTA settimana, col video pronto da mostrare a bordo vasca; il catalogo della tua squadra; e quelli comuni a tutti. Il codice (DO-01, TC-03) nasce con l\u2019esercizio e non cambia più. "Controlla i video" segna in rosso i link di YouTube spariti.',
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
    titolo: 'Mettila sul telefono o sull\u2019iPad',
    testo: 'Si installa come un\u2019app vera, senza store. iPhone: Safari, tasto Condividi in basso, "Aggiungi a Home". iPad: sempre SAFARI (da Chrome non si può), il tasto Condividi è in ALTO a destra, e la voce "Aggiungi a Home" sta più in basso nell\u2019elenco: scorri. Se non la vedi sei in navigazione privata — apri una scheda normale e riprova. Android: menù ⋮ di Chrome, "Installa app". Poi si apre a schermo pieno, senza barra del browser, e sull\u2019iPad puoi tenerlo di traverso: a bordo vasca sono due centimetri di schermo in più.',
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
