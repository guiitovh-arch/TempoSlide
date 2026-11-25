# Genera test/tfm-demo.pptx: deck de prueba con notas del orador (para el teleprompter).
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

slides = [
    ("TempoSlide", "Trabajo Fin de Máster · Defensa", "Buenos días, tribunal. Hoy les presento TempoSlide, una plataforma para dominar el tiempo de cualquier presentación."),
    ("El problema", "El 60% de las presentaciones se pasan de tiempo", "Todos hemos visto una defensa que se alarga. El problema no es el contenido, es que nadie mide el ritmo diapositiva a diapositiva."),
    ("Objetivos", "Temporizador · Cronómetro por diapositiva · Teleprompter", "Mis tres objetivos fueron: un temporizador global, un cronómetro por diapositiva y un teleprompter para ensayar."),
    ("Metodología", "Design thinking + prototipado iterativo", "Seguí un enfoque de design thinking. Entrevisté a doce estudiantes y prototipé tres versiones."),
    ("Resultados", "−35% de desviación de tiempo tras 3 ensayos", "Tras tres ensayos, la desviación media respecto al tiempo objetivo bajó un treinta y cinco por ciento."),
    ("Conclusiones", "Ensayar con datos cambia el resultado", "En conclusión: ensayar con datos convierte la ansiedad en control. Muchas gracias, quedo atento a sus preguntas."),
]
p = Presentation()
p.slide_width, p.slide_height = Inches(13.333), Inches(7.5)
colors = ["6C5CE7", "FF6B6B", "00B894", "0984E3", "FDCB6E", "E84393"]
for i, (t, s, n) in enumerate(slides):
    sl = p.slides.add_slide(p.slide_layouts[6])
    bg = sl.background.fill; bg.solid(); bg.fore_color.rgb = RGBColor.from_string(colors[i])
    for text, top, size, bold in ((t, 2.4, 66, True), (s, 4.0, 28, False)):
        tf = sl.shapes.add_textbox(Inches(1), Inches(top), Inches(11.3), Inches(1.5)).text_frame
        r = tf.paragraphs[0].add_run(); r.text = text
        r.font.size, r.font.bold = Pt(size), bold
        r.font.color.rgb = RGBColor(255, 255, 255)
    sl.notes_slide.notes_text_frame.text = n
p.save("tfm-demo.pptx")
