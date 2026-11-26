// Menú ⋯ de una presentación (tarjetas y página de la presentación).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Copy, Download, Trash2, FileUp, FolderInput } from 'lucide-react';
import { duplicateDeck, downloadPdf, deleteDeck, replaceDeckFile, updateDeck } from './store.js';
import { filesToDeck, ACCEPT } from './convert.js';
import { forgetPdf } from './Slide.jsx';

function FolderTags({ deck, folders, onClose, onSaved }) {
  const [folder, setFolder] = useState(deck.folder || '');
  const [tags, setTags] = useState((deck.tags || []).join(', '));
  const save = async (e) => {
    e.preventDefault();
    const t = [...new Set(tags.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12);
    onSaved(await updateDeck(deck.id, { folder: folder.trim() || null, tags: t }));
    onClose();
  };
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <form className="modal card" role="dialog" aria-modal="true" aria-labelledby="ft-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h3 id="ft-title">Carpeta y etiquetas</h3>
        <label>Carpeta <input className="text-input" list="ts-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="p. ej. Máster 2027" maxLength={60} autoFocus /></label>
        <datalist id="ts-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        <label>Etiquetas <input className="text-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="defensa, borrador, inglés" /><small className="muted">Separadas por comas.</small></label>
        <div className="row"><button className="btn primary">Guardar</button><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </div>,
    document.body
  );
}

export default function DeckMenu({ deck, folders = [], onRename, onDuplicated, onDeleted, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [ft, setFt] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef(null), file = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (e.key === 'Escape' || (e.type === 'mousedown' && !ref.current?.contains(e.target))) setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); };
  }, [open]);
  const act = (label, fn) => async (e) => {
    e.preventDefault(); e.stopPropagation(); setOpen(false); setErr(''); setBusy(label);
    try { await fn(); } catch (x) { setErr(x.message); } finally { setBusy(''); }
  };
  const replace = act('Reemplazando…', async () => {
    const files = file.current.files; if (!files?.length) return;
    const d = await replaceDeckFile(deck.id, await filesToDeck(files));
    forgetPdf(deck.id); file.current.value = '';
    onChanged?.(d);
  });
  return (
    <div className="deck-menu" ref={ref} onClick={(e) => { e.stopPropagation(); }}>
      <button className="icon-btn" aria-label="Más acciones" aria-haspopup="menu" aria-expanded={open} disabled={!!busy} title={busy || 'Más acciones'} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
      <input ref={file} type="file" multiple hidden accept={ACCEPT} onChange={replace} />
      {open && (
        <div className="menu-pop card" role="menu">
          {onRename && <button role="menuitem" onClick={act('', async () => onRename())}><Pencil size={16} /> Renombrar</button>}
          <button role="menuitem" onClick={act('Duplicando…', async () => onDuplicated?.(await duplicateDeck(deck.id)))}><Copy size={16} /> Duplicar</button>
          <button role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); file.current.click(); }}><FileUp size={16} /> Reemplazar archivo</button>
          <button role="menuitem" onClick={act('', () => downloadPdf(deck))}><Download size={16} /> Descargar PDF</button>
          <button role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); setFt(true); }}><FolderInput size={16} /> Carpeta y etiquetas</button>
          <hr />
          <button role="menuitem" className="menu-danger" onClick={act('Borrando…', async () => {
            if (!confirm(`¿Borrar «${deck.title}» y sus ${deck.sessions.length} ensayos? No se puede deshacer.`)) return;
            await deleteDeck(deck.id); onDeleted?.();
          })}><Trash2 size={16} /> Borrar</button>
        </div>
      )}
      {busy && <span className="menu-busy">{busy}</span>}
      {err && <span className="menu-err" role="alert">{err}</span>}
      {ft && <FolderTags deck={deck} folders={folders} onClose={() => setFt(false)} onSaved={(d) => onChanged?.(d)} />}
    </div>
  );
}
