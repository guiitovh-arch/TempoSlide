import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { User, FolderOpen, Sparkles, LogOut, Home, History, Timer, Clock, Layers, Repeat, GraduationCap, Gauge, CalendarDays, CalendarRange, Users, LayoutGrid, ChevronDown } from 'lucide-react';
import { fmt, markedTimes } from './lib.js';
import { listDecks, listLocalDecks, createDeck, updateDeck, importLocalDecks, clearPdfCache, retryPendingAudio, pendingAudioCount } from './store.js';
import { supabase, useAuth, userName, userPrefs, PLAN } from './supabase.js';
import { Avatar } from './Account.jsx';
import { filesToDeck, ACCEPT } from './convert.js';
import { DeckCard } from './Library.jsx';
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
        <Link to="/app/presentaciones"><FolderOpen size={16} /> Mis presentaciones</Link>
        <Link to="/app/temporizador"><Timer size={16} /> Temporizador</Link>
        <Link to="/app/planes"><Sparkles size={16} /> Ver planes</Link>
        <Link to="/universidades"><GraduationCap size={16} /> Para universidades</Link>
        <hr />
        <button className="menu-danger" onClick={async () => { await (await supabase()).auth.signOut(); await clearPdfCache(); nav('/'); }}><LogOut size={16} /> Cerrar sesión</button>
      </div>
    </details>
  );
}

const link = ([to, t, I]) => <NavLink key={to} to={to} end={to === '/app'}><I size={16} /> {t}</NavLink>;
const MAIN_LINKS = [['/app', 'Inicio', Home], ['/app/analizador', 'Analizador', Gauge], ['/app/presentaciones', 'Presentaciones', FolderOpen], ['/app/ensayos', 'Ensayos', History]];
const ORG_LINKS = [['/app/eventos', 'Eventos', CalendarDays], ['/app/organizador', 'Organizador', CalendarRange], ['/app/ponentes', 'Ponentes', Users], ['/app/posters', 'Pósteres', LayoutGrid]];

// «Organizar ▾»: desplegable por debajo de 1280 px; se abre con clic o teclado y se cierra con Esc o al salir.
function OrgDropdown() {
  const loc = useLocation();
  const active = ORG_LINKS.some(([to]) => loc.pathname.startsWith(to));
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary').focus(); } };
    const out = (e) => { if (ref.current?.open && !ref.current.contains(e.target)) ref.current.open = false; };
    document.addEventListener('keydown', k); document.addEventListener('mousedown', out);
    return () => { document.removeEventListener('keydown', k); document.removeEventListener('mousedown', out); };
  }, []);
  return (
    <details ref={ref} className={`org-drop ${active ? 'active' : ''}`} onClick={(e) => e.target.closest('a') && ref.current.removeAttribute('open')}>
      <summary>Organizar <ChevronDown size={14} /></summary>
      <div className="menu-pop card">{ORG_LINKS.map(link)}</div>
    </details>
  );
}

export function AppNav() {
  return (
    <nav className="nav wrap app-nav">
      <Logo to="/app" />
      <div className="nav-links app-links">
        {MAIN_LINKS.map(link)}
        <span className="org-pill">{ORG_LINKS.map(link)}</span>
        <OrgDropdown />
      </div>
      <div className="row nav-right"><ThemeToggle /><MobileMenu>{MAIN_LINKS.map(link)}<hr />{ORG_LINKS.map(link)}</MobileMenu><UserMenu /></div>
    </nav>
  );
}


export function Upload({ onDone, defaultMinutes = 10, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [minutes, setMinutes] = useState(defaultMinutes);
  const input = useRef(null);

  const send = async (list) => {
    setBusy(true); setErr('');
    try {
      const { pdf, notes, main } = await filesToDeck(list);
      const marks = markedTimes(notes);
      const deck = await createDeck({ title: main.name.replace(/\.[^.]+$/, ''), fileName: main.name, pdf, notes, targetMinutes: marks ? Math.round((marks.reduce((x, y) => x + y, 0) / 60) * 10) / 10 : +minutes || 10 });
      onDone(marks ? await updateDeck(deck.id, { plan: marks, timesFromNotes: true }) : deck);
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
      <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => send(e.target.files)} />
    </div>
  );
}

export default function Dashboard() {
  const [decks, setDecks] = useState(null);
  const nav = useNavigate();
  const auth = useAuth();
  const [imported, setImported] = useState(0);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!auth.ready) return;
    // Tras iniciar sesión desde una invitación, volver a ella.
    try { const next = sessionStorage.getItem('ts-next'); if (auth.user && next) { sessionStorage.removeItem('ts-next'); nav(next, { replace: true }); return; } } catch {}
    (async () => {
      // Primera vez con sesión: subir a la cuenta lo creado como invitado.
      if (auth.user && (await listLocalDecks()).length) setImported(await importLocalDecks());
      if (auth.user && (await pendingAudioCount())) { await retryPendingAudio(); setPending(await pendingAudioCount()); }
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
        {pending > 0 && <p className="notice">🎙 Grabación pendiente de subir ({pending}). Lo reintentaremos la próxima vez que abras TempoSlide.</p>}
        {imported > 0 && <p className="notice ok">☁️ Subimos a tu cuenta {imported} presentación{imported > 1 ? 'es' : ''} que tenías en este navegador.</p>}
        <Upload key={auth.user?.id || 'guest'} defaultMinutes={userPrefs(auth.user).defaultMinutes} onDone={(d) => nav(`/app/deck/${d.id}`)} />

        <div className="row between recent-head">
          <h2 className="left">Recientes</h2>
          {decks?.length > 0 && <Link to="/app/presentaciones" className="btn ghost small">Ver todas ({decks.length}) →</Link>}
        </div>
        <div className="decks">
          {decks?.length === 0 && <p className="muted">Aún no hay presentaciones. Sube la primera ☝️</p>}
          {decks?.slice(0, 6).map((d) => <DeckCard key={d.id} deck={d} onChange={async () => setDecks(await listDecks())} />)}
        </div>
      </main>
    </div>
  );
}
