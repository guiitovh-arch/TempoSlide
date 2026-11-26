// Páginas de la app: historial de ensayos, temporizador suelto y planes.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize, Pause, Play, RotateCcw, Check } from 'lucide-react';
import { AppNav } from './Dashboard.jsx';
import { listDecks } from './store.js';
import { fmt, phase, rehearsalStats } from './lib.js';
import { plans } from './Landing.jsx';
import { PLAN } from './supabase.js';

export function Rehearsals() {
  const [decks, setDecks] = useState(null);
  useEffect(() => { listDecks().then(setDecks).catch(() => setDecks([])); }, []);
  const rows = (decks || []).flatMap((d) => d.sessions.map((s) => ({ ...s, deck: d }))).sort((a, b) => b.at.localeCompare(a.at));
  const st = rehearsalStats(decks || []);
  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head">
          <div><span className="eyebrow">Historial</span><h1>Tus ensayos</h1></div>
          <div className="stats">
            <div className="stat plum"><b>{st.sessions}</b><span>ensayos</span></div>
            <div className="stat coral"><b>{fmt(st.totalMs)}</b><span>tiempo ensayado</span></div>
            <div className="stat mint"><b>{st.streak} {st.streak === 1 ? 'día' : 'días'}</b><span>racha</span></div>
          </div>
        </header>
        {decks && rows.length === 0 && (
          <div className="card empty"><p>Aún no has ensayado. Abre una presentación, pulsa <b>Presentar</b> y luego <b>Iniciar</b>: cada ensayo aparecerá aquí.</p><Link to="/app" className="btn primary">Ir a mis presentaciones</Link></div>
        )}
        {rows.length > 0 && (
          <div className="card table-card">
            <table className="table">
              <thead><tr><th>Fecha</th><th>Presentación</th><th>Modo</th><th>Duración</th><th>Frente al objetivo</th></tr></thead>
              <tbody>
                {rows.map((s) => {
                  const d = s.totalMs - s.targetMs;
                  return (
                    <tr key={s.id}>
                      <td>{new Date(s.at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td><Link to={`/app/deck/${s.deck.id}?session=${s.id}`} className="deck-link">{s.deck.title}</Link></td>
                      <td className="muted">{s.mode === 'teleprompter' ? 'Teleprompter' : 'Ensayo'}</td>
                      <td className="mono">{fmt(s.totalMs)}</td>
                      <td><span className={`chip ${d > 0 ? 'red' : 'green'}`}>{d > 0 ? `+${fmt(d)} pasado` : `${fmt(-d)} margen`}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const PRESETS = [3, 5, 10, 15, 20, 30];
const savedMin = () => { try { return +localStorage.getItem('ts-timer-min') || 10; } catch { return 10; } };

export function Timer() {
  const [min, setMin] = useState(savedMin);
  const [state, setState] = useState('ready'); // ready | running | paused
  const [, tick] = useState(0);
  const acc = useRef(0), seg = useRef(0), box = useRef(null);
  const elapsed = () => acc.current + (state === 'running' ? performance.now() - seg.current : 0);

  useEffect(() => { try { localStorage.setItem('ts-timer-min', String(min)); } catch {} }, [min]);
  useEffect(() => {
    if (state !== 'running') return;
    const i = setInterval(() => tick((x) => x + 1), 200);
    return () => clearInterval(i);
  }, [state]);

  const toggle = () => {
    if (state === 'running') { acc.current = elapsed(); setState('paused'); }
    else { seg.current = performance.now(); setState('running'); }
  };
  const reset = () => { acc.current = 0; setState('ready'); };
  useEffect(() => {
    const k = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      if (e.key === 'r' || e.key === 'R') reset();
      if (e.key === 'f' || e.key === 'F') box.current?.requestFullscreen?.();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const target = min * 60_000;
  const remaining = target - elapsed();
  const ph = phase(remaining, target);
  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head"><div><span className="eyebrow">Sin subir nada</span><h1>Temporizador</h1><p className="muted">Una cuenta atrás rápida para cualquier intervención. Cambia de color al 25 % y al 10 % del tiempo.</p></div></header>
        <div ref={box} className={`timer-box phase-${ph}`}>
          <div className="timer-presets">
            {PRESETS.map((p) => <button key={p} className={`btn glass small ${p === +min ? 'on' : ''}`} disabled={state !== 'ready'} onClick={() => setMin(p)}>{p} min</button>)}
            <label className="inline">Otro <input type="number" min="1" max="600" value={min} disabled={state !== 'ready'} onChange={(e) => setMin(Math.max(1, +e.target.value || 1))} /> min</label>
          </div>
          <div className="timer-display">{fmt(remaining)}</div>
          <p className="timer-sub">{remaining < 0 ? 'Tiempo extra' : state === 'ready' ? 'Listo para empezar' : state === 'paused' ? 'En pausa' : `Transcurrido ${fmt(elapsed())}`}</p>
          <div className="p-progress"><i style={{ width: `${Math.min(100, (elapsed() / target) * 100)}%` }} /></div>
          <div className="row timer-actions">
            <button className="btn coral big" onClick={toggle}>{state === 'running' ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> {state === 'paused' ? 'Reanudar' : 'Iniciar'}</>}</button>
            <button className="btn glass" onClick={reset} disabled={state === 'ready'}><RotateCcw size={16} /> Reiniciar</button>
            <button className="btn glass" onClick={() => box.current?.requestFullscreen?.()}><Maximize size={16} /> Pantalla completa</button>
          </div>
          <p className="timer-keys">Atajos: <kbd>Espacio</kbd> iniciar/pausar · <kbd>R</kbd> reiniciar · <kbd>F</kbd> pantalla completa</p>
        </div>
      </main>
    </div>
  );
}

export function Plans() {
  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head">
          <div><span className="eyebrow">Planes</span><h1>Elige cómo ensayar</h1></div>
        </header>
        <p className="notice ok"><Check size={16} /> Tu plan actual: <b>{PLAN.name}</b>. Durante la beta tienes todas las funciones sin límites y gratis. Te avisaremos antes de activar los pagos.</p>
        <div className="plans">
          {plans.map((p) => (
            <div key={p.n} className={`plan card ${p.hot ? 'hot' : ''}`}>
              {p.hot && <span className="badge">Más elegido por estudiantes</span>}
              <h3>{p.n}</h3>
              <div className="price">{p.p}</div>
              <small className="muted">{p.s}</small>
              <ul>{p.f.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              <button className="btn ghost" disabled>Disponible pronto</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
