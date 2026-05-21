import os
import pymysql
import bcrypt
import certifi
import pdfplumber
import json
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from io import BytesIO

# Cargar variables de entorno desde src/backend/.env
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

app = FastAPI(title="API Sistema de Prefectura ULA")

# Configuración de CORS para permitir la conexión desde Vite (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174"  # Se agrega soporte para ambos puertos de desarrollo
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# CONEXIÓN A LA BASE DE DATOS TiDB CLOUD (CON SSL AUTOMÁTICO)
# ---------------------------------------------------------
def get_db_connection():
    db_host = os.getenv("DB_HOST")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    db_port = int(os.getenv("DB_PORT", 4000))

    missing_vars = [name for name, value in (
        ("DB_HOST", db_host),
        ("DB_USER", db_user),
        ("DB_PASSWORD", db_password),
        ("DB_NAME", db_name),
    ) if not value]
    if missing_vars:
        raise RuntimeError(f"Faltan variables de entorno: {', '.join(missing_vars)}")

    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        db=db_name,
        port=db_port,
        cursorclass=pymysql.cursors.DictCursor,
        ssl={"ca": certifi.where()} # Certificado inyectado automáticamente para TiDB
    )

# ---------------------------------------------------------
# MODELOS DE DATOS (PYDANTIC) - RECEPTAN EL JSON DE REACT
# ---------------------------------------------------------
class RegistroUsuario(BaseModel):
    nombre: str
    correo: str
    turno: str
    password: str

class LoginUsuario(BaseModel):
    correo: str
    password: str

class Horario(BaseModel):
    docente: str
    licenciatura: str
    asignatura: str
    horario: str
    aulaAsignada: str
    archivo: str

class Aula(BaseModel):
    nombre: str
    edificio: str
    capacidad: int
    equipos: list = []
    estado: str = "Activo"

# ---------------------------------------------------------
# ENDPOINTS (RUTAS DE LA API)
# ---------------------------------------------------------

