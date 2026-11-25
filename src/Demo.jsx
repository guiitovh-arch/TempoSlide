// Demo interactiva de la landing: un mini ensayo de 4 diapositivas con temporizador, cronómetro y teleprompter.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, pace } from './lib.js';

const SLIDES = [
  { t: 'Hola, tribunal 👋', c: 'plum', say: 'Buenos días. Hoy les presento mi proyecto en menos de un minuto.' },
  { t: 'El problema', c: 'coral', say: 'Casi todas las defensas se pasan de tiempo porque nadie mide el ritmo.' },
  { t: 'La solución', c: 'mint', say: 'Ensayar con un cronómetro por diapositiva y un teleprompter.' },
  { t: '¡Gracias! 🙌', c: 'sun', say: 'Muchas gracias. Quedo atento a sus preguntas.' },
];
const BUDGET = [6, 8, 8, 4]; // segundos por diapositiva
const TARGET = BUDGET.reduce((a, b) => a + b, 0) * 1000;

export default function Demo() {
  const [state, setState] = useState('ready'); // ready | running | done
  const [page, setPage] = useState(0);
  const [laps, setLaps] = useState([]);
  const [, tick] = useState(0);
  const t0 = useRef(0), lap0 = useRef(0);

  useEffect(() => {
    if (state !== 'running') return;
    const i = setInterval(() => tick((x) => x + 1), 100);
    return () => clearInterval(i);
  }, [state]);

  const now = () => (state === 'running' ? performance.now() - t0.current : 0);
  const start = () => { t0.current = performance.now(); lap0.current = 0; setLaps([]); setPage(0); setState('running'); };
  const next = () => {
    const n = now();
    const l = [...laps, n - lap0.current];
    lap0.current = n;
    setLaps(l);
    if (page === SLIDES.length - 1) setState('done');
    else setPage(page + 1);
  };

  useEffect(() => {
    if (state !== 'running') return;
    const k = (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const total = state === 'done' ? laps.reduce((a, b) => a + b, 0) : now();
  const slideMs = state === 'running' ? total - lap0.current : 0;
  const p = state === 'running' ? pace(BUDGET, page, slideMs, total) : 0;
  const remaining = TARGET - total;
  const worst = laps.map((ms, i) => ({ i, over: ms - BUDGET[i] * 1000 })).sort((a, b) => b.over - a.over)[0];
  const s = SLIDES[page];

  return (
    <div className="demo card">
      <div className="demo-stage">
        {state === 'done' ? (
          <div className="demo-report">
            <span className="eyebrow">Tu informe</span>
            <strong className={total > TARGET ? 'over' : 'ok'}>{fmt(total)}</strong>
            <p>{total > TARGET ? `Te pasaste ${fmt(total - TARGET)} de los ${fmt(TARGET)} previstos.` : `¡Dentro de tiempo! Te sobraron ${fmt(TARGET - total)}.`}{worst?.over > 1000 && ` La diapositiva ${worst.i + 1} se llevó ${fmt(worst.over)} de más.`}</p>
            <div className="row">
              <button className="btn ghost" onClick={start}>↺ Repetir</button>
              <Link to="/app" className="btn primary">Hazlo con tu presentación →</Link>
            </div>
          </div>
        ) : (
          <>
            <div className={`demo-slide ${s.c}`} onClick={() => state === 'running' && next()}>
              <small>{page + 1} / {SLIDES.length}</small>
              <b>{s.t}</b>
            </div>
            <p className="demo-prompter">{state === 'running' ? `“${s.say}”` : 'Lee en voz alta lo que aparece aquí y avanza cuando termines.'}</p>
            {state === 'ready'
              ? <button className="btn primary big" onClick={start}>▶ Iniciar ensayo</button>
              : <button className="btn primary big" onClick={next}>{page === SLIDES.length - 1 ? 'Terminar ■' : 'Siguiente →'}</button>}
          </>
        )}
      </div>
      <aside className="demo-side">
        <div className={`demo-timer ${remaining < 0 ? 'over' : remaining < TARGET * 0.25 ? 'warn' : ''}`}>
          <small>{remaining < 0 ? 'Tiempo extra' : 'Tiempo restante'}</small>
          <span>{fmt(remaining)}</span>
          {state === 'running' && <i className={`chip ${p >= 0 ? 'green' : 'red'}`}>{p >= 0 ? `${fmt(p, true)} adelantado` : `${fmt(p)} tarde`}</i>}
        </div>
        <ol className="demo-laps">
          {BUDGET.map((b, i) => {
            const ms = laps[i] ?? (i === page && state === 'running' ? slideMs : 0);
            return (
              <li key={i} className={i === page && state === 'running' ? 'now' : ''}>
                <span>Diap. {i + 1}</span>
                <span className="bar"><i style={{ width: `${Math.min(100, (ms / (b * 1000)) * 100)}%` }} className={ms > b * 1000 ? 'over' : ''} /></span>
                <b>{ms ? fmt(ms) : '—'}</b>
                <small>/{fmt(b * 1000)}</small>
              </li>
            );
          })}
        </ol>
        <p className="muted small">Tip: también puedes avanzar con la tecla <kbd>→</kbd>.</p>
      </aside>
    </div>
  );
}
