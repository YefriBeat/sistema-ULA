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
# CONEXIÓN A LA BASE DE DATOS TiDB CLOUD (OFICIAL WINDOWS)
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

    # SOLUCIÓN: Usar certifi.where() asegura una conexión SSL exitosa a TiDB 
    # en cualquier entorno, ignorando rutas estáticas locales.
    return pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_password,
        db=db_name,
        port=db_port,
        cursorclass=pymysql.cursors.DictCursor,
        ssl_verify_cert=True,
        ssl_verify_identity=True,
        ssl={"ca": certifi.where()} # <--- Generación automática del certificado
    )

# ---------------------------------------------------------
# MODELOS DE DATOS (PYDANTIC)
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

class AsistenciaUpdate(BaseModel):
    status: str

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
# ENDPOINT PARA PROCESAR PDF Y ARCHIVOS DE IMAGEN DE HORARIOS
# ---------------------------------------------------------
@app.post("/upload-pdf")
async def procesar_pdf(archivo: UploadFile = File(...)):
    """
    Parser inteligente que acepta PDF e imágenes (PNG, JPG).
    Para PDF: usa pdfplumber.
    Para imágenes: intenta usar pytesseract si está disponible.
    """
    try:
        contenido = await archivo.read()
        
        # Validar tipo de archivo
        tipo_archivo = archivo.content_type
        if tipo_archivo not in ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']:
            raise ValueError("Formato no soportado. Usa PDF o imágenes (PNG, JPG).")
        
        licenciatura_extraida = "Licenciatura no identificada"
        mapa_docentes = {}
        horarios_compilados = []
        
        # ========== PROCESAR PDF ==========
        if tipo_archivo == 'application/pdf':
            pdf_file = BytesIO(contenido)
            
            with pdfplumber.open(pdf_file) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    texto_pagina = page.extract_text() or ""
                    for linea in texto_pagina.split('\n'):
                        if "Licenciatura en" in linea:
                            licenciatura_extraida = linea.strip()
                            break
                    
                    tables = page.extract_tables()
                    if not tables:
                        continue
                    
                    tabla_matriz = None
                    tabla_directorio = None
                    
                    for table in tables:
                        if not table or not table[0]: continue
                        fila_texto = " ".join([str(c).lower() for c in table[0] if c])
                        
                        if "lunes" in fila_texto or "martes" in fila_texto:
                            tabla_matriz = table
                        elif "asignatura" in fila_texto or "docente" in fila_texto:
                            tabla_directorio = table

                    if not tabla_directorio and len(tables) >= 2:
                        tabla_directorio = tables[-1]
                    if not tabla_matriz and len(tables) >= 1:
                        tabla_matriz = tables[0]

                    if not tabla_matriz or not tabla_directorio:
                        continue
                    
                    # Construir mapa de docentes
                    for row in tabla_directorio:
                        if not row or len(row) < 3: continue
                        asignatura_raw = str(row[0] or "").replace('\n', ' ').strip()
                        docente_raw = str(row[2] or "").replace('\n', ' ').strip()
                        
                        asignatura_raw = " ".join(asignatura_raw.split()).lower()
                        docente_raw = " ".join(docente_raw.split())
                        
                        if asignatura_raw and docente_raw and "asignatura" not in asignatura_raw:
                            mapa_docentes[asignatura_raw] = docente_raw
                    
                    # Procesar matriz de horarios
                    dias_indices = {}
                    start_row = 0
                    
                    for r_idx, row in enumerate(tabla_matriz):
                        fila_str = " ".join([str(c).lower() for c in row if c])
                        if "lunes" in fila_str:
                            start_row = r_idx + 1
                            for c_idx, cell in enumerate(row):
                                cell_val = str(cell or "").strip().lower().replace('\n', '')
                                for d in ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes"]:
                                    if d in cell_val:
                                        dia_oficial = d.replace('miercoles', 'miércoles').capitalize()
                                        dias_indices[dia_oficial] = c_idx
                            break

                    for row_num in range(start_row, len(tabla_matriz)):
                        row = tabla_matriz[row_num]
                        if not row or not row[0]: continue
                        
                        horario_slot = str(row[0] or "").replace('\n', '-').replace(' ', '').strip()
                        if len(horario_slot) < 5: continue
                        
                        for dia_nombre, idx_col in dias_indices.items():
                            if idx_col < len(row):
                                asignatura_celda = str(row[idx_col] or "").replace('\n', ' ').strip()
                                asignatura_celda = " ".join(asignatura_celda.split())
                                
                                if asignatura_celda and asignatura_celda.lower() not in ["", "sin especificar", "horario"]:
                                    key_busqueda = asignatura_celda.lower()
                                    docente_encontrado = mapa_docentes.get(key_busqueda, "Sin especificar")
                                    
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
        
        # ========== PROCESAR IMÁGENES ==========
        else:
            try:
                from PIL import Image
                try:
                    import pytesseract
                except ImportError:
                    pytesseract = None
                
                if pytesseract is None:
                    raise ImportError("pytesseract no está instalado")
                
                imagen = Image.open(BytesIO(contenido))
                texto_extraido = pytesseract.image_to_string(imagen, lang='spa')
                
                # Procesamiento simple: buscar patrones de licenciatura y horarios
                lineas = texto_extraido.split('\n')
                for linea in lineas:
                    if "Licenciatura en" in linea or "Licenciatura de" in linea:
                        licenciatura_extraida = linea.strip()
                        break
                
                horarios_compilados.append({
                    "id": "img_0",
                    "docente": "Extracción de Imagen",
                    "licenciatura": licenciatura_extraida,
                    "asignatura": "Asignatura extraída de imagen",
                    "horario_resumen": "Verificar manualmente",
                    "aula_asignada": "",
                    "nota": "La extracción de imágenes es experimental. Verifica los datos extraídos."
                })
                
            except ImportError:
                horarios_compilados.append({
                    "id": "img_error",
                    "docente": "Error de Extracción",
                    "licenciatura": "No disponible",
                    "asignatura": "pytesseract no configurado",
                    "horario_resumen": "Contacta al administrador",
                    "aula_asignada": "",
                    "nota": "Para procesar imágenes, debe instalarse Tesseract-OCR en el sistema."
                })
            except Exception as e:
                raise ValueError(f"Error procesando imagen: {str(e)}")
        
        if not horarios_compilados:
            raise ValueError("No se extrajeron horarios. Verifica la estructura del archivo.")
        
        return {
            "message": "Archivo procesado exitosamente",
            "datos_extraidos": {
                "lista_horarios": horarios_compilados
            }
        }
    
    except Exception as e:
        print(f"Error procesando archivo: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error al procesar archivo: {str(e)}")


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE HORARIOS
# ---------------------------------------------------------
@app.post("/api/guardar-horarios")
def guardar_horarios(horarios: list[dict]):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            for h in horarios:
                sql = """
                    INSERT INTO horarios 
                    (docente, licenciatura, asignatura, horario, aula_asignada, archivo, fecha_creacion, fecha_clase)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), CURDATE())
                """
                cursor.execute(sql, (
                    h.get("docente", ""),
                    h.get("licenciatura", ""),
                    h.get("asignatura", ""),
                    h.get("horario", h.get("horario_resumen", "")),
                    h.get("aulaAsignada", h.get("aula_asignada", "Por asignar")),
                    h.get("archivo", "")
                ))
        connection.commit()
        return {"message": "Horarios guardados"}
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
            cursor.execute("SELECT * FROM horarios ORDER BY id DESC")
            horarios = cursor.fetchall()
        return horarios if horarios else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener horarios: {str(e)}")
    finally:
        connection.close()


