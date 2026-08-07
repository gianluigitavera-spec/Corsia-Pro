// =====================================================================
// LA SCELTA DEL GRUPPO, UNA VOLTA SOLA
//
// Prima ogni scheda aveva il suo filtro: sceglievi Esordienti A nella
// Dashboard, poi di nuovo nell'Appello, poi nel Benessere. Chi allena un
// gruppo solo lo rifaceva dieci volte al giorno.
//
// Adesso la scelta sta in testata accanto alla stagione e vale
// dappertutto. Si possono spuntare più gruppi: chi segue Esordienti A e
// B insieme li vede insieme, senza dover scegliere.
// =====================================================================
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { RAGGRUPPAMENTI } from '../lib/dominio';

export default function ScegliGruppi({ scelti, cambia }) {
  const [aperto, setAperto] = useState(false);
  const guscio = useRef(null);

  // Si chiude toccando fuori: su schermo tattile non c'è un "via col
  // mouse" che lo faccia sparire da solo.
  useEffect(() => {
    if (!aperto) return;
    const fuori = (e) => { if (guscio.current && !guscio.current.contains(e.target)) setAperto(false); };
    document.addEventListener('pointerdown', fuori);
    return () => document.removeEventListener('pointerdown', fuori);
  }, [aperto]);

  function commuta(nome) {
    cambia(scelti.includes(nome) ? scelti.filter((x) => x !== nome) : [...scelti, nome]);
  }

  const etichetta = scelti.length === 0
    ? 'Tutte le categorie'
    : scelti.length === 1
      ? scelti[0]
      : `${scelti.length} categorie`;

  return (
    <div className="scegli-gruppi" ref={guscio}>
      <button className="scelta-stagione bottone-gruppi" onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto} title="Vale per tutte le schede">
        <Users size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
        {etichetta}
        <ChevronDown size={14} style={{ verticalAlign: -2, marginLeft: 6 }} />
      </button>

      {aperto && (
        <div className="tendina-gruppi">
          <button className="voce-gruppo" onClick={() => cambia([])}>
            <span className="segno">{scelti.length === 0 && <Check size={14} />}</span>
            <b>Tutte le categorie</b>
          </button>
          <div className="separatore" />
          {RAGGRUPPAMENTI.map((r) => (
            <button key={r.nome} className="voce-gruppo" onClick={() => commuta(r.nome)}>
              <span className="segno">{scelti.includes(r.nome) && <Check size={14} />}</span>
              {r.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
