import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Waves, ClipboardCheck, HeartPulse, Users, BarChart3, Sparkles, Settings2, LogOut, HelpCircle } from 'lucide-react';
import { sb, configurato } from './lib/supabase';
import * as api from './lib/dati';
import { stagioneCorrente, stagioniProposte, fasceRisolte, RAGGRUPPAMENTI } from './lib/dominio';
import { VERSIONE, CAMBIAMENTI } from './versione';
import { novitaDaMostrare, novitaDiRecupero } from './lib/novita';
import { BUILD } from './lib/versione';
import Accesso from './componenti/Accesso';
import StatoLinea from './componenti/StatoLinea';
import ScegliGruppi from './componenti/ScegliGruppi';
import Atleti from './componenti/Atleti';
import EditorSeduta from './componenti/EditorSeduta';
import Appello from './componenti/Appello';
import Volumi from './componenti/Volumi';
import Dashboard from './componenti/Dashboard';
import Benessere from './componenti/Benessere';
import Squadra from './componenti/Squadra';
import Esercizi from './componenti/Esercizi';
import Feedback from './componenti/Feedback';
import SenzaSquadra from './componenti/SenzaSquadra';
import Tutorial from './componenti/Tutorial';
import Novita from './componenti/Novita';

const SCHEDE = [
  { id: 'dashboard', nome: 'Dashboard', Icona: LayoutDashboard },
  { id: 'sedute', nome: 'Sedute', Icona: Waves },
  { id: 'appello', nome: 'Appello', Icona: ClipboardCheck },
  { id: 'benessere', nome: 'Benessere', Icona: HeartPulse },
  { id: 'atleti', nome: 'Atleti', Icona: Users },
  { id: 'volumi', nome: 'Carico atleti', Icona: BarChart3 },
  // L'id resta 'esercizi': ci puntano il tutorial e lo stato della scheda,
  // e le tabelle in banca dati si chiamano così. Cambia il nome che legge
  // l'allenatore, non l'impianto sotto.
  { id: 'esercizi', nome: 'Tecnica', Icona: Sparkles },
  { id: 'squadra', nome: 'Squadra', Icona: Settings2 },
];

// L'app è già stata usata su questo telefono? Basta una qualunque chiave
// lasciata da un uso precedente — il magazzino locale, i gruppi scelti,
// il tutorial chiuso — tolta quella delle novità, che è quella che stiamo
// decidendo. Serve solo a non trattare come nuovo chi nuovo non è.
function giaUsata() {
  try {
    return Object.keys(localStorage)
      .some((k) => k.startsWith('corsiapro:') && k !== 'corsiapro:novita');
  } catch { return false; }
}

