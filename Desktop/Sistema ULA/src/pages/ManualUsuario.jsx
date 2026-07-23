import { useState } from 'react';
import logo from '../components/logo.png';

const SECCIONES = [
  { id: 'introduccion', icono: 'info',            titulo: 'Introducción' },
  { id: 'acceso',       icono: 'login',           titulo: 'Acceso al sistema' },
  { id: 'dashboard',    icono: 'dashboard',       titulo: 'Panel principal' },
  { id: 'horarios',     icono: 'schedule',        titulo: 'Gestión de horarios' },
  { id: 'aulas',        icono: 'door_open',       titulo: 'Gestión de aulas' },
  { id: 'docentes',     icono: 'group',           titulo: 'Gestión de docentes' },
  { id: 'calendarios',  icono: 'calendar_month',  titulo: 'Calendarios académicos' },
  { id: 'perfil',       icono: 'manage_accounts', titulo: 'Configuración de perfil' },
  { id: 'soporte',      icono: 'support_agent',   titulo: 'Soporte técnico' },
  { id: 'faq',          icono: 'help',            titulo: 'Preguntas frecuentes' },
];

function Chip({ color, texto }) {
  const colores = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    gray:   'bg-gray-50 text-gray-600 border-gray-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    teal:   'bg-teal-50 text-teal-700 border-teal-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colores[color] ?? colores.gray}`}>
      {texto}
    </span>
  );
}

function Paso({ numero, titulo, descripcion }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1c355e] text-white flex items-center justify-center text-xs font-black mt-0.5">
        {numero}
      </div>
      <div>
        <p className="text-sm font-bold text-[#1b1c1e]">{titulo}</p>
        {descripcion && <p className="text-xs text-[#75777f] mt-0.5 leading-relaxed">{descripcion}</p>}
      </div>
    </div>
  );
}

function Aviso({ tipo = 'info', texto }) {
  const estilos = {
    info:    { bg: 'bg-blue-50 border-blue-200',   icono: 'info',      color: 'text-blue-700' },
    tip:     { bg: 'bg-green-50 border-green-200', icono: 'lightbulb', color: 'text-green-700' },
    warning: { bg: 'bg-amber-50 border-amber-200', icono: 'warning',   color: 'text-amber-700' },
  };
  const e = estilos[tipo];
  return (
    <div className={`flex gap-2.5 p-3.5 rounded-xl border ${e.bg} mt-4`}>
      <span className={`material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 ${e.color}`}>{e.icono}</span>
      <p className={`text-xs leading-relaxed font-medium ${e.color}`}>{texto}</p>
    </div>
  );
}

function Seccion({ id, icono, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#1c355e] flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]">{icono}</span>
        </div>
        <h2 className="text-lg font-black text-[#1b1c1e]">{titulo}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Tarjeta({ titulo, icono, children }) {
  return (
    <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-5 shadow-sm">
      {(titulo || icono) && (
        <div className="flex items-center gap-2 mb-3">
          {icono && <span className="material-symbols-outlined text-[16px] text-[#1c355e]">{icono}</span>}
          {titulo && <h3 className="text-sm font-bold text-[#1b1c1e]">{titulo}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}

export default function ManualUsuario() {
  const [seccionActiva, setSeccionActiva]       = useState('introduccion');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  const irA = (id) => {
    setSeccionActiva(id);
    setMenuMovilAbierto(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDescargarPDF = () => {
    const estiloImpresion = document.createElement('style');
    estiloImpresion.id = 'print-manual';
    estiloImpresion.textContent = `
      @media print {
        body * { visibility: hidden; }
        #manual-contenido, #manual-contenido * { visibility: visible; }
        #manual-contenido { position: absolute; left: 0; top: 0; width: 100%; }
        #manual-contenido aside, #manual-boton-indice, #manual-btn-descargar { display: none !important; }
        #manual-contenido main { width: 100% !important; max-width: 100% !important; }
        #manual-contenido section { break-inside: avoid; }
        nav[aria-label="sidebar"] { display: none !important; }
        @page { margin: 1.5cm; size: A4; }
      }
    `;
    document.head.appendChild(estiloImpresion);
    window.print();
    setTimeout(() => estiloImpresion.remove(), 1000);
  };

  return (
    <div className="bg-[#faf9fc] w-full">

      {/* ── CABECERA ── */}
      <div style={{ background: 'linear-gradient(135deg, #1c355e 0%, #162c50 100%)' }} className="px-6 py-10 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <img src={logo} alt="Logo Universidad Latino" className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-1">Universidad Latino</p>
              <h1 className="text-2xl font-black">Manual de Usuario Oficial</h1>
              <p className="text-sm text-white/70 mt-1">SIPREF — Versión 2.2 (Edición Completa)</p>
            </div>
          </div>
          <button
            id="manual-btn-descargar"
            onClick={handleDescargarPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Descargar PDF
          </button>
        </div>
      </div>

      <div id="manual-contenido" className="max-w-5xl mx-auto px-4 py-8 flex gap-8">

        {/* ── SIDEBAR (escritorio) ── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-6 bg-white border border-[#c5c6cf]/30 rounded-2xl overflow-hidden shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#75777f] px-4 py-3 border-b border-[#f0f0f4]">
              Contenido del Manual
            </p>
            <nav className="py-1.5">
              {SECCIONES.map(s => (
                <button
                  key={s.id}
                  onClick={() => irA(s.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors text-xs font-semibold ${
                    seccionActiva === s.id
                      ? 'bg-[#1c355e]/8 text-[#1c355e]'
                      : 'text-[#44464e] hover:bg-[#faf9fc] hover:text-[#1b1c1e]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[15px] flex-shrink-0 ${seccionActiva === s.id ? 'text-[#1c355e]' : 'text-[#75777f]'}`}>
                    {s.icono}
                  </span>
                  {s.titulo}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── BOTÓN FLOTANTE ÍNDICE MÓVIL ── */}
        <div id="manual-boton-indice" className="lg:hidden fixed bottom-20 right-4 z-50">
          <button
            onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
            className="w-12 h-12 rounded-full bg-[#1c355e] text-white shadow-lg flex items-center justify-center"
            aria-label="Abrir índice del manual"
          >
            <span className="material-symbols-outlined text-[20px]">{menuMovilAbierto ? 'close' : 'menu_book'}</span>
          </button>
          {menuMovilAbierto && (
            <div className="absolute bottom-14 right-0 bg-white border border-[#c5c6cf]/30 rounded-2xl shadow-xl w-56 overflow-hidden">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#75777f] px-4 py-3 border-b border-[#f0f0f4]">Contenido</p>
              {SECCIONES.map(s => (
                <button key={s.id} onClick={() => irA(s.id)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-[#44464e] hover:bg-[#faf9fc]">
                  <span className="material-symbols-outlined text-[15px] text-[#75777f]">{s.icono}</span>
                  {s.titulo}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <main className="flex-1 min-w-0 space-y-10">

          {/* ══ 1. INTRODUCCIÓN ══ */}
          <Seccion id="introduccion" icono="info" titulo="Introducción">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                El <strong className="text-[#1b1c1e]">SIPREF (Sistema de Gestión de Prefectura)</strong> es la plataforma web institucional desarrollada para la <strong className="text-[#1b1c1e]">Universidad Latino</strong>. Centraliza y automatiza la administración de horarios académicos, disponibilidad de aulas, suplencias docentes y calendarios institucionales conectados a la nube en tiempo real.
              </p>
            </Tarjeta>

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icono: 'schedule',       titulo: 'Horarios en tiempo real',     desc: 'Monitorea clases activas, próximas e instruidas con actualización cada 30 segundos.' },
                { icono: 'door_open',      titulo: 'Control de Aulas y Labs',     desc: 'Gestión diferenciada de salones y laboratorios con control de mantenimiento.' },
                { icono: 'group',          titulo: 'Gestión de Docentes',         desc: 'Directorio académico, clases agrupadas cronológicamente y registro de suplencias.' },
                { icono: 'calendar_month', titulo: 'Calendarios Oficiales',      desc: 'Consulta de calendarios escolares e importación de exámenes parciales por carrera.' },
                { icono: 'picture_as_pdf', titulo: 'Exportación a PDF',         desc: 'Descarga rápida del manual y de calendarios en formato PDF oficial.' },
                { icono: 'cloud_sync',     titulo: 'Conexión TiDB Cloud',         desc: 'Sincronización en la nube mediante TiDB Cloud (MySQL) de alta disponibilidad.' },
              ].map(f => (
                <div key={f.titulo} className="bg-white border border-[#c5c6cf]/30 rounded-xl p-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl text-[#1c355e] mb-2 block">{f.icono}</span>
                  <p className="text-xs font-bold text-[#1b1c1e] mb-1">{f.titulo}</p>
                  <p className="text-[11px] text-[#75777f] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <Tarjeta titulo="Requisitos mínimos del sistema" icono="devices">
              <ul className="space-y-1.5 text-xs text-[#44464e]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span><strong>Navegadores recomendados:</strong> Google Chrome 90+, Microsoft Edge 90+, Mozilla Firefox 88+ o Safari 14+.</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span><strong>Conexión a Internet:</strong> Estable (el sistema realiza peticiones seguras a TiDB Cloud).</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span><strong>Pantallas compatibles:</strong> Responsivo para smartphones (mínimo 360px), tablets y computadoras de escritorio.</li>
              </ul>
            </Tarjeta>
          </Seccion>

          {/* ══ 2. ACCESO AL SISTEMA ══ */}
          <Seccion id="acceso" icono="login" titulo="Acceso al sistema">
            <Tarjeta titulo="Iniciar sesión" icono="lock_open">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Ingresa a la URL del sistema y dirígete al formulario de Inicio de Sesión.' />
                <Paso numero={2} titulo="Escribe tu correo electrónico registrado y tu contraseña." />
                <Paso numero={3} titulo='Haz clic en "Ingresar".' descripcion='Al autenticarte correctamente, accederás directamente al Panel Principal (Dashboard).' />
              </div>
              <Aviso tipo="warning" texto='Si olvidaste tu contraseña o necesitas restablecerla, ponte en contacto con el administrador del sistema o ajústala desde la sección Configuración de Perfil.' />
            </Tarjeta>

            <Tarjeta titulo="Registro de nuevos usuarios" icono="person_add">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En la pantalla de Login, selecciona la opción "Crear cuenta".' />
                <Paso numero={2} titulo="Completa los datos requeridos: nombre completo, correo institucional y contraseña segura." descripcion="La contraseña debe contar con un mínimo de 6 caracteres." />
                <Paso numero={3} titulo='Haz clic en "Registrarse".' descripcion="Tu usuario quedará activado de inmediato en la base de datos." />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Cerrar sesión de forma segura" icono="logout">
              <p className="text-xs text-[#44464e] leading-relaxed">
                En el menú lateral izquierdo, haz clic en el botón <strong>Cerrar sesión</strong> (ubicado en la parte inferior). La sesión actual se finalizará y serás redirigido al formulario de ingreso.
              </p>
              <Aviso tipo="info" texto="En equipos de cómputo compartidos o aulas públicas, asegúrate de cerrar sesión al concluir tus actividades para proteger la información." />
            </Tarjeta>
          </Seccion>

          {/* ══ 3. PANEL PRINCIPAL (DASHBOARD) ══ */}
          <Seccion id="dashboard" icono="dashboard" titulo="Panel principal (Dashboard)">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                El <strong className="text-[#1b1c1e]">Directorio General de Horarios</strong> es el centro neurálgico del sistema. Muestra el estado académico de la universidad en tiempo real, sincronizado de forma automática cada 30 segundos.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Selector de Plan Educativo y Fecha" icono="edit_calendar">
              <p className="text-xs text-[#44464e] leading-relaxed mb-3">
                En la barra superior del Dashboard puedes elegir el tipo de plan y la fecha de consulta:
              </p>
              <div className="space-y-2 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">school</span><span><strong className="text-[#1b1c1e]">Plan Semestral vs. Cuatrimestral:</strong> Alterna entre los dos planes de estudio para visualizar únicamente sus grupos correspondientes.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">calendar_today</span><span><strong className="text-[#1b1c1e]">Selector de Fecha:</strong> Permite consultar la programación académica de cualquier día laboral o futuro.</span></div>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Tarjetas de métricas interactivas" icono="touch_app">
              <p className="text-xs text-[#44464e] leading-relaxed mb-3">
                Al hacer <strong className="text-[#1b1c1e]">clic en cualquier tarjeta de métrica</strong>, el sistema filtra instantáneamente la tabla principal y desplaza la vista hacia los resultados:
              </p>
              <div className="space-y-2 mt-1">
                {[
                  { chip: <Chip color="blue"   texto="En Curso" />,       desc: 'Clases impartiéndose activamente en la hora actual.' },
                  { chip: <Chip color="amber"  texto="Próximas" />,        desc: 'Clases cuya hora de inicio está a pocos minutos de comenzar.' },
                  { chip: <Chip color="gray"   texto="Finalizadas" />,     desc: 'Clases que concluyeron su horario en la jornada de hoy.' },
                  { chip: <Chip color="indigo" texto="Clases Totales" />,  desc: 'Desactiva filtros y muestra la totalidad de registros.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-32 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Ocupación de Aulas y Laboratorios" icono="meeting_room">
              <p className="text-xs text-[#44464e] leading-relaxed mb-2">
                El panel derecho incluye un análisis diferenciado para evitar distorsiones en los porcentajes:
              </p>
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">pie_chart</span><span><strong className="text-[#1b1c1e]">Gráfico de Aulas:</strong> Calcula la ocupación exclusivamente sobre salones de clases regulares.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-teal-600 flex-shrink-0 mt-0.5">science</span><span><strong className="text-[#1b1c1e]">Métricas de Laboratorios:</strong> Tarjeta independiente que computa los espacios etiquetados como "Lab" (disponibles, en uso y mantenimientos).</span></div>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Búsqueda y Filtros de Horarios" icono="filter_alt">
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">search</span><span><strong className="text-[#1b1c1e]">Buscador rápido:</strong> Encuentra clases introduciendo el nombre del docente, materia o clave de aula.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">school</span><span><strong className="text-[#1b1c1e]">Filtro por Carrera:</strong> Selecciona licencias específicas (ISC, DER, ENF, GAS, etc.).</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">today</span><span><strong className="text-[#1b1c1e]">Día y Horario:</strong> Restringe resultados a días específicos o turnos (Matutino / Vespertino).</span></div>
              </div>
            </Tarjeta>
          </Seccion>

          {/* ══ 4. GESTIÓN DE HORARIOS ══ */}
          <Seccion id="horarios" icono="schedule" titulo="Gestión de horarios">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Permite la importación de archivos de horarios académicos, asignación inteligente de aulas, edición puntual de asignaturas y mantenimiento de archivos.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Importar horarios (PDF / Excel)" icono="upload_file">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En el menú principal, abre "Gestión de Horarios".' />
                <Paso numero={2} titulo='Selecciona la pestaña "Cargar Horario".' />
                <Paso numero={3} titulo="Sube el archivo en formato PDF o Excel oficial facilitado por la universidad." />
                <Paso numero={4} titulo="Revisa la vista previa de datos extraídos (docente, materia, horas, días y grupo)." />
                <Paso numero={5} titulo='Aplica la "Asignación Automática de Aulas" o define manualmente los espacios.' />
                <Paso numero={6} titulo='Haz clic en "Guardar Horarios" para registrarlos de forma permanente en TiDB Cloud.' />
              </div>
              <Aviso tipo="tip" texto="La asignación automática omite salones que se encuentren en mantenimiento y balancea la carga de aulas entre los turnos matutino y vespertino." />
            </Tarjeta>

            <Tarjeta titulo="Gestor de Archivos y Edición" icono="edit_note">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Ingresa a la pestaña "Gestor de Archivos".' />
                <Paso numero={2} titulo="Selecciona la carrera o el archivo de horario previamente cargado." />
                <Paso numero={3} titulo="Para realizar cambios, presiona el botón de edición en la clase correspondiente." />
                <Paso numero={4} titulo="Actualiza los datos requeridos (aula, horario, docente) y guarda los cambios." />
              </div>
            </Tarjeta>
          </Seccion>

          {/* ══ 5. GESTIÓN DE AULAS ══ */}
          <Seccion id="aulas" icono="door_open" titulo="Gestión de aulas">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Supervisa todo el catálogo de espacios físicos de la universidad (salones de clase y laboratorios), consultando su estado actual y programando mantenimientos.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Clasificación de Espacios" icono="domain">
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">meeting_room</span><span><strong>Aulas de Clase:</strong> Salones normales (ej: A1, A2, B5) priorizados en el listado alfanumérico.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-teal-600 flex-shrink-0 mt-0.5">science</span><span><strong>Laboratorios:</strong> Espacios especializados (ej: Lab Sistemas, Lab Química) agrupados de forma independiente.</span></div>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Estados y Código de Colores" icono="palette">
              <div className="space-y-2.5 mt-1">
                {[
                  { chip: <Chip color="green" texto="Disponible" />,    desc: 'Espacio libre sin asignación en el momento actual.' },
                  { chip: <Chip color="blue"  texto="En Clase" />,      desc: 'Aula con sesión activa en curso.' },
                  { chip: <Chip color="amber" texto="Ocupada" />,       desc: 'Aula reservada para la jornada actual.' },
                  { chip: <Chip color="red"   texto="Mantenimiento" />, desc: 'Espacio deshabilitado por reparaciones o acondicionamiento.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-32 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Configurar Modo Mantenimiento" icono="construction">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="En la lista de aulas, ubica la tarjeta del espacio a modificar." />
                <Paso numero={2} titulo='Haz clic en el ícono de llave inglesa ("Mantenimiento").' />
                <Paso numero={3} titulo="Activa el interruptor e ingresa la fecha/hora de inicio y la fecha/hora de fin del mantenimiento." />
                <Paso numero={4} titulo="Opcional: Asigna un aula temporal de sustitución para mover las clases agendadas." />
                <Paso numero={5} titulo='Presiona "Guardar".' />
              </div>
            </Tarjeta>
          </Seccion>

          {/* ══ 6. GESTIÓN DE DOCENTES ══ */}
          <Seccion id="docentes" icono="group" titulo="Gestión de docentes">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Administra la plantilla docente, visualiza el horario de clases agrupadas por jornada y gestiona suplencias de forma rápida ante inasistencias.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Agrupación Cronológica de Clases" icono="auto_awesome">
              <p className="text-xs text-[#44464e] leading-relaxed mb-3">
                Para evitar redundancia, el sistema agrupa automáticamente clases consecutivas de la misma materia en un solo bloque (ej: dos horas seguidas de 07:00 a 08:40).
              </p>
              <div className="space-y-2 mt-1">
                {[
                  { chip: <Chip color="red"   texto="Activa" />,    desc: 'Clase impartiéndose en este momento.' },
                  { chip: <Chip color="amber" texto="Próxima" />,   desc: 'Clase agendada a comenzar en breve.' },
                  { chip: <Chip color="gray"  texto="Finalizada" />,desc: 'Clase concluida exitosamente.' },
                  { chip: <Chip color="blue"  texto="Pendiente" />, desc: 'Clase del día programada para más tarde.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-28 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Asignar una Suplencia" icono="swap_horiz">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="Ubica al docente titular en el directorio." />
                <Paso numero={2} titulo='Haz clic en el botón "Asignar Suplente".' />
                <Paso numero={3} titulo="Selecciona la asignatura y horario a cubrir." />
                <Paso numero={4} titulo="Elige a un docente registrado del sistema o marca 'Suplente Externo' e introduce su nombre." />
                <Paso numero={5} titulo='Haz clic en "Confirmar Suplencia".' />
              </div>
              <Aviso tipo="tip" texto="La suplencia se reflejará de inmediato en el Dashboard indicando el nombre del profesor sustituto." />
            </Tarjeta>
          </Seccion>

          {/* ══ 7. CALENDARIOS ACADÉMICOS ══ */}
          <Seccion id="calendarios" icono="calendar_month" titulo="Calendarios académicos">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Sección dedicada a la consulta y administración de calendarios escolares oficiales y rol de exámenes parciales por licenciatura.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Calendario Institucional por Ciclo" icono="event">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="Selecciona el ciclo escolar activo (ej: 2025-2026)." />
                <Paso numero={2} titulo="Visualiza los eventos académicos oficializados por la universidad (periodos de inscripción, asuetos, etc.)." />
                <Paso numero={3} titulo="Descarga la versión oficial en PDF haciendo clic en el botón de descarga del documento." />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Rol de Exámenes Parciales y Ordinarios" icono="assignment">
              <p className="text-xs text-[#44464e] leading-relaxed mb-3">
                Filtra por carrera (ISC, DER, ENF, etc.) para revisar la programación de exámenes parciales, ordinarios y fecha límite de entrega de actas.
              </p>
            </Tarjeta>
          </Seccion>

          {/* ══ 8. CONFIGURACIÓN DE PERFIL ══ */}
          <Seccion id="perfil" icono="manage_accounts" titulo="Configuración de perfil y sistema">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Permite la administración de tus datos personales, cambio de credenciales de acceso y verificación del estado de conexión a TiDB Cloud.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Actualizar perfil y contraseña" icono="key">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Accede a "Configuración de Perfil" desde el menú lateral.' />
                <Paso numero={2} titulo="Modifica tu nombre de usuario o foto de perfil si lo deseas." />
                <Paso numero={3} titulo="Para actualizar contraseña: ingresa la clave actual, escribe la nueva contraseña y confírmala." />
                <Paso numero={4} titulo='Haz clic en "Guardar cambios".' />
              </div>
            </Tarjeta>
          </Seccion>

          {/* ══ 9. SOPORTE TÉCNICO ══ */}
          <Seccion id="soporte" icono="support_agent" titulo="Soporte técnico">
            <Tarjeta titulo="Canales Oficiales de Atención" icono="contact_support">
              <p className="text-xs text-[#44464e] leading-relaxed mb-4">
                Si experimentas fallas en el sistema, problemas de acceso o requieres asistencia técnica especializada, puedes comunicarte a través de los datos oficiales:
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <a
                  href="mailto:soporte.sipref.software@gmail.com"
                  className="flex items-center gap-3.5 p-4 rounded-xl border border-[#c5c6cf]/30 bg-[#faf9fc] hover:bg-[#1c355e]/5 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1c355e] text-white flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#75777f]">Correo Electrónico</p>
                    <p className="text-xs font-bold text-[#1b1c1e] truncate group-hover:text-[#1c355e] transition-colors">
                      soporte.sipref.software@gmail.com
                    </p>
                  </div>
                </a>

                <a
                  href="tel:9997666713"
                  className="flex items-center gap-3.5 p-4 rounded-xl border border-[#c5c6cf]/30 bg-[#faf9fc] hover:bg-[#1c355e]/5 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1c355e] text-white flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-xl">call</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#75777f]">Atención Telefónica</p>
                    <p className="text-xs font-bold text-[#1b1c1e] group-hover:text-[#1c355e] transition-colors">
                      999 766 6713
                    </p>
                  </div>
                </a>
              </div>
            </Tarjeta>
          </Seccion>

          {/* ══ 10. PREGUNTAS FRECUENTES ══ */}
          <Seccion id="faq" icono="help" titulo="Preguntas frecuentes">
            {[
              {
                q: '¿Con qué frecuencia se actualiza la información del Dashboard?',
                a: 'El sistema consulta la base de datos cada 30 segundos automáticamente, garantizando que el estado de cada clase y aula se mantenga al día sin requerir recargar la página.',
              },
              {
                q: '¿Puedo usar el sistema en dispositivos móviles?',
                a: 'Sí, la plataforma cuenta con un diseño responsivo adaptativo que transforma las tablas en tarjetas legibles para pantallas táctiles de celulares y tabletas.',
              },
              {
                q: '¿Por qué los laboratorios tienen métricas independientes?',
                a: 'Se diferencian para no alterar la tasa real de ocupación de las aulas regulares, dado que los laboratorios cuentan con un régimen de uso especializado.',
              },
              {
                q: '¿Qué sucede si se interrumpe la conexión a internet?',
                a: 'SIPREF emitirá una notificación de reconexión y reintentará comunicarse de forma segura con TiDB Cloud en cuanto el servicio se restablezca.',
              },
              {
                q: '¿Cómo funciona la asignación automática de aulas?',
                a: 'Analiza el mapa horario del turno (matutino/vespertino), descarta aulas en mantenimiento y asigna el salón disponible con capacidad óptima.',
              },
              {
                q: '¿Cuál es el correo oficial de contacto para soporte técnico?',
                a: 'El canal principal de soporte técnico es soporte.sipref.software@gmail.com.',
              },
            ].map((item, i) => (
              <Tarjeta key={i}>
                <div className="flex gap-3">
                  <span className="material-symbols-outlined text-[18px] text-[#1c355e] flex-shrink-0 mt-0.5">question_answer</span>
                  <div>
                    <p className="text-sm font-bold text-[#1b1c1e] mb-1.5">{item.q}</p>
                    <p className="text-xs text-[#44464e] leading-relaxed">{item.a}</p>
                  </div>
                </div>
              </Tarjeta>
            ))}

            <div className="bg-[#1c355e] rounded-2xl p-6 text-white text-center mt-2">
              <span className="material-symbols-outlined text-4xl mb-3 block opacity-80">support_agent</span>
              <p className="font-black text-base mb-1">¿Necesitas ayuda adicional?</p>
              <p className="text-sm text-white/70">Visita el módulo de Soporte Técnico o escribe directamente a soporte.sipref.software@gmail.com</p>
            </div>
          </Seccion>

          <p className="text-[10px] text-center text-[#75777f] pb-4">
            SIPREF v2.2 · Universidad Latino · 2026
          </p>

        </main>
      </div>
    </div>
  );
}
