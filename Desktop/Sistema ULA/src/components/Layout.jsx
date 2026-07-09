import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useUser } from './UserContext';
import logo from './logo.png';

export default function Layout() {
  const location = useLocation();
  const { usuario } = useUser();

  // Estado para controlar el menú en celulares y tablets
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarAlertas, setMostrarAlertas] = useState(false);
  const alertasRef = useRef(null);

  // Estado dinámico para calendarios pendientes
  const [calendariosPendientes, setCalendariosPendientes] = useState([]);

  useEffect(() => {
    const fetchPendientes = async () => {
      const requeridos = [
        { id: 'gen', titulo: 'Calendario Institucional', subtitulo: 'Plan Cuatri. y Semes.', tipo: 'general' },
        ...['DER', 'ENF', 'GAS', 'ISC', 'NEG', 'NUT', 'PSCF', 'PSIC', 'VMK'].map(c => ({
          id: `exam-${c}`, titulo: `Exámenes: ${c}`, subtitulo: 'Calendario no cargado', tipo: 'examenes', carrera: c
        }))
      ];
      const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

      try {
        const res = await fetch(`${API_URL}/api/calendarios`);
        const cargados = await res.json();
        
        if (!Array.isArray(cargados)) {
          setCalendariosPendientes(requeridos);
          return;
        }

        // Filtramos los requeridos que NO están en los cargados
        const pendientes = requeridos.filter(req => {
          return !cargados.some(c => c.tipo === req.tipo && (c.carrera === req.carrera || (!req.carrera && !c.carrera)));
        });

        setCalendariosPendientes(pendientes);
      } catch (error) {
        console.error("Error al obtener calendarios en Layout:", error);
        setCalendariosPendientes(requeridos); // Si falla el fetch, los mostramos todos como pendientes
      }
    };

    fetchPendientes();
  }, [location.pathname]); // Se actualiza al cambiar de vista

  useEffect(() => {
    const handleClickFuera = (event) => {
      if (alertasRef.current && !alertasRef.current.contains(event.target)) {
        setMostrarAlertas(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  const [alertaActualIndex, setAlertaActualIndex] = useState(0);

  useEffect(() => {
    if (calendariosPendientes.length === 0) return;
    const interval = setInterval(() => {
      setAlertaActualIndex(prev => (prev + 1) % calendariosPendientes.length);
    }, 4000); // Cambia cada 4 segundos
    return () => clearInterval(interval);
  }, [calendariosPendientes]);

  const alertaActual = calendariosPendientes.length > 0 ? calendariosPendientes[alertaActualIndex] : null;

  const cerrarSesion = () => {
    localStorage.removeItem('usuarioLogueado');
  };

  const isActive = (path) =>
    location.pathname === `/${path}` || location.pathname.startsWith(`/${path}/`);

  // Cierra el menú al hacer clic en un enlace en versión móvil
  const cerrarMenu = () => setMenuAbierto(false);

  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

  const getLinkClasses = (path) => {
    const active = path === 'dashboard' ? isDashboard : isActive(path);
    return `rounded-2xl flex items-center gap-3.5 py-3 px-5 transition-all duration-300 ${
      active 
        ? 'bg-gradient-to-r from-[#fdbb11] to-[#e8a906] text-[#0e2045] shadow-lg shadow-[#fdbb11]/20 font-black translate-x-1' 
        : 'text-[#c5c6cf] hover:bg-white/5 hover:text-white font-semibold group hover:translate-x-1'
    }`;
  };

  const getIconClasses = (path) => {
    const active = path === 'dashboard' ? isDashboard : isActive(path);
    return `material-symbols-outlined text-[22px] ${
      active ? '' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-transform'
    }`;
  };

  return (
    <div className="bg-[#faf9fc] text-[#1b1c1e] antialiased flex flex-col min-h-screen font-manrope">
      <style>{`
        @keyframes fadeInSlideUp {
          0% { opacity: 0; transform: translateY(6px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        .animate-ticker {
          animation: fadeInSlideUp 4s ease-in-out forwards;
        }
      `}</style>

      {/* FONDO OSCURO (OVERLAY) PARA MÓVILES */}
      {menuAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={cerrarMenu}
        ></div>
      )}

      {/* HEADER SIEMPRE VISIBLE - Corrección: Se eliminó 'w-full' para que no se salga de la pantalla */}
      <header className="bg-white border-b border-[#c5c6cf]/30 flex justify-between items-center px-4 sm:px-8 py-3 h-16 z-30 fixed top-0 right-0 left-0 lg:left-64 shadow-sm transition-all duration-300">

        {/* Botón Menú y Logo (Izquierda - Solo Móvil) */}
        <div className="flex items-center gap-3 lg:hidden">
          <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú de navegación" className="p-1 hover:bg-slate-100 rounded-md">
            <span className="material-symbols-outlined text-2xl text-[#1c355e]">menu</span>
          </button>
          <img src={logo} alt="Universidad Latino Logo" className="h-8 object-contain" />
        </div>

        {/* Ticker de Alertas (Centro) */}
        <div className="hidden sm:flex flex-1 mx-4 lg:mx-8 items-center justify-center overflow-hidden h-full relative">
          {alertaActual && (
            <div key={alertaActual.id} className="absolute flex items-center gap-3 animate-ticker bg-white px-5 py-2 rounded-full border border-amber-200/50 shadow-sm shadow-amber-500/10">
              <span className="relative flex h-2.5 w-2.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-sm font-medium text-slate-500 tracking-wide">
                Pendiente: <span className="text-slate-800 font-bold">{alertaActual.titulo}</span>
                {!alertaActual.carrera && <span className="ml-1.5 text-slate-400 font-normal">({alertaActual.subtitulo})</span>}
              </span>
            </div>
          )}
        </div>

        {/* Información del Usuario (Derecha - Siempre visible) */}
        <div className="flex items-center gap-3 ml-auto pl-4 lg:border-l lg:border-[#c5c6cf]/30">
          
          {/* Iconos de Acción */}
          <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-3 border-r border-[#c5c6cf]/30 pr-3 sm:pr-5">
            <div className="relative" ref={alertasRef}>
              <button 
                onClick={() => setMostrarAlertas(!mostrarAlertas)}
                className="relative p-2 rounded-[12px] text-[#c5c6cf] hover:text-amber-500 hover:bg-amber-50 transition-colors group" 
                title="Alertas del Sistema">
                <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">warning</span>
                {/* Indicador de alerta activa */}
                {calendariosPendientes.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500 border-2 border-white animate-pulse"></span>
                )}
              </button>

              {/* Dropdown de Alertas */}
              {mostrarAlertas && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between">
                    <h3 className="font-bold text-sm">Alertas del Sistema</h3>
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {calendariosPendientes.length}
                    </span>
                  </div>
                  <div className="p-2 max-h-72 overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Documentos Pendientes
                    </div>
                    {calendariosPendientes.map((cal) => (
                      <div key={cal.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cal.tipo.startsWith('general') ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                          <span className="material-symbols-outlined text-[16px]">{cal.tipo.startsWith('general') ? 'event' : 'calendar_month'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{cal.titulo}</p>
                          <p className="text-xs text-slate-500 truncate">{cal.subtitulo}</p>
                        </div>
                      </div>
                    ))}
                    {calendariosPendientes.length === 0 && (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        No hay alertas pendientes.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="relative p-2 rounded-[12px] text-[#c5c6cf] hover:text-[#1c355e] hover:bg-slate-100 transition-colors group" title="Notificaciones">
              <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border-2 border-white animate-pulse"></span>
            </button>
            <Link to="/configuracion-perfil" className="p-2 rounded-[12px] text-[#c5c6cf] hover:text-[#1c355e] hover:bg-slate-100 transition-colors group" title="Configuración de Perfil">
              <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">settings</span>
            </Link>
          </div>

          <div className="flex flex-col items-end justify-center min-w-0 hidden sm:flex">
            <p className="text-xs sm:text-sm font-bold text-[#1b1c1e] leading-tight capitalize truncate max-w-[150px] lg:max-w-[200px]">
              {usuario.nombre}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">
              {usuario.turno}
            </p>
          </div>
          <div className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 rounded-full bg-[#0e2045] text-white flex items-center justify-center border border-[#c5c6cf]/30 font-bold text-base sm:text-lg uppercase shadow-sm">
            {usuario.nombre.charAt(0)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">

        {/* SIDEBAR (MENÚ LATERAL) */}
        <aside
          className={`bg-[#0e2045] min-h-screen w-64 shadow-2xl fixed left-0 top-0 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${menuAbierto ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0 border-r border-[#1c355e]`}
        >
          {/* Botón de cerrar (Solo móvil) */}
          <button
            onClick={cerrarMenu}
            aria-label="Cerrar menú de navegación"
            className="absolute top-4 right-4 text-white/50 hover:text-white lg:hidden bg-white/5 p-2 rounded-lg"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="px-6 py-10 w-full flex flex-col items-center justify-center">
            <div className="relative flex flex-col items-center group cursor-default">
              <div className="absolute inset-0 bg-[#fdbb11]/20 blur-[35px] rounded-full w-24 h-24 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 group-hover:bg-[#fdbb11]/30 transition-all duration-500"></div>
              <img src={logo} alt="Universidad Latino Logo" className="w-28 h-auto object-contain drop-shadow-2xl mb-5 relative z-10 group-hover:scale-105 transition-transform duration-500" />
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#fdbb11] text-[12px] uppercase tracking-[0.3em] font-black text-center drop-shadow-sm">SIPREF</p>
            </div>
          </div>

          <nav className="flex-1 px-5 mt-2 space-y-2">
            <Link to="/dashboard" onClick={cerrarMenu} className={getLinkClasses('dashboard')}>
              <span className={getIconClasses('dashboard')}>dashboard</span>
              <span className="text-sm tracking-wide">Inicio</span>
            </Link>

            <Link to="/horarios" onClick={cerrarMenu} className={getLinkClasses('horarios')}>
              <span className={getIconClasses('horarios')}>calendar_today</span>
              <span className="text-sm tracking-wide">Gestión de Horarios</span>
            </Link>

            <Link to="/gestion-aulas" onClick={cerrarMenu} className={getLinkClasses('gestion-aulas')}>
              <span className={getIconClasses('gestion-aulas')}>meeting_room</span>
              <span className="text-sm tracking-wide">Gestión de Espacios</span>
            </Link>

            <Link to="/gestion-docentes" onClick={cerrarMenu} className={getLinkClasses('gestion-docentes')}>
              <span className={getIconClasses('gestion-docentes')}>school</span>
              <span className="text-sm tracking-wide">Gestión de Docentes</span>
            </Link>

            <Link to="/calendarios" onClick={cerrarMenu} className={getLinkClasses('calendarios')}>
              <span className={getIconClasses('calendarios')}>calendar_month</span>
              <span className="text-sm tracking-wide">Calendarios</span>
            </Link>

          </nav>

          <div className="px-5 pb-8 mt-auto">
            <Link to="/login" onClick={() => { cerrarSesion(); cerrarMenu(); }} className="text-[#c5c6cf] hover:bg-red-500/10 hover:text-red-400 rounded-2xl flex items-center gap-3.5 py-3 px-5 transition-all duration-300 group hover:translate-x-1">
              <span className="material-symbols-outlined text-[22px] opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-transform">logout</span>
              <span className="font-semibold text-sm tracking-wide">Cerrar Sesión</span>
            </Link>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 lg:ml-64 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-[#1c2738] w-full py-5 px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center z-20 relative mt-auto border-t border-white/5 lg:pl-[288px] gap-4 md:gap-0">
        <div className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] text-center md:text-left">
          © 2026 UNIVERSIDAD LATINO - SIPREF
        </div>
        <nav className="flex flex-wrap justify-center items-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          <Link to="/soporte" className="hover:text-white transition-colors">SOPORTE TÉCNICO</Link>
          <span className="w-1 h-1 rounded-full bg-slate-700 hidden sm:block"></span>
          <Link to="/manual" className="hover:text-white transition-colors">MANUAL DE USUARIO</Link>
        </nav>
      </footer>
    </div>
  );
}