import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { User, FolderOpen, Sparkles, LogOut, Home, History, Timer, Clock, Layers, Repeat, GraduationCap } from 'lucide-react';
import DeckMenu from './DeckMenu.jsx';
import { fmt, markedTimes } from './lib.js';
import { listDecks, listLocalDecks, createDeck, updateDeck, importLocalDecks, clearPdfCache } from './store.js';
import { supabase, useAuth, userName, userPrefs, PLAN } from './supabase.js';
import { Avatar } from './Account.jsx';
import { pptxNotes } from './pptx.js';
import Slide, { usePdf } from './Slide.jsx';
import { Logo, ThemeToggle, MobileMenu } from './Landing.jsx';

function UserMenu() {
  const { ready, enabled, user } = useAuth();
  const nav = useNavigate();
  const [count, setCount] = useState(null);
  if (!ready || !enabled) return null;
  if (!user) return <Link to="/login" className="btn ghost small">Entrar</Link>;
  const close = (e) => e.currentTarget.closest('details')?.removeAttribute('open');
  return (
    <details className="account" onToggle={(e) => e.currentTarget.open && listDecks().then((d) => setCount(d.length)).catch(() => {})}>
      <summary title={user.email}>
        <Avatar user={user} size={34} />
        <span className="acc-chip-name hide-sm">{userName(user).split(' ').slice(0, 2).join(' ')}</span>
        <span className="plan-badge hide-sm">{PLAN.badge}</span>
        <span className="caret">▾</span>
      </summary>
      <div className="account-menu card" onClick={close}>
        <div className="menu-head">
          <b>{userName(user)}</b>
          <span className="muted small">{user.email}</span>
          <span className="small"><span className="plan-badge">{PLAN.badge}</span> {count === null ? '' : `${count} presentación${count === 1 ? '' : 'es'} · sin límite en la beta`}</span>
        </div>
        <Link to="/app/cuenta"><User size={16} /> Mi cuenta</Link>
        <Link to="/app"><FolderOpen size={16} /> Mis presentaciones</Link>
        <Link to="/app/planes"><Sparkles size={16} /> Ver planes</Link>
        <Link to="/universidades"><GraduationCap size={16} /> Para universidades</Link>
        <hr />
        <button className="menu-danger" onClick={async () => { await (await supabase()).auth.signOut(); await clearPdfCache(); nav('/'); }}><LogOut size={16} /> Cerrar sesión</button>
      </div>
    </details>
  );
}

const APP_LINKS = [['/app', 'Inicio', Home], ['/app/ensayos', 'Ensayos', History], ['/app/temporizador', 'Temporizador', Timer]]
  .map(([to, t, I]) => <NavLink key={to} to={to} end><I size={16} /> {t}</NavLink>);

export function AppNav({ children }) {
  return (
    <nav className="nav wrap app-nav">
      <Logo to="/app" />
      <div className="nav-links app-links">{APP_LINKS}</div>
      <div className="row">{children}<ThemeToggle /><MobileMenu>{APP_LINKS}</MobileMenu><UserMenu /></div>
    </nav>
  );
}

function Thumb({ id }) {
  const doc = usePdf(id);
  return <Slide doc={doc} page={0} className="thumb" />;
}

