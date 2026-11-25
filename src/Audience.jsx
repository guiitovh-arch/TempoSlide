import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Slide, { usePdf } from './Slide.jsx';

// Ventana para el proyector: solo diapositivas, sincronizada con el presentador.
export default function Audience() {
  const { id } = useParams();
  const doc = usePdf(id);
  const [s, setS] = useState({ page: 0, black: false });
  useEffect(() => {
    const c = new BroadcastChannel(`ts-${id}`);
    c.onmessage = (e) => e.data?.page !== undefined && setS(e.data);
    c.postMessage('hello');
    return () => c.close();
  }, [id]);
  return (
    <div className="audience" onDoubleClick={() => document.documentElement.requestFullscreen?.()} title="Doble clic: pantalla completa">
      <Slide doc={doc} page={s.page} black={s.black} />
    </div>
  );
}
