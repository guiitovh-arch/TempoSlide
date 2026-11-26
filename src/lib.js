// Lógica pura de tiempos (sin React) — probada en test/smoke.js.

export const fmt = (ms, signed = false) => {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const t = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (neg ? '−' : signed ? '+' : '') + t;
};

export const words = (t = '') => (t.trim() ? t.trim().split(/\s+/).length : 0);

// Ritmo en vivo: positivo = vas adelantado (te sobra tiempo), negativo = vas tarde.
export const pace = (budgetsSec, index, slideElapsedMs, totalElapsedMs) => {
  const plannedBefore = budgetsSec.slice(0, index).reduce((a, b) => a + b, 0) * 1000;
  const plannedNow = plannedBefore + Math.min(slideElapsedMs, budgetsSec[index] * 1000);
  return plannedNow - totalElapsedMs;
};

// Fase del temporizador por % restante.
export const phase = (remainingMs, targetMs) =>
  remainingMs < 0 ? 'over' : remainingMs <= targetMs * 0.1 ? 'danger' : remainingMs <= targetMs * 0.25 ? 'warn' : 'ok';

// Suma tiempos por diapositiva (una diapositiva puede visitarse varias veces).
export const perSlide = (slides, count) => {
  const out = Array(count).fill(0);
  for (const s of slides) if (s.index < count) out[s.index] += s.ms;
  return out;
};

// Dónde recortar: diapositivas que más se pasan de su plan en un ensayo (ms reales vs. segundos de plan).
export const cuts = (planSec, realMs, n = 3) =>
  planSec
    .map((p, i) => ({ index: i, overMs: realMs[i] - p * 1000 }))
    .filter((x) => x.overMs > 2000)
    .sort((a, b) => b.overMs - a.overMs)
    .slice(0, n);

// Marcas de tiempo al inicio de las notas, p. ej. "(30 s)", "(1 min)", "(1,5 min)". null si no hay ninguna.
// Las diapositivas sin marca (anexos) quedan en 0 s: no cuentan para el plan.
export const markedTimes = (notes) => {
  const t = notes.map((n) => {
    const m = (n || '').match(/^\s*\((\d+(?:[.,]\d+)?)\s*(s|seg|segundos?|min|minutos?|m)\.?\)/i);
    return m ? Math.round(parseFloat(m[1].replace(',', '.')) * (/^m/i.test(m[2]) ? 60 : 1)) : 0;
  });
  return t.some(Boolean) ? t : null;
};

