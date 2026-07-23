import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '../components/useToast';
import { useTime } from '../components/TimeContext';

export default function GestionAulas() {
  const { toast, toasts } = useToast();
  const ahora = useTime();
  const [confirmacion, setConfirmacion] = useState(null);

  const [aulas, setAulas] = useState([]);
  // ocupacion por horario programado: { "A24": { matutino: true, vespertino: true } }
  const [ocupacion, setOcupacion] = useState({});
  // clases: clases que están en sesión AHORA MISMO
  const [clases, setClases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  // Estado para el modal de mantenimiento
  const [modalMantAula, setModalMantAula] = useState(null);
  const [formMant, setFormMant] = useState({ en_mantenimiento: false, inicio_mantenimiento: '', fin_mantenimiento: '', aula_temporal: '' });
  const [guardandoMant, setGuardandoMant] = useState(false);

  // Estado para el modal de edición
  const [aulaAEditar, setAulaAEditar] = useState(null);
  const [formEditar, setFormEditar] = useState({ nombre: '', edificio: '', capacidad: '', equipos: [] });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [formData, setFormData] = useState({ nombre: '', edificio: '', capacidad: '', equipos: [] });

  const [estadoAcademico, setEstadoAcademico] = useState({ semestral: null, cuatrimestral: null });
  const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const fetchEstado = async () => {
      try {
        const [resSem, resCuat] = await Promise.all([
          fetch(`/api/estado-academico?plan=semestral&fecha=${hoyStr}`),
          fetch(`/api/estado-academico?plan=cuatrimestral&fecha=${hoyStr}`)
        ]);
        if (resSem.ok && resCuat.ok) {
          setEstadoAcademico({
            semestral: await resSem.json(),
            cuatrimestral: await resCuat.json()
          });
        }
      } catch (e) {
        console.error("Error al cargar estado académico:", e);
      }
    };
    fetchEstado();
  }, [hoyStr]);

  const fetchAulas = async () => {
    try {
      const r = await fetch('/api/aulas');
      if (r.ok) setAulas(await r.json());
    } catch (e) { console.error("Error al cargar aulas:", e); }
  };

  const fetchOcupacion = async () => {
    try {
      const r = await fetch('/api/aulas/ocupacion');
      if (r.ok) setOcupacion(await r.json());
    } catch (e) { console.error("Error al cargar ocupación:", e); }
    finally { setCargando(false); }
  };

  const fetchClasesAhora = async (t) => {
    const ref = t || ahora;
    const dia  = ref.getDay();
    const mins = ref.getHours() * 60 + ref.getMinutes();
    const refFechaStr = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
    try {
      const r = await fetch(`/api/clases-hoy?dia=${dia}&mins=${mins}&fecha=${refFechaStr}`);
      if (r.ok) setClases(await r.json());
    } catch (e) { console.error("Error al cargar clases en tiempo real:", e); }
  };

  // Carga inicial + refresco cada 30 s
  useEffect(() => {
    fetchAulas();
    fetchOcupacion();
    fetchClasesAhora(ahora);
    const intervalo = setInterval(() => {
      fetchAulas();
      fetchOcupacion();
      fetchClasesAhora(ahora);
    }, 30000);
    return () => clearInterval(intervalo);
  }, [hoyStr]);

  // Re-evalúa clases en tiempo real cuando el reloj del contexto avanza (cada 60 s)
  useEffect(() => { fetchClasesAhora(ahora); }, [ahora]);

  /** Clase activa en este momento para un aula específica (puede ser null). */
  const obtenerClaseEnCurso = (nombreAula) =>
    clases.find(c => c.aula_asignada === nombreAula) || null;

  /**
   * Estado de ocupación basado en horarios programados (semana completa).
   * 'disponible' | 'matutino' | 'vespertino' | 'bloqueada'
   */
  const obtenerEstadoAula = (nombreAula) => {
    const datos = ocupacion[nombreAula];
    if (!datos) return 'disponible';
    if (datos.matutino && datos.vespertino) return 'bloqueada';
    if (datos.matutino)   return 'matutino';
    if (datos.vespertino) return 'vespertino';
    return 'disponible';
  };

  // Mantenimiento vigente = flag true Y dentro del rango [inicio, fin]
  const estaEnMantenimiento = (aula) => {
    if (!aula.en_mantenimiento) return false;
    const ahora = new Date();
    if (aula.inicio_mantenimiento && new Date(aula.inicio_mantenimiento) > ahora) return false;
    if (aula.fin_mantenimiento && new Date(aula.fin_mantenimiento) < ahora) return false;
    return true;
  };

  // Mantenimiento programado = flag true PERO inicio es futuro
  const tieneMantProgramado = (aula) => {
    if (!aula.en_mantenimiento) return false;
    if (!aula.inicio_mantenimiento) return false;
    return new Date(aula.inicio_mantenimiento) > new Date();
  };

  const handleEliminar = (id) => {
    setConfirmacion({
      mensaje: "¿Estás seguro de que deseas eliminar esta aula?",
      onConfirmar: async () => {
        try {
          const response = await fetch(`/api/aulas/${id}`, { method: 'DELETE' });
          if (response.ok) { fetchAulas(); toast("Aula eliminada con éxito", "exito"); }
          else toast("Error al eliminar el aula", "error");
        } catch { toast("Error de conexión con el servidor", "error"); }
      }
    });
  };

  const abrirModalEditar = (aula) => {
    setAulaAEditar(aula);
    setFormEditar({
      nombre: aula.nombre,
      edificio: aula.edificio || '',
      capacidad: aula.capacidad || '',
      equipos: Array.isArray(aula.equipos) ? [...aula.equipos] : [],
    });
  };

  const handleCheckboxEditarChange = (equipo) => {
    setFormEditar(prev => ({
      ...prev,
      equipos: prev.equipos.includes(equipo)
        ? prev.equipos.filter(e => e !== equipo)
        : [...prev.equipos, equipo],
    }));
  };

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    if (!formEditar.nombre.trim()) {
      toast("El nombre del aula es obligatorio", "advertencia");
      return;
    }
    setGuardandoEdicion(true);
    try {
      const response = await fetch(`/api/aulas/${aulaAEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formEditar.nombre.trim(),
          edificio: formEditar.edificio,
          capacidad: Number(formEditar.capacidad) || 0,
          equipos: formEditar.equipos,
          estado: aulaAEditar.estado || 'Activo',
        }),
      });
      if (response.ok) {
        setAulaAEditar(null);
        fetchAulas();
        toast("Aula actualizada con éxito", "exito");
      } else {
        const err = await response.json().catch(() => ({}));
        toast(err.detail || "Error al actualizar el aula", "error");
      }
    } catch {
      toast("Error de conexión con el servidor", "error");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const abrirModalMant = (aula) => {
    setModalMantAula(aula);
    setFormMant({
      en_mantenimiento: aula.en_mantenimiento || false,
      inicio_mantenimiento: aula.inicio_mantenimiento ? aula.inicio_mantenimiento.slice(0, 16) : '',
      fin_mantenimiento: aula.fin_mantenimiento ? aula.fin_mantenimiento.slice(0, 16) : '',
      aula_temporal: aula.aula_temporal || ''
    });
  };

  const handleGuardarMant = async () => {
    if (!modalMantAula) return;
    setGuardandoMant(true);
    try {
      const response = await fetch(`/api/aulas/${modalMantAula.id}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          en_mantenimiento: formMant.en_mantenimiento,
          inicio_mantenimiento: formMant.en_mantenimiento && formMant.inicio_mantenimiento ? formMant.inicio_mantenimiento : null,
          fin_mantenimiento: formMant.en_mantenimiento && formMant.fin_mantenimiento ? formMant.fin_mantenimiento : null,
          aula_temporal: formMant.en_mantenimiento ? formMant.aula_temporal : null,
        }),
      });
      if (response.ok) {
        setModalMantAula(null);
        fetchAulas();
        toast("Estado de mantenimiento actualizado", "exito");
      } else {
        const err = await response.json().catch(() => ({}));
        toast(err.detail || "Error al guardar mantenimiento", "error");
      }
    } catch (error) {
      console.error("Error al guardar mantenimiento:", error);
      toast("Error de conexión con el servidor", "error");
    } finally {
      setGuardandoMant(false);
    }
  };

  const handleCheckboxChange = (equipo) => {
    setFormData(prev => ({
      ...prev,
      equipos: prev.equipos.includes(equipo)
        ? prev.equipos.filter(e => e !== equipo)
        : [...prev.equipos, equipo]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre) {
      toast("El nombre del aula es obligatorio", "advertencia");
      return;
    }
    try {
      const response = await fetch('/api/aulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: formData.nombre, edificio: formData.edificio, capacidad: 0, equipos: formData.equipos, estado: "Activo" })
      });
      if (response.ok) {
        setFormData({ nombre: '', edificio: '', capacidad: '', equipos: [] });
        setMostrarFormulario(false);
        fetchAulas();
        toast("Aula registrada con éxito", "exito");
      }
    } catch (error) {
      console.error("Error al guardar el aula", error);
      toast("Error al registrar el aula", "error");
    }
  };

  const aulasFiltradas = aulas.filter(aula => {
    if (filtro === 'mantenimiento') return estaEnMantenimiento(aula);
    if (filtro === 'en_curso') return !estaEnMantenimiento(aula) && !!obtenerClaseEnCurso(aula.nombre);
    return true;
  }).sort((a, b) => {
    const aEsLab = a.nombre.toLowerCase().startsWith('lab');
    const bEsLab = b.nombre.toLowerCase().startsWith('lab');
    if (aEsLab && !bEsLab) return 1;
    if (!aEsLab && bEsLab) return -1;
    return a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' });
  });

  const esLaboratorio = (nombre) => nombre.toLowerCase().startsWith('lab');
  const aulasNormales = aulas.filter(a => !esLaboratorio(a.nombre));
  const laboratorios  = aulas.filter(a => esLaboratorio(a.nombre));

  const totalAulas         = aulasNormales.length;
  const capacidadInstalada = aulasNormales.reduce((t, a) => t + (Number(a.capacidad) || 0), 0);
  const aulasEnClaseAhora  = aulasNormales.filter(a => !estaEnMantenimiento(a) && !!obtenerClaseEnCurso(a.nombre)).length;
  const aulasDisponibles   = aulasNormales.filter(a => !estaEnMantenimiento(a) && obtenerEstadoAula(a.nombre) === 'disponible').length;
  const aulasEnMant        = aulasNormales.filter(a => estaEnMantenimiento(a)).length;

  const totalLaboratorios = laboratorios.length;
  const labsEnUso = laboratorios.filter(a => !estaEnMantenimiento(a) && !!obtenerClaseEnCurso(a.nombre)).length;

  // Nombres de aulas disponibles para el dropdown de aula temporal
  const nombresAulas = aulas.map(a => a.nombre).filter(n => n !== modalMantAula?.nombre);

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-4">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1c355e] tracking-tight">Registro Global de Aulas</h1>
          <p className="text-base text-[#44464e] mt-1.5">Consulte y gestione todos los espacios en tiempo real.</p>
        </div>
        <button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          className="bg-[#1c355e] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all flex items-center gap-2 w-fit"
        >
          <span className="material-symbols-outlined">add_circle</span> Nueva Aula
        </button>
      </div>



      {/* MODAL NUEVA AULA */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#1c355e]">Nueva Aula / Espacio</h3>
              <button onClick={() => setMostrarFormulario(false)} className="text-[#44464e] hover:text-[#1c355e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Nombre del Aula</label>
                <input required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" placeholder="Ej. A101" type="text" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Planta <span className="text-[#c5c6cf] font-normal normal-case">(opcional)</span></label>
                <select value={formData.edificio} onChange={e => setFormData({...formData, edificio: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm">
                  <option value="">Sin planta asignada</option>
                  <option>Planta A</option>
                  <option>Planta B</option>
                  <option>Planta C</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Equipamiento</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Proyector', 'Aire Acond.', 'PCs', 'Smart Board'].map((item) => (
                    <label key={item} className="flex items-center gap-3 p-3 border border-[#c5c6cf]/30 rounded-xl cursor-pointer hover:bg-[#f4f3f6]">
                      <input type="checkbox" checked={formData.equipos.includes(item)} onChange={() => handleCheckboxChange(item)} className="rounded text-[#1c355e]" />
                      <span className="text-sm font-medium">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-[#1c355e] text-white py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all">Registrar Espacio</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR AULA */}
      {aulaAEditar && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#1c355e]">Editar Aula</h3>
              <button onClick={() => setAulaAEditar(null)} className="text-[#44464e] hover:text-[#1c355e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form className="space-y-5" onSubmit={handleGuardarEdicion}>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Nombre del Aula</label>
                <input
                  required
                  type="text"
                  value={formEditar.nombre}
                  onChange={e => setFormEditar({ ...formEditar, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                  placeholder="Ej. A101"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Planta <span className="text-[#c5c6cf] font-normal normal-case">(opcional)</span></label>
                <select
                  value={formEditar.edificio}
                  onChange={e => setFormEditar({ ...formEditar, edificio: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                >
                  <option value="">Sin planta asignada</option>
                  <option>Planta A</option>
                  <option>Planta B</option>
                  <option>Planta C</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Capacidad</label>
                <input
                  type="number"
                  min="0"
                  value={formEditar.capacidad}
                  onChange={e => setFormEditar({ ...formEditar, capacidad: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                  placeholder="Ej. 30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Equipamiento</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Proyector', 'Aire Acond.', 'PCs', 'Smart Board'].map((item) => (
                    <label key={item} className="flex items-center gap-3 p-3 border border-[#c5c6cf]/30 rounded-xl cursor-pointer hover:bg-[#f4f3f6]">
                      <input
                        type="checkbox"
                        checked={formEditar.equipos.includes(item)}
                        onChange={() => handleCheckboxEditarChange(item)}
                        className="rounded text-[#1c355e]"
                      />
                      <span className="text-sm font-medium">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAulaAEditar(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="flex-1 py-2.5 rounded-xl bg-[#1c355e] text-white text-sm font-bold hover:bg-[#152a4a] transition-all disabled:opacity-50"
                >
                  {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MANTENIMIENTO */}
      {modalMantAula && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1c355e]">Modo Mantenimiento</h3>
                <p className="text-sm text-[#75777f] mt-0.5">Aula: <span className="font-bold text-[#44464e]">{modalMantAula.nombre}</span></p>
              </div>
              <button onClick={() => setModalMantAula(null)} className="text-[#44464e] hover:text-[#1c355e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Toggle mantenimiento */}
              <label className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-orange-500">construction</span>
                  <div>
                    <p className="text-sm font-bold text-[#1b1c1e]">Activar Mantenimiento</p>
                    <p className="text-xs text-[#75777f]">Las clases se redirigirán al aula temporal</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formMant.en_mantenimiento}
                  onChange={e => setFormMant(prev => ({ ...prev, en_mantenimiento: e.target.checked }))}
                  className="w-5 h-5 rounded accent-orange-500 cursor-pointer"
                />
              </label>

              {formMant.en_mantenimiento && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Fecha y Hora de Inicio</label>
                      <input
                        type="datetime-local"
                        value={formMant.inicio_mantenimiento}
                        onChange={e => setFormMant(prev => ({ ...prev, inicio_mantenimiento: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Fecha y Hora de Fin</label>
                      <input
                        type="datetime-local"
                        value={formMant.fin_mantenimiento}
                        onChange={e => setFormMant(prev => ({ ...prev, fin_mantenimiento: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Aula Temporal / Alterna</label>
                    <select
                      value={formMant.aula_temporal}
                      onChange={e => setFormMant(prev => ({ ...prev, aula_temporal: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                    >
                      <option value="">Sin aula alterna</option>
                      {nombresAulas.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalMantAula(null)} className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all">
                  Cancelar
                </button>
                <button onClick={handleGuardarMant} disabled={guardandoMant} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all disabled:opacity-50">
                  {guardandoMant ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANNER CALENDARIO ACADÉMICO */}
      {(!((estadoAcademico.semestral?.hay_clases !== false || estadoAcademico.cuatrimestral?.hay_clases !== false) && ahora.getDay() !== 0)) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800">
          <span className="material-symbols-outlined text-amber-600 text-2xl">event_busy</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Calendario Académico Institucional</p>
            <p className="text-sm font-semibold">
              {estadoAcademico.semestral?.descripcion || estadoAcademico.cuatrimestral?.descripcion || (ahora.getDay() === 0 ? 'Domingo (Sin Actividad Académica)' : 'Día sin clases regulares programadas')}
            </p>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="flex gap-3 flex-wrap">
        {[
          { id: 'todos',         label: 'Todos'         },
          { id: 'en_curso',      label: 'En Curso'      },
          { id: 'mantenimiento', label: 'Mantenimiento' },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => setFiltro(btn.id)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
              filtro === btn.id
                ? 'bg-[#1c355e] text-white'
                : 'bg-white border border-[#c5c6cf]/30 text-[#44464e] hover:border-[#1c355e]/50'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── CONTENEDOR PRINCIPAL: AULAS (Izquierda/Centro) y ESTADÍSTICAS (Derecha) ── */}
      <div className="flex flex-col xl:flex-row gap-8 items-stretch">
        
        {/* ── LISTA DE AULAS ──────────────────────────────────────────────── */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cargando ? (
          <p className="col-span-full text-center">Cargando datos...</p>
        ) : aulasFiltradas.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#c5c6cf]/30">Sin Aulas en esta categoría</div>
        ) : (
          aulasFiltradas.map((aula) => {
            const enMant        = estaEnMantenimiento(aula);
            const mantProg      = tieneMantProgramado(aula);
            const claseActiva   = !enMant ? obtenerClaseEnCurso(aula.nombre) : null;
            const estadoHorario = enMant ? 'mantenimiento' : obtenerEstadoAula(aula.nombre);

            // Prioridad visual: mantenimiento > mant_programado > en_clase > estado por horario
            const BADGE = {
              mantenimiento:   { cls: 'bg-orange-100 text-orange-600',  icon: 'construction',    label: 'Mantenimiento' },
              mant_programado: { cls: 'bg-yellow-100 text-yellow-700',  icon: 'event_upcoming',  label: 'Mant. Programado' },
              en_clase:        { cls: 'bg-blue-100 text-blue-700',      icon: 'play_circle',     label: 'En Curso'      },
              disponible:      { cls: 'bg-[#1c9c72]/10 text-[#1c9c72]', icon: 'check_circle',   label: 'Disponible'    },
              matutino:        { cls: 'bg-amber-100 text-amber-700',    icon: 'wb_sunny',        label: 'Ocupado: Matutino'  },
              vespertino:      { cls: 'bg-indigo-100 text-indigo-700',  icon: 'nights_stay',     label: 'Ocupado: Vespertino' },
              bloqueada:       { cls: 'bg-purple-100 text-purple-700',  icon: 'domain',          label: 'Ocupado: Ambos'     },
            };
            const badgeKey = enMant ? 'mantenimiento' : mantProg ? 'mant_programado' : claseActiva ? 'en_clase' : estadoHorario;
            const badge    = BADGE[badgeKey] || BADGE.disponible;

            const borderClass = enMant        ? 'border-orange-200'
                              : mantProg      ? 'border-yellow-300 border-dashed'
                              : claseActiva   ? 'border-blue-300'
                              : estadoHorario === 'bloqueada' ? 'border-red-200'
                              : 'border-[#c5c6cf]/30';

            return (
              <div key={aula.id} className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${borderClass}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-[#1b1c1e]">{aula.nombre}</h2>
                    {claseActiva && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 shadow-sm" />}
                  </div>
                  {mantProg && aula.inicio_mantenimiento && (
                    <p className="text-[10px] text-yellow-700 font-semibold flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      Inicia: {new Date(aula.inicio_mantenimiento).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <div className="flex flex-col items-end gap-2">
                    {/* Badge con prioridad: tiempo real > horario programado */}
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${badge.cls}`}>
                      <span className="material-symbols-outlined text-[12px]">{badge.icon}</span>
                      {badge.label}
                    </span>
                    {/* Botones de acción */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => abrirModalEditar(aula)}
                        title="Editar aula"
                        className="p-1.5 text-[#44464e] hover:text-[#1c355e] hover:bg-[#1c355e]/10 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button
                        onClick={() => abrirModalMant(aula)}
                        title="Modo mantenimiento"
                        className={`p-1.5 rounded-lg transition-colors ${enMant ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-[#44464e] hover:text-orange-500 hover:bg-orange-50'}`}
                      >
                        <span className="material-symbols-outlined text-[20px]">construction</span>
                      </button>
                      <button onClick={() => handleEliminar(aula.id)} className="p-1.5 text-[#44464e] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Panel docente en tiempo real — solo visible cuando hay clase activa */}
                  {claseActiva && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 space-y-1">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Docente en clase ahora
                      </p>
                      <p className="text-sm font-black text-[#1b1c1e] leading-tight">{claseActiva.docente}</p>
                      <p className="text-[10px] text-[#75777f] font-semibold">{claseActiva.asignatura}</p>
                      <p className="text-[10px] font-mono font-bold text-blue-600">
                        {(claseActiva.horario || '').split(' ').slice(1).join(' ')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-[#44464e] font-bold uppercase">Edificio</p>
                    <p className="text-sm font-medium">{aula.edificio || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Capacidad: <span className="text-[#1c355e] font-bold">{aula.capacidad || '—'}</span></p>
                  </div>
                  {enMant && aula.aula_temporal && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold bg-orange-50 px-3 py-1.5 rounded-lg">
                      <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                      Clases redirigidas a: <span className="font-bold">{aula.aula_temporal}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {aula.equipos?.map((equipo, index) => (
                      <div key={index} className="px-2 py-1 bg-[#f4f3f6] rounded-lg text-[11px] font-medium text-[#44464e]">{equipo}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
            )}
          </div>
        </div>

        {/* ── ESTADÍSTICAS (COSTADO DERECHO) ─────────────────────────────────── */}
        <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-4 xl:sticky xl:top-24 self-start">
          <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
            <p className="text-xs font-bold uppercase opacity-80">Total de Aulas</p>
            <p className="text-4xl font-extrabold mt-1">{totalAulas}</p>
          </div>
          <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">Aulas en Clase</p>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-4xl font-extrabold ${aulasEnClaseAhora > 0 ? 'text-blue-700' : 'text-[#c5c6cf]'}`}>{aulasEnClaseAhora}</p>
              {aulasEnClaseAhora > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />}
            </div>
            <p className="text-[11px] text-[#75777f] font-semibold mt-1">{aulasDisponibles} disponibles</p>
          </div>

          <div className="bg-[#1c9c72] text-white p-6 rounded-2xl shadow-lg flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase opacity-90">Total Laboratorios</p>
            <div className="flex items-center justify-between w-full mt-1">
              <p className="text-4xl font-extrabold">{totalLaboratorios}</p>
              <div className="text-right">
                <p className="text-sm font-bold opacity-90">{labsEnUso} en uso</p>
                <p className="text-[10px] opacity-75">{totalLaboratorios - labsEnUso} libres</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-orange-200 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">Aulas en Mantenimiento</p>
            <p className="text-4xl font-extrabold text-orange-500 mt-1">{aulasEnMant}</p>
          </div>
          <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">Capacidad Total (Aulas)</p>
            <p className="text-4xl font-extrabold text-[#1c355e] mt-1">{capacidadInstalada}</p>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      {confirmacion && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-red-500 text-[28px]">warning</span>
              <h3 className="text-base font-bold text-[#1b1c1e]">Confirmar acción</h3>
            </div>
            <p className="text-sm text-[#44464e] mb-6">{confirmacion.mensaje}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmacion(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => { confirmacion.onConfirmar(); setConfirmacion(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
