import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmt } from './lib.js';
import Slide, { usePdf } from './Slide.jsx';
import { Logo } from './Landing.jsx';

export function AppNav({ children }) {
  return (
    <nav className="nav wrap app-nav">
      <Logo />
      <div className="nav-links"><Link to="/app">Mis presentaciones</Link></div>
      <div className="row">{children}</div>
    </nav>
  );
}

function Thumb({ id }) {
  const doc = usePdf(id);
  return <Slide doc={doc} page={0} className="thumb" />;
}

function Upload({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const input = useRef(null);

  const send = async (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targetMinutes', minutes);
    try { onDone(await api('/presentations', { method: 'POST', body: fd })); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div
      className={`drop ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]); }}
    >
      <span className="drop-i">{busy ? '⏳' : '📤'}</span>
      <div>
        <h3>{busy ? 'Convirtiendo tu presentación…' : 'Arrastra tu presentación aquí'}</h3>
        <p className="muted">PPTX (con notas del orador), PPT, KEY, ODP o PDF · máx. 100 MB</p>
        {err && <p className="err">{err}</p>}
      </div>
      <label className="inline">
        Tiempo máximo
        <input type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} /> min
      </label>
      <button className="btn primary" disabled={busy} onClick={() => input.current.click()}>Elegir archivo</button>
      <input ref={input} type="file" hidden accept=".pptx,.ppt,.key,.odp,.pdf" onChange={(e) => send(e.target.files[0])} />
    </div>
  );
}

export default function Dashboard() {
  const [decks, setDecks] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api('/presentations').then(setDecks); }, []);

  const totalSessions = decks?.reduce((a, d) => a + d.sessions.length, 0) ?? 0;
  const totalMs = decks?.reduce((a, d) => a + d.sessions.reduce((x, s) => x + s.totalMs, 0), 0) ?? 0;

  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head">
          <div>
            <span className="eyebrow">Tu estudio</span>
            <h1>Hola 👋 ¿Qué ensayamos hoy?</h1>
          </div>
          <div className="stats">
            <div className="stat violet"><b>{decks?.length ?? '–'}</b><span>presentaciones</span></div>
            <div className="stat pink"><b>{totalSessions}</b><span>ensayos</span></div>
            <div className="stat blue"><b>{fmt(totalMs)}</b><span>tiempo ensayado</span></div>
          </div>
        </header>

        <Upload onDone={(d) => nav(`/app/deck/${d.id}`)} />

        <div className="decks">
          {decks?.length === 0 && <p className="muted">Aún no hay presentaciones. Sube la primera ☝️</p>}
          {decks?.map((d) => {
            const last = d.sessions.at(-1);
            const delta = last ? last.totalMs - d.targetMinutes * 60_000 : null;
            return (
              <Link key={d.id} to={`/app/deck/${d.id}`} className="deck card">
                <Thumb id={d.id} />
                <div className="deck-info">
                  <h3>{d.title}</h3>
                  <div className="row small muted">
                    <span>⏳ {d.targetMinutes} min</span>
                    <span>🗂 {d.slideCount ?? '…'} diap.</span>
                    <span>🔁 {d.sessions.length} ensayos</span>
                  </div>
                  {last && (
                    <span className={`chip ${delta > 0 ? 'red' : 'green'}`}>
                      Último: {fmt(last.totalMs)} ({delta > 0 ? `+${fmt(delta)} pasado` : `${fmt(-delta)} de margen`})
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
