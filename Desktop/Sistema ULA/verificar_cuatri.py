import sys
sys.path.append('src/backend')
from main import get_db_connection

try:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT ciclo, plan, COUNT(*) as cnt FROM calendario_institucional GROUP BY ciclo, plan")
    for r in c.fetchall():
        print(r)
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
