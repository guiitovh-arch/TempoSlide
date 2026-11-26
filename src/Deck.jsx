import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Play, ScrollText, Wand2, Gauge, EyeOff } from 'lucide-react';
import { fmt, deckSlides, manualPlans, requiredPpm, deckPpm, ppmHint, cleanPlanInput, parsePlan, perSlide, cuts } from './lib.js';
import { getDeck, updateDeck, putDeck } from './store.js';
import Slide, { usePdf } from './Slide.jsx';
import { AppNav } from './Dashboard.jsx';
import DeckMenu from './DeckMenu.jsx';

// Campo de plan: vacío con el propuesto en gris, texto mientras se escribe, número al salir.
function PlanInput({ manual, proposed, disabled, onCommit }) {
  const [raw, setRaw] = useState(manual == null ? '' : String(manual));
  useEffect(() => { setRaw(manual == null ? '' : String(manual)); }, [manual]);
  return (
    <input className="plan-input" inputMode="numeric" pattern="[0-9]*" maxLength={3} aria-label="Segundos de plan"
      placeholder={String(proposed)} value={raw} disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setRaw(cleanPlanInput(e.target.value))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onBlur={() => { const v = parsePlan(raw); setRaw(v == null ? '' : String(v)); if (v !== manual) onCommit(v); }} />
  );
}

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

  if (!deck) return <div className="app"><AppNav /><main className="wrap"><p className="muted">Cargando…</p></main></div>;

  const slides = count ? deckSlides(deck, count) : [];
  const plan = slides.map((s) => s.plan);
  const planSec = plan.reduce((a, b) => a + b, 0);
  const maxSec = deck.targetMinutes * 60;
  const ppm = deckPpm(slides);
  const setManual = (i, v) => { const p = manualPlans(deck, count); p[i] = v; save({ plan: p, slideTargets: null, timesFromNotes: false }); };
  const proposeAll = () => save({ plan: slides.map((s) => s.proposed), slideTargets: null, timesFromNotes: false });
  const toggleSkip = (i) => { const s = Array.from({ length: count }, (_, j) => !!deck.skipped?.[j]); s[i] = !s[i]; save({ skipped: s }); };

  const session = deck.sessions.find((s) => s.id === sel) || deck.sessions.at(-1);
  const real = session ? perSlide(session.slides, count) : [];
  const toCut = session && session.totalMs > session.targetMs ? cuts(plan, real) : [];
  const maxBar = Math.max(1, ...plan.map((x) => x * 1000), ...real);
  const best = deck.sessions.length ? deck.sessions.reduce((a, s) => (Math.abs(s.totalMs - s.targetMs) < Math.abs(a.totalMs - a.targetMs) ? s : a)) : null;

  return (
    <div className="app">
      <AppNav>
        <span className="muted small">{saved}</span>
        <Link className="btn ghost" to={`/present/${id}?prompter=1`}><ScrollText size={16} /> <span className="hide-sm">Ensayar con teleprompter</span></Link>
        <Link className="btn coral" to={`/present/${id}`}><Play size={16} /> Presentar</Link>
      </AppNav>
      <main className="wrap">
        <header className="deck-head">
          <div className="deck-title-row full">
            <input className="title-input" aria-label="Título" value={deck.title} onChange={(e) => setDeck({ ...deck, title: e.target.value })} onBlur={(e) => save({ title: e.target.value })} />
            <DeckMenu deck={deck} onDuplicated={(c) => nav(`/app/deck/${c.id}`)} onDeleted={() => nav('/app')} />
          </div>
          <div className="row">
            <label className="inline">Tiempo máximo
              <input type="number" min="1" step="0.5" value={deck.targetMinutes} onChange={(e) => save({ targetMinutes: +e.target.value || 1 })} /> min
            </label>
            {deck.timesFromNotes && <span className="chip green">⏱ Plan importado de tus notas</span>}
            <button className="btn ghost small" onClick={proposeAll} title="Rellena el plan de todas las diapositivas a partir de las notas"><Wand2 size={14} /> Proponer plan para todas</button>
            <Link className="btn ghost small" to={`/app/analizador?deck=${id}`}><Gauge size={14} /> Analizar</Link>
          </div>
        </header>

        <section className="grid2">
          <div className="card analysis">
            <span className="eyebrow">Tu plan</span>
            <div className="big-num">{fmt(planSec * 1000)}</div>
            <div className="usage" title={`${Math.round((planSec / maxSec) * 100)} % del tiempo`}>
              <i style={{ width: `${Math.min(100, (planSec / maxSec / 1.3) * 100)}%`, background: planSec > maxSec ? '#c43c32' : '#397449' }} />
              <span className="usage-limit" style={{ left: `${100 / 1.3}%` }} />
            </div>
            {planSec > maxSec
              ? <p className="tip">Tu plan suma <b>{fmt(planSec * 1000)}</b> y tienes <b>{fmt(maxSec * 1000)}</b>: recorta <b>{fmt((planSec - maxSec) * 1000)}</b>.</p>
              : <p>Tienes {fmt(maxSec * 1000)}: te quedan <b>{fmt((maxSec - planSec) * 1000)}</b> de margen.</p>}
            {ppm && <p>Para cumplir tu plan de {fmt(planSec * 1000)} necesitas hablar a unos <b>{ppm} ppm</b>{ppmHint(ppm) && <span className={`ppm-hint ${ppm > 180 ? 'bad' : ''}`}> · {ppmHint(ppm)}</span>}.</p>}
            {!ppm && <p className="muted small">Añade tu guion en las notas para ver a qué ritmo tendrás que hablar.</p>}
            {best && <p className="small">🏆 Mejor ensayo: <b>{fmt(best.totalMs)}</b> de {deck.sessions.length}.</p>}
            <p className="muted small">El plan que escribes manda: no cambia al editar notas ni el tiempo máximo. Los campos vacíos usan el valor propuesto (en gris).</p>
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
                      <span>#{deck.sessions.length - i} · {new Date(s.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}{s.blind && <span className="tag" title="Ensayo a ciegas"><EyeOff size={12} /> a ciegas</span>}</span>
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
        <p className="muted">Edita el guion (alimenta el teleprompter), el plan en segundos de cada diapositiva u omítela. <span className="legend"><i className="plan" /> plan <i className="real" /> {session ? 'ensayo seleccionado' : 'ensayo'}</span></p>
        <div className="slides-list">
          {slides.map((s, i) => {
            const sppm = requiredPpm(s.words, s.plan);
            const hint = ppmHint(sppm);
            return (
              <div key={i} className={`slide-row card ${s.omitted ? 'skipped' : ''}`}>
                <div className="slide-row-thumb"><span className="num">{i + 1}</span><Slide doc={doc} page={i} className="thumb" /></div>
                <textarea
                  placeholder="Escribe aquí lo que vas a decir en esta diapositiva…"
                  defaultValue={deck.notes[i] || ''}
                  onBlur={(e) => { if (e.target.value !== (deck.notes[i] || '')) { const n = [...deck.notes]; n[i] = e.target.value; save({ notes: n }); } }}
                />
                <div className="slide-row-time">
                  <div className="row">
                    <label className="inline">Plan <PlanInput manual={s.manualPlan} proposed={s.proposed} disabled={s.omitted} onCommit={(v) => setManual(i, v)} /> s</label>
                    {s.manualPlan == null && !s.omitted && <button className="link-btn small" onClick={() => setManual(i, s.proposed)} title="Fijar el plan propuesto">Proponer</button>}
                  </div>
                  <div className="bars">
                    <span className="bar plan"><i style={{ width: `${((s.plan * 1000) / maxBar) * 100}%` }} /></span>
                    {session && <span className={`bar real ${real[i] > s.plan * 1000 * 1.15 ? 'over' : ''}`}><i style={{ width: `${(real[i] / maxBar) * 100}%` }} /></span>}
                  </div>
                  <small className="muted">
                    {session ? `Real ${fmt(real[i])} · ` : ''}{s.words} palabras{sppm ? ` · ≈ ${sppm} ppm` : ''}
                  </small>
                  {hint && !s.omitted && <small className={`ppm-hint ${sppm > 180 ? 'bad' : ''}`}>{hint}</small>}
                  <label className="inline small"><input type="checkbox" checked={s.omitted} onChange={() => toggleSkip(i)} /> Omitir al presentar</label>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
