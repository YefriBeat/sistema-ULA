# ✅ CHECKLIST DE VERIFICACIÓN - TiDB Cloud

## 📋 Verificación Pre-Ejecución

### 1. Archivos y Configuración

- [x] ✅ `.env` configurado con credenciales TiDB
  ```
  Ubicación: src/backend/.env
  DB_NAME: db_prefectura (confirmado)
  DB_PORT: 4000 (confirmado)
  ```

- [x] ✅ Certificado SSL presente
  ```
  Ubicación: C:\Users\mooef\Desktop\Sistema ULA\isrgrootx1.pem
  Usado en: main.py (línea ~52)
  ```

- [x] ✅ Scripts SQL actualizados
  ```
  - SQL_CREAR_BASE_DATOS.sql (versión mejorada)
  - src/backend/database_schema.sql (versión mejorada)
  - BD Name: db_prefectura
  ```

### 2. Base de Datos

- [ ] Ejecutar script SQL para crear tablas
  ```bash
  mysql -h gateway01.us-east-1.prod.aws.tidbcloud.com \
        -u TZ62Vyde4EbNpoi.root -p < SQL_CREAR_BASE_DATOS.sql
  ```

- [ ] Verificar que existan todas las tablas:
  ```sql
  USE db_prefectura;
  SHOW TABLES;
  -- Debería mostrar: usuarios, aulas, horarios, asignaciones_aulas, asistencia_log, auditoria
  ```

- [ ] Verificar columna `status_asistencia` en tabla `horarios`
  ```sql
  DESC horarios;
  -- Debería incluir: status_asistencia VARCHAR(50)
  ```

### 3. Backend (Python)

- [x] ✅ Dependencias instaladas
  ```
  ✅ pymysql
  ✅ bcrypt
  ✅ pdfplumber
  ✅ fastapi
  ✅ uvicorn
  ✅ python-dotenv
  ```

- [x] ✅ Endpoint de asistencia corregido
  ```python
  Línea 407: WHERE id = %s (anteriormente: WHERE Id = %s)
  ```

- [ ] Iniciar servidor backend
  ```bash
  cd src/backend
  uvicorn main:app --reload
  ```

- [ ] Verificar conexión a BD
  ```
  GET http://localhost:8000/api/db-check
  Respuesta esperada: {"message": "Conexión a TiDB Cloud OK"}
  ```

### 4. Frontend (React)

- [ ] Instalar dependencias
  ```bash
  npm install
  ```

- [ ] Iniciar servidor frontend
  ```bash
  npm run dev
  ```

- [ ] Verificar que abra en http://localhost:5173

### 5. Funcionalidades Principales

- [ ] **Login**
  - [ ] Registrarse con correo @universidadlatino.edu.mx
  - [ ] Login exitoso

- [ ] **Dashboard (VisualBd)**
  - [ ] Carga con sincronización en vivo
  - [ ] Filtros funcionan (estado, licenciatura, día)
  - [ ] Botón "Mostrar Finalizadas" funciona

- [ ] **Gestión de Horarios**
  - [ ] Cargar PDF y/o imagen
  - [ ] Botón "Aplicar a todas" asigna aula correctamente
  - [ ] Publicar asignaciones guarda en BD

- [ ] **Gestión de Aulas**
  - [ ] Listar aulas
  - [ ] Crear/eliminar aula

---

## 🔧 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| Error: "Access Denied" en MySQL | Verifica credenciales en `.env` |
| Error: "Certificate not found" | Confirma ruta de `.pem` en main.py |
| Error: "Connection refused" | Comprueba que TiDB Cloud esté corriendo y firewall abierto |
| Error: "Unknown database" | Ejecuta script SQL nuevamente |
| Backend no conecta | Asegúrate que `npm run dev` está en otra terminal |

---

## 📊 Verificación de Datos

### Aulas de Prueba (deberían existir):
```sql
SELECT COUNT(*) FROM aulas;
-- Resultado esperado: 6
```

### Estructura de Tablas:
```sql
-- Verificar que horarios tiene status_asistencia
SELECT * FROM information_schema.COLUMNS 
WHERE TABLE_NAME='horarios' AND COLUMN_NAME='status_asistencia';
```

---

## 🚀 Orden de Ejecución

1. ✅ Verificar `.env` y certificado
2. ⏳ Ejecutar script SQL en TiDB Cloud
3. ⏳ Iniciar backend: `uvicorn main:app --reload`
4. ⏳ Verificar conexión: `http://localhost:8000/api/db-check`
5. ⏳ Iniciar frontend: `npm run dev`
6. ⏳ Probar login y funcionalidades

---

## 📞 Contacto/Soporte

Si encuentras problemas:
1. Lee `TIDB_CLOUD_SETUP.md` para soluciones
2. Verifica logs de backend (línea de terminal donde corre uvicorn)
3. Comprueba Network tab en DevTools del navegador

---

## ✨ Estado Final Esperado

```
✅ Backend corriendo en http://localhost:8000
✅ Frontend corriendo en http://localhost:5173
✅ Base de datos TiDB Cloud conectada
✅ SSL habilitado
✅ Todas las tablas creadas
✅ Datos de prueba cargados
✅ Sistema listo para uso
```

**Fecha de configuración:** 21 de Mayo de 2026
**Versión:** 1.0 (TiDB Cloud Compatible)
