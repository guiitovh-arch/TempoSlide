import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fmt, words, estimateSlides, budgets, band, perSlide, cuts } from './lib.js';
import { getDeck, updateDeck, deleteDeck, putDeck } from './store.js';
import Slide, { usePdf } from './Slide.jsx';
import { AppNav } from './Dashboard.jsx';

export default function Deck() {
  const { id } = useParams();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const doc = usePdf(id);
  const [deck, setDeck] = useState(null);
  const [sel, setSel] = useState(q.get('session'));
  const [saved, setSaved] = useState('');

  useEffect(() => { getDeck(id).then((d) => (d ? setDeck(d) : nav('/app'))); }, [id]);
  const count = doc?.numPages ?? 0;

  const save = async (patch) => {
    setDeck((d) => ({ ...d, ...patch }));
    setDeck(await updateDeck(id, patch));
    setSaved('Guardado ✓'); setTimeout(() => setSaved(''), 1500);
  };

  // Primera carga: guardar nº de páginas y alinear notas.
  useEffect(() => {
    if (deck && count && deck.slideCount !== count) save({ slideCount: count, notes: Array.from({ length: count }, (_, i) => deck.notes[i] || '') });
  }, [deck?.id, count]);

  const plan = useMemo(() => (deck && count ? budgets(deck, count) : []), [deck, count]);
  if (!deck) return <div className="app"><AppNav /><main className="wrap"><p className="muted">Cargando…</p></main></div>;

  const skipped = deck.skipped || [];
  const excluded = Array.from({ length: count }, (_, i) => !!skipped[i] || (!!deck.slideTargets && plan[i] === 0)); // omitidas o anexos
  const est = count ? estimateSlides(deck.notes, count, deck.wpm, excluded).reduce((a, b) => a + b, 0) : 0;
  const b = band(est, deck.targetMinutes * 60);
  const session = deck.sessions.find((s) => s.id === sel) || deck.sessions.at(-1);
  const real = session ? perSlide(session.slides, count) : [];
  const toCut = session && session.totalMs > session.targetMs ? cuts(plan, real) : [];
  const maxBar = Math.max(1, ...plan.map((x) => x * 1000), ...real);
  const hasNotes = deck.notes.some((n) => n?.trim());
  // ppm necesarias para decir el guion en el tiempo planificado (5 s por diapositiva para transiciones).
  const scriptWords = deck.notes.reduce((x, n, i) => x + (excluded[i] ? 0 : words(n)), 0);
  const speakSec = plan.reduce((x, y) => x + y, 0) - excluded.filter((e) => !e).length * 5;
  const requiredWpm = Math.round(scriptWords / (Math.max(speakSec, 30) / 60));
  const best = deck.sessions.length ? deck.sessions.reduce((a, s) => (Math.abs(s.totalMs - s.targetMs) < Math.abs(a.totalMs - a.targetMs) ? s : a)) : null;
  const setTarget = (i, v) => {
    const t = [...plan]; t[i] = Math.max(0, +v || 0);
    save({ slideTargets: t, timesFromNotes: false, targetMinutes: Math.round((t.reduce((a, x) => a + x, 0) / 60) * 10) / 10 });
  };
  const toggleSkip = (i) => {
    const s = Array.from({ length: count }, (_, j) => !!skipped[j]); s[i] = !s[i];
    save({ skipped: s, slideTargets: null });
  };

  return (
    <div className="app">
      <AppNav>
        <span className="muted small">{saved}</span>
        <Link className="btn ghost" to={`/present/${id}?prompter=1`}>📜 Ensayar con teleprompter</Link>
        <Link className="btn primary" to={`/present/${id}`}>▶ Presentar</Link>
      </AppNav>
      <main className="wrap">
        <header className="deck-head">
          <input className="title-input" value={deck.title} onChange={(e) => setDeck({ ...deck, title: e.target.value })} onBlur={(e) => save({ title: e.target.value })} />
          <div className="row">
            <label className="inline">Tiempo máximo
              <input type="number" min="1" step="0.5" value={deck.targetMinutes} onChange={(e) => save({ targetMinutes: +e.target.value || 1, slideTargets: null })} /> min
            </label>
            <label className="inline">Ritmo de habla
              <input type="number" min="60" max="220" value={deck.wpm || 130} onChange={(e) => save({ wpm: +e.target.value || 130, slideTargets: null })} /> ppm
            </label>
            {deck.timesFromNotes && deck.slideTargets && <span className="chip green">⏱ Tiempos importados de tus notas</span>}
            {deck.slideTargets && <button className="btn ghost small" onClick={() => save({ slideTargets: null })}>↺ Reparto automático</button>}
            <button className="btn ghost small danger" onClick={async () => { if (confirm('¿Borrar esta presentación y sus ensayos?')) { await deleteDeck(id); nav('/app'); } }}>Borrar</button>
          </div>
        </header>

        <section className="grid2">
          <div className="card analysis">
            <span className="eyebrow">Pre-análisis</span>
            <div className="big-num">{fmt(est * 1000)}</div>
            <p>duración estimada para <b>{deck.targetMinutes} min</b> disponibles</p>
            <span className="chip" style={{ background: b.color }}>{b.label}</span>
            <p className="muted small">
              {hasNotes ? `Basado en ${deck.notes.reduce((a, n, i) => a + (excluded[i] ? 0 : words(n)), 0)} palabras de notas a ${deck.wpm || 130} ppm + transiciones${skipped.some(Boolean) ? ` · ${skipped.filter(Boolean).length} diapositivas omitidas` : ''}.` : 'Sin notas del orador: añade tu guion abajo para una estimación precisa (y para el teleprompter).'}
            </p>
            {hasNotes && b.key === 'over' && <p className="small">Para cuadrar tendrías que hablar a <b>{requiredWpm} ppm</b> o recortar guion.</p>}
            {best && <p className="small">🏆 Mejor ensayo: <b>{fmt(best.totalMs)}</b> ({deck.sessions.length} ensayos en total)</p>}
          </div>
          <div className="card">
            <span className="eyebrow">Ensayos</span>
            {deck.sessions.length === 0 ? (
              <p className="muted">Todavía no has ensayado. Pulsa <b>Presentar</b> y luego <b>Iniciar</b>.</p>
            ) : (
              <ul className="sessions">
                {[...deck.sessions].reverse().map((s, i) => {
                  const d = s.totalMs - s.targetMs;
                  return (
                    <li key={s.id} className={s.id === session?.id ? 'on' : ''} onClick={() => setSel(s.id)}>
                      <span>#{deck.sessions.length - i} · {new Date(s.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <b>{fmt(s.totalMs)}</b>
                      <span className={`chip ${d > 0 ? 'red' : 'green'}`}>{d > 0 ? `+${fmt(d)} pasado` : `${fmt(-d)} margen`}</span>
                      <button className="x" title="Borrar ensayo" onClick={async (e) => { e.stopPropagation(); setDeck(await putDeck({ ...deck, sessions: deck.sessions.filter((x) => x.id !== s.id) })); }}>×</button>
                    </li>
                  );
                })}
              </ul>
            )}
            {toCut.length > 0 && (
              <div className="cuts">
                <b>✂️ Dónde recortar</b> — te pasaste {fmt(session.totalMs - session.targetMs)}. Estas diapositivas se comen más tiempo del previsto:
                <ul>{toCut.map((c) => <li key={c.index}>Diapositiva {c.index + 1}: <b>+{fmt(c.overMs)}</b> sobre su plan</li>)}</ul>
              </div>
            )}
          </div>
        </section>

        <h2 className="left">Diapositiva a diapositiva</h2>
        <p className="muted">Edita el guion (alimenta el teleprompter), el tiempo de cada diapositiva u omítela. <span className="legend"><i className="plan" /> plan <i className="real" /> {session ? 'ensayo seleccionado' : 'ensayo'}</span></p>
        <div className="slides-list">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={`slide-row card ${skipped[i] ? 'skipped' : ''}`}>
              <div className="slide-row-thumb"><span className="num">{i + 1}</span><Slide doc={doc} page={i} className="thumb" /></div>
              <textarea
                placeholder="Escribe aquí lo que vas a decir en esta diapositiva…"
                defaultValue={deck.notes[i] || ''}
                onBlur={(e) => { if (e.target.value !== (deck.notes[i] || '')) { const n = [...deck.notes]; n[i] = e.target.value; save({ notes: n }); } }}
              />
              <div className="slide-row-time">
                <label className="inline">Plan
                  <input type="number" min="0" value={plan[i] ?? 0} disabled={skipped[i]} onChange={(e) => setTarget(i, e.target.value)} /> s
                </label>
                <div className="bars">
                  <span className="bar plan"><i style={{ width: `${((plan[i] * 1000) / maxBar) * 100}%` }} /></span>
                  {session && <span className={`bar real ${real[i] > plan[i] * 1000 * 1.15 ? 'over' : ''}`}><i style={{ width: `${(real[i] / maxBar) * 100}%` }} /></span>}
                </div>
                <small className={session && real[i] > plan[i] * 1000 * 1.15 ? 'err' : 'muted'}>{session ? `Real ${fmt(real[i])} · ` : ''}{words(deck.notes[i])} palabras</small>
                <label className="inline small"><input type="checkbox" checked={!!skipped[i]} onChange={() => toggleSkip(i)} /> Omitir al presentar</label>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
