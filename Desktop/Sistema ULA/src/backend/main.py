import os
import re
import unicodedata
import pymysql
import bcrypt
import certifi
import pdfplumber
import json
import smtplib
import secrets
from contextlib import asynccontextmanager
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from io import BytesIO

# Cargar variables de entorno desde src/backend/.env
base_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(base_dir, ".env"))

def migrar_columnas_verificacion():
    """Agrega las columnas y tablas necesarias si no existen."""
    try:
        connection = get_db_connection()
        with connection.cursor() as cursor:
            for sentencia in [
                "ALTER TABLE usuarios ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE usuarios ADD COLUMN verification_code VARCHAR(6) NULL",
                "ALTER TABLE usuarios ADD COLUMN reset_code VARCHAR(6) NULL",
                "ALTER TABLE aulas ADD COLUMN en_mantenimiento BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE aulas ADD COLUMN fin_mantenimiento DATETIME NULL",
                "ALTER TABLE aulas ADD COLUMN aula_temporal VARCHAR(100) NULL",
                "ALTER TABLE usuarios ADD COLUMN verification_code_expira DATETIME NULL",
                "ALTER TABLE usuarios ADD COLUMN reset_code_expira DATETIME NULL",
                "ALTER TABLE usuarios ADD COLUMN created_at DATETIME DEFAULT NOW()",
                "ALTER TABLE horarios ADD COLUMN fecha_clase DATE NULL",
                "ALTER TABLE horarios ADD COLUMN semestre VARCHAR(50) NULL",
                "ALTER TABLE horarios ADD COLUMN cuatrimestre VARCHAR(50) NULL",
                "ALTER TABLE horarios ADD COLUMN grupo VARCHAR(50) NULL",
                """CREATE TABLE IF NOT EXISTS docentes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(200) NOT NULL,
                    especialidad VARCHAR(200) DEFAULT '',
                    materias TEXT DEFAULT '[]',
                    correo VARCHAR(200) DEFAULT '',
                    created_at DATETIME DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS suplencias (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    docente_id INT NOT NULL,
                    suplente_id INT NOT NULL,
                    materia VARCHAR(200) DEFAULT '',
                    dia VARCHAR(50) DEFAULT '',
                    fecha DATE,
                    hora_inicio TIME,
                    hora_fin TIME,
                    activa BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS suplencias_horarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    docente_nombre VARCHAR(200) NOT NULL,
                    suplente_nombre VARCHAR(200) NOT NULL,
                    materia VARCHAR(200) DEFAULT '',
                    dia VARCHAR(50) DEFAULT '',
                    fecha DATE,
                    hora_inicio TIME,
                    hora_fin TIME,
                    activa BOOLEAN DEFAULT TRUE,
                    created_at DATETIME DEFAULT NOW()
                )""",
                """CREATE TABLE IF NOT EXISTS calendarios (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tipo VARCHAR(50) NOT NULL,
                    carrera VARCHAR(50) DEFAULT '',
                    archivo_nombre VARCHAR(255) NOT NULL,
                    archivo_url VARCHAR(500) NOT NULL,
                    created_at DATETIME DEFAULT NOW()
                )""",
            ]:
                try:
                    cursor.execute(sentencia)
                except Exception:
                    pass
        connection.commit()
        connection.close()
    except Exception as e:
        print(f"Advertencia en migración: {e}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    migrar_columnas_verificacion()
    yield


app = FastAPI(title="API SIPREF ULA", lifespan=lifespan)

# Configurar directorio de uploads
UPLOAD_DIR = os.path.join(base_dir, "uploads", "calendarios")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=os.path.join(base_dir, "uploads")), name="uploads")


import urllib.request
import urllib.error

def _enviar_smtp(correo_destino: str, asunto: str, html: str):
    """Envía correos usando la API de EmailJS (vía HTTP) para evadir el bloqueo de puertos de Render."""
    service_id = os.getenv("EMAILJS_SERVICE_ID")
    template_id = os.getenv("EMAILJS_TEMPLATE_ID")
    public_key = os.getenv("EMAILJS_PUBLIC_KEY")
    private_key = os.getenv("EMAILJS_PRIVATE_KEY")

    if not service_id or not template_id or not public_key:
        raise ValueError("Faltan las credenciales de EmailJS en las variables de entorno.")

    payload = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "accessToken": private_key,
        "template_params": {
            "to_email": correo_destino,
            "asunto": asunto,
            "html_content": html
        }
    }

    req = urllib.request.Request(
        'https://api.emailjs.com/api/v1.0/email/send',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            pass # Si es 200 OK, el correo se envió correctamente
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        raise ValueError(f"Error de EmailJS ({e.code}): {error_msg}")
    except Exception as e:
        raise ValueError(f"Error de conexión con EmailJS: {str(e)}")


def enviar_correo_otp(correo_destino: str, codigo: str, nombre: str):
    html = f"""
    <html><body style="font-family:Arial,sans-serif;background:#f4f6fb;padding:32px;">
      <div style="max-width:420px;margin:auto;background:#fff;border-radius:16px;
                  padding:36px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);">
        <h2 style="color:#1c355e;margin-bottom:4px;">SIPREF</h2>
        <p style="color:#75777f;font-size:13px;">Universidad Latino</p>
        <p style="color:#44464e;">Hola <b>{nombre}</b>, tu código de verificación es:</p>
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#1c355e;
                    background:#f0f4ff;padding:18px;border-radius:10px;margin:24px 0;">
          {codigo}
        </div>
        <p style="color:#75777f;font-size:12px;">Caduca en 15 minutos. No lo compartas con nadie.</p>
      </div>
    </body></html>
    """
    _enviar_smtp(correo_destino, "Código de verificación — SIPREF ULA", html)

# Configuración de CORS para permitir la conexión desde Vite (React)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "*"
    ],
    allow_credentials=False,
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
    semestre: str = ""
    cuatrimestre: str = ""
    grupo: str = ""

class Aula(BaseModel):
    nombre: str
    edificio: str = ""
    capacidad: int = 0
    equipos: list = []
    estado: str = "Activo"

class MantenimientoUpdate(BaseModel):
    en_mantenimiento: bool
    fin_mantenimiento: Optional[str] = None  # ISO datetime, ej: "2026-05-25T18:00"
    aula_temporal: Optional[str] = None

class Docente(BaseModel):
    nombre: str
    especialidad: str = ""
    materias: list = []
    correo: str = ""

class Suplencia(BaseModel):
    docente_id: int
    suplente_id: int
    materia: str = ""
    dia: str = ""
    fecha: str
    hora_inicio: str
    hora_fin: str

class SuplenciaHorarios(BaseModel):
    docente_nombre: str
    suplente_nombre: str
    materia: str = ""
    dia: str = ""
    fecha: str
    hora_inicio: str
    hora_fin: str

class ActualizarUsuario(BaseModel):
    nombre: str
    turno: str

class CambiarPassword(BaseModel):
    password_actual: str
    password_nueva: str

class VerificacionCorreo(BaseModel):
    correo: str
    codigo: str

