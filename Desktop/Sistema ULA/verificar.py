import sys
sys.path.append('src/backend')
from main import get_db_connection

conn = get_db_connection()
c = conn.cursor()
c.execute("SELECT plan, ciclo, periodo, descripcion, fecha_inicio, fecha_fin FROM calendario_institucional WHERE tipo_evento='examen_parcial' AND periodo=2")
for row in c.fetchall():
    print(row)
conn.close()
