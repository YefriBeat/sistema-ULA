import sys
sys.path.append('src/backend')
from main import get_db_connection

eventos = [
    ('semestral','2025-2026',2,'inicio_periodo','Inicio de subciclo escolar','2026-02-09','2026-02-09',False),
    ('semestral','2025-2026',2,'inhabil','Inhábil: Constitución Mexicana','2026-02-02','2026-02-02',True),
    ('semestral','2025-2026',2,'inhabil','Inhábil: Natalicio de Benito Juárez','2026-03-16','2026-03-16',True),
    ('semestral','2025-2026',2,'examen_parcial','Primer examen Parcial','2026-03-17','2026-03-25',False),
    ('semestral','2025-2026',2,'vacaciones','Vacaciones de semana santa','2026-03-30','2026-04-10',True),
    ('semestral','2025-2026',2,'inhabil','Inhábil: Día del trabajo','2026-05-01','2026-05-01',True),
    ('semestral','2025-2026',2,'evaluacion','Evaluación docente','2026-05-04','2026-05-07',False),
    ('semestral','2025-2026',2,'inhabil','Inhábil: Día del Maestro','2026-05-15','2026-05-15',True),
    ('semestral','2025-2026',2,'examen_parcial','Segundo examen parcial','2026-05-25','2026-06-05',False),
    ('semestral','2025-2026',2,'examen_ordinario','Exámenes ordinarios','2026-06-22','2026-07-03',False),
    ('semestral','2025-2026',2,'inscripcion','Inscripciones a exámenes extraordinarios','2026-07-06','2026-07-07',False),
    ('semestral','2025-2026',2,'examen_extraordinario','Exámenes extraordinarios','2026-07-08','2026-07-21',False),
    ('semestral','2025-2026',2,'entrega','Entrega reporte de actividades','2026-07-22','2026-07-22',False),
    ('semestral','2025-2026',2,'entrega','Entrega plan de actividades','2026-07-29','2026-07-29',False),
    ('semestral','2025-2026',2,'fin_periodo','Fin de subciclo escolar','2026-07-31','2026-07-31',False),
    ('cuatrimestral','2025-2026',2,'inicio_periodo','Inicio Cuatrimestre','2026-05-04','2026-05-04',False),
    ('cuatrimestral','2025-2026',2,'inhabil','Inhábil: Día del Maestro','2026-05-15','2026-05-15',True),
    ('cuatrimestral','2025-2026',2,'examen_parcial','Primer examen parcial','2026-06-08','2026-06-15',False),
    ('cuatrimestral','2025-2026',2,'evaluacion','Evaluación Docente','2026-06-22','2026-06-25',False),
    ('cuatrimestral','2025-2026',2,'examen_parcial','Segundo examen parcial','2026-07-20','2026-07-27',False),
    ('cuatrimestral','2025-2026',2,'examen_ordinario','Exámenes ordinarios','2026-08-03','2026-08-10',False),
    ('cuatrimestral','2025-2026',2,'inscripcion','Inscripciones a extraordinarios','2026-08-13','2026-08-14',False),
    ('cuatrimestral','2025-2026',2,'examen_extraordinario','Exámenes extraordinarios','2026-08-17','2026-08-24',False),
    ('cuatrimestral','2025-2026',2,'fin_periodo','Fin Cuatrimestre','2026-08-28','2026-08-28',False),
]

conn = get_db_connection()
c = conn.cursor()
try:
    c.execute("DELETE FROM calendario_institucional WHERE ciclo = '2025-2026'")
    c.executemany("""
        INSERT INTO calendario_institucional 
        (plan, ciclo, periodo, tipo_evento, descripcion, fecha_inicio, fecha_fin, suspende_clases) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, eventos)
    conn.commit()
    print("Insertado exitosamente.")
except Exception as e:
    print(e)
finally:
    conn.close()