class RecuperarContrasena(BaseModel):
    correo: str

class RestablecerContrasena(BaseModel):
    correo: str
    codigo: str
    nueva_password: str

# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
_DIAS_MAP = {'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6}

def _parse_horario_minutos(horario_str: str):
    """Convierte 'Lunes 07:00-09:00' → (dia_index, inicio_min, fin_min). Retorna (None,None,None) si no parsea."""
    if not horario_str:
        return None, None, None
    partes = horario_str.strip().split(' ', 1)
    if len(partes) < 2:
        return None, None, None
    dia_raw = unicodedata.normalize('NFD', partes[0].lower())
    dia_raw = ''.join(c for c in dia_raw if unicodedata.category(c) != 'Mn')
    dia_index = _DIAS_MAP.get(dia_raw)
    tiempo = re.sub(r'-+', '-', partes[1].replace(' ', ''))
    m = re.match(r'(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})', tiempo)
    if not m:
        return dia_index, None, None
    h_i, m_i, h_f, m_f = map(int, m.groups())
    return dia_index, h_i * 60 + m_i, h_f * 60 + m_f

def _aplicar_mantenimiento(horarios: list) -> list:
    """Reemplaza aula_asignada por aula_temporal si el aula está en mantenimiento vigente."""
    ahora = datetime.now()
    for h in horarios:
        en_mant = h.pop('en_mantenimiento', None)
        fin_mant = h.pop('fin_mantenimiento', None)
        aula_temp = h.pop('aula_temporal', None)
        if not en_mant or not aula_temp:
            continue
        # Sin fecha de fin → mantenimiento indefinido (siempre activo)
        if fin_mant is None:
            vigente = True
        else:
            if isinstance(fin_mant, datetime):
                fin_dt = fin_mant
            else:
                try:
                    fin_dt = datetime.fromisoformat(str(fin_mant))
                except Exception:
                    fin_dt = None
            vigente = bool(fin_dt and fin_dt > ahora)
        if vigente:
            h['aula_original'] = h['aula_asignada']
            h['aula_asignada'] = aula_temp
            h['aula_reasignada'] = True
    return horarios

def _timedelta_to_str(td):
    if isinstance(td, timedelta):
        total = int(td.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    return str(td)[:5] if td else ""

def _normalizar_licenciatura(texto: str) -> str:
    """Elimina duplicación de palabras en el nombre de licenciatura extraído del PDF."""
    if not texto:
        return texto
    # Palabras pegadas repetidas: "LICENCIATURALICENCIATURA" → "LICENCIATURA"
    texto = re.sub(r'([A-Za-záéíóúÁÉÍÓÚñÑ]{5,})\1', r'\1', texto)
    # Palabras separadas repetidas: "Licenciatura Licenciatura" → "Licenciatura"
    texto = re.sub(r'\b(\w+)\s+\1\b', r'\1', texto, flags=re.IGNORECASE)
    texto = ' '.join(texto.split()).strip()
    
    # Extraer siglas si están entre paréntesis, por ejemplo: "(ISC Plan 2020)" o "(Der Plan 2024)" -> "ISC", "DER"
    match = re.search(r'\(\s*([A-Za-z]{2,6})\b', texto)
    if match:
        return match.group(1).upper()
        
    return texto


def _time_to_mins(t):
    if isinstance(t, timedelta):
        return int(t.total_seconds() // 60)
    try:
        parts = str(t).split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

# ---------------------------------------------------------
# ENDPOINTS (RUTAS DE LA API)
# ---------------------------------------------------------

@app.get("/api/calendarios")
def obtener_calendarios():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, tipo, carrera, archivo_nombre, archivo_url FROM calendarios")
            calendarios = cursor.fetchall()
        return calendarios
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        connection.close()

import shutil

@app.post("/api/calendarios/upload")
async def subir_calendario(
    tipo: str = Form(...),
    carrera: str = Form(""),
    archivo: UploadFile = File(...)
):
    if archivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")
    
    # Crear nombre de archivo seguro
    safe_filename = f"{tipo}_{carrera}_{secrets.token_hex(4)}.pdf" if carrera else f"{tipo}_{secrets.token_hex(4)}.pdf"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    # Guardar archivo físicamente
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)
        
    archivo_url = f"/uploads/calendarios/{safe_filename}"
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Si ya existe un calendario para este tipo/carrera, lo borramos (o lo actualizamos)
            # Para simplificar, insertamos uno nuevo y eliminamos los viejos de la BD
            cursor.execute("DELETE FROM calendarios WHERE tipo = %s AND carrera = %s", (tipo, carrera))
            cursor.execute(
                "INSERT INTO calendarios (tipo, carrera, archivo_nombre, archivo_url) VALUES (%s, %s, %s, %s)",
                (tipo, carrera, archivo.filename, archivo_url)
            )
        connection.commit()
        return {"message": "Calendario subido exitosamente", "url": archivo_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        connection.close()


@app.get("/ping")
def ping():
    return {"status": "ok", "message": "Servidor activo"}

@app.post("/api/registro")
def registrar_usuario(datos: RegistroUsuario):
    correo_limpio = datos.correo.strip().lower()
    if not correo_limpio.endswith("universidadlatino.edu.mx"):
        raise HTTPException(status_code=400, detail="El correo debe pertenecer a la Universidad Latino.")

    password_hasheada = bcrypt.hashpw(datos.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM usuarios WHERE correo = %s", (correo_limpio,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Este correo ya se encuentra registrado.")

            cursor.execute(
                "INSERT INTO usuarios (nombre, correo, turno, password, is_verified) VALUES (%s, %s, %s, %s, TRUE)",
                (datos.nombre.strip(), correo_limpio, datos.turno, password_hasheada)
            )
        connection.commit()
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        connection.close()

    return {"message": "Usuario registrado correctamente. Ya puedes iniciar sesión."}


@app.delete("/api/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: int, admin_correo: str):
    correo_admin_permitido = "yenri.moo@alumno.universidadlatino.edu.mx"
    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT correo FROM usuarios WHERE id = %s", (usuario_id,))
            user_a_eliminar = cursor.fetchone()
            
            if not user_a_eliminar:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")
                
            correo_eliminar = user_a_eliminar['correo']
            
            # Un usuario puede eliminarse a sí mismo. Para eliminar a otros, debe ser el admin.
            if admin_correo.lower() != correo_eliminar.lower() and admin_correo.lower() != correo_admin_permitido:
                raise HTTPException(status_code=403, detail="Solo el administrador puede eliminar a otros usuarios.")
                
            cursor.execute("DELETE FROM usuarios WHERE id = %s", (usuario_id,))
        connection.commit()
        return {"message": "Cuenta eliminada correctamente"}
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar la cuenta: {str(e)}")
    finally:
        connection.close()


@app.put("/api/usuarios/{usuario_id}")
def actualizar_usuario(usuario_id: int, datos: ActualizarUsuario):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE usuarios SET nombre = %s, turno = %s WHERE id = %s",
                (datos.nombre.strip(), datos.turno, usuario_id)
            )
        connection.commit()
        return {"message": "Perfil actualizado correctamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar perfil: {str(e)}")
    finally:
        connection.close()


@app.get("/api/usuarios/{usuario_id}")
def obtener_usuario(usuario_id: int):
    """Devuelve los datos públicos de un usuario por ID (sin contraseña)."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, nombre, correo, turno, created_at FROM usuarios WHERE id = %s",
                (usuario_id,)
            )
            u = cursor.fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="Usuario no encontrado.")
        return {
            'id':         u['id'],
            'nombre':     u['nombre'],
            'correo':     u['correo'],
            'turno':      u['turno'] or '',
            'created_at': u['created_at'].isoformat() if u.get('created_at') else None,
        }
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        connection.close()


@app.get("/api/usuarios")
def listar_usuarios():
    """Lista todos los usuarios registrados (sin datos sensibles)."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, nombre, correo, turno, is_verified, created_at
                FROM usuarios ORDER BY nombre
            """)
            usuarios = cursor.fetchall()
        result = []
        for u in (usuarios or []):
            result.append({
                'id':          u['id'],
                'nombre':      u['nombre'],
                'correo':      u['correo'],
                'turno':       u['turno'] or '',
                'is_verified': bool(u.get('is_verified', False)),
                'created_at':  u['created_at'].isoformat() if u.get('created_at') else None,
            })
        return result
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener usuarios: {str(e)}")
    finally:
        connection.close()


@app.put("/api/usuarios/{usuario_id}/cambiar-password")
def cambiar_password(usuario_id: int, datos: CambiarPassword):
    if len(datos.password_nueva) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT password FROM usuarios WHERE id = %s", (usuario_id,))
            usuario = cursor.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")
            if not bcrypt.checkpw(datos.password_actual.encode('utf-8'), usuario['password'].encode('utf-8')):
                raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
            nueva_hash = bcrypt.hashpw(datos.password_nueva.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("UPDATE usuarios SET password = %s WHERE id = %s", (nueva_hash, usuario_id))
        connection.commit()
        return {"message": "Contraseña actualizada correctamente."}
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al cambiar contraseña: {str(e)}")
    finally:
        connection.close()


@app.post("/api/verificar-correo")
def verificar_correo(datos: VerificacionCorreo):
    correo_limpio = datos.correo.strip().lower()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, verification_code, verification_code_expira, is_verified FROM usuarios WHERE correo = %s",
                (correo_limpio,)
            )
            usuario = cursor.fetchone()

            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")
            if usuario['is_verified']:
                return {"message": "El correo ya estaba verificado."}
            if usuario.get('verification_code_expira') and datetime.now() > usuario['verification_code_expira']:
                raise HTTPException(status_code=400, detail="El código ha expirado. Regístrate de nuevo para recibir un código actualizado.")
            if usuario['verification_code'] != datos.codigo.strip():
                raise HTTPException(status_code=400, detail="Código incorrecto. Inténtalo de nuevo.")

            cursor.execute(
                "UPDATE usuarios SET is_verified = TRUE, verification_code = NULL, verification_code_expira = NULL WHERE id = %s",
                (usuario['id'],)
            )
        connection.commit()
        return {"message": "Correo verificado correctamente. Ya puedes iniciar sesión."}
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
            cursor.execute(
                "SELECT id, nombre, correo, turno, password, is_verified, created_at FROM usuarios WHERE correo = %s",
                (correo_limpio,)
            )
            usuario = cursor.fetchone()

            if not usuario:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

            password_valida = bcrypt.checkpw(
                datos.password.encode('utf-8'),
                usuario['password'].encode('utf-8')
            )

            if not password_valida:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")

            return {
                "message": "Login exitoso",
                "usuario": {
                    "id":         usuario['id'],
                    "nombre":     usuario['nombre'],
                    "correo":     usuario['correo'],
                    "turno":      usuario['turno'],
                    "created_at": usuario['created_at'].isoformat() if usuario.get('created_at') else None,
                    "logged_at":  datetime.now().isoformat(),
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
    Para imágenes: usa easyocr con detección de tabla por posición.
    """
    try:
        contenido = await archivo.read()
        
        # Validar tipo de archivo
        tipo_archivo = archivo.content_type
        if tipo_archivo not in ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']:
            raise ValueError("Formato no soportado. Usa PDF o imágenes (PNG, JPG).")
        
        licenciatura_extraida = "Licenciatura no identificada"
        semestre_extraido = ""
        cuatrimestre_extraido = ""
        grupo_extraido = ""
        mapa_docentes = {}
        horarios_compilados = []
        
        # ========== PROCESAR PDF ==========
        if tipo_archivo == 'application/pdf':
            pdf_file = BytesIO(contenido)
            
            with pdfplumber.open(pdf_file) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    texto_pagina = page.extract_text() or ""
                    for linea in texto_pagina.split('\n'):
                        linea_upper = linea.upper()
                        if "LICENCIATURA EN" in linea_upper or "LICENCIATURA" in linea_upper:
                            licenciatura_extraida = _normalizar_licenciatura(linea.strip())
                        match_sem = re.search(r'SEMESTRE:\s*([^\s]+)', linea_upper)
                        if match_sem: semestre_extraido = match_sem.group(1)
                        match_cuat = re.search(r'CUATRIMESTRE:\s*([^\s]+)', linea_upper)
                        if match_cuat: cuatrimestre_extraido = match_cuat.group(1)
                        match_grupo = re.search(r'GRUPO:\s*([^\s]+)', linea_upper)
                        if match_grupo: grupo_extraido = match_grupo.group(1)
                    
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
                                        "aula_asignada": "",
                                        "semestre": semestre_extraido,
                                        "cuatrimestre": cuatrimestre_extraido,
                                        "grupo": grupo_extraido
                                    })
        
        # ========== PROCESAR IMÁGENES ==========
        else:
            try:
                import numpy as np
                import easyocr
                from PIL import Image

                imagen = Image.open(BytesIO(contenido))
                imagen_np = np.array(imagen)

                # Usar reader con mejor configuración para imágenes
                reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
                resultados = reader.readtext(imagen_np)

                if not resultados:
                    raise ValueError("No se pudo extraer texto de la imagen. Verifica que sea una imagen clara.")

                # Construir lista de elementos con posición central (umbral de confianza más bajo)
                elementos = []
                for bbox, texto, conf in resultados:
                    if conf > 0.25 and texto.strip():  # Reducido de 0.3 a 0.25 para más tolerancia
                        y_centro = (bbox[0][1] + bbox[2][1]) / 2
                        x_centro = (bbox[0][0] + bbox[2][0]) / 2
                        elementos.append({"texto": texto.strip(), "x": x_centro, "y": y_centro, "conf": conf})

                if not elementos:
                    raise ValueError("No se extrajo texto suficiente de la imagen.")

                elementos.sort(key=lambda e: e["y"])

                # Extraer licenciatura, semestre, cuatrimestre, grupo
                for elem in elementos:
                    texto_upper = elem["texto"].upper()
                    if "LICENCIATURA" in texto_upper:
                        licenciatura_extraida = _normalizar_licenciatura(elem["texto"].strip())
                    match_sem = re.search(r'SEMESTRE:\s*([^\s]+)', texto_upper)
                    if match_sem: semestre_extraido = match_sem.group(1)
                    match_cuat = re.search(r'CUATRIMESTRE:\s*([^\s]+)', texto_upper)
                    if match_cuat: cuatrimestre_extraido = match_cuat.group(1)
                    match_grupo = re.search(r'GRUPO:\s*([^\s]+)', texto_upper)
                    if match_grupo: grupo_extraido = match_grupo.group(1)

                # Agrupar elementos en filas (aumentar tolerancia a 25px para mejor agrupación)
                filas = []
                fila_actual = []
                y_actual = None
                tolerancia = 25  # Aumentado de 15 a 25px
                for elem in elementos:
                    if y_actual is None or abs(elem["y"] - y_actual) <= tolerancia:
                        fila_actual.append(elem)
                        y_actual = elem["y"] if y_actual is None else (y_actual + elem["y"]) / 2
                    else:
                        if fila_actual:
                            filas.append(sorted(fila_actual, key=lambda e: e["x"]))
                        fila_actual = [elem]
                        y_actual = elem["y"]
                if fila_actual:
                    filas.append(sorted(fila_actual, key=lambda e: e["x"]))

                # Detectar columnas de días - MÁS FLEXIBLE
                dias_keywords = {
                    "lunes": "Lunes", "l": "Lunes",
                    "martes": "Martes", "m": "Martes", "ma": "Martes",
                    "miércoles": "Miércoles", "miercoles": "Miércoles", "x": "Miércoles", "mi": "Miércoles",
                    "jueves": "Jueves", "j": "Jueves", "ju": "Jueves",
                    "viernes": "Viernes", "v": "Viernes", "vi": "Viernes"
                }
                cols_dias = {}
                y_fila_dias = None

                for fila in filas:
                    for elem in fila:
                        texto_lower = elem["texto"].lower().strip()
                        # Solo aceptar palabras cortas o que coincidan exactamente para días
                        if len(texto_lower) <= 10:  # Los días no son textos largos
                            for d_key, d_val in dias_keywords.items():
                                if d_key in texto_lower and d_val not in cols_dias:
                                    cols_dias[d_val] = elem["x"]
                                    y_fila_dias = elem["y"]
                                    break

                # Construir mapa asignatura→docente desde la tabla de directorio al pie
                mapa_docentes_img = {}
                for fila in filas:
                    textos = [e["texto"] for e in fila]
                    tiene_numero = any(re.search(r"\d{1,3}", t) for t in textos)
                    # Buscar nombres propios (capitalizados)
                    nombres = [t for t in textos if len(t.split()) >= 2 and t[0].isupper() and not any(c.isdigit() for c in t)]
                    if tiene_numero and len(nombres) >= 1:
                        # Mapear el primer elemento con nombres
                        key = textos[0].lower() if textos else "unknown"
                        valor = nombres[-1] if nombres else "Sin especificar"
                        if key and key != "sin especificar":
                            mapa_docentes_img[key] = valor

                # OPCIÓN 1: Extraer horarios de la tabla de días si se detectaron
                if y_fila_dias is not None and cols_dias:
                    for fila in filas:
                        if not fila or fila[0]["y"] <= y_fila_dias:
                            continue
                        primer_texto = fila[0]["texto"]
                        # Buscar patrón de horario (HH:MM o HH-MM)
                        if not re.search(r"\d{1,2}[:\-]\d{2}", primer_texto):
                            continue
                        horario_slot = primer_texto

                        for elem in fila[1:]:
                            celda = elem["texto"].strip()
                            if not celda or len(celda) < 2:
                                continue
                            # No procesar si es hora
                            if re.search(r"\d{1,2}[:\-]\d{2}", celda):
                                continue

                            # Asignar día basado en la columna X más cercana
                            dia_asignado = min(cols_dias, key=lambda d: abs(cols_dias[d] - elem["x"]))

                            key_busqueda = celda.lower()
                            docente_img = mapa_docentes_img.get(key_busqueda, "Sin especificar")
                            if docente_img == "Sin especificar":
                                for k, v in mapa_docentes_img.items():
                                    if k in key_busqueda or key_busqueda in k:
                                        docente_img = v
                                        break

                            entrada_id = f"img_{dia_asignado}_{horario_slot}_{celda}"
                            ya_existe = any(
                                h["id"] == entrada_id and h["asignatura"].lower() == celda.lower()
                                for h in horarios_compilados
                            )
                            if not ya_existe:
                                horarios_compilados.append({
                                    "id": entrada_id,
                                    "docente": docente_img,
                                    "licenciatura": licenciatura_extraida,
                                    "asignatura": celda.title(),
                                    "horario_resumen": f"{dia_asignado} {horario_slot}",
                                    "aula_asignada": "",
                                    "semestre": semestre_extraido,
                                    "cuatrimestre": cuatrimestre_extraido,
                                    "grupo": grupo_extraido
                                })

                # OPCIÓN 2: Si no se estructuró bien, generar horarios de texto directo
                if not horarios_compilados and elementos:
                    contador = 0
                    for elem in elementos:
                        texto = elem["texto"].strip()
                        # Filtrar elementos muy cortos o que sean números solos
                        if len(texto) > 2 and not re.fullmatch(r"\d+", texto) and "licenciatura" not in texto.lower():
                            docente_encontrado = "Sin especificar"
                            # Buscar en el mapa si existe
                            for k, v in mapa_docentes_img.items():
                                if k in texto.lower() or texto.lower() in k:
                                    docente_encontrado = v
                                    break

                            horarios_compilados.append({
                                "id": f"img_fallback_{contador}",
                                "docente": docente_encontrado,
                                "licenciatura": licenciatura_extraida,
                                "asignatura": texto.title(),
                                "horario_resumen": "Verificar en imagen",
                                "aula_asignada": "",
                                "semestre": semestre_extraido,
                                "cuatrimestre": cuatrimestre_extraido,
                                "grupo": grupo_extraido
                            })
                            contador += 1
                            if contador >= 20:  # Máximo 20 fallback para evitar spam
                                break

                # OPCIÓN 3: Si aún no hay nada, al menos mostrar que se leyó texto
                if not horarios_compilados:
                    horarios_compilados.append({
                        "id": "img_0",
                        "docente": "Verificar manualmente",
                        "licenciatura": licenciatura_extraida,
                        "asignatura": f"Se detectó imagen. Se extrajeron {len(elementos)} elementos de texto. Verifica que el formato sea correcto.",
                        "horario_resumen": "Revisar imagen",
                        "aula_asignada": "",
                        "semestre": semestre_extraido,
                        "cuatrimestre": cuatrimestre_extraido,
                        "grupo": grupo_extraido
                    })

            except ImportError:
                horarios_compilados.append({
                    "id": "img_error",
                    "docente": "Error de Extracción",
                    "licenciatura": "No disponible",
                    "asignatura": "easyocr no instalado. Ejecuta: pip install easyocr numpy pillow",
                    "horario_resumen": "Instala la dependencia",
                    "aula_asignada": ""
                })
            except Exception as e:
                import traceback
                error_detail = str(e)
                print(f"Error procesando imagen: {error_detail}")
                print(traceback.format_exc())
                raise ValueError(f"Error procesando imagen: {error_detail}")
        
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


@app.post("/api/recuperar-contrasena")
def recuperar_contrasena(datos: RecuperarContrasena):
    correo_limpio = datos.correo.strip().lower()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nombre FROM usuarios WHERE correo = %s", (correo_limpio,))
            usuario = cursor.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="No existe una cuenta con ese correo.")

            codigo = str(secrets.randbelow(900000) + 100000)
            expira_reset = datetime.now() + timedelta(minutes=15)
            cursor.execute("UPDATE usuarios SET reset_code = %s, reset_code_expira = %s WHERE id = %s", (codigo, expira_reset, usuario['id']))
        connection.commit()
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        connection.close()

    try:
        html_reset = f"""
        <html><body style="font-family:Arial,sans-serif;background:#f4f6fb;padding:32px;">
          <div style="max-width:420px;margin:auto;background:#fff;border-radius:16px;
                      padding:36px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08);">
            <h2 style="color:#1c355e;margin-bottom:4px;">SIPREF</h2>
            <p style="color:#75777f;font-size:13px;">Universidad Latino</p>
            <p style="color:#44464e;">Hola <b>{usuario['nombre']}</b>, tu código para restablecer la contraseña es:</p>
            <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#1c355e;
                        background:#f0f4ff;padding:18px;border-radius:10px;margin:24px 0;">
              {codigo}
            </div>
            <p style="color:#75777f;font-size:12px;">Caduca en 15 minutos. Si no solicitaste esto, ignora este correo.</p>
          </div>
        </body></html>
        """
        _enviar_smtp(correo_limpio, "Restablecer contraseña — SIPREF ULA", html_reset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo enviar el correo: {str(e)}")

    return {"message": "Código enviado al correo."}


@app.post("/api/restablecer-contrasena")
def restablecer_contrasena(datos: RestablecerContrasena):
    correo_limpio = datos.correo.strip().lower()
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, reset_code, reset_code_expira FROM usuarios WHERE correo = %s", (correo_limpio,))
            usuario = cursor.fetchone()
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")
            if usuario.get('reset_code_expira') and datetime.now() > usuario['reset_code_expira']:
                raise HTTPException(status_code=400, detail="El código ha expirado. Solicita un nuevo correo de recuperación.")
            if not usuario['reset_code'] or usuario['reset_code'] != datos.codigo.strip():
                raise HTTPException(status_code=400, detail="Código incorrecto.")

            if len(datos.nueva_password) < 6:
                raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")
            nueva_hash = bcrypt.hashpw(datos.nueva_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute(
                "UPDATE usuarios SET password = %s, reset_code = NULL, reset_code_expira = NULL WHERE id = %s",
                (nueva_hash, usuario['id'])
            )
        connection.commit()
        return {"message": "Contraseña actualizada correctamente."}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error en la base de datos: {str(e)}")
    finally:
        connection.close()


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE HORARIOS
# ---------------------------------------------------------
def _verificar_conflicto_aula(cursor, aula: str, horario_str: str, excluir_id: int = None) -> str | None:
    """Retorna mensaje de conflicto si el aula ya está ocupada en ese rango horario, o None si no hay conflicto."""
    if not aula or aula in ("Por asignar", ""):
        return None
    dia_idx, inicio, fin = _parse_horario_minutos(horario_str)
    if dia_idx is None or inicio is None or fin is None:
        return None
    query = "SELECT horario, asignatura, docente FROM horarios WHERE aula_asignada = %s AND TRIM(aula_asignada) != '' AND TRIM(aula_asignada) != 'Por asignar'"
    params = [aula]
    if excluir_id is not None:
        query += " AND id != %s"
        params.append(excluir_id)
    cursor.execute(query, params)
    existentes = cursor.fetchall()
    for ex in (existentes or []):
        e_dia, e_inicio, e_fin = _parse_horario_minutos(ex.get('horario', ''))
        if e_dia != dia_idx or e_inicio is None or e_fin is None:
            continue
        # Hay solapamiento si NO se cumple: e_fin <= inicio OR e_inicio >= fin
        if not (e_fin <= inicio or e_inicio >= fin):
            return (f"El aula '{aula}' ya está ocupada en ese horario: "
                    f"{ex['asignatura']} con {ex['docente']} ({ex['horario']})")
    return None


@app.post("/api/guardar-horarios")
def guardar_horarios(horarios: list[dict]):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Verificar conflictos antes de insertar
            conflictos = []
            for h in horarios:
                aula = h.get("aulaAsignada", h.get("aula_asignada", "Por asignar"))
                horario_str = h.get("horario", h.get("horario_resumen", ""))
                msg = _verificar_conflicto_aula(cursor, aula, horario_str)
                if msg and msg not in conflictos:
                    conflictos.append(msg)
            if conflictos:
                raise HTTPException(status_code=409, detail=conflictos[0])

            for h in horarios:
                sql = """
                    INSERT INTO horarios
                    (docente, licenciatura, asignatura, horario, aula_asignada, archivo, fecha_creacion, fecha_clase, semestre, cuatrimestre, grupo)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), CURDATE(), %s, %s, %s)
                """
                cursor.execute(sql, (
                    h.get("docente", ""),
                    h.get("licenciatura", ""),
                    h.get("asignatura", ""),
                    h.get("horario", h.get("horario_resumen", "")),
                    h.get("aulaAsignada", h.get("aula_asignada", "Por asignar")),
                    h.get("archivo", ""),
                    h.get("semestre", ""),
                    h.get("cuatrimestre", ""),
                    h.get("grupo", "")
                ))
        connection.commit()
        return {"message": "Horarios guardados"}
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar horarios: {str(e)}")
    finally:
        connection.close()


@app.get("/api/horarios")
def obtener_horarios():
    """
    Devuelve el catálogo completo de horarios programados (semana recurrente).
    Usa GROUP BY para deduplicar entradas idénticas sin filtrar por fecha de carga,
    igual que /api/clases-hoy, para que el dashboard muestre exactamente los mismos
    registros que Gestión de Docentes.
    """
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    MIN(h.id)           AS id,
                    h.docente,
                    h.licenciatura,
                    h.asignatura,
                    h.horario,
                    h.aula_asignada,
                    MIN(h.archivo)      AS archivo,
                    MAX(h.fecha_creacion) AS fecha_creacion,
                    MAX(h.semestre)     AS semestre,
                    MAX(h.cuatrimestre) AS cuatrimestre,
                    MAX(h.grupo)        AS grupo,
                    a.en_mantenimiento,
                    a.fin_mantenimiento,
                    a.aula_temporal
                FROM horarios h
                LEFT JOIN aulas a ON a.nombre = h.aula_asignada
                WHERE h.docente IS NOT NULL
                  AND TRIM(h.docente) != ''
                  AND TRIM(h.docente) != 'Sin especificar'
                GROUP BY
                    h.docente, h.licenciatura, h.asignatura,
                    h.horario, h.aula_asignada,
                    a.en_mantenimiento, a.fin_mantenimiento, a.aula_temporal
                ORDER BY h.horario
                LIMIT 1000
            """)
            horarios = cursor.fetchall()
        return _aplicar_mantenimiento(horarios) if horarios else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener horarios: {str(e)}")
    finally:
        connection.close()


@app.get("/api/clases-hoy")
def obtener_clases_hoy(dia: Optional[int] = None, mins: Optional[int] = None):
    """
    Clases EN CURSO ahora mismo.
    dia  = getDay() JS (0=Dom…6=Sab). Si se omite, usa el día real del servidor.
    mins = minutos desde medianoche.  Si se omite, usa la hora real del servidor.
    """
    ahora = datetime.now()
    dia_hoy   = dia  if dia  is not None else (ahora.isoweekday() % 7)
    mins_ahora = mins if mins is not None else (ahora.hour * 60 + ahora.minute)

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Sin filtro por fecha: usamos el campo horario (día semana + hora)
            cursor.execute("""
                SELECT h.docente, h.asignatura, h.horario, h.aula_asignada,
                       a.en_mantenimiento, a.fin_mantenimiento, a.aula_temporal
                FROM (
                    SELECT docente, asignatura, horario, aula_asignada
                    FROM horarios
                    WHERE docente IS NOT NULL AND TRIM(docente) != ''
                    GROUP BY docente, asignatura, horario, aula_asignada
                ) h
                LEFT JOIN aulas a ON a.nombre = h.aula_asignada
            """)
            todas = cursor.fetchall()

        en_curso = []
        for clase in (todas or []):
            dia_idx, inicio, fin = _parse_horario_minutos(clase.get('horario', ''))
            if dia_idx == dia_hoy and inicio is not None and inicio <= mins_ahora <= fin:
                en_curso.append(clase)

        return _aplicar_mantenimiento(en_curso)
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener clases: {str(e)}")
    finally:
        connection.close()


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE AULAS
# ---------------------------------------------------------
@app.get("/api/aulas/ocupacion")
def obtener_ocupacion_aulas():
    """
    Calcula ocupación de cada aula basándose en sus horarios asignados en la BD.
    Matutino  : inicio < 14:00 (840 min).
    Vespertino: inicio >= 14:00.
    No depende de la hora actual — refleja la semana completa.
    """
    LIMITE_VESPERTINO = 14 * 60  # 840 min = 14:00
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT aula_asignada, horario
                FROM horarios
                WHERE aula_asignada IS NOT NULL
                  AND TRIM(aula_asignada) != ''
                  AND TRIM(aula_asignada) != 'Por asignar'
            """)
            registros = cursor.fetchall()

        ocupacion: dict[str, dict] = {}
        for r in (registros or []):
            aula = r['aula_asignada']
            _, inicio, _ = _parse_horario_minutos(r.get('horario', ''))
            if inicio is None:
                continue
            if aula not in ocupacion:
                ocupacion[aula] = {'matutino': False, 'vespertino': False}
            if inicio < LIMITE_VESPERTINO:
                ocupacion[aula]['matutino'] = True
            else:
                ocupacion[aula]['vespertino'] = True

        return ocupacion
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener ocupación: {str(e)}")
    finally:
        connection.close()


@app.get("/api/aulas")
def obtener_aulas():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, nombre, edificio, capacidad, equipos, estado,
                       en_mantenimiento, fin_mantenimiento, aula_temporal
                FROM aulas ORDER BY nombre
            """)
            aulas = cursor.fetchall()
        for aula in (aulas or []):
            # Parsear equipos de JSON string a lista
            if aula.get('equipos'):
                try:
                    aula['equipos'] = json.loads(aula['equipos'])
                except Exception:
                    aula['equipos'] = []
            # Serializar datetime para JSON
            if aula.get('fin_mantenimiento') and isinstance(aula['fin_mantenimiento'], datetime):
                aula['fin_mantenimiento'] = aula['fin_mantenimiento'].isoformat()
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


@app.put("/api/aulas/{aula_id}")
def actualizar_aula(aula_id: int, aula: Aula):
    """Actualiza los datos de un aula existente."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            equipos_json = json.dumps(aula.equipos)
            cursor.execute(
                "UPDATE aulas SET nombre=%s, edificio=%s, capacidad=%s, equipos=%s, estado=%s WHERE id=%s",
                (aula.nombre, aula.edificio, aula.capacidad, equipos_json, aula.estado, aula_id)
            )
        connection.commit()
        return {"message": "Aula actualizada exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar aula: {str(e)}")
    finally:
        connection.close()


@app.post("/api/aulas/{aula_id}/mantenimiento")
def actualizar_mantenimiento(aula_id: int, datos: MantenimientoUpdate):
    fin_dt = None
    if datos.fin_mantenimiento:
        try:
            fin_dt = datetime.fromisoformat(datos.fin_mantenimiento)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usa ISO 8601: YYYY-MM-DDTHH:MM")
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE aulas SET en_mantenimiento=%s, fin_mantenimiento=%s, aula_temporal=%s WHERE id=%s",
                (datos.en_mantenimiento, fin_dt, datos.aula_temporal if datos.en_mantenimiento else None, aula_id)
            )
        connection.commit()
        return {"message": "Estado de mantenimiento actualizado"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar mantenimiento: {str(e)}")
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
                       COUNT(CASE WHEN aula_asignada != 'Por asignar' THEN 1 END) as aulas_asignadas,
                       GROUP_CONCAT(DISTINCT CASE WHEN aula_asignada != 'Por asignar' AND TRIM(aula_asignada) != '' THEN aula_asignada END SEPARATOR ', ') as aulas_ocupadas,
                       GROUP_CONCAT(horario SEPARATOR '|') as todos_horarios
                FROM horarios 
                GROUP BY archivo 
                ORDER BY fecha_carga DESC
            """)
            archivos = cursor.fetchall()
            
        LIMITE_VESPERTINO = 14 * 60 # 14:00
        for arch in (archivos or []):
            turnos = set()
            if arch.get('todos_horarios'):
                horarios_lista = arch['todos_horarios'].split('|')
                for h in horarios_lista:
                    _, inicio, _ = _parse_horario_minutos(h)
                    if inicio is not None:
                        if inicio < LIMITE_VESPERTINO:
                            turnos.add("Matutino")
                        else:
                            turnos.add("Vespertino")
            
            if "Matutino" in turnos and "Vespertino" in turnos:
                arch['turno'] = "Ambos Turnos"
            elif "Matutino" in turnos:
                arch['turno'] = "Matutino"
            elif "Vespertino" in turnos:
                arch['turno'] = "Vespertino"
            else:
                arch['turno'] = "Sin horario fijo"
            
            # Limpiar campo pesado antes de devolverlo
            if 'todos_horarios' in arch:
                del arch['todos_horarios']

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
                SELECT id, docente, licenciatura, asignatura, horario, aula_asignada, fecha_creacion, semestre, cuatrimestre, grupo
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
    """Actualiza un horario específico (aula, docente, asignatura). Valida conflictos de aula."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            nueva_aula = datos.get("aula_asignada", "Por asignar")
            # Obtener el horario original para parsear día y hora
            cursor.execute("SELECT horario FROM horarios WHERE id = %s", (horario_id,))
            actual = cursor.fetchone()
            if actual:
                msg = _verificar_conflicto_aula(cursor, nueva_aula, actual.get('horario', ''), excluir_id=horario_id)
                if msg:
                    raise HTTPException(status_code=409, detail=msg)
            sql = "UPDATE horarios SET aula_asignada = %s, docente = %s, asignatura = %s WHERE id = %s"
            cursor.execute(sql, (
                nueva_aula,
                datos.get("docente", ""),
                datos.get("asignatura", ""),
                horario_id
            ))
        connection.commit()
        return {"message": "Horario actualizado exitosamente"}
    except HTTPException:
        raise
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


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE DOCENTES
# ---------------------------------------------------------

@app.get("/api/docentes")
def obtener_docentes():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM docentes ORDER BY nombre")
            docentes = cursor.fetchall()

            ahora = datetime.now()
            mins_ahora = ahora.hour * 60 + ahora.minute
            # isoweekday: Lun=1..Dom=7 → % 7 da Lun=1..Sab=6, Dom=0 (igual que JS getDay())
            dia_hoy = ahora.isoweekday() % 7

            cursor.execute("""
                SELECT s.*, ds.nombre as suplente_nombre
                FROM suplencias s
                LEFT JOIN docentes ds ON ds.id = s.suplente_id
                WHERE s.activa = TRUE AND s.fecha = CURDATE()
            """)
            suplencias_hoy = cursor.fetchall()

            # Sin filtro de fecha: usamos el campo horario (día semana + hora) igual que obtener_clases_hoy
            cursor.execute("""
                SELECT DISTINCT docente, horario FROM horarios
                WHERE docente IS NOT NULL AND TRIM(docente) != ''
            """)
            clases_semana = cursor.fetchall()

        for doc in (docentes or []):
            try:
                doc['materias'] = json.loads(doc.get('materias') or '[]')
            except Exception:
                doc['materias'] = []

            suplencia_activa = None
            for s in (suplencias_hoy or []):
                if s['docente_id'] != doc['id']:
                    continue
                mins_i = _time_to_mins(s['hora_inicio'])
                mins_f = _time_to_mins(s['hora_fin'])
                if mins_ahora >= mins_i and mins_ahora <= mins_f:
                    suplencia_activa = {
                        **{k: v for k, v in s.items() if k not in ('hora_inicio', 'hora_fin', 'fecha')},
                        'hora_inicio': _timedelta_to_str(s['hora_inicio']),
                        'hora_fin': _timedelta_to_str(s['hora_fin']),
                        'fecha': str(s['fecha']) if s.get('fecha') else ''
                    }
                    break

            en_clase = False
            if not suplencia_activa:
                for clase in (clases_semana or []):
                    if clase['docente'] != doc['nombre']:
                        continue
                    dia_clase, inicio, fin = _parse_horario_minutos(clase.get('horario', ''))
                    if dia_clase == dia_hoy and inicio is not None and inicio <= mins_ahora <= fin:
                        en_clase = True
                        break

            doc['suplencia_activa'] = suplencia_activa
            if suplencia_activa:
                doc['estado'] = 'suplente_asignado'
            elif en_clase:
                doc['estado'] = 'en_clase'
            else:
                doc['estado'] = 'disponible'

        return docentes if docentes else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener docentes: {str(e)}")
    finally:
        connection.close()


@app.post("/api/docentes")
def crear_docente(docente: Docente):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO docentes (nombre, especialidad, materias, correo) VALUES (%s, %s, %s, %s)",
                (docente.nombre.strip(), docente.especialidad.strip(), json.dumps(docente.materias), docente.correo.strip())
            )
        connection.commit()
        return {"message": "Docente registrado exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al crear docente: {str(e)}")
    finally:
        connection.close()


