# Análisis de SlideTempo y estrategia para TempoSlide

## Qué es SlideTempo (slidetempo.com, en beta)
- Promesa: *"Will it run to time?"* — estima cuánto durará un deck simulando 1.000 ensayos (rango + P90).
- Entrada: PPTX (lee notas, gráficos, tablas) o PDF.
- Analizador: duración estimada con bandas (corta / cómoda / justa / te pasas), tiempo por diapositiva (gráficos más tiempo, separadores ~5 s), sugerencias de recortes si te pasas, contextos (congreso, pitch, reunión, clase).
- Temporizador: enlace de cuenta atrás compartible para abrir en el móvil, sin cuenta.
- Organizadores (Pro): programas de congresos, tracks paralelos, Gantt, enlace/QR para asistentes, pósteres, exportes Word/Excel.
- Precios: Gratis (1 análisis/semana) · **One Deck 3,99 $ pago único por deck** · Pro 9,99 $/mes (anual = 12 por 10) · prueba Pro 3 meses sin tarjeta.

## Sus huecos (nuestras oportunidades)
1. **No acompaña en directo**: estima, pero no tiene vista de presentador, cronómetro por diapositiva real ni teleprompter. → TempoSlide es lo que usas *mientras* hablas.
2. **No aprende de tus ensayos reales**: su estimación es estadística; no compara con tus tiempos reales. → Nuestro informe compara plan vs. real por diapositiva y ensayo a ensayo.
3. Sin prueba social, precios inconsistentes ($ vs £), contradicciones en el plan gratis, retención de datos poco clara. → Ser muy claros: tabla de precios simple, política de datos en una frase.
4. Sin Google Slides/Keynote. → Ya aceptamos KEY/ODP/PPT vía LibreOffice; Google Slides = exportar PDF/PPTX (integración directa como mejora).

## Ideas que ya incorporé
- **Pre-análisis** con las mismas 4 bandas (palabras de notas ÷ ritmo de habla + transiciones).
- **Presupuesto por diapositiva** repartido automáticamente según el guion y editable a mano.
- **Indicador de ritmo** en vivo (adelantado / tarde respecto al plan acumulado).
- Fases de color del temporizador (25% / 10% / tiempo extra).

## Mejoras recomendadas (siguientes pasos)
- **Enlace de cronometrador**: un compañero o el tribunal ve la cuenta atrás en su móvil (requiere sincronización por servidor/WebSocket).
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
| Pro | 6,99 €/mes · 49 €/año | Docentes, consultores, ponentes frecuentes | Más barato que SlideTempo Pro (9,99 $) con más funciones en directo |
| Universidades | Licencia campus a medida | Escuelas de negocio / másteres | Plantillas con tiempos oficiales, panel docente; aquí está el ingreso recurrente grande |

Tácticas: el Pase Defensa es el plan destacado; ofrecer "convierte tu pase en Pro" con descuento al terminar; programa de embajadores (1 pase gratis por cada 3 compañeros invitados); prueba Pro sin tarjeta que simplemente caduca (lo que mejor hace SlideTempo).
