import sys
sys.path.append('src/backend')
from main import get_db_connection

try:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('TRUNCATE TABLE calendario_institucional')
    conn.commit()
    print("Tabla truncada con éxito.")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
