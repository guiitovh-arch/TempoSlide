# Análisis de SlideTempo y estrategia para TempoSlide

## Qué es SlideTempo (slidetempo.com, en beta)
- Promesa: *"Will it run to time?"* — estima cuánto durará un deck simulando 1.000 ensayos (rango + P90).
- Entrada: PPTX (lee notas, gráficos, tablas) o PDF.
- Analizador: duración estimada con bandas (corta / cómoda / justa / te pasas), tiempo por diapositiva (gráficos más tiempo, separadores ~5 s), sugerencias de recortes si te pasas, contextos (congreso, pitch, reunión, clase).
- Temporizador: enlace de cuenta atrás compartible para abrir en el móvil, sin cuenta.
- Organizadores (Pro): programas de congresos, tracks paralelos, Gantt, enlace/QR para asistentes, pósteres, exportes Word/Excel.
- Precios: Gratis (1 análisis/semana) · **Una presentación 3,99 € pago único** · Pro 9,99 €/mes o 99,90 €/año · prueba Pro 3 meses sin tarjeta. La palanca de pago es re-analizar (y, para organizadores, exportar/publicar).

## Sus huecos (nuestras oportunidades)
> Actualizado con el recorrido por dentro de la cuenta (ver `slidetempo-analisis-cuenta.md`). SlideTempo **sí** tiene teleprónter y un temporizador compañero para el móvil, pero ambos son satélites de su analizador.

1. **Simula, no mide**: todo gira en torno a 1.000 ensayos simulados (Monte Carlo). Su teleprónter muestra "EN HORA / POR DELANTE", pero el ensayo real no se guarda ni se compara. → TempoSlide guarda cada ensayo y lo compara con el plan diapositiva a diapositiva, y te dice dónde recortar con datos reales.
2. **El modelo falla con decks reales**: clasificó gráficos y tablas como "sección", las diapositivas quedan todas entre 15 y 20 s y el tiempo extra se reparte con reglas fijas. → Nosotros respetamos el guion del orador: si las notas traen marcas `(30 s)`, son el plan; si no, se estima por palabras y ritmo, y todo es editable.
3. **Cobra por re-analizar**: el gratis da 1 análisis a la semana; editar las notas y volver a analizar cuesta 3,99 € por presentación. Penaliza justo lo que hay que hacer para preparar una defensa: iterar. → Ensayar y re-planificar es ilimitado en todos los planes.
4. **Incoherencias y huecos**: dice "sin registro" pero exige login; el organizador guarda en el navegador aunque diga "en tu cuenta"; traducciones a medias; consejos en inglés; sin prueba social; no mide tu voz; sin Google Slides/Keynote.
5. **El valor gordo está en organizadores** (programa de congresos, ponentes, pósteres): es otro producto. Para el estudiante que defiende un TFM sobra. → Enfocarse en el ponente y dejar organizadores para una fase B2B (universidades: tribunales y franjas de defensa).

## Ideas que ya incorporé
- **Pre-análisis** con las mismas 4 bandas (palabras de notas ÷ ritmo de habla + transiciones).
- **Presupuesto por diapositiva** repartido automáticamente según el guion y editable a mano.
- **Indicador de ritmo** en vivo (adelantado / tarde respecto al plan acumulado).
- Fases de color del temporizador (25% / 10% / tiempo extra).
- **Marcas de tiempo en las notas** (`(30 s)`, `(1 min)`) → plan por diapositiva; diapositivas sin marca = anexos fuera del plan (detectado en el deck de la defensa).
- **ppm necesarias**: si el guion no cabe, te dice a qué velocidad tendrías que hablar (ej.: el guion del TFM pide ~190 ppm para 12,3 min, descontando 5 s de transición por diapositiva; a 130 ppm duraría ~18 min).
- **Omitir diapositivas** al presentar y **dónde recortar** tras un ensayo que se pasa.

## Mejoras recomendadas (siguientes pasos)
- **Temporizador compañero** (lo tiene SlideTempo, `/t/{código}` con caducidad de 48 h y botón de WhatsApp): un compañero o el tribunal ve la cuenta atrás en su móvil. Requiere sincronización en tiempo real (Vercel + un canal tipo Ably/Pusher o WebSocket).
- **Ritmo real por voz**: medir palabras por minuto con la Web Speech API y resaltar en el teleprompter la frase que estás diciendo.
- **Recortes sugeridos**: si el informe muestra que te pasas, proponer qué diapositivas acortar (las que más se desvían).
- **Modo tribunal / Q&A**: temporizador separado para preguntas.
- **Plantillas de defensa** con tiempos oficiales por universidad (gancho B2B).
- **Mando desde el móvil** (QR) para avanzar diapositivas y ver notas.

## Estrategia de precios propuesta
El momento de compra del estudiante es **un evento puntual** (defensa TFM/TFG). Cobrar por deck (como SlideTempo) penaliza iterar con varias versiones; una suscripción asusta a quien solo tiene una defensa.

| Plan | Precio | Para quién | Lógica |
|---|---|---|---|
| Gratis | 0 € | Probar | 2 presentaciones, las 3 herramientas, últimos 3 ensayos. Útil de verdad → boca a boca |
| **Pase Defensa** | 4,99 € pago único, 30 días de Pro | Estudiantes | Ancla emocional "prepara tu defensa"; no se renueva → confianza. Precio ≈ un café y medio |
| Pro | 6,99 €/mes · 49 €/año | Docentes, consultores, ponentes frecuentes | Más barato que SlideTempo Pro (9,99 €/mes · 99,90 €/año) y centrado en el directo |
| Universidades | Licencia campus a medida | Escuelas de negocio / másteres | Plantillas con tiempos oficiales, panel docente; aquí está el ingreso recurrente grande |

Tácticas: el Pase Defensa es el plan destacado; ofrecer "convierte tu pase en Pro" con descuento al terminar; programa de embajadores (1 pase gratis por cada 3 compañeros invitados); prueba Pro sin tarjeta que simplemente caduca (lo que mejor hace SlideTempo).
