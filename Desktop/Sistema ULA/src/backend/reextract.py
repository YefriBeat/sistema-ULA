import os
from dotenv import load_dotenv
load_dotenv('.env')
import pymysql
import main

conn = pymysql.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT', 3306)),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME'),
    ssl={'ssl':{}}
)

cursor = conn.cursor(pymysql.cursors.DictCursor)
cursor.execute('SELECT id, archivo_nombre, archivo_datos FROM calendarios')
rows = cursor.fetchall()

cursor.execute('DELETE FROM calendario_institucional')

for row in rows:
    if not row['archivo_datos']:
        print(f"Skipping empty file {row['archivo_nombre']}")
        continue
    eventos = main._parsear_calendario_institucional_pdf(row['archivo_datos'])
    if eventos:
        values = [list(e) for e in eventos]
        cursor.executemany(
            'INSERT INTO calendario_institucional (plan, ciclo, periodo, tipo_evento, descripcion, fecha_inicio, fecha_fin, suspende_clases) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
            values
        )
        print(f"Extracted {len(eventos)} events for {row['archivo_nombre']}")
        
conn.commit()
print("Done")
