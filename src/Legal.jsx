// Política de privacidad y términos. Describen lo que la app hace de verdad con los datos (ver src/store.js y server.js).
// Al cambiar el tratamiento de datos (analítica, pagos, nuevos proveedores…), actualizar estos textos y la fecha.
import { Link } from 'react-router-dom';
import { Logo, ThemeToggle } from './Landing.jsx';

const LEGAL = {
  owner: '[NOMBRE DEL TITULAR]', // persona física o empresa responsable
  email: '[CORREO DE CONTACTO]',
  country: '[PAÍS]',
  updated: '26 de noviembre de 2026',
};

function Page({ title, children }) {
  return (
    <div className="legal-page">
      <nav className="nav wrap"><Logo /><ThemeToggle /></nav>
      <main className="wrap narrow legal">
        <span className="eyebrow">Legal</span>
        <h1>{title}</h1>
        <p className="muted">Última actualización: {LEGAL.updated}</p>
        {children}
        <p className="legal-nav"><Link to="/privacidad">Privacidad</Link> · <Link to="/terminos">Términos</Link> · <Link to="/">Volver al inicio</Link></p>
      </main>
    </div>
  );
}

const Mail = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

export function Privacy() {
  return (
    <Page title="Política de privacidad">
      <p>En TempoSlide queremos que ensayes tranquilo, también respecto a tus datos. Aquí explicamos qué guardamos, para qué y cómo puedes controlarlo. Sin letra pequeña: no vendemos datos, no mostramos publicidad y no usamos cookies de seguimiento.</p>

      <h2>1. Responsable</h2>
      <p>El responsable del tratamiento es <b>{LEGAL.owner}</b> ({LEGAL.country}). Para cualquier consulta sobre privacidad escríbenos a <Mail />.</p>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><b>Cuenta</b> (si te registras): tu correo electrónico y, si entras con Google, tu nombre y foto de perfil. Solo pedimos a Google los permisos básicos de identidad (correo y perfil); <b>no accedemos</b> a tu Drive, Gmail, Presentaciones ni a ningún otro servicio de tu cuenta.</li>
        <li><b>Tus presentaciones</b>: el archivo convertido a PDF, las notas del orador, el tiempo objetivo y el plan por diapositiva.</li>
        <li><b>Tus ensayos</b>: fecha, duración total y tiempo de cada diapositiva.</li>
        <li><b>Preferencias</b>: el tema claro u oscuro, guardado solo en tu navegador.</li>
      </ul>

      <h2>3. Modo invitado</h2>
      <p>Si usas TempoSlide sin cuenta, tus presentaciones y ensayos se guardan <b>únicamente en tu navegador</b> (IndexedDB). No los recibimos ni los almacenamos. Si borras los datos del navegador, se pierden.</p>

      <h2>4. Conversión de archivos</h2>
      <p>Cuando subes un PPTX, PPT, KEY u ODP, el archivo se envía a nuestro servidor solo para convertirlo a PDF. Se procesa en una carpeta temporal y <b>se borra inmediatamente</b> después de devolverte el resultado. Los PDF no pasan por el servidor de conversión. Las notas del orador se leen directamente en tu navegador.</p>

      <h2>5. Para qué los usamos</h2>
      <p>Solo para prestarte el servicio: identificarte, guardar tus presentaciones y ensayos y mostrártelos en cualquier dispositivo. La base legal es la ejecución del servicio que solicitas al crear tu cuenta. No elaboramos perfiles, no tomamos decisiones automatizadas sobre ti y no usamos tus contenidos para entrenar modelos de inteligencia artificial.</p>

      <h2>6. Con quién los compartimos</h2>
      <p>No vendemos ni cedemos tus datos. Usamos estos proveedores para que TempoSlide funcione, que actúan como encargados del tratamiento:</p>
      <ul>
        <li><b>Supabase</b>: autenticación, base de datos y almacenamiento de tus PDF (privados y accesibles solo con tu sesión).</li>
        <li><b>Vercel</b>: alojamiento de la web y conversión temporal de archivos.</li>
        <li><b>Google</b>: inicio de sesión con Google (si lo eliges) y carga de las tipografías de la web (Google Fonts), que implica que tu navegador contacte con servidores de Google.</li>
      </ul>
      <p>Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo (por ejemplo, en Estados Unidos), con las garantías previstas en la normativa, como las cláusulas contractuales tipo.</p>

      <h2>7. Cuánto tiempo los guardamos</h2>
      <p>Mientras mantengas tu cuenta. Puedes borrar cualquier presentación o ensayo desde la app en cualquier momento, y se elimina de nuestros sistemas (incluido el PDF). Si quieres eliminar tu cuenta completa, escríbenos a <Mail /> y la borraremos junto con todos sus datos.</p>

      <h2>8. Tus derechos</h2>
      <p>Puedes acceder a tus datos, rectificarlos, suprimirlos, pedir su portabilidad, oponerte o limitar su tratamiento escribiendo a <Mail />. Si consideras que no hemos atendido bien tu solicitud, puedes reclamar ante la autoridad de protección de datos de tu país.</p>

      <h2>9. Seguridad</h2>
      <p>Las comunicaciones van cifradas (HTTPS) y cada usuario solo puede leer y modificar sus propios datos, gracias a reglas de seguridad a nivel de fila en la base de datos. Al cerrar sesión borramos la copia local de tus PDF en ese navegador.</p>

      <h2>10. Menores</h2>
      <p>TempoSlide no está dirigido a menores de 14 años.</p>

      <h2>11. Cambios</h2>
      <p>Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es relevante, te avisaremos dentro de la app.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Términos de uso">
      <p>Estos términos regulan el uso de TempoSlide, una herramienta para ensayar y presentar con temporizador, cronómetro por diapositiva y teleprompter. Al usar la web aceptas estos términos.</p>

      <h2>1. Quiénes somos</h2>
      <p>TempoSlide es un servicio de <b>{LEGAL.owner}</b> ({LEGAL.country}). Contacto: <Mail />.</p>

      <h2>2. El servicio</h2>
      <p>Puedes usar TempoSlide sin cuenta (modo invitado, con los datos en tu navegador) o con una cuenta para guardar tus presentaciones en la nube. TempoSlide está en <b>beta</b>: añadimos funciones con frecuencia y puede haber errores o interrupciones. Lo ofrecemos «tal cual» y te recomendamos conservar siempre tus archivos originales.</p>

      <h2>3. Tu cuenta</h2>
      <p>Eres responsable de mantener el acceso a tu correo o a tu cuenta de Google con la que entras, y de la actividad que se haga con tu cuenta. Avísanos si detectas un uso no autorizado.</p>

      <h2>4. Tu contenido</h2>
      <p>Tus presentaciones, notas y ensayos <b>son tuyos</b>. Nos concedes únicamente el permiso necesario para almacenarlos, convertirlos y mostrártelos con el fin de prestarte el servicio. No los usamos para nada más. Garantizas que tienes derecho a subir el contenido que subes.</p>

      <h2>5. Uso aceptable</h2>
      <p>No puedes usar TempoSlide para subir contenido ilícito o que infrinja derechos de terceros, intentar acceder a datos de otros usuarios, sobrecargar o atacar el servicio, ni automatizar su uso de forma abusiva. Podemos suspender cuentas que incumplan estas reglas.</p>

      <h2>6. Precios</h2>
      <p>Durante la beta, TempoSlide es gratuito. Si en el futuro activamos planes de pago, te informaremos con antelación de precios y condiciones, y nunca te cobraremos sin tu aceptación expresa.</p>

      <h2>7. Responsabilidad</h2>
      <p>TempoSlide es una herramienta de apoyo: las estimaciones de duración son orientativas y no garantizan el resultado de tu presentación. En la medida permitida por la ley, no respondemos de daños indirectos, pérdida de datos o lucro cesante derivados del uso del servicio. Nada de esto limita los derechos que te reconozca la normativa de consumidores aplicable.</p>

      <h2>8. Baja</h2>
      <p>Puedes dejar de usar TempoSlide cuando quieras y pedir la eliminación de tu cuenta escribiendo a <Mail />. Podemos dar de baja el servicio avisando con antelación razonable para que puedas descargar tus archivos.</p>

      <h2>9. Cambios y ley aplicable</h2>
      <p>Podemos actualizar estos términos; si el cambio es relevante, te avisaremos. Se rigen por la legislación de {LEGAL.country}, sin perjuicio de los derechos que te correspondan como consumidor en tu país de residencia.</p>
    </Page>
  );
}