@app.put("/api/asistencia/{id}")
def actualizar_asistencia(id: int, datos: AsistenciaUpdate):
    """
    Endpoint para actualizar el estado de asistencia desde un panel operativo
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE horarios SET status_asistencia = %s WHERE id = %s"
            cursor.execute(sql, (datos.status, id))
        connection.commit()
        return {"message": "Estado actualizado correctamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar asistencia: {str(e)}")
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


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE ARCHIVOS PDF
# ---------------------------------------------------------
@app.get("/api/archivos")
def obtener_archivos():
    """
    Obtiene lista de archivos únicos y estadísticas de los horarios
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT archivo, 
                       COUNT(*) as total_horarios,
                       MIN(fecha_creacion) as fecha_carga,
                       MAX(fecha_creacion) as ultima_modificacion,
                       COUNT(CASE WHEN aula_asignada != 'Por asignar' THEN 1 END) as aulas_asignadas
                FROM horarios 
                GROUP BY archivo 
                ORDER BY fecha_carga DESC
            """)
            archivos = cursor.fetchall()
        return archivos if archivos else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener archivos: {str(e)}")
    finally:
        connection.close()


@app.get("/api/archivos/{nombre_archivo}/horarios")
def obtener_horarios_archivo(nombre_archivo: str):
    """
    Obtiene todos los horarios de un archivo específico
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, docente, licenciatura, asignatura, horario, aula_asignada, fecha_creacion
                FROM horarios 
                WHERE archivo = %s
                ORDER BY horario
            """, (nombre_archivo,))
            horarios = cursor.fetchall()
        return horarios if horarios else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener horarios: {str(e)}")
    finally:
        connection.close()


@app.put("/api/horarios/{horario_id}")
def actualizar_horario(horario_id: int, datos: dict):
    """
    Actualiza un horario específico (para cambiar aula asignada)
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE horarios SET aula_asignada = %s, docente = %s, asignatura = %s WHERE id = %s"
            cursor.execute(sql, (
                datos.get("aula_asignada", "Por asignar"),
                datos.get("docente", ""),
                datos.get("asignatura", ""),
                horario_id
            ))
        connection.commit()
        return {"message": "Horario actualizado exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar horario: {str(e)}")
    finally:
        connection.close()


@app.delete("/api/archivos/{nombre_archivo}")
def eliminar_archivo(nombre_archivo: str):
    """
    Elimina un archivo y todos sus horarios asociados
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM horarios WHERE archivo = %s", (nombre_archivo,))
        connection.commit()
        return {"message": f"Archivo '{nombre_archivo}' y sus horarios eliminados exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar archivo: {str(e)}")
    finally:
        connection.close()