@app.put("/api/docentes/{docente_id}")
def actualizar_docente(docente_id: int, docente: Docente):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE docentes SET nombre=%s, especialidad=%s, materias=%s, correo=%s WHERE id=%s",
                (docente.nombre.strip(), docente.especialidad.strip(), json.dumps(docente.materias), docente.correo.strip(), docente_id)
            )
        connection.commit()
        return {"message": "Docente actualizado exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar docente: {str(e)}")
    finally:
        connection.close()


@app.delete("/api/docentes/{docente_id}")
def eliminar_docente(docente_id: int):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM suplencias WHERE docente_id = %s OR suplente_id = %s", (docente_id, docente_id))
            cursor.execute("DELETE FROM docentes WHERE id = %s", (docente_id,))
        connection.commit()
        return {"message": "Docente eliminado exitosamente"}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar docente: {str(e)}")
    finally:
        connection.close()


# ---------------------------------------------------------
# ENDPOINTS PARA GESTIÓN DE SUPLENCIAS
# ---------------------------------------------------------

@app.get("/api/suplencias")
def obtener_suplencias():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT s.*,
                       d.nombre  AS docente_nombre,
                       ds.nombre AS suplente_nombre
                FROM suplencias s
                LEFT JOIN docentes d  ON d.id  = s.docente_id
                LEFT JOIN docentes ds ON ds.id = s.suplente_id
                WHERE s.activa = TRUE AND s.fecha >= CURDATE()
                ORDER BY s.fecha, s.hora_inicio
            """)
            suplencias = cursor.fetchall()
        for s in (suplencias or []):
            s['hora_inicio'] = _timedelta_to_str(s['hora_inicio'])
            s['hora_fin']    = _timedelta_to_str(s['hora_fin'])
            if s.get('fecha'):
                s['fecha'] = str(s['fecha'])
        return suplencias if suplencias else []
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener suplencias: {str(e)}")
    finally:
        connection.close()


@app.post("/api/suplencias")
def crear_suplencia(s: Suplencia):
    if s.docente_id == s.suplente_id:
        raise HTTPException(status_code=400, detail="El docente no puede ser su propio suplente.")
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM suplencias
                WHERE suplente_id = %s AND activa = TRUE AND fecha = %s
                AND NOT (hora_fin <= %s OR hora_inicio >= %s)
            """, (s.suplente_id, s.fecha, s.hora_inicio, s.hora_fin))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="El suplente ya tiene una suplencia asignada en ese horario.")
            cursor.execute("""
                INSERT INTO suplencias (docente_id, suplente_id, materia, dia, fecha, hora_inicio, hora_fin, activa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
            """, (s.docente_id, s.suplente_id, s.materia, s.dia, s.fecha, s.hora_inicio, s.hora_fin))
        connection.commit()
        return {"message": "Suplencia asignada correctamente."}
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al crear suplencia: {str(e)}")
    finally:
        connection.close()


