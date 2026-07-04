import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast, ToastContainer } from '../components/useToast';
import { useUser } from '../components/UserContext';

const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino', ambos: 'Ambos Turnos' };

const fmtFecha = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtFechaHora = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

export default function ConfiguracionPerfil() {
  const navigate = useNavigate();
  const { toast, toasts } = useToast();
  const { usuario: usuarioCtx, actualizarUsuario } = useUser();

  // ── Estado local del formulario (draft editable, separado del contexto) ────
  const [usuario, setUsuario] = useState(() => ({
    id:              usuarioCtx.id,
    nombre_completo: usuarioCtx.nombre_completo,
    correo:          usuarioCtx.correo,
    turno:           usuarioCtx.turno,
    created_at:      usuarioCtx.created_at,
    logged_at:       usuarioCtx.logged_at,
  }));
  const [guardando, setGuardando] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  
  // ── Eliminar otros usuarios (Solo admin) ───────────────────────────────────
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null);
  
  // ── Cambio de contraseña ───────────────────────────────────────────────────

  // ── Cambio de contraseña ───────────────────────────────────────────────────
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmar: '' });
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [mostrarPass, setMostrarPass] = useState({ actual: false, nueva: false, confirmar: false });

  // ── Panel lateral de usuarios ──────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState([]);

  // Determinamos si es admin buscando su correo en la lista fresca de usuarios o en el contexto
  const correoActual = (usuarios.find(u => u.id === usuario.id)?.correo || usuario?.correo || '')?.trim().toLowerCase();
  const esAdmin = correoActual === 'yenri.moo@alumno.universidadlatino.edu.mx';


  // ── Última actualización de perfil (localStorage) ─────────────────────────
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  // ── Leer última actualización de perfil ───────────────────────────────────
  useEffect(() => {
    setUltimaActualizacion(localStorage.getItem('perfil_actualizado_en') || null);
  }, []);

  // ── Fetch lista de usuarios ────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then(data => setUsuarios(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);


  // ── Guardar perfil ────────────────────────────────────────────────────────
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!usuario.nombre_completo.trim()) { toast('El nombre no puede estar vacío.', 'advertencia'); return; }
    if (!usuario.id) { toast('No se puede identificar al usuario.', 'error'); return; }
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: usuario.nombre_completo.trim(), turno: usuario.turno }),
      });
      const data = await res.json();
      if (res.ok) {
        const ahora = new Date().toISOString();
        // Propaga el cambio al contexto → Layout y demás componentes se actualizan sin recargar
        actualizarUsuario({
          nombre:          usuario.nombre_completo.trim(),
          nombre_completo: usuario.nombre_completo.trim(),
          turno:           usuario.turno,
        });
        localStorage.setItem('perfil_actualizado_en', ahora);
        setUltimaActualizacion(ahora);
        toast('Perfil actualizado correctamente.', 'exito');
      } else {
        toast(data.detail || 'Error al guardar los cambios.', 'error');
      }
    } catch { toast('Error de conexión con el servidor.', 'error'); }
    finally { setGuardando(false); }
  };

  // ── Cambiar contraseña ────────────────────────────────────────────────────
  const handleCambiarPassword = async (e) => {
    e.preventDefault();
    if (!pass.actual || !pass.nueva || !pass.confirmar) { toast('Completa todos los campos de contraseña.', 'advertencia'); return; }
    if (pass.nueva.length < 6) { toast('La nueva contraseña debe tener al menos 6 caracteres.', 'advertencia'); return; }
    if (pass.nueva !== pass.confirmar) { toast('Las contraseñas nuevas no coinciden.', 'advertencia'); return; }
    if (!usuario.id) { toast('No se puede identificar al usuario.', 'error'); return; }
    setCambiandoPass(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/cambiar-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_actual: pass.actual, password_nueva: pass.nueva }),
      });
      const data = await res.json();
      if (res.ok) {
        setPass({ actual: '', nueva: '', confirmar: '' });
        toast('Contraseña actualizada correctamente.', 'exito');
      } else {
        toast(data.detail || 'Error al cambiar la contraseña.', 'error');
      }
    } catch { toast('Error de conexión con el servidor.', 'error'); }
    finally { setCambiandoPass(false); }
  };

  // ── Eliminar cuenta (Propia) ──────────────────────────────────────────────
  const handleEliminarCuenta = async () => {
    if (!usuario.id) { toast('No se puede identificar al usuario.', 'error'); return; }
    setEliminando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}?admin_correo=${encodeURIComponent(usuario.correo)}`, { method: 'DELETE' });
      if (res.ok) {
        localStorage.removeItem('usuarioLogueado');
        localStorage.removeItem('perfil_actualizado_en');
        toast('Cuenta eliminada correctamente.', 'exito');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        const data = await res.json();
        toast(data.detail || 'Error al eliminar la cuenta.', 'error');
        setMostrarConfirmacion(false);
      }
    } catch { toast('Error de conexión con el servidor.', 'error'); setMostrarConfirmacion(false); }
    finally { setEliminando(false); }
  };

  // ── Eliminar otro usuario (Admin) ─────────────────────────────────────────
  const handleEliminarOtroUsuario = async () => {
    if (!usuarioAEliminar) return;
    setEliminando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuarioAEliminar.id}?admin_correo=${encodeURIComponent(usuario.correo)}`, { method: 'DELETE' });
      if (res.ok) {
        setUsuarios(prev => prev.filter(u => u.id !== usuarioAEliminar.id));
        toast(`Usuario eliminado correctamente.`, 'exito');
        setUsuarioAEliminar(null);
      } else {
        const data = await res.json();
        toast(data.detail || 'Error al eliminar usuario.', 'error');
      }
    } catch { toast('Error de conexión con el servidor.', 'error'); }
    finally { setEliminando(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const inicial    = (usuario.nombre_completo || 'U').charAt(0).toUpperCase();
  const turnoLabel = TURNO_LABEL[usuario.turno?.toLowerCase()] || usuario.turno || 'No asignado';
  const togglePass = (field) => setMostrarPass(p => ({ ...p, [field]: !p[field] }));

  const fortaleza = useMemo(() => {
    const v = pass.nueva;
    if (!v) return { nivel: 0, label: '', color: '' };
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const niveles = [
      { nivel: 1, label: 'Muy débil', color: 'bg-red-500' },
      { nivel: 2, label: 'Débil',     color: 'bg-orange-400' },
      { nivel: 3, label: 'Media',     color: 'bg-amber-400' },
      { nivel: 4, label: 'Fuerte',    color: 'bg-green-500' },
    ];
    return niveles[score - 1] || { nivel: 0, label: '', color: '' };
  }, [pass.nueva]);

  return (
    <div className="space-y-5 font-manrope max-w-[1300px] mx-auto">

      {/* ══ CABECERA COMPACTA ══════════════════════════════════════════════════ */}
      <div className="rounded-2xl overflow-hidden shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #1c355e 55%, #1a3a6b 100%)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(to right, #fdbb11 0%, #ffe066 40%, transparent 100%)' }} />

        <div className="px-7 py-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/20 shadow-xl"
              style={{ background: 'linear-gradient(145deg, #243d6b 0%, #1a2f55 100%)' }}>
              <span className="text-3xl font-black text-white">{inicial}</span>
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-[#0a1628]" />
          </div>

          {/* Datos principales */}
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#fdbb11' }}>
              Universidad Latino · SIPREF
            </p>
            <h1 className="text-xl font-black text-white leading-tight capitalize">
              {usuario.nombre_completo || 'Usuario'}
            </h1>
            <p className="text-white/50 text-xs mt-0.5">{usuario.correo || '—'}</p>

            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="material-symbols-outlined text-[11px]">school</span>
                Prefecto
              </span>
              {usuario.turno && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(253,187,17,0.12)', color: '#fdbb11', border: '1px solid rgba(253,187,17,0.3)' }}>
                  <span className="material-symbols-outlined text-[11px]">schedule</span>
                  {turnoLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.12)', color: '#86efac', border: '1px solid rgba(74,222,128,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                En línea
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ LAYOUT DE DOS COLUMNAS ═════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">

        {/* ── COLUMNA IZQUIERDA ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* ── EDITAR PERFIL ────────────────────────────────────────────────── */}
          <form onSubmit={handleGuardar} className="bg-white border border-[#c5c6cf]/40 rounded-[24px] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-7 py-5 border-b border-[#c5c6cf]/30 bg-gradient-to-r from-[#faf9fc] to-white flex items-center gap-4">
              <div className="w-10 h-10 rounded-[14px] bg-[#1c355e] flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-white text-[20px]">manage_accounts</span>
              </div>
              <div>
                <h2 className="text-base font-black text-[#1b1c1e] tracking-tight">Información del Perfil</h2>
                <p className="text-xs text-[#75777f] font-medium mt-0.5">Datos personales y configuración de cuenta</p>
              </div>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Nombre Completo</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px] transition-colors group-focus-within:text-[#1c355e]">person</span>
                  <input type="text" value={usuario.nombre_completo}
                    onChange={e => setUsuario({ ...usuario, nombre_completo: e.target.value })}
                    placeholder="Tu nombre completo"
                    className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf]/60 rounded-xl text-sm font-medium text-[#1b1c1e] placeholder:text-[#c5c6cf] bg-white focus:outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] transition-all" />
                </div>
              </div>

              {/* Correo */}
              <div>
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Correo Institucional</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px]">mail</span>
                  <input type="email" value={usuario.correo} disabled
                    className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf]/30 rounded-xl text-sm font-medium text-[#75777f] bg-[#f4f3f6] cursor-not-allowed" />
                </div>
                <p className="text-[10px] text-[#75777f] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">lock</span>No se puede modificar.
                </p>
              </div>

              {/* Turno */}
              <div>
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Turno Asignado</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px] transition-colors group-focus-within:text-[#1c355e]">schedule</span>
                  <select value={usuario.turno} onChange={e => setUsuario({ ...usuario, turno: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf]/60 rounded-xl text-sm font-medium text-[#1b1c1e] bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] transition-all">
                    <option value="">Seleccionar turno...</option>
                    <option value="matutino">Turno Matutino</option>
                    <option value="vespertino">Turno Vespertino</option>
                    <option value="ambos">Ambos Turnos</option>
                  </select>
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Cargo / Rol</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px]">badge</span>
                  <input value="Prefecto Universitario" disabled
                    className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf]/30 rounded-xl text-sm font-medium text-[#75777f] bg-[#f4f3f6] cursor-not-allowed" />
                </div>
              </div>

              {/* Departamento */}
              <div>
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Departamento</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px]">corporate_fare</span>
                  <input value="Prefectura Universitaria" disabled
                    className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf]/30 rounded-xl text-sm font-medium text-[#75777f] bg-[#f4f3f6] cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="px-7 py-5 border-t border-[#c5c6cf]/30 bg-[#faf9fc] flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-[#75777f] font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-500 text-[16px]">verified_user</span>
                Datos cifrados y almacenados de forma segura.
              </p>
              <button type="submit" disabled={guardando}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-[14px] text-sm font-bold transition-all ${
                  guardando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#1c355e] hover:bg-[#0e1f3d] text-white shadow-lg shadow-[#1c355e]/20 hover:-translate-y-0.5'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{guardando ? 'hourglass_empty' : 'save'}</span>
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>

          {/* ── CAMBIO DE CONTRASEÑA ─────────────────────────────────────────── */}
          <form onSubmit={handleCambiarPassword} className="bg-white border border-[#c5c6cf]/40 rounded-[24px] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-7 py-5 border-b border-[#c5c6cf]/30 bg-gradient-to-r from-[#faf9fc] to-white flex items-center gap-4">
              <div className="w-10 h-10 rounded-[14px] bg-[#1c355e]/10 border border-[#1c355e]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1c355e] text-[20px]">lock_reset</span>
              </div>
              <div>
                <h2 className="text-base font-black text-[#1b1c1e] tracking-tight">Seguridad · Contraseña</h2>
                <p className="text-xs text-[#75777f] font-medium mt-0.5">Actualiza tu credencial de acceso al sistema</p>
              </div>
            </div>

            <div className="px-7 py-6 space-y-5">
              {/* Contraseña actual */}
              <div>
                <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Contraseña Actual</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px] transition-colors group-focus-within:text-[#1c355e]">key</span>
                  <input type={mostrarPass.actual ? 'text' : 'password'} value={pass.actual}
                    onChange={e => setPass(p => ({ ...p, actual: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 border border-[#c5c6cf]/60 rounded-xl text-sm font-medium text-[#1b1c1e] bg-white focus:outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] transition-all" />
                  <button type="button" onClick={() => togglePass('actual')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c5c6cf] hover:text-[#44464e] transition-colors">
                    <span className="material-symbols-outlined text-[18px]">{mostrarPass.actual ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nueva contraseña */}
                <div>
                  <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Nueva Contraseña</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[17px] transition-colors group-focus-within:text-[#1c355e]">lock</span>
                    <input type={mostrarPass.nueva ? 'text' : 'password'} value={pass.nueva}
                      onChange={e => setPass(p => ({ ...p, nueva: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-10 py-3 border border-[#c5c6cf]/60 rounded-xl text-sm font-medium text-[#1b1c1e] bg-white focus:outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] transition-all" />
                    <button type="button" onClick={() => togglePass('nueva')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c5c6cf] hover:text-[#44464e] transition-colors">
                      <span className="material-symbols-outlined text-[18px]">{mostrarPass.nueva ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {pass.nueva && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(n => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= fortaleza.nivel ? fortaleza.color : 'bg-[#e8e8ef]'}`} />
                        ))}
                      </div>
                      {fortaleza.label && <p className="text-[10px] font-semibold text-[#75777f]">Fortaleza: {fortaleza.label}</p>}
                    </div>
                  )}
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label className="block text-[10px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Confirmar Contraseña</label>
                  <div className="relative group">
                    <span className={`material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] transition-colors ${
                      pass.confirmar && pass.nueva !== pass.confirmar ? 'text-red-400' :
                      pass.confirmar && pass.nueva === pass.confirmar  ? 'text-green-500' :
                      'text-[#c5c6cf] group-focus-within:text-[#1c355e]'
                    }`}>lock</span>
                    <input type={mostrarPass.confirmar ? 'text' : 'password'} value={pass.confirmar}
                      onChange={e => setPass(p => ({ ...p, confirmar: e.target.value }))}
                      placeholder="Repite la contraseña"
                      className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm font-medium text-[#1b1c1e] bg-white focus:outline-none focus:ring-2 transition-all ${
                        pass.confirmar && pass.nueva !== pass.confirmar
                          ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                          : 'border-[#c5c6cf]/60 focus:ring-[#1c355e]/15 focus:border-[#1c355e]'
                      }`} />
                    <button type="button" onClick={() => togglePass('confirmar')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c5c6cf] hover:text-[#44464e] transition-colors">
                      <span className="material-symbols-outlined text-[18px]">{mostrarPass.confirmar ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  </div>
                  {pass.confirmar && pass.nueva !== pass.confirmar && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">error</span>
                      Las contraseñas no coinciden.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={cambiandoPass}
                  className={`flex items-center gap-2 px-7 py-3 rounded-[14px] text-sm font-bold transition-all ${
                    cambiandoPass ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-2 border-[#1c355e] text-[#1c355e] hover:bg-[#1c355e] hover:text-white shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  }`}>
                  <span className="material-symbols-outlined text-[18px]">{cambiandoPass ? 'hourglass_empty' : 'key'}</span>
                  {cambiandoPass ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </div>
          </form>

          {/* ── ZONA DE PELIGRO ──────────────────────────────────────────────── */}
          <div className="rounded-[24px] overflow-hidden border border-red-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="px-7 py-5 flex items-center gap-4 border-b border-red-200"
              style={{ background: 'linear-gradient(135deg, #fff1f1 0%, #fff5f5 100%)' }}>
              <div className="w-10 h-10 rounded-[14px] bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-red-600 text-[20px]">warning</span>
              </div>
              <div>
                <h2 className="text-base font-black text-red-700 tracking-tight">Zona de Peligro</h2>
                <p className="text-xs text-red-500 font-medium mt-0.5">Acciones destructivas permanentes e irreversibles.</p>
              </div>
            </div>
            <div className="bg-white px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <p className="text-base font-bold text-[#1b1c1e]">Eliminar cuenta permanentemente</p>
                <p className="text-sm text-[#75777f]">Se borrarán todos tus datos, historiales y configuraciones.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
                  {['Historial borrado', 'Acceso revocado', 'Sin recuperación'].map(item => (
                    <span key={item} className="text-xs font-bold text-red-400 flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-[14px]">close</span>{item}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setMostrarConfirmacion(true)}
                className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-[14px] bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-sm font-bold transition-all hover:shadow-lg hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* ── PANEL USUARIOS REGISTRADOS ───────────────────────────────────── */}
          <div className="bg-white border border-[#c5c6cf]/40 rounded-[24px] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#c5c6cf]/30 bg-gradient-to-r from-[#faf9fc] to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-[#1c355e] flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-white text-[20px]">group</span>
                </div>
                <div>
                  <h2 className="text-base font-black text-[#1b1c1e] tracking-tight">Usuarios Registrados</h2>
                  <p className="text-xs text-[#75777f] font-medium mt-0.5">Personal con acceso al sistema</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#1c355e]/8 text-[#1c355e] border border-[#1c355e]/15">
                {usuarios.length}
              </span>
            </div>

            {/* Lista de usuarios (max 8 visibles + scroll) */}
            <div className="overflow-y-auto divide-y divide-[#f0f0f4]" style={{ maxHeight: '360px' }}>
              {usuarios.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-3xl text-[#c5c6cf] block mb-2">group</span>
                  <p className="text-xs font-semibold text-[#75777f]">Sin usuarios registrados</p>
                </div>
              ) : (
                usuarios.map(u => {
                  const esMismo = u.id === usuario.id;
                  const turnoU  = TURNO_LABEL[u.turno?.toLowerCase()] || u.turno || '—';
                  return (
                    <div key={u.id}
                      className={`px-5 py-3 flex items-center gap-3 transition-colors hover:bg-[#faf9fc] ${esMismo ? 'bg-[#1c355e]/3' : ''}`}>
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          esMismo ? 'bg-[#1c355e] text-white' : 'bg-[#f4f3f6] text-[#44464e]'
                        }`}>
                          {(u.nombre || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${esMismo ? 'bg-green-400' : 'bg-[#c5c6cf]'}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-[#1b1c1e] truncate capitalize">{u.nombre}</p>
                          {esMismo && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#1c355e]/10 text-[#1c355e] flex-shrink-0">Tú</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#75777f] truncate">{u.correo}</p>
                      </div>

                      {/* Estado / Acciones */}
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <div className="text-right space-y-1">
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            esMismo ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-[#f4f3f6] text-[#75777f] border border-[#c5c6cf]/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${esMismo ? 'bg-green-400 animate-pulse' : 'bg-[#c5c6cf]'}`} />
                            {esMismo ? 'En línea' : 'Desconectado'}
                          </span>
                          {u.turno && <p className="text-[9px] text-[#75777f] font-medium">{turnoU}</p>}
                        </div>
                        {esAdmin && !esMismo && (
                          <button
                            onClick={() => setUsuarioAEliminar(u)}
                            title="Eliminar usuario del sistema"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 transition-colors border border-transparent hover:border-red-600"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#c5c6cf]/30 bg-[#faf9fc] flex items-center justify-between">
              <p className="text-xs text-[#75777f] font-bold">
                {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
              </p>
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                1 en línea
              </span>
            </div>
          </div>

          {/* ── ACTIVIDAD RECIENTE ───────────────────────────────────────────── */}
          <div className="bg-white border border-[#c5c6cf]/40 rounded-[24px] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="px-6 py-5 border-b border-[#c5c6cf]/30 bg-gradient-to-r from-[#faf9fc] to-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#1c9c72]/10 border border-[#1c9c72]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#1c9c72] text-[20px]">history</span>
              </div>
              <div>
                <h2 className="text-base font-black text-[#1b1c1e] tracking-tight">Actividad Reciente</h2>
                <p className="text-xs text-[#75777f] font-medium mt-0.5">Registro de accesos y cambios</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {[
                { icon: 'login',      color: 'text-[#1c355e] bg-[#1c355e]/8 border border-[#1c355e]/10', label: 'Último inicio de sesión',      valor: fmtFechaHora(usuario.logged_at)      },
                { icon: 'edit',       color: 'text-amber-600 bg-amber-50 border border-amber-200',     label: 'Última actualización de perfil', valor: fmtFechaHora(ultimaActualizacion)    },
                { icon: 'person_add', color: 'text-[#1c9c72] bg-[#1c9c72]/8 border border-[#1c9c72]/10',  label: 'Fecha de registro',             valor: fmtFecha(usuario.created_at)         },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-4 py-2 border-b border-[#f0f0f4] last:border-none">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color}`}>
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#75777f] uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-black text-[#1b1c1e] truncate mt-0.5">{item.valor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL DE CONFIRMACIÓN ══════════════════════════════════════════════ */}
      {(mostrarConfirmacion || usuarioAEliminar) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-8 pt-8 pb-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4 border border-red-200">
                <span className="material-symbols-outlined text-red-600 text-3xl">warning</span>
              </div>
              <h2 className="text-lg font-black text-[#1b1c1e]">
                {mostrarConfirmacion ? '¿Eliminar tu cuenta?' : `¿Eliminar a ${usuarioAEliminar?.nombre}?`}
              </h2>
              <p className="text-sm text-[#75777f] mt-2 leading-relaxed">
                Esta acción es <span className="font-bold text-red-600">permanente e irreversible</span>. 
                {mostrarConfirmacion 
                  ? ' No podrás recuperar tu cuenta ni tus datos.' 
                  : ' El usuario perderá su acceso al sistema inmediatamente.'}
              </p>
            </div>
            <div className="mx-8 mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-[11px] text-red-600 font-semibold text-center">
                Esta acción se aplicará de inmediato.
              </p>
            </div>
            <div className="px-8 pb-8 flex gap-3">
              <button 
                onClick={() => { setMostrarConfirmacion(false); setUsuarioAEliminar(null); }} 
                disabled={eliminando}
                className="flex-1 py-3 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all disabled:opacity-50">
                Cancelar
              </button>
              <button 
                onClick={mostrarConfirmacion ? handleEliminarCuenta : handleEliminarOtroUsuario} 
                disabled={eliminando}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20">
                <span className="material-symbols-outlined text-[17px]">{eliminando ? 'hourglass_empty' : 'delete_forever'}</span>
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
