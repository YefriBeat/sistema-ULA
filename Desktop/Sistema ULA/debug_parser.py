# -*- coding: utf-8 -*-
import sys
sys.path.append('src/backend')
from main import get_db_connection, _parsear_calendario_institucional_pdf

conn = get_db_connection()
try:
    c = conn.cursor()
    c.execute("SELECT archivo_datos FROM calendarios WHERE tipo = 'general' LIMIT 1")
    row = c.fetchone()
    contenido_pdf = row['archivo_datos']
finally:
    conn.close()

eventos = _parsear_calendario_institucional_pdf(contenido_pdf)

print(f"Total de eventos extraidos: {len(eventos)}\n")

plan_actual = None
for ev in eventos:
    plan, ciclo, periodo, tipo, desc, fi, ff, susp = ev
    label = f"[{plan.upper():15s}] Ciclo {ciclo} P{periodo}"
    if plan != plan_actual:
        print(f"\n{'='*80}")
        print(f"  {plan.upper()}")
        print(f"{'='*80}")
        plan_actual = plan
    
    susp_str = " ** SUSPENDE **" if susp else ""
    print(f"  {fi} al {ff}  | {tipo:25s} | {desc[:55]:55s}{susp_str}")