@app.delete("/api/suplencias/{suplencia_id}")
def eliminar_suplencia(suplencia_id: int):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE suplencias SET activa = FALSE WHERE id = %s", (suplencia_id,))
        connection.commit()
        return {"message": "Suplencia cancelada."}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al cancelar suplencia: {str(e)}")
    finally:
        connection.close()


# ---------------------------------------------------------
# ENDPOINTS PARA DOCENTES DESDE HORARIOS (SIN TABLA PROPIA)
# ---------------------------------------------------------

@app.get("/api/docentes-horarios")
def obtener_docentes_horarios():
    """Docentes únicos de horarios. Incluye horarios_hoy para cálculo en tiempo real en el frontend."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION group_concat_max_len = 65535")
            cursor.execute("""
                SELECT
                    docente AS nombre,
                    GROUP_CONCAT(DISTINCT asignatura  ORDER BY asignatura  SEPARATOR '|||') AS materias_raw,
                    GROUP_CONCAT(DISTINCT licenciatura ORDER BY licenciatura SEPARATOR '|||') AS licenciaturas_raw
                FROM horarios
                WHERE docente IS NOT NULL
                  AND TRIM(docente) != ''
                  AND TRIM(docente) != 'Sin especificar'
                GROUP BY docente
                ORDER BY docente
            """)
            filas = cursor.fetchall()

            # Todos los horarios semanales (sin filtro de fecha) para cálculo client-side
            cursor.execute("""
                SELECT DISTINCT docente, horario, asignatura
                FROM horarios
                WHERE docente IS NOT NULL AND TRIM(docente) != ''
                  AND TRIM(docente) != 'Sin especificar'
            """)
            clases_hoy_raw = cursor.fetchall()

            # Suplencias activas hoy
            cursor.execute("""
                SELECT * FROM suplencias_horarios
                WHERE activa = TRUE AND fecha = CURDATE()
            """)
            suplencias_hoy = cursor.fetchall()

        # Agrupar horarios semanales por docente, incluyendo dia_index
        clases_por_docente = defaultdict(list)
        for c in (clases_hoy_raw or []):
            dia_idx, inicio, fin = _parse_horario_minutos(c.get('horario', ''))
            if inicio is not None and dia_idx is not None:
                clases_por_docente[c['docente']].append({
                    'asignatura':  c['asignatura'],
                    'dia_index':   dia_idx,   # 0=Dom,1=Lun...6=Sab (igual que JS getDay())
                    'inicio_mins': inicio,
                    'fin_mins':    fin,
                })

        # Suplencias hoy por docente (con horas convertidas a string)
        suplencias_por_docente = defaultdict(list)
        for s in (suplencias_hoy or []):
            suplencias_por_docente[s['docente_nombre']].append({
                'id':              s['id'],
                'suplente_nombre': s['suplente_nombre'],
                'materia':         s['materia'],
                'hora_inicio':     _timedelta_to_str(s['hora_inicio']),
                'hora_fin':        _timedelta_to_str(s['hora_fin']),
                'inicio_mins':     _time_to_mins(s['hora_inicio']),
                'fin_mins':        _time_to_mins(s['hora_fin']),
            })

        docentes = []
        for row in (filas or []):
            nombre        = row['nombre']
            materias      = [m.strip() for m in (row['materias_raw']      or '').split('|||') if m.strip()]
            licenciaturas = [l.strip() for l in (row['licenciaturas_raw'] or '').split('|||') if l.strip()]

            docentes.append({
                'nombre':           nombre,
                'materias':         materias,
                'licenciaturas':    licenciaturas,
                'horarios_semana':  clases_por_docente.get(nombre, []),
                'suplencias_hoy':   suplencias_por_docente.get(nombre, []),
            })

        return docentes
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener docentes: {str(e)}")
    finally:
        connection.close()


@app.post("/api/suplencias-horarios")
def crear_suplencia_horarios(s: SuplenciaHorarios):
    if s.docente_nombre.strip() == s.suplente_nombre.strip():
        raise HTTPException(status_code=400, detail="El docente no puede ser su propio suplente.")
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM suplencias_horarios
                WHERE suplente_nombre = %s AND activa = TRUE AND fecha = %s
                AND NOT (hora_fin <= %s OR hora_inicio >= %s)
            """, (s.suplente_nombre, s.fecha, s.hora_inicio, s.hora_fin))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="El suplente ya tiene una suplencia asignada en ese horario.")
            cursor.execute("""
                INSERT INTO suplencias_horarios
                (docente_nombre, suplente_nombre, materia, dia, fecha, hora_inicio, hora_fin, activa)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
            """, (s.docente_nombre, s.suplente_nombre, s.materia, s.dia, s.fecha, s.hora_inicio, s.hora_fin))
        connection.commit()
        return {"message": "Suplencia asignada correctamente."}
    except HTTPException:
        raise
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al crear suplencia: {str(e)}")
    finally:
        connection.close()