function Upload({ onDone, defaultMinutes = 10 }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [minutes, setMinutes] = useState(defaultMinutes);
  const input = useRef(null);

  // Admite 1 archivo (PPTX/KEY/PDF…) o 2 (PDF para las diapositivas + PPTX para las notas).
  const send = async (list) => {
    const files = [...(list || [])];
    if (!files.length) return;
    const ext = (f) => f.name.toLowerCase().split('.').pop();
    const pdfFile = files.find((f) => ext(f) === 'pdf');
    const src = files.find((f) => ext(f) !== 'pdf');
    setBusy(true); setErr('');
    try {
      if (src && !['pptx', 'ppt', 'key', 'odp', 'pps', 'ppsx'].includes(ext(src))) throw new Error('Formato no soportado. Usa PPTX, PPT, KEY, ODP o PDF.');
      const notes = src && ext(src) === 'pptx' ? await pptxNotes(await src.arrayBuffer()).catch(() => []) : [];
      let pdf = pdfFile;
      if (!pdf) {
        if (src.size > 4.4 * 1024 * 1024) throw new Error('Este archivo pesa más de 4,4 MB y no se puede convertir en el servidor. Expórtalo a PDF desde PowerPoint/Keynote y arrastra el PDF junto al PPTX (así conservamos tus notas).');
        const fd = new FormData();
        fd.append('file', src);
        const r = await fetch('/api/convert', { method: 'POST', body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error al convertir (${r.status})`);
        pdf = await r.blob();
      }
      const main = src || pdfFile;
      const marks = markedTimes(notes);
      const deck = await createDeck({ title: main.name.replace(/\.[^.]+$/, ''), fileName: main.name, pdf, notes, targetMinutes: marks ? Math.round((marks.reduce((x, y) => x + y, 0) / 60) * 10) / 10 : +minutes || 10 });
      onDone(marks ? await updateDeck(deck.id, { slideTargets: marks, timesFromNotes: true }) : deck);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div
      className={`drop ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
    >
      <span className="drop-i">{busy ? '⏳' : '📤'}</span>
      <div>
        <h3>{busy ? 'Convirtiendo tu presentación…' : 'Arrastra tu presentación aquí'}</h3>
        <p className="muted">PPTX (con notas del orador), PPT, KEY, ODP o PDF. ¿Deck pesado? Arrastra el PDF + el PPTX juntos.</p>
        {err && <p className="err">{err}</p>}
      </div>
      <label className="inline">
        Tiempo máximo
        <input type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} /> min
      </label>
      <button className="btn primary" disabled={busy} onClick={() => input.current.click()}>Elegir archivo</button>
      <input ref={input} type="file" multiple hidden accept=".pptx,.ppt,.key,.odp,.pdf" onChange={(e) => send(e.target.files)} />
    </div>
  );
}

export default function Dashboard() {
  const [decks, setDecks] = useState(null);
  const nav = useNavigate();
  const auth = useAuth();
  const [imported, setImported] = useState(0);
  const [renaming, setRenaming] = useState(null);
  useEffect(() => {
    if (!auth.ready) return;
    (async () => {
      // Primera vez con sesión: subir a la cuenta lo creado como invitado.
      if (auth.user && (await listLocalDecks()).length) setImported(await importLocalDecks());
      setDecks(await listDecks());
    })().catch((e) => { console.error(e); setDecks([]); });
  }, [auth.ready, auth.user?.id]);

  const totalSessions = decks?.reduce((a, d) => a + d.sessions.length, 0) ?? 0;
  const totalMs = decks?.reduce((a, d) => a + d.sessions.reduce((x, s) => x + s.totalMs, 0), 0) ?? 0;

  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head">
          <div>
            <span className="eyebrow">Tu estudio</span>
            <h1>Hola{auth.user?.user_metadata?.full_name ? `, ${auth.user.user_metadata.full_name.split(' ')[0]}` : ''} 👋 ¿Qué ensayamos hoy?</h1>
          </div>
          <div className="stats">
            <div className="stat plum"><b>{decks?.length ?? '–'}</b><span>presentaciones</span></div>
            <div className="stat coral"><b>{totalSessions}</b><span>ensayos</span></div>
            <div className="stat mint"><b>{fmt(totalMs)}</b><span>tiempo ensayado</span></div>
          </div>
        </header>

        {auth.ready && auth.enabled && !auth.user && (
          <p className="notice">Estás en <b>modo invitado</b>: tus presentaciones solo viven en este navegador. <Link to="/login"><b>Crea una cuenta</b></Link> para guardarlas en la nube.</p>
        )}
        {imported > 0 && <p className="notice ok">☁️ Subimos a tu cuenta {imported} presentación{imported > 1 ? 'es' : ''} que tenías en este navegador.</p>}
        <Upload key={auth.user?.id || 'guest'} defaultMinutes={userPrefs(auth.user).defaultMinutes} onDone={(d) => nav(`/app/deck/${d.id}`)} />

        <div className="decks">
          {decks?.length === 0 && <p className="muted">Aún no hay presentaciones. Sube la primera ☝️</p>}
          {decks?.map((d) => {
            const last = d.sessions.at(-1);
            const delta = last ? last.totalMs - d.targetMinutes * 60_000 : null;
            return (
              <div key={d.id} className="deck card">
                <Link to={`/app/deck/${d.id}`} tabIndex={-1} aria-hidden="true"><Thumb id={d.id} /></Link>
                <div className="deck-info">
                  <div className="deck-title-row">
                    {renaming === d.id ? (
                      <input className="text-input grow" defaultValue={d.title} autoFocus aria-label="Nuevo nombre"
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={async (e) => { const t = e.target.value.trim(); setRenaming(null); if (t && t !== d.title) { await updateDeck(d.id, { title: t }); setDecks(await listDecks()); } }} />
                    ) : <Link to={`/app/deck/${d.id}`} className="deck-link"><h3>{d.title}</h3></Link>}
                    <DeckMenu deck={d} onRename={() => setRenaming(d.id)} onDuplicated={async () => setDecks(await listDecks())} onDeleted={async () => setDecks(await listDecks())} />
                  </div>
                  <div className="row small muted meta">
                    <span><Clock size={14} /> {d.targetMinutes.toLocaleString('es')} min</span>
                    <span><Layers size={14} /> {d.slideCount ?? '…'} diap.</span>
                    <span><Repeat size={14} /> {d.sessions.length} ensayos</span>
                  </div>
                  {last && (
                    <span className={`chip ${delta > 0 ? 'red' : 'green'}`}>
                      Último: {fmt(last.totalMs)} ({delta > 0 ? `+${fmt(delta)} pasado` : `${fmt(-delta)} de margen`})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
