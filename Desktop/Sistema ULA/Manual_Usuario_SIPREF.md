# Manual de Usuario - SIPREF ULA

Bienvenido al **Sistema de Gestión de Prefectura (SIPREF) de la ULA**. Este manual tiene como objetivo guiarte en el uso de cada uno de los módulos de la plataforma, detallando las funcionalidades más recientes.

---

## 1. Inicio de Sesión y Acceso
Para ingresar al sistema, necesitas tus credenciales (correo electrónico y contraseña).
1. Ingresa a la página principal del sistema.
2. Escribe tu **Correo** y **Contraseña**.
3. Haz clic en **Ingresar**.
*Si olvidaste tu contraseña, puedes usar la opción de recuperación de contraseña.*

---

## 2. Gestión de Horarios (Módulo Principal)
Este módulo te permite cargar y organizar la información base del sistema: los horarios de clase.

### Subida de Horarios
Tienes dos opciones para cargar los horarios en formato PDF:
- **Subida Individual (1 Horario):** Selecciona el grado académico, grupo y archivo PDF. Ideal para actualizar un grupo específico.
- **Subida por Lotes:** Permite cargar múltiples archivos PDF a la vez. **Importante:** Debido al procesamiento en la nube, la subida por lotes puede tomar unos minutos dependiendo de tu conexión a internet. Una barra de progreso te indicará el avance y los botones se deshabilitarán automáticamente para evitar que presiones varias veces y se suban archivos duplicados.

### Gestión y Visualización de Archivos
- **Vista por Tarjetas:** Los archivos cargados se agrupan de forma automática por Licenciatura y Semestre/Cuatrimestre (Ej: `ENFERMERÍA - OCTAVO.pdf`).
- Las tarjetas te mostrarán información clave:
  - **Fecha de Carga.**
  - **Plan** (Semestral o Cuatrimestral).
  - **Turno** (Detectado automáticamente por el horario: Matutino o Vespertino).
  - **Aulas Ocupadas** y Porcentaje de Cobertura.
- **Detalles del Archivo:** Al hacer clic en un archivo, verás la tabla completa de clases, donde podrás ver cada asignatura, docente, horario y modificar manualmente el "Aula Asignada" mediante el ícono del lápiz. 
*Nota: Si la carrera de un archivo Cuatrimestral no fue detectada, la etiqueta de Licenciatura dirá **"No definida"** en color gris para evitar confusiones.*

### Cierre de Periodo
Al terminar un ciclo escolar (Ej: Fin de semestre):
1. Selecciona los archivos que deseas archivar en la vista de tarjetas usando la **casilla de selección (checkbox)**.
2. Haz clic en el botón flotante **"Cerrar Periodo"**.
3. Asigna un nombre (Ej: *Semestral Ene-Jun 2026*) y el tipo (Semestral o Cuatrimestral).
4. El sistema guardará estos datos en el **Historial** de forma segura y vaciará el tablero principal para que puedas cargar los horarios del nuevo ciclo.

### Historial y Restauración
Si archivaste un periodo por error o necesitas consultarlo:
1. Ve a la pestaña **"Historial"** dentro de Gestión de Horarios.
2. Podrás ver y eliminar cierres antiguos.
3. Puedes hacer clic en **"Regresar archivos al tablero principal"**. Esto sacará los horarios del archivo y los pondrá de vuelta en uso (útil si probaste exportar y te quedaste sin datos en el tablero).

---

## 3. Control de Asistencia y Docentes
Este módulo te permite registrar el día a día de la prefectura. El sistema detecta automáticamente qué clases se están impartiendo "HOY" según los horarios cargados.

- **Firma de Asistencia:** Marca rápidamente la asistencia de un profesor con el botón verde.
- **Retardo / Falta:** Si un maestro llega tarde o no asiste, presiona los botones naranja/rojo y se abrirá una ventana para justificar o dejar comentarios.
- **Suplencias:** Si un profesor falta, puedes asignar un suplente. Este suplente cubrirá el aula y se registrará su asistencia y datos en la bitácora.
- **Reprogramaciones:** Si una clase se cancela y se moverá a otro día/hora, utiliza este botón para agendar la nueva fecha.
- **Envío de Reportes:** En la esquina superior puedes exportar un Excel (Bitácora) o enviar el reporte de asistencias/faltas directamente por correo electrónico (Email).

---

## 4. Gestión de Aulas y Laboratorios
Permite ver de forma gráfica y rápida la disponibilidad física de las aulas.

- **Mapa de Aulas:** Visualiza qué salones están libres (Verde), en uso (Rojo) o reservados para un examen (Azul).
- Al pasar el ratón sobre un aula en uso, verás qué clase se está impartiendo.
- Puedes filtrar por edificio (Edificio A, Edificio B, Laboratorios, etc.).

---

## 5. Control de Exámenes y Estados Académicos
Mantén el control de las fechas de evaluación y la situación académica.

- **Estados Académicos:** Permite generar avisos sobre el estatus de los alumnos (ordinarios, extraordinarios, suspensión, etc.).
- **Exámenes de Hoy:** Listado de las aulas reservadas para aplicación de exámenes, el horario y el profesor responsable.

---

## 6. Bitácora General
Todo lo que ocurre en el sistema queda registrado en la bitácora automáticamente: Subida de horarios, registro de faltas, cambios de aula, suplencias, etc.

- Puedes agregar **Notas Manuales** a la bitácora en cualquier momento usando el botón de nueva nota.
- Puedes utilizar los **Filtros Avanzados** para buscar por usuario, tipo de acción, módulo o fechas.
- La tabla permite **Exportación Rápida a Excel** para reportes ejecutivos o revisiones de auditoría.

---

## Consejos Útiles de Desempeño
1. **Paciencia con el Lote:** No recargues la página (F5) ni cierres el navegador mientras la barra de carga de subida por lote esté en proceso, ya que podrías interrumpir la subida de los archivos.
2. **Nombres de Docentes:** Asegúrate de que los PDFs de horarios tengan los nombres de los docentes escritos siempre de la misma forma para que el sistema asocie correctamente todas las materias a un mismo maestro.
3. **Limpieza de Cierres:** No utilices nombres de ciclos repetidos al hacer el Cierre de Periodo para mantener el Historial organizado y evitar sobrescribir cierres.

---
*Manual de Sistema SIPREF ULA - Actualizado para la Versión 2.0*
