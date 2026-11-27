import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Play, ScrollText, Wand2, Gauge, EyeOff, Share2, Lock } from 'lucide-react';
import { fmt, deckSlides, manualPlans, requiredPpm, deckPpm, ppmHint, cleanPlanInput, parsePlan, perSlide, cuts } from './lib.js';
import { getDeck, updateDeck, deleteSession, subscribeDeck, assignPresenter } from './store.js';
import { useAuth } from './supabase.js';
import { ShareModal, PresentersPanel, PresenterFilter, matchesFilter, canEditSlide, presenterColor, Chip, memberName, ago, initials } from './Group.jsx';
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
  const [err, setErr] = useState('');
  const [share, setShare] = useState(false);
  const [filter, setFilter] = useState('all');
  const [picked, setPicked] = useState(new Set());
  const [warn, setWarn] = useState(null); // { idx, name }: otro miembro cambió la nota que estás editando
  const focused = useRef(null);
  const auth = useAuth();
  const me = auth.user?.id;

  const reload = () => getDeck(id).then((d) => (d ? setDeck(d) : nav('/app')));
  useEffect(() => { reload(); }, [id]);
  // Cambios de otros miembros en vivo; si tocan la nota que estás editando, avisamos (gana el último guardado).
  useEffect(() => {
    let off = () => {};
    subscribeDeck(id, (table, p) => {
      if (table === 'slides' && p.new?.idx === focused.current && p.new.notes_updated_by && p.new.notes_updated_by !== me) setWarn({ idx: p.new.idx, by: p.new.notes_updated_by });
      reload();
    }).then((f) => { off = f; });
    return () => off();
  }, [id, me]);
  const count = doc?.numPages ?? 0;

  const save = async (patch) => {
    setErr('');
    setDeck((d) => ({ ...d, ...patch }));
    try { setDeck(await updateDeck(id, patch)); setSaved('Guardado ✓'); setTimeout(() => setSaved(''), 1500); }
    catch (e) { setErr(e.message); reload(); }
  };

  // Primera carga: guardar nº de páginas y alinear notas.
  useEffect(() => {
    if (deck?.isOwner && count && (deck.slideCount !== count || (deck._rows && deck._rows.length < count))) save({ slideCount: count, notes: Array.from({ length: count }, (_, i) => deck.notes[i] || '') });
  }, [deck?.id, count]);

  if (!deck) return <div className="app"><AppNav /><main className="wrap"><p className="muted">Cargando…</p></main></div>;

  const slides = count ? deckSlides(deck, count) : [];
  const plan = slides.map((s) => s.plan);
  const planSec = plan.reduce((a, b) => a + b, 0);
  const maxSec = deck.targetMinutes * 60;
  const ppm = deckPpm(slides);
  const setManual = (i, v) => { const p = manualPlans(deck, count); p[i] = v; save({ plan: p, slideTargets: null, timesFromNotes: false }); };
  const editable = (i) => canEditSlide(deck, i, me);
  const proposeAll = () => { const p = manualPlans(deck, count); slides.forEach((s, i) => { if (editable(i)) p[i] = s.proposed; }); save({ plan: p, slideTargets: null, timesFromNotes: false }); };
  const assign = async (idxs, pid) => { setErr(''); try { setDeck(await assignPresenter(id, idxs, pid || null)); setPicked(new Set()); } catch (e) { setErr(e.message); reload(); } };
  const shown = slides.filter((s) => matchesFilter(deck, s.index, filter));
  const grouped = !!auth.user && deck.members?.length > 0;
  const toggleSkip = (i) => { const s = Array.from({ length: count }, (_, j) => !!deck.skipped?.[j]); s[i] = !s[i]; save({ skipped: s }); };

  const session = deck.sessions.find((s) => s.id === sel) || deck.sessions.at(-1);
  const real = session ? perSlide(session.slides, count) : [];
  const toCut = session && session.totalMs > session.targetMs ? cuts(plan, real) : [];
  const maxBar = Math.max(1, ...plan.map((x) => x * 1000), ...real);
  const best = deck.sessions.length ? deck.sessions.reduce((a, s) => (Math.abs(s.totalMs - s.targetMs) < Math.abs(a.totalMs - a.targetMs) ? s : a)) : null;

  return (
    <div className="app">
      <AppNav />
      <main className="wrap">
        <header className="deck-head">
          <div className="deck-title-row full">
            <input className="title-input" aria-label="Título" value={deck.title} readOnly={!deck.isOwner} onChange={(e) => setDeck({ ...deck, title: e.target.value })} onBlur={(e) => deck.isOwner && save({ title: e.target.value })} />
            {grouped && (
              <button className="members-btn" onClick={() => setShare(true)} title="Grupo">
                {deck.members.slice(0, 4).map((m) => m.avatar_url ? <img key={m.user_id} className="avatar" src={m.avatar_url} alt={m.name} referrerPolicy="no-referrer" /> : <span key={m.user_id} className="avatar" title={m.name}>{initials(m.name)}</span>)}
                {deck.isOwner && <span className="share-lbl"><Share2 size={14} /> Compartir</span>}
              </button>
            )}
            <span className="muted small saved">{saved}</span>
            <Link className="btn ghost" to={`/present/${id}?prompter=1`}><ScrollText size={16} /> <span className="hide-sm">Ensayar con teleprompter</span></Link>
            <Link className="btn coral" to={`/present/${id}`}><Play size={16} /> Presentar</Link>
            <DeckMenu deck={deck} onDuplicated={(c) => nav(`/app/deck/${c.id}`)} onDeleted={() => nav('/app')} onChanged={() => window.location.reload()} />
          </div>
          <div className="row">
            <label className="inline">Tiempo máximo
              <input type="number" min="1" step="0.5" value={deck.targetMinutes} disabled={!deck.isOwner} onChange={(e) => save({ targetMinutes: +e.target.value || 1 })} /> min
            </label>
            {deck.timesFromNotes && <span className="chip green">⏱ Plan importado de tus notas</span>}
            <button className="btn ghost small" onClick={proposeAll} title="Rellena el plan de todas las diapositivas a partir de las notas"><Wand2 size={14} /> Proponer plan para todas</button>
            <Link className="btn ghost small" to={`/app/analizador?deck=${id}`}><Gauge size={14} /> Analizar</Link>
            {auth.user && deck.isOwner && <button className="btn ghost small" onClick={() => setShare(true)}><Share2 size={14} /> Compartir</button>}
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
                      <span>#{deck.sessions.length - i} · {new Date(s.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}{s.blind && <span className="tag" title="Ensayo a ciegas"><EyeOff size={12} /> a ciegas</span>}{s.audio && <span className="tag" title="Con grabación">🎙 {fmt(s.audio.seconds * 1000)}</span>}</span>
                      <b>{fmt(s.totalMs)}</b>
                      <span className={`chip ${d > 0 ? 'red' : 'green'}`}>{d > 0 ? `+${fmt(d)} pasado` : `${fmt(-d)} margen`}</span>
                      <button className="x" title="Borrar ensayo" onClick={async (e) => { e.stopPropagation(); if (s.audio && !confirm('Este ensayo tiene una grabación. ¿Borrar el ensayo y su grabación?')) return; setDeck(await deleteSession(id, s.id)); }}>×</button>
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

        {err && <p className="notice" role="alert">{err}</p>}
        <PresentersPanel deck={deck} slides={slides} onChanged={reload} />

        <div className="row between slides-head">
          <h2 className="left">Diapositiva a diapositiva</h2>
          <PresenterFilter deck={deck} value={filter} onChange={setFilter} />
        </div>
        {picked.size > 0 && deck.presenters.length > 0 && (
          <div className="assign-bar card">
            <b>{picked.size} seleccionada{picked.size > 1 ? 's' : ''}</b>
            <label className="inline">Asignar a
              <select value="" onChange={(e) => e.target.value && assign([...picked], e.target.value === 'none' ? null : e.target.value)}>
                <option value="">Elige…</option>{deck.presenters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="none">Sin asignar</option>
              </select>
            </label>
            <button className="link-btn" onClick={() => setPicked(new Set())}>Cancelar</button>
          </div>
        )}
        <p className="muted">Edita el guion (alimenta el teleprompter), el plan en segundos de cada diapositiva u omítela. <span className="legend"><i className="plan" /> plan <i className="real" /> {session ? 'ensayo seleccionado' : 'ensayo'}</span></p>
        <div className="slides-list">
          {shown.length === 0 && <p className="muted">Nadie tiene diapositivas con este filtro.</p>}
          {shown.map((s) => {
            const i = s.index;
            const sppm = requiredPpm(s.words, s.plan);
            const hint = ppmHint(sppm);
            const can = editable(i);
            const pid = deck.presenterOf?.[i];
            const meta = deck.notesMeta?.[i];
            return (
              <div key={i} className={`slide-row card ${s.omitted ? 'skipped' : ''} ${pid ? 'assigned' : ''}`} style={pid ? { '--pc': presenterColor(deck, pid) } : undefined}>
                <div className="slide-row-thumb">
                  {deck.presenters.length > 0 && <input type="checkbox" className="pick" aria-label={`Seleccionar diapositiva ${i + 1}`} checked={picked.has(i)} onChange={(e) => { const n = new Set(picked); e.target.checked ? n.add(i) : n.delete(i); setPicked(n); }} />}
                  <span className="num">{i + 1}</span><Slide doc={doc} page={i} className="thumb" />
                  {pid && <span className="thumb-chip"><Chip deck={deck} id={pid} /></span>}
                </div>
                <div className="notes-col">
                  <textarea
                    key={focused.current === i ? `f${i}` : `${i}-${meta?.at || ''}-${(deck.notes[i] || '').length}`}
                    placeholder={can ? 'Escribe aquí lo que vas a decir en esta diapositiva…' : 'Sin notas'}
                    defaultValue={deck.notes[i] || ''}
                    readOnly={!can}
                    onFocus={() => { focused.current = i; }}
                    onBlur={(e) => { focused.current = null; if (warn?.idx === i) setWarn(null); if (can && e.target.value !== (deck.notes[i] || '')) { const n = [...deck.notes]; n[i] = e.target.value; save({ notes: n }); } }}
                  />
                  {warn?.idx === i && <small className="ppm-hint bad" role="alert">{memberName(deck, warn.by)} acaba de cambiar esta nota. Si guardas, tu versión sustituirá a la suya.</small>}
                  <small className="muted">
                    {!can && <><Lock size={11} /> Solo lectura: la presenta {deck.presenters.find((p) => p.id === pid)?.name}. </>}
                    {grouped && meta?.by && meta?.at && <>Editado por {meta.by === me ? 'ti' : memberName(deck, meta.by)} {ago(meta.at)}</>}
                  </small>
                </div>
                <div className="slide-row-time">
                  <div className="row">
                    <label className="inline">Plan <PlanInput manual={s.manualPlan} proposed={s.proposed} disabled={s.omitted || !can} onCommit={(v) => setManual(i, v)} /> s</label>
                    {s.manualPlan == null && !s.omitted && can && <button className="link-btn small" onClick={() => setManual(i, s.proposed)} title="Fijar el plan propuesto">Proponer</button>}
                  </div>
                  <div className="bars">
                    <span className="bar plan"><i style={{ width: `${((s.plan * 1000) / maxBar) * 100}%` }} /></span>
                    {session && <span className={`bar real ${real[i] > s.plan * 1000 * 1.15 ? 'over' : ''}`}><i style={{ width: `${(real[i] / maxBar) * 100}%` }} /></span>}
                  </div>
                  <small className="muted">
                    {session ? `Real ${fmt(real[i])} · ` : ''}{s.words} palabras{sppm ? ` · ≈ ${sppm} ppm` : ''}
                  </small>
                  {hint && !s.omitted && <small className={`ppm-hint ${sppm > 180 ? 'bad' : ''}`}>{hint}</small>}
                  <label className="inline small"><input type="checkbox" checked={s.omitted} disabled={!can} onChange={() => toggleSkip(i)} /> Omitir al presentar</label>
                  {deck.presenters.length > 0 && (
                    <label className="inline small">Presenta
                      <select value={pid || ''} disabled={!can} onChange={(e) => assign([i], e.target.value || null)}>
                        <option value="">Sin asignar</option>{deck.presenters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      {share && <ShareModal deck={deck} onClose={() => setShare(false)} onChanged={reload} />}
    </div>
  );
}
