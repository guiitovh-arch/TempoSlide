// Landing del plan Universidades (jornadas de defensa). Aún sin producto: capta universidades piloto.
import { Link } from 'react-router-dom';
import { CalendarDays, Users, FolderKanban, QrCode, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { Logo, ThemeToggle, EnterButton } from './Landing.jsx';

const CONTACT = 'ddyitocontacto@gmail.com';
const mail = `mailto:${CONTACT}?subject=${encodeURIComponent('TempoSlide para universidades: piloto')}&body=${encodeURIComponent('Hola, me interesa el piloto de TempoSlide para jornadas de defensa.\n\nUniversidad / programa:\nNº aproximado de defensas por convocatoria:\nFechas de la próxima convocatoria:\n')}`;

const SLOTS = [
  { h: '09:00', n: 'Lucía M.', st: 'ok', t: 'Lista · ensayó 4 veces · 14:10 / 15:00' },
  { h: '09:20', n: 'Pablo R.', st: 'warn', t: 'Se pasará · previsto +3:20' },
  { h: '09:40', n: 'Marta S.', st: 'bad', t: 'Sin ensayar · presentación subida' },
  { h: '10:00', n: 'Jorge P.', st: 'ok', t: 'Lista · ensayó 2 veces · 14:45 / 15:00' },
];
const ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: XCircle };

const FEATURES = [
  [FolderKanban, 'Convocatorias', 'Agrupa una jornada completa: “Defensas TFM · junio 2027”, con fechas, aulas, tribunales y la duración oficial por alumno.'],
  [CalendarDays, 'Calendario de defensas', 'Franjas por aula y tribunal. Cada alumno vincula su presentación y ves, antes de empezar, a qué hora terminará de verdad cada sesión.'],
  [Users, 'Alumnos', 'Estado de cada alumno de un vistazo: presentación subida, ensayada, lista. Aviso de “no ha ensayado nunca” para que el tutor actúe a tiempo.'],
  [QrCode, 'Horario público con QR', 'Un enlace y un cartel con QR para alumnos, tribunales y familias. Siempre actualizado, sin reenviar PDFs.'],
];

export default function Universities() {
  return (
    <div className="landing">
      <nav className="nav wrap">
        <Logo />
        <div className="nav-links"><a href="#funciones">Funciones</a><a href="#como">Cómo funciona</a><a href="#piloto">Piloto</a></div>
        <div className="row"><ThemeToggle /><EnterButton /></div>
      </nav>

      <header className="hero wrap">
        <div>
          <span className="eyebrow">TempoSlide para universidades</span>
          <h1>Jornadas de defensa que <span className="hl">terminan a su hora.</span></h1>
          <p className="lead">Veinte defensas, dos días, tres aulas y 15 minutos por alumno. TempoSlide te dice antes de empezar quién se va a pasar, y ayuda a cada alumno a ensayar hasta que cuadre.</p>
          <div className="row">
            <a href={mail} className="btn coral big">Únete al piloto →</a>
            <a href="#como" className="btn ghost big">Cómo funciona</a>
          </div>
          <p className="micro">En desarrollo · buscamos másteres y grados para la convocatoria de 2027</p>
        </div>
        <div className="uni-mock card">
          <div className="row between"><b>Aula 2.1 · Tribunal A</b><span className="plan-badge">Defensas TFM · junio</span></div>
          <ul className="uni-slots">
            {SLOTS.map((s) => { const I = ICON[s.st]; return (
              <li key={s.h} className={s.st}><span className="mono">{s.h}</span><b>{s.n}</b><span className="uni-st"><I size={16} /> {s.t}</span></li>
            ); })}
          </ul>
          <p className="uni-banner"><AlertTriangle size={16} /> <span>Según lo previsto, la sesión acaba a las <b>10:23</b>: <b>3 min</b> más tarde de lo programado.</span></p>
        </div>
      </header>

      <section id="funciones" className="wrap">
        <h2>Lo que un congreso necesita, a la medida de una defensa.</h2>
        <div className="bento uni-features">
          {FEATURES.map(([I, t, d]) => (
            <article key={t} className="feat plum"><span className="feat-i uni-i"><I size={24} /></span><h3>{t}</h3><p>{d}</p></article>
          ))}
        </div>
      </section>

      <section id="como" className="wrap">
        <h2>Así funcionará</h2>
        <ol className="steps uni-steps">
          {[
            ['Crea la convocatoria', 'Fechas, aulas, tribunales y minutos por alumno. Importa la lista de alumnos desde Excel.'],
            ['Los alumnos se unen', 'Con un código de la convocatoria. Suben su presentación y ensayan con temporizador, cronómetro y teleprompter.'],
            ['Ves quién está listo', 'Estado y duración prevista de cada alumno, y a qué hora terminará cada sesión. Publica el horario con un QR.'],
          ].map(([t, d], i) => <li key={t} className="card"><span className="num">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}
        </ol>
      </section>

      <section className="wrap narrow">
        <div className="card uni-privacy">
          <ShieldCheck size={28} />
          <div>
            <h3>El alumno decide qué comparte</h3>
            <p className="muted">La coordinación ve el estado y la duración prevista. El guion, las notas y los ensayos siguen siendo privados del alumno.</p>
          </div>
        </div>
      </section>

      <section id="piloto" className="wrap narrow center">
        <span className="eyebrow">Programa piloto</span>
        <h2>Gratis para las primeras universidades</h2>
        <p className="muted sub-wide">Lo construimos con coordinadores reales. Las universidades piloto tienen la licencia gratis durante su primera convocatoria y todo el plan Pro para sus alumnos.</p>
        <div className="row center-row">
          <a href={mail} className="btn coral big">Quiero ser universidad piloto</a>
          <Link to="/app" className="btn ghost big">Probar TempoSlide como alumno</Link>
        </div>
        <p className="micro">Escríbenos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      </section>

      <footer className="footer uni-footer">
        <div className="wrap">
          <div className="foot-row"><Logo /><span className="foot-links"><Link to="/">Inicio</Link><Link to="/privacidad">Privacidad</Link><Link to="/terminos">Términos</Link></span><span>© 2026 TempoSlide</span></div>
        </div>
      </footer>
    </div>
  );
}