@app.get("/api/db-check")
def comprobar_conexion_db():
    try:
        connection = get_db_connection()
        connection.close()
        return {"message": "Conexión a TiDB Cloud OK"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo conectar a la base de datos: {str(e)}")


@app.post("/api/registro")
def registrar_usuario(datos: RegistroUsuario):
    # 1. Validación estricta del correo (Regla de la Universidad)
    correo_limpio = datos.correo.strip().lower()
    if not correo_limpio.endswith(".universidadlatino.edu.mx"):
        raise HTTPException(status_code=400, detail="El correo debe pertenecer a la Universidad Latino.")
    
    # 2. Encriptar la contraseña de forma segura
    password_bytes = datos.password.encode('utf-8')
    salt = bcrypt.gensalt()
    password_hasheada = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    # 3. Conexión e inserción en la base de datos
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Comprobar si el correo ya existe
            cursor.execute("SELECT id FROM usuarios WHERE correo = %s", (correo_limpio,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Este correo ya se encuentra registrado.")
            
            # Guardar el nuevo usuario
            sql = "INSERT INTO usuarios (nombre, correo, turno, password) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (datos.nombre.strip(), correo_limpio, datos.turno, password_hasheada))
            
        connection.commit()
        return {"message": "Usuario creado exitosamente"}
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        connection.close()


@app.post("/api/login")
def login_usuario(datos: LoginUsuario):
    correo_limpio = datos.correo.strip().lower()
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Buscar al usuario por correo
            cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (correo_limpio,))
            usuario = cursor.fetchone()
            
            # Si el usuario no existe
            if not usuario:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
            
            # Verificar si la contraseña ingresada coincide con la encriptada en la BD
            password_valida = bcrypt.checkpw(
                datos.password.encode('utf-8'), 
                usuario['password'].encode('utf-8')
            )
            
            if not password_valida:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
            
            # Si todo está correcto, devolvemos el nombre y el turno para Layout.jsx
            return {
                "message": "Login exitoso",
                "usuario": {
                    "nombre": usuario['nombre'],
                    "turno": usuario['turno']
                }
            }
            
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        connection.close()



# ---------------------------------------------------------
# ---------------------------------------------------------
# ENDPOINT PARA PROCESAR PDF DE HORARIOS (PARSER INTELIGENTE)
# ---------------------------------------------------------
@app.post("/upload-pdf")
async def procesar_pdf(archivo: UploadFile = File(...)):
    """
    Parser inteligente y a prueba de balas para PDFs institucionales.
    Limpia saltos de línea ocultos y detecta tablas dinámicamente.
    """
    try:
        contenido = await archivo.read()
        pdf_file = BytesIO(contenido)
        
        licenciatura_extraida = "Licenciatura no identificada"
        mapa_docentes = {}  # {asignatura_limpia: docente_limpio}
        horarios_compilados = []
        
        with pdfplumber.open(pdf_file) as pdf:
            for page_num, page in enumerate(pdf.pages):
                # ========== PASO 1: Extraer Licenciatura de forma flexible ==========
                texto_pagina = page.extract_text() or ""
                for linea in texto_pagina.split('\n'):
                    if "Licenciatura en" in linea:
                        licenciatura_extraida = linea.strip()
                        break
                
                # ========== PASO 2: Identificar Tablas Dinámicamente ==========
                tables = page.extract_tables()
                if not tables:
                    continue
                
                tabla_matriz = None
                tabla_directorio = None
                
                for table in tables:
                    if not table or not table[0]: continue
                    # Juntar toda la primera fila para ver qué contiene
                    fila_texto = " ".join([str(c).lower() for c in table[0] if c])
                    
                    if "lunes" in fila_texto or "martes" in fila_texto:
                        tabla_matriz = table
                    elif "asignatura" in fila_texto or "docente" in fila_texto:
                        tabla_directorio = table

                # Fallback por si la cabecera no estaba en la fila 0
                if not tabla_directorio and len(tables) >= 2:
                    tabla_directorio = tables[-1]
                if not tabla_matriz and len(tables) >= 1:
                    tabla_matriz = tables[0]

                if not tabla_matriz or not tabla_directorio:
                    continue
                
                # ========== PASO 3: Construir Mapa de Docentes (Tabla Inferior) ==========
                for row in tabla_directorio:
                    if not row or len(row) < 3: continue
                    # Limpiar saltos de línea y espacios dobles
                    asignatura_raw = str(row[0] or "").replace('\n', ' ').strip()
                    docente_raw = str(row[2] or "").replace('\n', ' ').strip()
                    
                    asignatura_raw = " ".join(asignatura_raw.split()).lower()
                    docente_raw = " ".join(docente_raw.split())
                    
                    if asignatura_raw and docente_raw and "asignatura" not in asignatura_raw:
                        mapa_docentes[asignatura_raw] = docente_raw
                
                # ========== PASO 4: Procesar Matriz de Horarios (Tabla Superior) ==========
                dias_indices = {}
                start_row = 0
                
                # Buscar en qué fila están los días realmente
                for r_idx, row in enumerate(tabla_matriz):
                    fila_str = " ".join([str(c).lower() for c in row if c])
                    if "lunes" in fila_str:
                        start_row = r_idx + 1
                        for c_idx, cell in enumerate(row):
                            cell_val = str(cell or "").strip().lower().replace('\n', '')
                            # Mapear columnas a los días oficiales
                            for d in ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes"]:
                                if d in cell_val:
                                    dia_oficial = d.replace('miercoles', 'miércoles').capitalize()
                                    dias_indices[dia_oficial] = c_idx
                        break

                # Leer las materias por hora
                for row_num in range(start_row, len(tabla_matriz)):
                    row = tabla_matriz[row_num]
                    if not row or not row[0]: continue
                    
                    # Formatear la hora (ej. de "13:20 \n 14:10" a "13:20-14:10")
                    horario_slot = str(row[0] or "").replace('\n', '-').replace(' ', '').strip()
                    if len(horario_slot) < 5: continue # Ignorar filas basura
                    
                    for dia_nombre, idx_col in dias_indices.items():
                        if idx_col < len(row):
                            asignatura_celda = str(row[idx_col] or "").replace('\n', ' ').strip()
                            asignatura_celda = " ".join(asignatura_celda.split()) # Quitar espacios extra
                            
                            if asignatura_celda and asignatura_celda.lower() not in ["", "sin especificar", "horario"]:
                                key_busqueda = asignatura_celda.lower()
                                docente_encontrado = mapa_docentes.get(key_busqueda, "Sin especificar")
                                
                                # Si no coincide exacto, buscar si "contiene" la palabra
                                if docente_encontrado == "Sin especificar":
                                    for key_mapa, doc in mapa_docentes.items():
                                        if key_mapa in key_busqueda or key_busqueda in key_mapa:
                                            docente_encontrado = doc
                                            break
                                
                                horarios_compilados.append({
                                    "id": f"{page_num}_{row_num}_{idx_col}",
                                    "docente": docente_encontrado,
                                    "licenciatura": licenciatura_extraida,
                                    "asignatura": asignatura_celda.title(),
                                    "horario_resumen": f"{dia_nombre} {horario_slot}",
                                    "aula_asignada": ""
                                })
        
        if not horarios_compilados:
            raise ValueError("No se extrajeron horarios. Verifica la estructura del PDF.")
        
        return {
            "message": "PDF procesado exitosamente",
            "datos_extraidos": {
                "lista_horarios": horarios_compilados
            }
        }
    
    except Exception as e:
        print(f"Error procesando PDF: {str(e)}") # Esto te lo imprimirá en consola para debugear
        raise HTTPException(status_code=400, detail=f"Error al procesar PDF: {str(e)}")

# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE HORARIOS
# ---------------------------------------------------------
@app.post("/api/guardar-horarios")
def guardar_horarios(horarios: list[dict]):
    """
    Guarda los horarios procesados en la base de datos TiDB
    """
    if not horarios:
        raise HTTPException(status_code=400, detail="La lista de horarios está vacía.")
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for horario in horarios:
                sql = """
                    INSERT INTO horarios (docente, licenciatura, asignatura, horario, aula_asignada, archivo)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (
                    horario.get("docente", ""),
                    horario.get("licenciatura", ""),
                    horario.get("asignatura", ""),
                    horario.get("horario", ""),
                    horario.get("aulaAsignada", "Por asignar"),
                    horario.get("archivo", "")
                ))
        connection.commit()
        return {"message": "Horarios guardados exitosamente", "total": len(horarios)}
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar horarios: {str(e)}")
    finally:
        connection.close()


@app.get("/api/horarios")
def obtener_horarios():
    """
    Obtiene todos los horarios registrados
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM horarios")
            horarios = cursor.fetchall()
        return horarios if horarios else []
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener horarios: {str(e)}")
    finally:
        connection.close()


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE AULAS
# ---------------------------------------------------------
@app.get("/api/aulas")
def obtener_aulas():
    """
    Obtiene todas las aulas disponibles
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nombre, edificio, capacidad FROM aulas ORDER BY nombre")
            aulas = cursor.fetchall()
        return aulas if aulas else []
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener aulas: {str(e)}")
    finally:
        connection.close()


@app.post("/api/aulas")
def crear_aula(aula: Aula):
    """
    Crea una nueva aula
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Convertir lista de equipos a JSON string
            equipos_json = json.dumps(aula.equipos)
            
            sql = "INSERT INTO aulas (nombre, edificio, capacidad, equipos, estado) VALUES (%s, %s, %s, %s, %s)"
            cursor.execute(sql, (
                aula.nombre, 
                aula.edificio, 
                aula.capacidad,
                equipos_json,
                aula.estado
            ))
        connection.commit()
        return {"message": "Aula creada exitosamente"}
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al crear aula: {str(e)}")
    finally:
        connection.close()


@app.delete("/api/aulas/{aula_id}")
def eliminar_aula(aula_id: int):
    """
    Elimina un aula por su ID
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM aulas WHERE id = %s", (aula_id,))
        connection.commit()
        return {"message": "Aula eliminada exitosamente"}
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar aula: {str(e)}")
    finally:
        connection.close()


@app.get("/api/clases-hoy")
def obtener_clases_hoy():
    """
    Obtiene las clases programadas para hoy
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Ajusta la consulta según tu estructura de base de datos
            cursor.execute("""
                SELECT docente, asignatura, horario, aula_asignada 
                FROM horarios 
                WHERE DATE(fecha_clase) = CURDATE()
                ORDER BY horario
            """)
            clases = cursor.fetchall()
        return clases if clases else []
    
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener clases: {str(e)}")
    finally:
        connection.close()
