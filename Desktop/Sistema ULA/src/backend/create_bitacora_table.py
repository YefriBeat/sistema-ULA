import os
from dotenv import load_dotenv
import pymysql
import certifi

load_dotenv()

def get_db_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", 4000)),
        cursorclass=pymysql.cursors.DictCursor,
        ssl_ca=certifi.where()
    )

conn = get_db_connection()
cursor = conn.cursor()

query = """
CREATE TABLE IF NOT EXISTS bitacora_cambios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(255),
    tipo_operacion VARCHAR(100),
    modulo_afectado VARCHAR(100),
    registro_id INT,
    docente VARCHAR(255),
    suplente VARCHAR(255),
    licenciatura VARCHAR(100),
    grado_cuatrimestre VARCHAR(50),
    asignatura VARCHAR(255),
    grupo VARCHAR(50),
    dia_anterior VARCHAR(50),
    dia_nuevo VARCHAR(50),
    hora_anterior VARCHAR(50),
    hora_nueva VARCHAR(50),
    aula_anterior VARCHAR(50),
    aula_nueva VARCHAR(50),
    turno_anterior VARCHAR(50),
    turno_nuevo VARCHAR(50),
    estado_anterior VARCHAR(100),
    estado_nuevo VARCHAR(100),
    motivo TEXT,
    datos_anteriores JSON,
    datos_nuevos JSON
);
"""

cursor.execute(query)
conn.commit()
print("Table created successfully")
conn.close()