@app.delete("/api/suplencias-horarios/{suplencia_id}")
def cancelar_suplencia_horarios(suplencia_id: int):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE suplencias_horarios SET activa = FALSE WHERE id = %s", (suplencia_id,))
        connection.commit()
        return {"message": "Suplencia cancelada."}
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al cancelar suplencia: {str(e)}")
    finally:
        connection.close()


@app.get("/api/suplencias-activas")
def obtener_suplencias_activas():
    """Todas las suplencias activas hoy con datos enriquecidos (licenciatura y aula del horario original)."""
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT sh.id, sh.docente_nombre, sh.suplente_nombre, sh.materia,
                       sh.dia, sh.fecha, sh.hora_inicio, sh.hora_fin,
                       MIN(h.licenciatura) AS licenciatura,
                       MIN(h.aula_asignada) AS aula_asignada
                FROM suplencias_horarios sh
                LEFT JOIN horarios h
                    ON h.docente = sh.docente_nombre AND h.asignatura = sh.materia
                WHERE sh.activa = TRUE AND sh.fecha = CURDATE()
                GROUP BY sh.id, sh.docente_nombre, sh.suplente_nombre, sh.materia,
                         sh.dia, sh.fecha, sh.hora_inicio, sh.hora_fin
            """)
            suplencias = cursor.fetchall()
        result = []
        for s in (suplencias or []):
            result.append({
                'id':              s['id'],
                'docente_nombre':  s['docente_nombre'],
                'suplente_nombre': s['suplente_nombre'],
                'materia':         s['materia'],
                'dia':             s['dia'],
                'fecha':           str(s['fecha']),
                'hora_inicio':     _timedelta_to_str(s['hora_inicio']),
                'hora_fin':        _timedelta_to_str(s['hora_fin']),
                'inicio_mins':     _time_to_mins(s['hora_inicio']),
                'fin_mins':        _time_to_mins(s['hora_fin']),
                'licenciatura':    s.get('licenciatura') or '',
                'aula_asignada':   s.get('aula_asignada') or '',
            })
        return result
    except pymysql.Error as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener suplencias activas: {str(e)}")
    finally:
        connection.close()