# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con el código en este repositorio.

## Descripción General del Proyecto

**Sistema ULA** es un sistema de gestión de prefectura universitaria (Sistema de Prefectura ULA) para administrar la asignación de aulas, asistencia y horarios. Los prefectos suben los horarios en formato PDF, los cuales son procesados e introducidos en una base de datos en la nube.

## Ejecución del Proyecto

Ambos servidores deben ejecutarse simultáneamente para un funcionamiento completo.

### Frontend (React + Vite)
```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview

# Instalar dependencias (sin requisitos.txt — instalar manualmente):
pip install fastapi uvicorn pymysql pdfplumber pydantic python-dotenv

# Ejecutar el servidor (desde la raíz del repositorio):
uvicorn main:app --reload --app-dir src/backend   # http://localhost:8000

EntornoLas credenciales del backend están en src/backend/.env (TiDB Cloud MySQL, SSL, puerto 4000). El frontend llama directamente a http://localhost:8000/api/* — no hay ningún proxy configurado en Vite.ArquitecturaFrontend (src/)App.jsx — definiciones de rutas; todas las rutas excepto /login y /registro requieren localStorage.getItem('usuarioLogueado').components/Layout.jsx — estructura de barra lateral + encabezado + pie de página que envuelve todas las páginas autenticadas. Muestra los datos del usuario logueado en la esquina superior derecha.pages/ — un archivo por ruta: Login, Registro, Dashboard, GestionHorarios, GestionAulas, AsignacionAulas, VisualBd.No se utiliza librería de estado global — el estado es local mediante useState/useEffect por página. El estado de autenticación reside en localStorage.Tailwind CSS se carga a través de CDN en index.html (no está instalado como paquete). Los iconos de Material Symbols también se cargan por CDN.Backend (src/backend/main.py)Aplicación FastAPI en un solo archivo. Todas las rutas, la lógica de la base de datos y el procesamiento de PDFs residen aquí.Superficie clave de la API:MétodoRutaPropósitoPOST/api/registroRegistrar usuario de prefectura (Validación de dominio requerida)POST/api/loginAutenticar usuario y devolver sus datosGET/POST/api/aulasListar / crear aulasDELETE/api/aulas/{id}Eliminar aulaPOST/upload-pdfProcesar el PDF de horarios subidoPOST/api/guardar-horariosPersistir los horarios procesados en la BDGET/api/horariosTodos los horariosGET/api/clases-hoyClases del día de hoyBase de DatosTiDB Cloud (compatible con MySQL), base de datos db_prefectura. Se requiere SSL. El host y las credenciales están en src/backend/.env — no las escribas directamente en el código fuente.Procesamiento de PDFs (PDF Parsing)La ruta /upload-pdf en main.py utiliza pdfplumber para extraer los datos de los horarios. El procesador mapea los nombres de los profesores y las materias con sus respectivos días y bloques horarios. Esta es la lógica más compleja del backend — cualquier cambio aquí afecta la ingesta de horarios en todo el sistema.Convenciones Clave y Reglas de NegocioDISEÑO INTACTO: Queda estrictamente prohibido alterar el estilo visual, los colores, los bordes, los componentes HTML o cualquier clase de Tailwind CSS existente, a menos que se solicite explitamente. Las modificaciones deben enfocarse únicamente en la lógica.Regla de Correo Institucional: Para que la creación de una cuenta en la página de Registro sea válida, el correo electrónico del usuario DEBE terminar obligatoriamente con la extensión .universidadlatino.edu.mx. Esta validación debe aplicarse tanto en el Frontend (interfaz) como en el Backend (servidor).Visualización de Sesión: Tras un inicio de sesión exitoso, el componente Layout.jsx debe extraer el nombre del usuario y su turno desde el localStorage e inyectar el texto "Nombre - Turno" en la esquina superior derecha de la pantalla, dentro del borde superior existente.Todo el texto de la interfaz de usuario (UI) y los nombres de variables/funciones están en español.Las páginas se comunican con el backend mediante llamadas fetch a http://localhost:8000.Actualmente no existe una suite de pruebas (tests).La página AsignacionAulas (/asignar-aulas) está bajo desarrollo activo de funcionalidad interna.