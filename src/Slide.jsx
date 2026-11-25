import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getPdf } from './store.js';

pdfjs.GlobalWorkerOptions.workerSrc = worker;
const cache = new Map();
export const loadPdf = (id) => {
  if (!cache.has(id)) cache.set(id, getPdf(id).then(async (b) => pdfjs.getDocument({ data: new Uint8Array(await b.arrayBuffer()) }).promise));
  return cache.get(id);
};

export function usePdf(id) {
  const [doc, setDoc] = useState(null);
  useEffect(() => { loadPdf(id).then(setDoc); }, [id]);
  return doc;
}

// Renderiza la página `page` (0-based) ajustada al ancho del contenedor.
export default function Slide({ doc, page, className = '', black = false }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [ratio, setRatio] = useState(9 / 16);

  useEffect(() => {
    if (!doc || page < 0 || page >= doc.numPages) return;
    let task, cancelled = false;
    const draw = async () => {
      const p = await doc.getPage(page + 1);
      if (cancelled) return;
      const v1 = p.getViewport({ scale: 1 });
      setRatio(v1.height / v1.width);
      const w = wrap.current.clientWidth || 800;
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: (w / v1.width) * dpr });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      task?.cancel();
      task = p.render({ canvas: c, viewport: vp });
      task.promise.catch(() => {});
    };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap.current);
    return () => { cancelled = true; ro.disconnect(); task?.cancel(); };
  }, [doc, page]);

  return (
    <div ref={wrap} className={`slide ${className}`} style={{ aspectRatio: `${1 / ratio}`, "--ar": 1 / ratio }}>
      {doc && page < doc.numPages ? <canvas ref={canvas} style={{ opacity: black ? 0 : 1 }} /> : <div className="slide-empty">{doc ? 'Fin' : ''}</div>}
    </div>
  );
}
