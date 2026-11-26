// Biblioteca: todas las presentaciones con buscador, orden, carpeta y etiquetas.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Layers, Repeat, Search, Folder, Tag } from 'lucide-react';
import { AppNav } from './Dashboard.jsx';
import DeckMenu from './DeckMenu.jsx';
import Slide, { usePdf } from './Slide.jsx';
import { listDecks, updateDeck } from './store.js';
import { fmt, deckSlides } from './lib.js';

function Thumb({ id }) {
  const doc = usePdf(id);
  return <Slide doc={doc} page={0} className="thumb" />;
}

export const planSeconds = (d) => (d.slideCount ? deckSlides(d, d.slideCount).reduce((a, s) => a + s.plan, 0) : null);

export function DeckCard({ deck: d, folders, onChange }) {
  const [renaming, setRenaming] = useState(false);
  const nav = useNavigate();
  const last = d.sessions.at(-1);
  const delta = last ? last.totalMs - d.targetMinutes * 60_000 : null;
  const plan = planSeconds(d);
  return (
    <div className="deck card">
      <Link to={`/app/deck/${d.id}`} tabIndex={-1} aria-hidden="true"><Thumb id={d.id} /></Link>
      <div className="deck-info">
        <div className="deck-title-row">
          {renaming ? (
            <input className="text-input grow" defaultValue={d.title} autoFocus aria-label="Nuevo nombre"
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(false); }}
              onBlur={async (e) => { const t = e.target.value.trim(); setRenaming(false); if (t && t !== d.title) { await updateDeck(d.id, { title: t }); onChange(); } }} />
          ) : <Link to={`/app/deck/${d.id}`} className="deck-link"><h3>{d.title}</h3></Link>}
          <DeckMenu deck={d} folders={folders} onRename={() => setRenaming(true)} onDuplicated={onChange} onDeleted={onChange} onChanged={onChange} />
        </div>
        <div className="row small muted meta">
          <span title="Duración del plan"><Clock size={14} /> {plan ? fmt(plan * 1000) : `${d.targetMinutes.toLocaleString('es')} min`}</span>
          <span><Layers size={14} /> {d.slideCount ?? '…'} diap.</span>
          <span><Repeat size={14} /> {d.sessions.length} ensayos</span>
        </div>
        {(d.folder || d.tags?.length > 0) && (
          <div className="row tags">
            {d.folder && <button className="tag" onClick={() => nav(`/app/presentaciones?carpeta=${encodeURIComponent(d.folder)}`)}><Folder size={12} /> {d.folder}</button>}
            {d.tags?.map((t) => <button key={t} className="tag" onClick={() => nav(`/app/presentaciones?etiqueta=${encodeURIComponent(t)}`)}><Tag size={12} /> {t}</button>)}
          </div>
        )}
        {last && (
          <span className={`chip ${delta > 0 ? 'red' : 'green'}`}>
            Último: {fmt(last.totalMs)} ({delta > 0 ? `+${fmt(delta)} pasado` : `${fmt(-delta)} de margen`})
          </span>
        )}
      </div>
    </div>
  );
}

const SORTS = { reciente: 'Más recientes', nombre: 'Nombre', duracion: 'Duración' };

export default function Library() {
  const [decks, setDecks] = useState(null);
  const [err, setErr] = useState('');
  const params = new URLSearchParams(location.search);
  const [qText, setQText] = useState('');
  const [sort, setSort] = useState('reciente');
  const [folder, setFolder] = useState(params.get('carpeta') || '');
  const [tag, setTag] = useState(params.get('etiqueta') || '');
  const load = () => listDecks().then(setDecks).catch((e) => { setErr(e.message); setDecks([]); });
  useEffect(() => { load(); }, []);

  const folders = useMemo(() => [...new Set((decks || []).map((d) => d.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [decks]);
  const tags = useMemo(() => [...new Set((decks || []).flatMap((d) => d.tags || []))].sort((a, b) => a.localeCompare(b, 'es')), [decks]);
  const shown = (decks || [])
    .filter((d) => !qText || d.title.toLowerCase().includes(qText.toLowerCase()))
    .filter((d) => !folder || (folder === '__none' ? !d.folder : d.folder === folder))
    .filter((d) => !tag || d.tags?.includes(tag))
    .sort((a, b) => sort === 'nombre' ? a.title.localeCompare(b.title, 'es') : sort === 'duracion' ? (planSeconds(b) || 0) - (planSeconds(a) || 0) : b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="dash-head">
          <div><span className="eyebrow">Biblioteca</span><h1>Presentaciones</h1></div>
          <Link to="/app" className="btn primary">Subir presentación</Link>
        </header>
        {err && <p className="notice">No pudimos cargar tus presentaciones: {err}</p>}
        <div className="lib-tools">
          <label className="search"><Search size={16} /><input className="text-input" placeholder="Buscar por nombre…" value={qText} onChange={(e) => setQText(e.target.value)} aria-label="Buscar presentaciones" /></label>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">{Object.entries(SORTS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Carpeta">
            <option value="">Todas las carpetas</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value="__none">Sin carpeta</option>
          </select>
          {tags.length > 0 && (
            <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Etiqueta">
              <option value="">Todas las etiquetas</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        {decks === null && <p className="muted">Cargando…</p>}
        {decks?.length === 0 && !err && <div className="card empty"><p>Tu biblioteca está vacía. Sube tu primera presentación y aparecerá aquí, con su plan, sus ensayos y sus etiquetas.</p><Link to="/app" className="btn primary">Subir presentación</Link></div>}
        {decks?.length > 0 && shown.length === 0 && <p className="muted">Ninguna presentación coincide con estos filtros.</p>}
        <div className="decks">{shown.map((d) => <DeckCard key={d.id} deck={d} folders={folders} onChange={load} />)}</div>
      </main>
    </div>
  );
}