export default function App() {
  const [sessione, setSessione] = useState(undefined);

  // La categoria scelta una volta e valida per tutte le schede. Vuoto =
  // tutte. Resta fra una visita e l'altra: chi allena gli Esordienti A
  // apre l'app e li ha già davanti.
  const [gruppi, setGruppi] = useState(() => {
    try { return JSON.parse(localStorage.getItem('corsiapro:gruppi') || '[]'); }
    catch { return []; }
  });

  function scegliGruppi(nuovi) {
    setGruppi(nuovi);
    try { localStorage.setItem('corsiapro:gruppi', JSON.stringify(nuovi)); } catch { /* niente */ }
  }

  // I codici categoria dietro la scelta. null = nessun filtro.
  const codiciGruppi = gruppi.length
    ? [...new Set(gruppi.flatMap((n) => RAGGRUPPAMENTI.find((r) => r.nome === n)?.codici || []))]
    : null;
  const [societa, setSocieta] = useState(null);
  const [ruolo, setRuolo] = useState(null);
  const [scheda, setScheda] = useState('dashboard');
  const [zone, setZone] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [fasce, setFasce] = useState([]);
  const [proiezione, setProiezione] = useState(null);
  const [stagioni, setStagioni] = useState([]);
  const [errore, setErrore] = useState(null);
  const [senzaSquadra, setSenzaSquadra] = useState(false);
  const [apertura, setApertura] = useState(null); // {id} oppure {data}
  const [registro, setRegistro] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [novita, setNovita] = useState([]);
  const [ricarica, setRicarica] = useState(0);

  const [stagione, setStagione] = useState(stagioneCorrente());

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSessione(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSessione(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessione) return;
    (async () => {
      try {
        const [membri, z, c, f, st] = await Promise.all([
          api.mieSocieta(), api.leggiZone(), api.leggiCategorie(),
          api.leggiFasce(), api.leggiStagioni(),
        ]);
        setZone(z); setCategorie(c);
        const risolte = fasceRisolte(f, stagione);
        setFasce(risolte.fasce);
        setProiezione(risolte.proiettata ? risolte : null);
        setStagioni(stagioniProposte(st, stagioneCorrente()));
        const primo = membri?.[0];
        if (!primo?.societa) { setSenzaSquadra(true); return; }
        setSenzaSquadra(false);
        setSocieta(primo.societa);
        setRuolo(primo.ruolo);
      } catch (e) { setErrore(e.message); }
    })();
  }, [sessione, stagione, ricarica]);

  // Alla prima visita il tutorial parte da solo; poi solo se lo richiami.
  useEffect(() => {
    if (!societa) return;
    try {
      // In navigazione privata su Safari localStorage lancia invece di
      // tornare null: senza la rete, l'app non si apriva proprio.
      try {
        if (localStorage.getItem('corsiapro:tutorial') !== 'visto') setTutorial(true);
      } catch { setTutorial(true); }
    } catch { /* navigazione privata: pazienza, non parte */ }
  }, [societa?.id]);

  // Le novità dopo un aggiornamento. Parte dopo il tutorial e mai
  // insieme: chi apre l'app per la prima volta ha già il tutorial davanti,
  // e due finestre sovrapposte sono una di troppo.
  //
  // Al contrario del tutorial, se localStorage non risponde qui si sta
  // zitti: senza poter scrivere "vista", la finestra tornerebbe a ogni
  // apertura, e a bordo vasca è una molestia. Nel dubbio, silenzio.
  useEffect(() => {
    if (!societa || tutorial) return;
    try {
      const vistaPrima = localStorage.getItem('corsiapro:novita');
      // Prima apertura in assoluto: si registra la versione e basta,
      // senza annunciare niente. La decisione sta in novitaDaMostrare.
      //
      // Senza versione salvata ci sono però due persone diverse: chi apre
      // l'app oggi per la prima volta, e chi la usa da mesi ma è arrivato
      // prima che l'annuncio esistesse. Trattarli uguale vorrebbe dire
      // che il secondo si perde in silenzio la novità appena consegnata.
      // A distinguerli è una qualunque altra traccia lasciata dall'uso:
      // il magazzino, i gruppi scelti, il tutorial chiuso.
      setNovita(
        vistaPrima
          ? novitaDaMostrare(VERSIONE, CAMBIAMENTI, vistaPrima)
          : (giaUsata() ? novitaDiRecupero(VERSIONE, CAMBIAMENTI) : [])
      );
      // La versione si segna comunque, anche quando non si apre niente:
      // così una voce senza `annuncia` non resta in agguato per la volta
      // dopo.
      localStorage.setItem('corsiapro:novita', VERSIONE);
    } catch { /* navigazione privata: nessun annuncio, nessun danno */ }
  }, [societa?.id, tutorial]);

  const chiudiNovita = useCallback(() => setNovita([]), []);

  const chiudiTutorial = useCallback((nonPiu) => {
    setTutorial(false);
    if (nonPiu) {
      try { localStorage.setItem('corsiapro:tutorial', 'visto'); } catch { /* niente */ }
    }
  }, []);

  // Dal calendario all'editor, con la data del giorno cliccato.
  const apriSeduta = useCallback((id, data) => {
    setApertura(id ? { id } : { data });
    setScheda('sedute');
  }, []);
  const consumaApertura = useCallback(() => setApertura(null), []);

  if (!configurato) {
    return (
      <div className="accesso">
        <div className="riquadro">
          <div className="marchio">Corsia<span>Pro</span></div>
          <p className="sotto">Manca la configurazione.</p>
          <div className="avviso">
            Copia <span className="mono">.env.example</span> in <span className="mono">.env</span> e riempi
            VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Supabase → Project Settings → API), poi riavvia
            <span className="mono"> npm run dev</span>.
          </div>
        </div>
      </div>
    );
  }

  if (sessione === undefined) return null;
  if (!sessione) return <Accesso />;
  if (senzaSquadra) return <SenzaSquadra email={sessione.user?.email} ricarica={() => setRicarica((n) => n + 1)} />;

  const puoScrivere = ruolo === 'coach' || ruolo === 'collega';

  return (
    <div className="guscio">
      <header className="testata">
        <div className="riga-testata">
          <div className="marchio">
            <img src="/marchio.svg" alt="" className="segno" />
            Corsia<span>Pro</span>
          </div>
          <button
            className="versione"
            onClick={() => setRegistro(true)}
            title={`Cosa è cambiato · build ${BUILD}`}
          >
            v{VERSIONE}
          </button>
          <div className="spazio" />
          <StatoLinea />
          <Feedback scheda={scheda} societa={societa} />
          <button className="mini" onClick={() => setTutorial(true)} title="Rivedi il tutorial" aria-label="Tutorial">
            <HelpCircle size={15} />
          </button>
          <button className="mini" onClick={() => api.esci()} title="Esci" aria-label="Esci">
            <LogOut size={14} />
          </button>
        </div>

        <div className="riga-testata secondaria">
          {societa && <div className="societa">{societa.nome}</div>}
          <div className="spazio" />
          <select
            value={stagione}
            onChange={(e) => setStagione(e.target.value)}
            aria-label="Stagione"
            className="scelta-stagione"
          >
            {stagioni.map((x) => <option key={x} value={x}>Stagione {x}</option>)}
          </select>
          <ScegliGruppi scelti={gruppi} cambia={scegliGruppi} />
        </div>
      </header>

      <nav className="nav">
        {SCHEDE.map(({ id, nome, Icona }) => (
          <button key={id} aria-current={scheda === id} onClick={() => setScheda(id)}>
            <Icona size={15} style={{ verticalAlign: -3, marginRight: 7 }} />{nome}
          </button>
        ))}
      </nav>

      {errore && <div className="sezione avviso errore">{errore}</div>}

      {tutorial && societa && (
        <Tutorial vaiA={setScheda} chiudi={chiudiTutorial} />
      )}

      {!tutorial && novita.length > 0 && (
        <Novita voci={novita} chiudi={chiudiNovita} />
      )}

      {registro && (
        <div className="registro" role="dialog" aria-label="Registro dei cambiamenti">
          <div className="registro-riquadro">
            <div className="intestazione">
              <h3>Cosa è cambiato</h3>
              <div style={{ flex: 1 }} />
              <button className="mini" onClick={() => setRegistro(false)}>Chiudi</button>
            </div>
            <div className="corpo">
              {CAMBIAMENTI.map((c) => (
                <div key={c.versione} className="voce-registro">
                  <div className="riga-versione">
                    <span className="mono numero-versione">v{c.versione}</span>
                    <span className="mono" style={{ color: 'var(--testo-3)', fontSize: 12 }}>{c.data}</span>
                    {c.versione === VERSIONE && <span className="attuale">in uso</span>}
                  </div>
                  <ul>{c.voci.map((v, i) => <li key={i}>{v}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {societa && (
        <main className="sezione">
          {scheda === 'dashboard' && (
            <Dashboard societa={societa} zone={zone} categorie={categorie} stagione={stagione}
              gruppi={gruppi} codiciGruppi={codiciGruppi}
              puoScrivere={puoScrivere} apriSeduta={apriSeduta} />
          )}
          {scheda === 'sedute' && (
            <EditorSeduta
              societa={societa} zone={zone} categorie={categorie} fasce={fasce} puoScrivere={puoScrivere}
              apertura={apertura} consumaApertura={consumaApertura}
            />
          )}
          {scheda === 'appello' && <Appello societa={societa} fasce={fasce} puoScrivere={puoScrivere}
            gruppi={gruppi} codiciGruppi={codiciGruppi} />}
          {scheda === 'benessere' && <Benessere societa={societa} fasce={fasce} puoScrivere={puoScrivere}
            gruppi={gruppi} codiciGruppi={codiciGruppi} />}
          {scheda === 'atleti' && (
            <Atleti societa={societa} fasce={fasce} stagione={stagione} codiciGruppi={codiciGruppi}
              proiezione={proiezione} puoScrivere={puoScrivere} />
          )}
          {scheda === 'volumi' && <Volumi societa={societa} stagione={stagione} fasce={fasce}
            gruppi={gruppi} codiciGruppi={codiciGruppi} />}
          {scheda === 'esercizi' && <Esercizi societa={societa} puoScrivere={puoScrivere} />}
          {scheda === 'squadra' && (
            <Squadra societa={societa} ruolo={ruolo} ricaricaSocieta={() => setRicarica((n) => n + 1)} />
          )}
        </main>
      )}
    </div>
  );
}
