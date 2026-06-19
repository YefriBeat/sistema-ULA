import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUser } from './UserContext';
import logo from './logo.png';

export default function Layout() {
  const location = useLocation();
  const { usuario } = useUser();

  // Estado para controlar el menú en celulares y tablets
  const [menuAbierto, setMenuAbierto] = useState(false);

  const cerrarSesion = () => {
    localStorage.removeItem('usuarioLogueado');
  };

  const isActive = (path) =>
    location.pathname === `/${path}` || location.pathname.startsWith(`/${path}/`);

  // Cierra el menú al hacer clic en un enlace en versión móvil
  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <div className="bg-[#faf9fc] text-[#1b1c1e] antialiased flex flex-col min-h-screen font-manrope">

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

        {/* Información del Usuario (Derecha - Siempre visible) */}
        <div className="flex items-center gap-3 ml-auto pl-4 lg:border-l lg:border-[#c5c6cf]/30">
          <div className="flex flex-col items-end justify-center min-w-0">
            <p className="text-xs sm:text-sm font-bold text-[#1b1c1e] leading-tight capitalize truncate max-w-[200px]">
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
          className={`bg-[#1c355e] min-h-screen w-64 border-r border-white/5 shadow-2xl fixed left-0 top-0 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${menuAbierto ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0`}
        >
          {/* Botón de cerrar (Solo móvil) */}
          <button
            onClick={cerrarMenu}
            aria-label="Cerrar menú de navegación"
            className="absolute top-4 right-4 text-white/50 hover:text-white lg:hidden"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-full flex items-center justify-center px-2 mb-2">
              <img src={logo} alt="Universidad Latino Logo" className="w-24 h-24 sm:w-32 sm:h-32 object-contain mb-2 drop-shadow-lg" />
            </div>
            <p className="text-white text-[10px] uppercase tracking-[0.2em] font-extrabold opacity-80 mt-2">PREFECTURA CENTRAL</p>
          </div>

          <nav className="flex-1 px-4 mt-2 space-y-1">
            <Link to="/dashboard" onClick={cerrarMenu} className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${location.pathname === '/dashboard' || location.pathname === '/' ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${location.pathname === '/dashboard' || location.pathname === '/' ? '' : 'opacity-70 group-hover:opacity-100'}`}>dashboard</span>
              <span className="text-sm">Inicio</span>
            </Link>

            <Link to="/horarios" onClick={cerrarMenu} className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('horarios') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('horarios') ? '' : 'opacity-70 group-hover:opacity-100'}`}>calendar_today</span>
              <span className="text-sm">Gestión de Horarios</span>
            </Link>

            <Link to="/gestion-aulas" onClick={cerrarMenu} className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('gestion-aulas') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('gestion-aulas') ? '' : 'opacity-70 group-hover:opacity-100'}`}>meeting_room</span>
              <span className="text-sm">Gestión de Espacios  </span>
            </Link>

            <Link to="/gestion-docentes" onClick={cerrarMenu} className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('gestion-docentes') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('gestion-docentes') ? '' : 'opacity-70 group-hover:opacity-100'}`}>school</span>
              <span className="text-sm">Gestión de Docentes</span>
            </Link>

            <Link to="/configuracion-perfil" onClick={cerrarMenu} className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('configuracion-perfil') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('configuracion-perfil') ? '' : 'opacity-70 group-hover:opacity-100'}`}>manage_accounts</span>
              <span className="text-sm">Configuración de Perfil</span>
            </Link>
          </nav>

          <div className="px-4 pb-8 mt-auto">
            <Link to="/login" onClick={() => { cerrarSesion(); cerrarMenu(); }} className="text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200">
              <span className="material-symbols-outlined text-xl">logout</span>
              <span className="font-medium text-sm">Cerrar Sesión</span>
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
          © 2026 UNIVERSIDAD LATINO - SISTEMA DE GESTIÓN INSTITUCIONAL
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