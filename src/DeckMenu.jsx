// Menú ⋯ de una presentación (tarjeta del inicio y página de la presentación).
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Copy, Download, Trash2 } from 'lucide-react';
import { duplicateDeck, downloadPdf, deleteDeck } from './store.js';

export default function DeckMenu({ deck, onRename, onDuplicated, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (e.key === 'Escape' || (e.type === 'mousedown' && !ref.current?.contains(e.target))) setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', off);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', off); };
  }, [open]);
  const act = (fn) => async (e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <div className="deck-menu" ref={ref} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button className="icon-btn" aria-label="Más acciones" aria-haspopup="menu" aria-expanded={open} disabled={busy} onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
      {open && (
        <div className="menu-pop card" role="menu">
          {onRename && <button role="menuitem" onClick={act(async () => onRename())}><Pencil size={16} /> Renombrar</button>}
          <button role="menuitem" onClick={act(async () => onDuplicated?.(await duplicateDeck(deck.id)))}><Copy size={16} /> Duplicar</button>
          <button role="menuitem" onClick={act(() => downloadPdf(deck))}><Download size={16} /> Descargar PDF</button>
          <hr />
          <button role="menuitem" className="menu-danger" onClick={act(async () => {
            if (!confirm(`¿Borrar «${deck.title}» y sus ${deck.sessions.length} ensayos? No se puede deshacer.`)) return;
            await deleteDeck(deck.id); onDeleted?.();
          })}><Trash2 size={16} /> Borrar</button>
        </div>
      )}
    </div>
  );
}