// Estadísticas de ensayo para el perfil.
export const rehearsalStats = (decks, today = new Date()) => {
  const sessions = decks.flatMap((d) => d.sessions || []);
  const totalMs = sessions.reduce((a, s) => a + s.totalMs, 0);
  const best = sessions.length ? Math.min(...sessions.map((s) => Math.abs(s.totalMs - s.targetMs) / s.targetMs)) : null;
  // Racha: días consecutivos con al menos un ensayo, terminando hoy o ayer.
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  const days = new Set(sessions.map((s) => day(s.at)));
  let streak = 0;
  const cur = new Date(today);
  if (!days.has(day(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (days.has(day(cur))) { streak++; cur.setUTCDate(cur.getUTCDate() - 1); }
  return { decks: decks.length, sessions: sessions.length, totalMs, best, streak };
};

// ─── Plan por diapositiva ────────────────────────────────────────────────────
// El plan escrito a mano manda y nada lo recalcula. Sin plan manual se propone uno:
// notas a 150 ppm (+2 s de transición) o, sin notas, un valor por tipo de diapositiva.
export const PPM = 150;
export const SLIDE_TYPES = { titulo: 'Título', seccion: 'Sección', contenido: 'Contenido', grafico: 'Gráfico', cierre: 'Cierre' };
export const FALLBACK = { titulo: 10, seccion: 5, contenido: 20, grafico: 30, cierre: 15 };
export const defaultType = (i, count) => (i === 0 ? 'titulo' : i === count - 1 ? 'cierre' : 'contenido');
export const proposeSeconds = (s) => Math.round(s.words ? (s.words / PPM) * 60 + 2 : FALLBACK[s.type] ?? 15);
export const slideSeconds = (s) => (s.omitted ? 0 : s.manualPlan ?? proposeSeconds(s));

// deck.plan: segundos manuales por diapositiva (null = propuesto). deck.slideTargets es el formato antiguo.
export const manualPlans = (deck, count) => Array.from({ length: count }, (_, i) => deck.plan?.[i] ?? deck.slideTargets?.[i] ?? null);
export const deckSlides = (deck, count) => {
  const manual = manualPlans(deck, count);
  return Array.from({ length: count }, (_, i) => {
    const s = { index: i, words: words(deck.notes?.[i]), type: deck.types?.[i] || defaultType(i, count), omitted: !!deck.skipped?.[i], manualPlan: manual[i] };
    return { ...s, proposed: proposeSeconds(s), plan: slideSeconds(s) };
  });
};

// Ritmo necesario para un plan; null si no hay datos para calcularlo.
export const requiredPpm = (w, seconds) => (w > 0 && seconds > 0 ? Math.round(w / (seconds / 60)) : null);
// Global: solo diapositivas con notas y plan, sin las omitidas.
export const deckPpm = (slides) => {
  const s = slides.filter((x) => !x.omitted && x.words > 0 && x.plan > 0);
  return requiredPpm(s.reduce((t, x) => t + x.words, 0), s.reduce((t, x) => t + x.plan, 0));
};
export const ppmHint = (ppm) => (ppm == null ? null : ppm > 180 ? 'Muy rápido para este plan' : ppm < 110 ? 'Te sobra tiempo' : null);

// Campo de plan: texto mientras se escribe, número al salir. '' = sin plan manual.
export const cleanPlanInput = (raw) => raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3);
export const parsePlan = (raw) => { const v = cleanPlanInput(raw); return v === '' ? null : Math.min(600, Number(v)); };

// ─── Cronómetro del ensayo ───────────────────────────────────────────────────
// El total es la suma por diapositiva, así reiniciar una lo ajusta.
// t = { cur, done: ms acumulados por diapositiva, since: ms | null (null = en pausa), resets: nº por diapositiva }
export const newClock = (count, cur = 0) => ({ cur, done: Array(count).fill(0), resets: Array(count).fill(0), since: null });
const live = (t, now) => (t.since == null ? 0 : now - t.since);
export const slideMs = (t, now) => t.done[t.cur] + live(t, now);
export const totalMs = (t, now) => t.done.reduce((a, b) => a + b, 0) + live(t, now);
const bank = (t, now) => { const done = [...t.done]; done[t.cur] += live(t, now); return done; };
export const goTo = (t, i, now) => ({ ...t, done: bank(t, now), cur: i, since: t.since == null ? null : now });
export const pauseClock = (t, now) => ({ ...t, done: bank(t, now), since: null });
export const resumeClock = (t, now) => ({ ...t, since: now });
export function resetSlide(t, now) {
  const done = [...t.done], resets = [...t.resets];
  done[t.cur] = 0; resets[t.cur] += 1;
  return { ...t, done, resets, since: t.since == null ? null : now };
}
// Deshacer: devuelve a la diapositiva el tiempo que tenía al reiniciar; lo corrido después se conserva.
export function undoReset(before, after, resetAt) {
  const done = [...after.done], resets = [...after.resets], i = before.cur;
  done[i] += slideMs(before, resetAt); resets[i] -= 1;
  return { ...after, done, resets };
}

// ─── Analizador ──────────────────────────────────────────────────────────────
export const CONTEXTS = {
  defensa: { label: 'Defensa (TFM, TFG, tesis)', k: 1 },
  clase: { label: 'Clase', k: 1.1 },
  pitch: { label: 'Pitch', k: 1.05 },
  reunion: { label: 'Reunión', k: 1.15 },
  congreso: { label: 'Congreso', k: 1 },
};
// Monte Carlo con semilla fija: el mismo archivo y la misma configuración dan el mismo resultado.
export function simulate({ seconds, maxSec, ctx = 'defensa', runs = 1000 }) {
  let a = 1;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const k = CONTEXTS[ctx]?.k ?? 1;
  const totals = Array.from({ length: runs }, () => {
    const pace = 1 + 0.1 * gauss();
    return seconds.reduce((t, s) => t + s * Math.max(0.5, 1 + 0.15 * gauss()), 0) * pace * k;
  }).sort((x, y) => x - y);
  const at = (p) => totals[Math.floor(p * (runs - 1))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9), totals, over: maxSec ? totals.filter((t) => t > maxSec).length : null };
}
export const verdict = (pct) => (pct < 0.7 ? 'short' : pct < 0.95 ? 'ok' : pct <= 1.05 ? 'tight' : 'over');
// Histograma: n barras entre el mínimo y el máximo; cada barra sabe si está por encima del límite.
export const histogram = (totals, maxSec, n = 24) => {
  const lo = totals[0], hi = totals[totals.length - 1], w = (hi - lo) / n || 1;
  const bins = Array.from({ length: n }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const t of totals) bins[Math.min(n - 1, Math.floor((t - lo) / w))].count++;
  return bins.map((b) => ({ ...b, over: maxSec != null && b.from + w / 2 > maxSec }));
};
// Qué recortar: las más largas (sin portada ni cierre) hasta cubrir el exceso.
export const cutSuggestions = (slides, overSec) => {
  const out = []; let left = overSec;
  for (const s of slides.filter((x) => !x.omitted && x.plan > 0 && x.type !== 'titulo' && x.type !== 'cierre').sort((a, b) => b.plan - a.plan)) {
    if (left <= 0) break;
    out.push(s); left -= s.plan;
  }
  return out;
};
// Si sobra: 10 % de margen y el resto repartido en proporción al plan.
export const spareAllocation = (slides, spareSec) => {
  const margin = Math.round(spareSec * 0.1), rest = spareSec - margin;
  const sum = slides.reduce((t, s) => t + (s.omitted ? 0 : s.plan), 0) || 1;
  return { margin, extra: slides.map((s) => (s.omitted ? 0 : Math.round((s.plan / sum) * rest))) };
};

// ─── Organizador ─────────────────────────────────────────────────────────────
// session: { day, room, start (min desde 00:00), talks: [{ id, minutes, predicted (seg), speakers: [] }] }
export const timeline = (s) => { let t = s.start; return s.talks.map((x) => ({ ...x, day: s.day, room: s.room, start: t, end: (t += x.minutes) })); };
// Minuto en que acabará: acabar antes no compensa a quien se pasa.
export const forecast = (s) => s.talks.reduce((t, x) => t + Math.max(x.minutes, (x.predicted ?? 0) / 60), s.start);
export function conflicts(sessions) {
  const all = sessions.flatMap(timeline);
  return all.flatMap((a, i) => {
    const found = a.predicted > a.minutes * 60 ? [{ type: 'se-pasa', ids: [a.id] }] : [];
    for (const b of all.slice(i + 1)) {
      if (a.day !== b.day || a.start >= b.end || b.start >= a.end) continue;
      if (a.room && a.room === b.room) found.push({ type: 'sala', ids: [a.id, b.id] });
      if (a.speakers?.some((p) => b.speakers?.includes(p))) found.push({ type: 'ponente', ids: [a.id, b.id] });
    }
    return found;
  });
}
export const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

// CSV seguro: comillas y ' delante de =, +, -, @ (evita fórmulas al abrir en Excel).
export const csvCell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
