import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from './lib.js';
import Demo from './Demo.jsx';

const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
export function ThemeToggle() {
  const [t, setT] = useState(() => document.documentElement.dataset.theme || systemTheme());
  const flip = () => {
    const n = t === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem('ts-theme', n); } catch {}
    setT(n);
  };
  return <button className="theme-toggle" onClick={flip} aria-label={t === 'dark' ? 'Activar modo claro' : 'Activar modo nocturno'} title={t === 'dark' ? 'Modo claro' : 'Modo nocturno'}>{t === 'dark' ? '☀️' : '🌙'}</button>;
}

export const Logo = () => (
  <Link to="/" className="logo">
    <span className="logo-mark">◔</span> TempoSlide
  </Link>
);

function HeroMock() {
  const [t, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((x) => (x + 1) % 600), 1000); return () => clearInterval(i); }, []);
  const remaining = 10 * 60_000 - (183 + t) * 1000;
  const laps = [42, 61, 38, 15 + (t % 60)];
  return (
    <div className="mock">
      <div className="mock-top">
        <span className="dot r" /><span className="dot y" /><span className="dot g" />
        <span className="mock-title">Defensa TFM · ensayo 3</span>
      </div>
      <div className="mock-body">
        <div className="mock-slide">
          <small>04 / 12</small>
          <b>Metodología</b>
          <span>Design thinking + prototipado</span>
        </div>
        <div className="mock-side">
          <div className="mock-timer">{fmt(remaining)}</div>
          <div className="chip green">+00:12 adelantado</div>
          <ul className="mock-laps">
            {laps.map((s, i) => (
              <li key={i} className={i === 3 ? 'now' : ''}>
                <span>Diap. {i + 1}</span>
                <span className="bar"><i style={{ width: `${Math.min(100, (s / 60) * 100)}%` }} /></span>
                <b>{fmt(s * 1000)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mock-prompter">“…seguí un enfoque de <mark>design thinking</mark>. Entrevisté a doce estudiantes y prototipé tres versiones…”</div>
    </div>
  );
}

function Calculator() {
  const [min, setMin] = useState(15);
  const [slides, setSlides] = useState(20);
  const per = (min * 60) / Math.max(slides, 1);
  return (
    <div className="calc card">
      <div className="calc-inputs">
        <label>Minutos que te dan<input type="range" min="3" max="60" value={min} onChange={(e) => setMin(+e.target.value)} /><b>{min} min</b></label>
        <label>Diapositivas<input type="range" min="3" max="80" value={slides} onChange={(e) => setSlides(+e.target.value)} /><b>{slides}</b></label>
      </div>
      <div className="calc-out">
        <span>Tienes</span>
        <strong>{Math.round(per)} s</strong>
        <span>por diapositiva. {per < 30 ? 'Spoiler: vas a correr. 🏃' : per < 60 ? 'Ajustado, pero se puede. 🎯' : 'Hay espacio para respirar. 🌿'}</span>
      </div>
    </div>
  );
}

const features = [
  { c: 'plum', i: '⏳', t: 'Temporizador', d: 'Cuenta atrás desde que pulsas “Iniciar”. Cambia de color al 25% y al 10%, y te avisa si entras en tiempo extra.' },
  { c: 'coral', i: '⏱️', t: 'Cronómetro por diapositiva', d: 'Cada diapositiva se cronometra desde que entras hasta que pasas a la siguiente. Sabrás exactamente dónde se te va el tiempo.' },
  { c: 'lilac', i: '📜', t: 'Teleprompter', d: 'Tus notas del orador se importan solas del PPTX. Auto-scroll al ritmo de tu presupuesto, modo espejo y tamaño ajustable.' },
  { c: 'mint', i: '🔮', t: 'Pre-análisis', d: 'Antes de ensayar, estimamos cuánto dura tu presentación según tus notas y te decimos si vas cómodo o te vas a pasar.' },
  { c: 'sun', i: '🖥️', t: 'Pantalla de público', d: 'Abre una segunda ventana para el proyector. Tú ves tiempos y notas; ellos solo ven tus diapositivas.' },
  { c: 'plum', i: '📈', t: 'Informe de ensayos', d: 'Compara cada ensayo con tu plan, diapositiva a diapositiva. Ve cómo mejoras de un ensayo a otro.' },
];

const plans = [
  { n: 'Gratis', p: '0 €', s: 'para siempre', f: ['2 presentaciones', 'Temporizador + cronómetro por diapositiva', 'Teleprompter básico', 'Últimos 3 ensayos guardados'], cta: 'Empezar gratis' },
  { n: 'Pase Defensa', p: '4,99 €', s: 'pago único · 30 días', hot: true, f: ['Todo Pro durante 30 días', 'Perfecto para tu TFM, TFG o pitch', 'Sin suscripción, no se renueva', 'Tus datos se quedan contigo'], cta: 'Preparar mi defensa' },
  { n: 'Pro', p: '6,99 €', s: '/ mes · o 49 € / año', f: ['Presentaciones ilimitadas', 'Historial completo e informes', 'Pantalla de público + atajos', 'Teleprompter avanzado (espejo, auto-ritmo)'], cta: 'Probar Pro' },
  { n: 'Universidades', p: 'A medida', s: 'licencia campus', f: ['Cuentas para alumnos y tribunales', 'Plantillas de defensa con tiempos oficiales', 'Panel para docentes', 'Soporte y onboarding'], cta: 'Hablemos' },
];

const faqs = [
  ['¿Qué formatos puedo subir?', 'PPTX (recomendado: importamos tus notas del orador), PPT, Keynote, ODP y PDF. Convertimos todo a un formato que se ve igual en cualquier navegador.'],
  ['¿El temporizador empieza solo?', 'No. Empieza en el momento exacto en que pulsas “Iniciar”. Puedes pausarlo si el tribunal te interrumpe.'],
  ['¿Cómo calcula el cronómetro por diapositiva?', 'Mide desde que entras a una diapositiva hasta que pasas a otra. Si vuelves atrás, el tiempo se suma a esa diapositiva.'],
  ['¿Necesito instalar algo?', 'No. Funciona en el navegador. Para proyectar, abre la “Pantalla de público” y arrástrala al proyector.'],
  ['¿Qué pasa con mis archivos?', 'Se guardan en tu biblioteca para que puedas ensayar las veces que quieras, y puedes borrarlos cuando quieras.'],
  ['¿En qué se diferencia de un calculador de tiempo?', 'Los calculadores estiman una cifra. TempoSlide además te acompaña en directo: cuenta atrás, ritmo por diapositiva, teleprompter e informe de cada ensayo.'],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="nav wrap">
        <Logo />
        <div className="nav-links">
          <a href="#funciones">Funciones</a>
          <a href="#como">Cómo funciona</a>
          <a href="#demo">Pruébalo</a>
          <a href="#precios">Precios</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="row">
          <ThemeToggle />
          <Link to="/login" className="btn ghost small hide-sm">Entrar</Link>
          <Link to="/app" className="btn dark">Abrir app</Link>
        </div>
      </nav>

      <header className="hero wrap">
        <div>
          <span className="eyebrow">Déjame adivinar…</span>
          <h1>Te sobraron diapositivas y <span className="hl">te faltó tiempo.</span></h1>
          <p className="lead">TempoSlide es tu copiloto para presentar: temporizador, cronómetro por diapositiva y teleprompter en un solo lugar. Sube tu presentación, ensaya con datos y llega a tu defensa sabiendo que cuadra.</p>
          <div className="row">
            <Link to="/app" className="btn primary big">Subir mi presentación →</Link>
            <a href="#como" className="btn ghost big">Cómo funciona</a>
          </div>
          <p className="micro">Sin instalar · PPTX, Keynote, PDF · Gratis para empezar</p>
        </div>
        <HeroMock />
      </header>

      <div className="strip wrap">
        {['🎓 Defensas TFM/TFG', '🚀 Pitches', '🎤 Congresos', '👩‍🏫 Clases', '💼 Comités'].map((x) => <span key={x}>{x}</span>)}
      </div>

      <section id="funciones" className="wrap">
        <h2>Tres herramientas que se entienden entre sí.<br /><span className="muted">Y tres más que no sabías que necesitabas.</span></h2>
        <div className="bento">
          {features.map((f, i) => (
            <article key={f.t} className={`feat ${f.c} ${i < 3 ? 'main' : ''}`}>
              <span className="feat-i">{f.i}</span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="como" className="wrap">
        <h2>Así funciona</h2>
        <ol className="steps">
          {[
            ['Sube tu deck', 'Arrastra tu PPTX o PDF. Importamos diapositivas y notas.'],
            ['Fija tu tiempo', 'Dinos cuántos minutos tienes. Repartimos un presupuesto por diapositiva.'],
            ['Ensaya', 'Pulsa “Iniciar”. Temporizador, cronómetro y teleprompter trabajan juntos.'],
            ['Mejora', 'Revisa el informe: qué diapositivas te comen el tiempo y cuánto mejoras.'],
          ].map(([t, d], i) => (
            <li key={t} className="card"><span className="num">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
      </section>

      <section id="demo" className="wrap">
        <span className="eyebrow center-block">Pruébalo ahora</span>
        <h2>Ensaya 30 segundos aquí mismo.</h2>
        <p className="muted center sub">Cuatro diapositivas, un plan de tiempo y tu voz. Mira cómo el cronómetro mide cada una.</p>
        <Demo />
      </section>

      <section className="wrap">
        <h2>¿Cuánto tiempo tienes de verdad?</h2>
        <Calculator />
      </section>

      <section id="precios" className="wrap">
        <h2>Precios honestos</h2>
        <p className="muted center">Pagas cuando lo necesitas: una defensa, un semestre o todo el campus.</p>
        <div className="plans">
          {plans.map((p) => (
            <div key={p.n} className={`plan card ${p.hot ? 'hot' : ''}`}>
              {p.hot && <span className="badge">Más elegido por estudiantes</span>}
              <h3>{p.n}</h3>
              <div className="price">{p.p}</div>
              <small className="muted">{p.s}</small>
              <ul>{p.f.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              <Link to="/app" className={`btn ${p.hot ? 'primary' : 'ghost'}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
        <p className="micro center">Estamos en beta: de momento todos los planes son gratis mientras activamos los pagos.</p>
      </section>

      <section id="faq" className="wrap narrow">
        <h2>Preguntas frecuentes</h2>
        {faqs.map(([q, a]) => (
          <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>

      <footer className="footer">
        <div className="wrap">
          <h2>Deja de adivinar.<br />Empieza a ensayar.</h2>
          <Link to="/app" className="btn primary big">Abrir TempoSlide →</Link>
          <div className="foot-row"><Logo /><span className="foot-links"><Link to="/privacidad">Privacidad</Link><Link to="/terminos">Términos</Link></span><span>Hecho con ganas para mentes ágiles · © 2026</span></div>
        </div>
      </footer>
    </div>
  );
}
