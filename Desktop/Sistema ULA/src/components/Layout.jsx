import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import logo from './logo.png'; 

export default function Layout() {
  const location = useLocation();
  
  const [usuario, setUsuario] = useState({ 
    nombre: 'Usuario Administrador', 
    turno: 'Prefectura' 
  });

  useEffect(() => {
    const datosGuardados = localStorage.getItem('usuarioLogueado');
    if (datosGuardados) {
      const userParseado = JSON.parse(datosGuardados);
      setUsuario({
        nombre: userParseado.nombre_completo || userParseado.nombre || 'Usuario',
        turno: userParseado.turno || 'Prefectura'
      });
    }
  }, []);

  const cerrarSesion = () => {
    localStorage.removeItem('usuarioLogueado');
  };

  // Función auxiliar para detectar rutas activas
  const isActive = (path) => location.pathname.includes(path);

  return (
    <div className="bg-[#faf9fc] text-[#1b1c1e] antialiased flex flex-col min-h-screen font-manrope">
      
      {/* HEADER */}
      <header className="bg-white border-b border-[#c5c6cf]/30 flex justify-between items-center w-full px-8 py-3 h-16 z-40 fixed top-0 right-0 left-0 lg:left-64">
        <div className="flex items-center gap-4 lg:hidden">
            <span className="material-symbols-outlined text-2xl text-[#1c355e] cursor-pointer">menu</span>
            <img src={logo} alt="Universidad Latino Logo" className="h-8 object-contain" />
        </div>

       

        <div className="flex items-center gap-6 ml-auto">
          <div className="flex items-center gap-4 pl-6 border-l border-[#c5c6cf]/30">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#1b1c1e] leading-tight capitalize">{usuario.nombre} - {usuario.turno}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-[#0e2045] text-white flex items-center justify-center border border-[#c5c6cf]/30 font-bold text-lg uppercase shadow-sm">
              {usuario.nombre.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        
        {/* SIDEBAR */}
        <aside className="bg-[#1c355e] min-h-screen w-64 border-r border-white/5 shadow-2xl fixed left-0 top-0 flex flex-col z-50 hidden lg:flex">
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-full flex items-center justify-center px-2 mb-2">
               <img src={logo} alt="Universidad Latino Logo" className="w-32 h-32 object-contain mb-2 drop-shadow-lg" />
            </div>
            <p className="text-white text-[10px] uppercase tracking-[0.2em] font-extrabold opacity-80 mt-2">PREFECTURA CENTRAL</p>
          </div>

          <nav className="flex-1 px-4 mt-2 space-y-1">
            {/* Inicio - Dashboard con Base de Datos en Vivo */}
            <Link to="/dashboard" className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${location.pathname === '/dashboard' || location.pathname === '/' ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${location.pathname === '/dashboard' || location.pathname === '/' ? '' : 'opacity-70 group-hover:opacity-100'}`}>dashboard</span>
              <span className="text-sm">Inicio</span>
            </Link>

            {/* Gestión de Horarios */}
            <Link to="/horarios" className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('horarios') || isActive('asignar-aulas') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('horarios') || isActive('asignar-aulas') ? '' : 'opacity-70 group-hover:opacity-100'}`}>calendar_today</span>
              <span className="text-sm">Gestión de Horarios</span>
            </Link>
            
            {/* Gestión de Aulas */}
            <Link to="/gestion-aulas" className={`rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200 ${isActive('gestion-aulas') ? 'bg-[#fdbb11] text-[#000924] shadow-lg shadow-black/10 font-bold' : 'text-slate-300 hover:bg-white/10 hover:text-white font-medium group'}`}>
              <span className={`material-symbols-outlined text-xl ${isActive('gestion-aulas') ? '' : 'opacity-70 group-hover:opacity-100'}`}>meeting_room</span>
              <span className="text-sm">Gestión de Aulas</span>
            </Link>
          </nav>

          {/* Logout */}
          <div className="px-4 pb-8 mt-auto">
            <Link to="/login" onClick={cerrarSesion} className="text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl flex items-center gap-4 py-3.5 px-4 transition-all duration-200">
              <span className="material-symbols-outlined text-xl">logout</span>
              <span className="font-medium text-sm">Cerrar Sesión</span>
            </Link>
          </div>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 lg:ml-64 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-[#1c2738] w-full py-5 px-8 flex flex-col md:flex-row justify-between items-center z-40 relative mt-auto border-t border-white/5 lg:pl-[288px]">
        <div className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-4 md:mb-0">
            © 2026 UNIVERSIDAD LATINO - SISTEMA DE GESTIÓN INSTITUCIONAL
        </div>
        <nav className="flex items-center gap-6 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
          <a className="hover:text-white transition-colors" href="#">SOPORTE TÉCNICO</a>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <a className="hover:text-white transition-colors" href="#">AVISO DE PRIVACIDAD</a>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <a className="hover:text-white transition-colors" href="#">MANUAL DE USUARIO</a>
        </nav>
      </footer>
    </div>
  );
}