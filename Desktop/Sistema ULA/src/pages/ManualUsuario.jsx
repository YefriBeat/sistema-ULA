import { useState } from 'react';
import logo from '../components/logo.png';

const SECCIONES = [
  { id: 'introduccion', icono: 'info',            titulo: 'Introducción' },
  { id: 'acceso',       icono: 'login',           titulo: 'Acceso al sistema' },
  { id: 'dashboard',    icono: 'dashboard',       titulo: 'Panel principal' },
  { id: 'horarios',     icono: 'schedule',        titulo: 'Gestión de horarios' },
  { id: 'aulas',        icono: 'door_open',       titulo: 'Gestión de aulas' },
  { id: 'docentes',     icono: 'group',           titulo: 'Gestión de docentes' },
  { id: 'perfil',       icono: 'manage_accounts', titulo: 'Configuración de perfil' },
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
              <h1 className="text-2xl font-black">Manual de Usuario</h1>
              <p className="text-sm text-white/70 mt-1">SIPREF — Versión 2.1</p>
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
              Contenido
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

        {/* ── CONTENIDO ── */}
        <main className="flex-1 min-w-0 space-y-10">

          {/* ══ 1. INTRODUCCIÓN ══ */}
          <Seccion id="introduccion" icono="info" titulo="Introducción">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                El <strong className="text-[#1b1c1e]">SIPREF</strong> es una plataforma web desarrollada para la <strong className="text-[#1b1c1e]">Universidad Latino</strong> que centraliza la administración de horarios académicos, aulas e información docente en tiempo real.
              </p>
            </Tarjeta>

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icono: 'schedule',   titulo: 'Horarios en tiempo real', desc: 'Visualiza qué clase está en curso, cuál es la próxima y cuáles han finalizado.' },
                { icono: 'door_open',  titulo: 'Control de aulas',        desc: 'Registra aulas, gestiona ocupación y activa modos de mantenimiento.' },
                { icono: 'group',      titulo: 'Directorio de docentes',  desc: 'Administra el personal académico y registra suplencias al instante.' },
              ].map(f => (
                <div key={f.titulo} className="bg-white border border-[#c5c6cf]/30 rounded-xl p-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl text-[#1c355e] mb-2 block">{f.icono}</span>
                  <p className="text-xs font-bold text-[#1b1c1e] mb-1">{f.titulo}</p>
                  <p className="text-[11px] text-[#75777f] leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <Tarjeta titulo="Requisitos mínimos" icono="devices">
              <ul className="space-y-1.5 text-xs text-[#44464e]">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span>Navegador moderno: Chrome 90+, Firefox 88+, Edge 90+ o Safari 14+</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span>Conexión a internet activa (el sistema consulta la base de datos en línea)</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-[14px] text-green-600">check_circle</span>Resolución mínima recomendada: 360 × 640 px (funciona en móvil y escritorio)</li>
              </ul>
            </Tarjeta>
          </Seccion>

          {/* ══ 2. ACCESO AL SISTEMA ══ */}
          <Seccion id="acceso" icono="login" titulo="Acceso al sistema">
            <Tarjeta titulo="Iniciar sesión" icono="lock_open">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Abre el sistema en tu navegador y haz clic en "Iniciar Sesión".' />
                <Paso numero={2} titulo="Ingresa tu correo electrónico institucional y contraseña." />
                <Paso numero={3} titulo='Presiona el botón "Ingresar".' descripcion='Si las credenciales son correctas, serás redirigido al Panel Principal.' />
              </div>
              <Aviso tipo="warning" texto='Si olvidas tu contraseña, contacta al administrador del sistema para restablecerla desde la sección Configuración de Perfil.' />
            </Tarjeta>

            <Tarjeta titulo="Crear una cuenta nueva" icono="person_add">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En la pantalla de Login, haz clic en "Crear cuenta".' />
                <Paso numero={2} titulo="Completa el formulario con tu nombre, correo y contraseña." descripcion="La contraseña debe tener al menos 6 caracteres." />
                <Paso numero={3} titulo='Presiona "Registrarse".' descripcion="Tu cuenta se crea de inmediato y quedarás autenticado automáticamente." />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Cerrar sesión" icono="logout">
              <p className="text-xs text-[#44464e] leading-relaxed">
                En la barra lateral izquierda, haz clic en el botón <strong>Cerrar sesión</strong> (ícono de salida, en la parte inferior del menú). Serás redirigido a la pantalla de Login.
              </p>
              <Aviso tipo="info" texto="La sesión se almacena en el navegador. Si usas el sistema en un equipo compartido, cierra sesión siempre al terminar." />
            </Tarjeta>
          </Seccion>

          {/* ══ 3. PANEL PRINCIPAL ══ */}
          <Seccion id="dashboard" icono="dashboard" titulo="Panel principal (Dashboard)">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                El <strong className="text-[#1b1c1e]">Directorio General de Horarios</strong> muestra todas las clases de la base de datos con su estado en tiempo real, actualizado automáticamente cada 30 segundos.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Tarjetas de métricas interactivas" icono="touch_app">
              <p className="text-xs text-[#44464e] leading-relaxed mb-3">
                En la parte superior del dashboard hay 4 tarjetas con indicadores clave. Al hacer <strong className="text-[#1b1c1e]">clic en cualquier tarjeta</strong>, la página baja automáticamente a la tabla de horarios y aplica el filtro correspondiente:
              </p>
              <div className="space-y-2 mt-1">
                {[
                  { chip: <Chip color="blue"  texto="En Curso" />,      desc: 'Filtra y muestra solo las clases activas en este momento.' },
                  { chip: <Chip color="amber" texto="Próximas" />,       desc: 'Muestra las clases que están por iniciar hoy y las programadas.' },
                  { chip: <Chip color="gray"  texto="Finalizadas" />,    desc: 'Muestra las clases que ya terminaron hoy.' },
                  { chip: <Chip color="indigo" texto="Clases Totales" />, desc: 'Muestra la base de datos completa sin filtros.' },
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
                El panel lateral derecho muestra dos indicadores separados:
              </p>
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">meeting_room</span><span><strong className="text-[#1b1c1e]">Gráfico de Aulas:</strong> muestra el porcentaje de ocupación solo de aulas regulares (excluye laboratorios).</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c9c72] flex-shrink-0 mt-0.5">science</span><span><strong className="text-[#1b1c1e]">Total Laboratorios:</strong> tarjeta independiente que muestra cuántos laboratorios hay, cuántos están en uso y cuántos están libres.</span></div>
              </div>
              <Aviso tipo="info" texto="Los laboratorios (espacios con prefijo 'Lab') no se mezclan con las aulas normales en los porcentajes ni en los totales del gráfico circular." />
            </Tarjeta>

            <Tarjeta titulo="Indicadores de estado en la tabla" icono="radio_button_checked">
              <div className="space-y-2.5 mt-1">
                {[
                  { chip: <Chip color="blue"   texto="En Curso" />,    desc: 'La clase está activa en este momento.' },
                  { chip: <Chip color="amber"  texto="Próxima" />,     desc: 'La clase comienza en los próximos minutos.' },
                  { chip: <Chip color="gray"   texto="Finalizada" />,  desc: 'La clase ya terminó hoy.' },
                  { chip: <Chip color="indigo" texto="Programada" />,  desc: 'Clase futura, aún no es su día/hora.' },
                  { chip: <Chip color="blue"   texto="Suplencia" />,   desc: 'Un docente sustituto está cubriendo la clase.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-28 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Cómo usar los filtros" icono="filter_list">
              <div className="space-y-2.5 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">search</span><span><strong className="text-[#1b1c1e]">Búsqueda:</strong> escribe el nombre de un docente, asignatura o aula para filtrar al instante.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">school</span><span><strong className="text-[#1b1c1e]">Licenciatura:</strong> desplegable para filtrar por carrera.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">today</span><span><strong className="text-[#1b1c1e]">Día:</strong> muestra solo las clases de ese día de la semana.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">schedule</span><span><strong className="text-[#1b1c1e]">Hora:</strong> filtra por turno (matutino / vespertino).</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">radio_button_checked</span><span><strong className="text-[#1b1c1e]">Estado:</strong> muestra solo clases con el estado seleccionado.</span></div>
              </div>
              <Aviso tipo="tip" texto='Usa el botón "BD Total" o haz clic en la tarjeta "Clases Totales" para eliminar todos los filtros y ver el directorio completo.' />
            </Tarjeta>
          </Seccion>

          {/* ══ 4. GESTIÓN DE HORARIOS ══ */}
          <Seccion id="horarios" icono="schedule" titulo="Gestión de horarios">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Permite cargar archivos de horarios académicos, asignar aulas de forma automática o manual, editar entradas individuales y eliminar registros.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Cargar un archivo de horarios" icono="upload_file">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En el menú lateral, haz clic en "Gestión de Horarios".' />
                <Paso numero={2} titulo='Selecciona la pestaña "Cargar Horario".' />
                <Paso numero={3} titulo="Arrastra y suelta el archivo o haz clic en el área de carga para seleccionarlo." descripcion="Se aceptan archivos PDF o Excel con el formato de horario institucional." />
                <Paso numero={4} titulo="El sistema extrae automáticamente los datos del archivo." descripcion="Verifica que la información detectada sea correcta antes de continuar." />
                <Paso numero={5} titulo="Asigna un aula a cada clase (manual o automática)." descripcion='Usa "Asignación automática" para que el sistema elija el aula disponible más adecuada.' />
                <Paso numero={6} titulo='Haz clic en "Guardar horario" para registrar todo en la base de datos.' />
              </div>
              <Aviso tipo="tip" texto="La asignación automática considera la ocupación matutina y vespertina de cada aula. Las aulas en mantenimiento son excluidas automáticamente." />
            </Tarjeta>

            <Tarjeta titulo="Editar un horario existente" icono="edit">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En la pestaña "Gestor de Archivos", selecciona el archivo que contiene el horario.' />
                <Paso numero={2} titulo="Busca el registro que deseas modificar y presiona el ícono de edición." />
                <Paso numero={3} titulo="Modifica los campos necesarios en el modal que aparece." />
                <Paso numero={4} titulo='Presiona "Guardar cambios" para confirmar.' />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Eliminar un horario" icono="delete">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="Localiza el registro en el gestor de archivos." />
                <Paso numero={2} titulo="Haz clic en el ícono de eliminar (papelera)." />
                <Paso numero={3} titulo="Confirma la acción en el cuadro de diálogo." />
              </div>
              <Aviso tipo="warning" texto="Eliminar un horario es una acción irreversible. Asegúrate de que el registro ya no es necesario antes de confirmarlo." />
            </Tarjeta>
          </Seccion>

          {/* ══ 5. GESTIÓN DE AULAS ══ */}
          <Seccion id="aulas" icono="door_open" titulo="Gestión de aulas">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Administra el inventario de aulas y laboratorios del plantel. Puedes ver su disponibilidad en tiempo real, registrar nuevos espacios y activar el modo mantenimiento.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Separación Aulas vs Laboratorios" icono="science">
              <p className="text-xs text-[#44464e] leading-relaxed mb-2">
                El sistema diferencia automáticamente entre <strong className="text-[#1b1c1e]">aulas regulares</strong> y <strong className="text-[#1b1c1e]">laboratorios</strong> (espacios con prefijo "Lab"):
              </p>
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0 mt-0.5">meeting_room</span><span>Las <strong>aulas</strong> se ordenan alfanuméricamente (A1, A2… A10) y aparecen primero en la lista.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c9c72] flex-shrink-0 mt-0.5">science</span><span>Los <strong>laboratorios</strong> se agrupan al final de la lista y tienen su propio panel de métricas independiente.</span></div>
              </div>
              <Aviso tipo="info" texto="Los laboratorios no cuentan en el total de aulas ni afectan los promedios de ocupación de salones regulares." />
            </Tarjeta>

            <Tarjeta titulo="Estados de un aula" icono="info">
              <div className="space-y-2.5 mt-1">
                {[
                  { chip: <Chip color="green" texto="Disponible" />,    desc: 'El aula está libre y puede ser asignada.' },
                  { chip: <Chip color="blue"  texto="En Clase" />,      desc: 'Hay una clase activa en este momento (indicador azul estático).' },
                  { chip: <Chip color="amber" texto="Ocupada" />,       desc: 'Asignada a turno matutino y/o vespertino.' },
                  { chip: <Chip color="red"   texto="Mantenimiento" />, desc: 'Fuera de servicio temporalmente.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-32 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Registrar una nueva aula" icono="add_circle">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Haz clic en "Nueva Aula" (botón superior derecho).' />
                <Paso numero={2} titulo="Completa los campos: nombre del aula, edificio y capacidad." />
                <Paso numero={3} titulo="Selecciona los equipos disponibles (proyector, pizarrón digital, laboratorio, etc.)." />
                <Paso numero={4} titulo='Presiona "Guardar".' />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Activar modo mantenimiento" icono="construction">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="Busca el aula en la lista y haz clic en el ícono de llave inglesa." />
                <Paso numero={2} titulo="En el modal, activa el interruptor de mantenimiento." />
                <Paso numero={3} titulo="Indica la fecha estimada de fin del mantenimiento." descripcion="Opcional: especifica un aula temporal donde se trasladarán las clases." />
                <Paso numero={4} titulo='Haz clic en "Guardar".' />
              </div>
              <Aviso tipo="info" texto="Las aulas en mantenimiento se muestran con indicador naranja y quedan excluidas de la asignación automática de horarios." />
            </Tarjeta>
          </Seccion>

          {/* ══ 6. GESTIÓN DE DOCENTES ══ */}
          <Seccion id="docentes" icono="group" titulo="Gestión de docentes">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Consulta el directorio de docentes con su estado en tiempo real (en clase, disponible, por entrar, con suplencia activa) y gestiona las suplencias cuando un docente no pueda presentarse.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Clases del día en cada tarjeta" icono="today">
              <p className="text-xs text-[#44464e] leading-relaxed mb-2">
                Cada tarjeta de docente muestra <strong className="text-[#1b1c1e]">únicamente las clases del día actual</strong>, ordenadas cronológicamente. Las clases consecutivas de la misma asignatura se agrupan automáticamente en un solo bloque horario.
              </p>
              <div className="space-y-2 mt-1">
                {[
                  { chip: <Chip color="red"   texto="Activa" />,      desc: 'La clase está en curso ahora mismo (fondo rojo claro).' },
                  { chip: <Chip color="amber" texto="Próxima" />,      desc: 'La clase inicia en los próximos 30 minutos (fondo ámbar).' },
                  { chip: <Chip color="gray"  texto="Finalizada" />,   desc: 'La clase ya terminó hoy (texto atenuado con ícono ✓).' },
                  { chip: <Chip color="blue"  texto="Pendiente" />,    desc: 'Clase del día que aún no ha comenzado (fondo gris neutro).' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-28 flex-shrink-0">{item.chip}</div>
                    <p className="text-xs text-[#44464e]">{item.desc}</p>
                  </div>
                ))}
              </div>
              <Aviso tipo="info" texto='Ejemplo: si un docente tiene 2 bloques de 50 min de la misma materia (07:00–07:50 y 07:50–08:40), se muestra como un solo bloque "07:00–08:40".' />
            </Tarjeta>

            <Tarjeta titulo="Filtros disponibles" icono="filter_list">
              <div className="space-y-2 mt-1 text-xs text-[#44464e]">
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0">search</span><span><strong className="text-[#1b1c1e]">Búsqueda:</strong> por nombre del docente o carrera.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0">radio_button_checked</span><span><strong className="text-[#1b1c1e]">Estado:</strong> Todos / En Clase / Con Suplente.</span></div>
                <div className="flex gap-2"><span className="material-symbols-outlined text-[14px] text-[#1c355e] flex-shrink-0">sort_by_alpha</span><span><strong className="text-[#1b1c1e]">Orden A–Z:</strong> ordena el listado alfabéticamente.</span></div>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Registrar una suplencia" icono="swap_horiz">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo="Localiza al docente que no podrá asistir en la lista." />
                <Paso numero={2} titulo='Haz clic en "Asignar Suplente" dentro de su tarjeta.' />
                <Paso numero={3} titulo="Selecciona la clase específica que necesita cobertura." descripcion="Se muestran todas las clases semanales del docente." />
                <Paso numero={4} titulo="Elige al docente suplente de la lista o marca la opción de suplente externo e ingresa el nombre." />
                <Paso numero={5} titulo="Confirma los datos (materia, día, fecha, hora de inicio y hora de fin)." />
                <Paso numero={6} titulo='Presiona "Asignar Suplente".' />
              </div>
              <Aviso tipo="tip" texto="Una suplencia activa aparece en el Dashboard con el indicador azul «Suplencia» y muestra el nombre del docente sustituto." />
            </Tarjeta>
          </Seccion>

          {/* ══ 7. CONFIGURACIÓN DE PERFIL ══ */}
          <Seccion id="perfil" icono="manage_accounts" titulo="Configuración de perfil">
            <Tarjeta>
              <p className="text-sm text-[#44464e] leading-relaxed">
                Accede a tu perfil desde el ícono de usuario en la barra superior o desde el menú lateral. Aquí puedes actualizar tu información personal y cambiar tu contraseña.
              </p>
            </Tarjeta>

            <Tarjeta titulo="Actualizar datos personales" icono="edit">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='Navega a "Configuración de Perfil".' />
                <Paso numero={2} titulo="Edita los campos que desees: nombre, correo electrónico o foto de perfil." />
                <Paso numero={3} titulo='Haz clic en "Guardar cambios".' />
              </div>
            </Tarjeta>

            <Tarjeta titulo="Cambiar contraseña" icono="lock">
              <div className="space-y-3 mt-1">
                <Paso numero={1} titulo='En la sección de perfil, localiza el apartado "Cambiar contraseña".' />
                <Paso numero={2} titulo="Ingresa tu contraseña actual." />
                <Paso numero={3} titulo="Escribe la nueva contraseña y confírmala." />
                <Paso numero={4} titulo='Presiona "Actualizar contraseña".' />
              </div>
              <Aviso tipo="warning" texto="Por seguridad, usa contraseñas de al menos 8 caracteres combinando letras, números y símbolos. No compartas tu contraseña con otras personas." />
            </Tarjeta>
          </Seccion>

          {/* ══ 8. PREGUNTAS FRECUENTES ══ */}
          <Seccion id="faq" icono="help" titulo="Preguntas frecuentes">
            {[
              {
                q: '¿Con qué frecuencia se actualizan los datos del Dashboard?',
                a: 'El Panel Principal se sincroniza con la base de datos cada 30 segundos de forma automática. No es necesario recargar la página.',
              },
              {
                q: '¿Puedo usar el sistema desde mi celular?',
                a: 'Sí. El sistema es completamente responsivo. En dispositivos móviles la tabla del Dashboard se convierte en tarjetas individuales para facilitar la lectura.',
              },
              {
                q: '¿Cuántos dispositivos pueden usar la misma cuenta al mismo tiempo?',
                a: 'No hay límite de dispositivos. La misma cuenta puede iniciarse sesión en múltiples dispositivos o navegadores simultáneamente.',
              },
              {
                q: '¿Qué hago si el Dashboard muestra "Error de conexión"?',
                a: 'Verifica tu conexión a internet. Si el problema persiste, el servidor puede estar temporalmente inaccesible. Espera unos segundos; el sistema reintentará automáticamente.',
              },
              {
                q: '¿Cómo sé si un aula está disponible para asignar un horario nuevo?',
                a: 'En Gestión de Aulas puedes ver el estado de cada espacio. Las aulas con estado "Disponible" (verde) no tienen asignación en ningún turno y pueden usarse libremente.',
              },
              {
                q: '¿Qué diferencia hay entre "suplente de la lista" y "suplente externo"?',
                a: 'Un suplente de la lista es un docente ya registrado en el sistema. Un suplente externo es alguien no registrado, cuyo nombre se ingresa manualmente para dejar constancia de la cobertura.',
              },
              {
                q: '¿Puedo eliminar mi cuenta?',
                a: 'La eliminación de cuentas debe solicitarse al administrador del sistema. Desde la interfaz de usuario no es posible eliminar la propia cuenta.',
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
              <p className="font-black text-base mb-1">¿Necesitas más ayuda?</p>
              <p className="text-sm text-white/70">Comunícate con el equipo de soporte técnico a través del enlace en el pie de página del sistema.</p>
            </div>
          </Seccion>

          <p className="text-[10px] text-center text-[#75777f] pb-4">
            SIPREF v2.1 · Universidad Latino · 2026
          </p>

        </main>
      </div>
    </div>
  );
}
