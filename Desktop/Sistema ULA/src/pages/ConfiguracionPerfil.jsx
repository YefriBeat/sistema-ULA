import { useState, useEffect } from 'react';

export default function ConfiguracionPerfil() {
  const [usuario, setUsuario] = useState({ nombre_completo: '', correo: '', turno: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const datos = localStorage.getItem('usuarioLogueado');
    if (datos) {
      const parsed = JSON.parse(datos);
      setUsuario({
        nombre_completo: parsed.nombre_completo || parsed.nombre || '',
        correo: parsed.correo || '',
        turno: parsed.turno || '',
      });
    }
  }, []);

  const handleGuardar = (e) => {
    e.preventDefault();
    setGuardando(true);
    setTimeout(() => setGuardando(false), 1200);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#1b1c1e] tracking-tight">Configuración de Perfil</h1>
        <p className="text-sm text-slate-500 mt-1">Visualiza y edita la información de tu cuenta.</p>
      </div>

      {/* Avatar y nombre */}
      <div className="bg-white border border-[#c5c6cf]/40 rounded-2xl p-6 shadow-sm flex items-center gap-5">
        <div className="h-16 w-16 flex-shrink-0 rounded-full bg-[#0e2045] text-white flex items-center justify-center font-bold text-2xl uppercase shadow">
          {usuario.nombre_completo.charAt(0) || 'U'}
        </div>
        <div>
          <p className="font-bold text-[#1b1c1e] text-base capitalize">{usuario.nombre_completo || 'Usuario'}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{usuario.turno || 'Prefectura'}</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleGuardar} className="bg-white border border-[#c5c6cf]/40 rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre Completo</label>
          <input
            type="text"
            value={usuario.nombre_completo}
            onChange={(e) => setUsuario({ ...usuario, nombre_completo: e.target.value })}
            className="w-full px-4 py-2.5 border border-[#c5c6cf] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Correo Electrónico</label>
          <input
            type="email"
            value={usuario.correo}
            disabled
            className="w-full px-4 py-2.5 border border-[#c5c6cf] rounded-xl text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400 mt-1">El correo no puede modificarse.</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Turno</label>
          <select
            value={usuario.turno}
            onChange={(e) => setUsuario({ ...usuario, turno: e.target.value })}
            className="w-full px-4 py-2.5 border border-[#c5c6cf] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all bg-white"
          >
            <option value="">Seleccionar turno...</option>
            <option value="Matutino">Matutino</option>
            <option value="Vespertino">Vespertino</option>
            <option value="Nocturno">Nocturno</option>
          </select>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 bg-[#1c355e] hover:bg-[#0e2045] text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-xl">{guardando ? 'hourglass_empty' : 'save'}</span>
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
