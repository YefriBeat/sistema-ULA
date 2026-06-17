# 🚀 Guía de Conexión a TiDB Cloud - Sistema ULA

## Estado: ✅ Configuración Completada

Tu sistema ya está listo para conectarse a **TiDB Cloud**. El certificado SSL (`isrgrootx1.pem`) está incluido y configurado automáticamente en el backend.

---

## 📋 Paso 1: Verificar Credenciales en `.env`

Abre el archivo: `src/backend/.env`

```dotenv
DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=TZ62Vyde4EbNpoi.root
DB_PASSWORD=whFFpt8rkosHWrXW
DB_NAME=db_prefectura
```

**Si estas credenciales son correctas, continúa al Paso 2.**

Si necesitas cambiarlas:
1. Ve a [TiDB Cloud Dashboard](https://tidbcloud.com/)
2. Abre tu cluster
3. Haz click en "Connect"
4. Selecciona la pestaña "MySQL Driver"
5. Copia las credenciales y actualiza el `.env`

---

## 🗄️ Paso 2: Crear la Base de Datos

Tienes dos opciones:

### Opción A: Usar MySQL Workbench (Recomendado)
1. Abre MySQL Workbench
2. Crea una nueva conexión SSH o TCP/IP con los datos de TiDB
3. Abre el archivo `SQL_CREAR_BASE_DATOS.sql` desde el proyecto
4. Ejecuta el script completo
5. Verifica que se creó `db_prefectura` con todas las tablas

### Opción B: Usar Terminal/PowerShell
```powershell
# Linux/Mac
mysql -h gateway01.us-east-1.prod.aws.tidbcloud.com -u TZ62Vyde4EbNpoi.root -p < SQL_CREAR_BASE_DATOS.sql

# PowerShell (Windows)
mysql -h gateway01.us-east-1.prod.aws.tidbcloud.com `
      -u TZ62Vyde4EbNpoi.root `
      -p < SQL_CREAR_BASE_DATOS.sql
```

---

## 🏗️ Paso 3: Verificar la Estructura de BD

Una vez ejecutado el script, verifica que existan estas tablas:

```sql
USE db_prefectura;
SHOW TABLES;
```

Deberías ver:
- ✅ `usuarios`
- ✅ `aulas`
- ✅ `horarios` (con columna `status_asistencia`)
- ✅ `asignaciones_aulas`
- ✅ `asistencia_log`
- ✅ `auditoria`

---

## 🔌 Paso 4: Iniciar el Backend

```bash
cd src/backend
python main.py
# O con uvicorn:
uvicorn main:app --reload --app-dir .
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## ✅ Paso 5: Verificar Conexión

Abre tu navegador y ve a:
```
http://localhost:8000/api/db-check
```

**Respuesta esperada:**
```json
{"message": "Conexión a TiDB Cloud OK"}
```

Si ves esto, ¡la conexión está trabajando correctamente! ✨

---

## 🎨 Paso 6: Iniciar el Frontend

En otra terminal:
```bash
npm run dev
```

Ve a: `http://localhost:5173`

---

## 📊 Estructura Mejorada de BD

### Tabla `horarios` (Nueva Columna)
```
status_asistencia VARCHAR(50)
  - pendiente (por defecto)
  - asistio (docente presente)
  - retraso (docente llegó tarde)
  - no_llego (docente no asistió)
```

### Nueva Tabla `asistencia_log`
Guarda un historial detallado de cada registro de asistencia:
- ID del horario
- Docente
- Asignatura
- Aula
- Estado (asistio/retraso/no_llego)
- Timestamp del registro

### Nueva Tabla `auditoria`
Registra todos los cambios críticos en el sistema para compliance y debugging.

---

## 🔍 Troubleshooting

### ❌ Error: "Certificado no encontrado"
**Solución:** Verifica que `isrgrootx1.pem` esté en:
```
C:\Users\mooef\Desktop\Sistema ULA\isrgrootx1.pem
```

### ❌ Error: "Access Denied"
**Verifica:**
1. Usuario y contraseña en `.env` son correctos
2. El usuario tiene permisos en TiDB Cloud
3. Intenta desde otra máquina con ping al host

### ❌ Error: "Base de datos no existe"
**Solución:** Ejecuta el script SQL nuevamente:
```bash
mysql -h [host] -u [user] -p < SQL_CREAR_BASE_DATOS.sql
```

### ❌ Error: "Port 4000 refused"
**Solución:** 
1. Asegúrate de que el puerto 4000 está abierto en tu firewall
2. Verifica el host correcto en `.env`

---

## 📝 Resumen del Flujo

```
┌─────────────────────────────────────────┐
│  1. Usuarios se registran/login         │
│     - Validación de email               │
│     - Contraseña encriptada con bcrypt  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  2. Cargan PDF/Imágenes de horarios    │
│     - Parser inteligente                │
│     - Extrae docentes y asignaturas     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  3. Asignan aulas automáticamente       │
│     - "Aplicar a todas" con 1 click     │
│     - Guardan en tabla horarios         │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  4. Dashboard en tiempo real            │
│     - Visualización de clases en curso  │
│     - Filtros por estado/licenciatura   │
│     - Registro de asistencia            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  5. Auditoría y reportes                │
│     - Historial de cambios              │
│     - Log de asistencia                 │
│     - Trazabilidad completa             │
└─────────────────────────────────────────┘
```

---

## ✨ ¡Listo!

Tu Sistema ULA está completamente conectado a TiDB Cloud con:
- ✅ SSL habilitado automáticamente
- ✅ Índices optimizados
- ✅ Schema mejorado con auditoría
- ✅ Soporte para asistencia en tiempo real
- ✅ Compatibilidad TiDB Cloud nativa

**¿Necesitas ayuda?** Revisa el archivo `main.py` en la sección de endpoints para ver todas las rutas disponibles.
