import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '../components/useToast';
import { useTime } from '../components/TimeContext';
import { convertir12hA24h } from '../utils/timeUtils';

const obtenerColorLicenciatura = (licenciatura) => {
  const lic = (licenciatura || '').toLowerCase();
  if (lic.includes('medicina') || lic === 'med') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (lic.includes('administración') || lic.includes('negocios') || lic === 'adm' || lic === 'neg') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (lic.includes('mecatrónica') || lic.includes('ingeniería') || lic === 'isc' || lic === 'sis' || lic === 'imc') return 'bg-green-100 text-green-700 border-green-200';
  if (lic.includes('enfermería') || lic === 'enf') return 'bg-teal-100 text-teal-700 border-teal-200';
  if (lic.includes('derecho') || lic === 'der') return 'bg-red-100 text-red-700 border-red-200';
  if (lic.includes('nutrición') || lic === 'nut') return 'bg-lime-100 text-lime-700 border-lime-200';
  if (lic.includes('psicología') || lic === 'psi') return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function GestionAulas() {
  const { toast, toasts } = useToast();
  const ahora = useTime();
  const [confirmacion, setConfirmacion] = useState(null);

  const [aulas, setAulas] = useState([]);
  // ocupacion por horario programado: { "A24": { matutino: true, vespertino: true } }
  const [ocupacion, setOcupacion] = useState({});
  // clases: clases que están en sesión AHORA MISMO
  const [clases, setClases] = useState([]);
  const [examenesHoy, setExamenesHoy] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Estado para liberaciones manuales de aulas
  const [liberaciones, setLiberaciones] = useState([]);
  const [modalLiberarAula, setModalLiberarAula] = useState(null);
  const [motivoLiberacion, setMotivoLiberacion] = useState('Salida anticipada');
  const [guardandoLiberacion, setGuardandoLiberacion] = useState(false);

  // Estado para el modal de horarios de carrera
  const [modalCarrera, setModalCarrera] = useState(null);

  // Estado para el modal de mantenimiento
  const [modalMantAula, setModalMantAula] = useState(null);
  const [formMant, setFormMant] = useState({ en_mantenimiento: false, inicio_mantenimiento: '', fin_mantenimiento: '', aula_temporal: '' });
  const [guardandoMant, setGuardandoMant] = useState(false);
  const [aulasDisponiblesMant, setAulasDisponiblesMant] = useState([]);
  const [cargandoAulasMant, setCargandoAulasMant] = useState(false);

  useEffect(() => {
    if (!modalMantAula || !formMant.en_mantenimiento || !formMant.inicio_mantenimiento || !formMant.fin_mantenimiento) {
      setAulasDisponiblesMant([]);
      setCargandoAulasMant(false);
      return;
    }

    const cargarAulasMant = async () => {
      setCargandoAulasMant(true);
      try {
        const start24h = convertir12hA24h(formMant.inicio_mantenimiento);
        const end24h = convertir12hA24h(formMant.fin_mantenimiento);
        const url = `/api/aulas/disponibles-mantenimiento?datetime_inicio=${encodeURIComponent(start24h)}&datetime_fin=${encodeURIComponent(end24h)}&aula_excluida=${encodeURIComponent(modalMantAula.nombre || '')}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : [];
          setAulasDisponiblesMant(arr);
          const disponibleNombres = arr.map(a => a.nombre);
          if (formMant.aula_temporal && !disponibleNombres.includes(formMant.aula_temporal)) {
            setFormMant(prev => ({ ...prev, aula_temporal: '' }));
          }
        } else {
          setAulasDisponiblesMant([]);
        }
      } catch (err) {
        console.error("Error al obtener aulas para mantenimiento:", err);
        setAulasDisponiblesMant([]);
      } finally {
        setCargandoAulasMant(false);
      }
    };

    cargarAulasMant();
  }, [modalMantAula, formMant.en_mantenimiento, formMant.inicio_mantenimiento, formMant.fin_mantenimiento]);

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
        const [resSem, resCuat, exRes] = await Promise.all([
          fetch(`/api/estado-academico?plan=semestral&fecha=${hoyStr}`),
          fetch(`/api/estado-academico?plan=cuatrimestral&fecha=${hoyStr}`),
          fetch(`/api/examenes-hoy`)
        ]);
        if (resSem.ok && resCuat.ok) {
          setEstadoAcademico({
            semestral: await resSem.json(),
            cuatrimestral: await resCuat.json()
          });
        }
        if (exRes.ok) {
          const exData = await exRes.json();
          setExamenesHoy(Array.isArray(exData) ? exData : []);
        }
      } catch (e) {
        console.error("Error al cargar estado académico o exámenes:", e);
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

  const fetchLiberaciones = async () => {
    try {
      const r = await fetch(`/api/aulas/liberadas?fecha=${hoyStr}`);
      if (r.ok) setLiberaciones(await r.json());
    } catch (e) { console.error("Error al cargar liberaciones:", e); }
  };

  const handleConfirmarLiberacion = async () => {
    if (!modalLiberarAula) return;
    setGuardandoLiberacion(true);
    try {
      const res = await fetch('/api/aulas/liberar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aula_nombre: modalLiberarAula.aulaNombre,
          fecha: hoyStr,
          docente: modalLiberarAula.clase.docente,
          asignatura: modalLiberarAula.clase.asignatura,
          horario: modalLiberarAula.clase.horario,
          motivo: motivoLiberacion || 'Liberación manual',
        })
      });
      if (res.ok) {
        setModalLiberarAula(null);
        fetchClasesAhora(ahora);
        fetchLiberaciones();
        fetchOcupacion();
        toast(`Aula ${modalLiberarAula.aulaNombre} liberada manualmente con éxito`, "exito");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.detail || "Error al liberar el aula", "error");
      }
    } catch {
      toast("Error de conexión con el servidor", "error");
    } finally {
      setGuardandoLiberacion(false);
    }
  };

  const handleReactivarAula = async (liberacionId, aulaNombre) => {
    try {
      const res = await fetch(`/api/aulas/liberar/${liberacionId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchClasesAhora(ahora);
        fetchLiberaciones();
        fetchOcupacion();
        toast(`Aula ${aulaNombre} reactivada en clase`, "exito");
      } else {
        toast("Error al reactivar el aula", "error");
      }
    } catch {
      toast("Error de conexión con el servidor", "error");
    }
  };

  // Carga inicial + refresco cada 30 s
  useEffect(() => {
    fetchAulas();
    fetchOcupacion();
    fetchClasesAhora(ahora);
    fetchLiberaciones();
    const intervalo = setInterval(() => {
      fetchAulas();
      fetchOcupacion();
      fetchClasesAhora(ahora);
      fetchLiberaciones();
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
    if (aula.inicio_mantenimiento && new Date(aula.inicio_mantenimiento) > ahora) return false;
    if (aula.fin_mantenimiento && new Date(aula.fin_mantenimiento) < ahora) return false;
    return true;
  };

  // Mantenimiento programado = flag true PERO inicio es futuro
  const tieneMantProgramado = (aula) => {
    if (!aula.en_mantenimiento) return false;
    if (!aula.inicio_mantenimiento) return false;
    return new Date(aula.inicio_mantenimiento) > ahora;
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
      const start24h = convertir12hA24h(formMant.inicio_mantenimiento);
      const end24h = convertir12hA24h(formMant.fin_mantenimiento);
      const response = await fetch(`/api/aulas/${modalMantAula.id}/mantenimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          en_mantenimiento: formMant.en_mantenimiento,
          inicio_mantenimiento: formMant.en_mantenimiento && start24h ? start24h : null,
          fin_mantenimiento: formMant.en_mantenimiento && end24h ? end24h : null,
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

  const esLaboratorio = (nombre) => nombre.toLowerCase().startsWith('lab');
  const aulasNormales = aulas.filter(a => !esLaboratorio(a.nombre));
  const laboratorios  = aulas.filter(a => esLaboratorio(a.nombre));

  const aulasFiltradas = aulas.filter(aula => {
    const term = busqueda.trim().toLowerCase();
    if (term) {
      const coincideNombre = aula.nombre?.toLowerCase().includes(term);
      const coincideEdificio = aula.edificio?.toLowerCase().includes(term);
      const coincideEquipos = Array.isArray(aula.equipos) && aula.equipos.some(e => e?.toLowerCase().includes(term));
      const claseActiva = obtenerClaseEnCurso(aula.nombre);
      const coincideDocente = claseActiva?.docente?.toLowerCase().includes(term);
      const coincideAsignatura = claseActiva?.asignatura?.toLowerCase().includes(term);
      if (!coincideNombre && !coincideEdificio && !coincideEquipos && !coincideDocente && !coincideAsignatura) {
        return false;
      }
    }

    const esLab = esLaboratorio(aula.nombre);
    const enMant = estaEnMantenimiento(aula);
    const enClase = !enMant && !!obtenerClaseEnCurso(aula.nombre);
    const estAula = enMant ? 'mantenimiento' : obtenerEstadoAula(aula.nombre);

    // Filtro por Tipo
    if (filtroTipo === 'aulas' && esLab) return false;
    if (filtroTipo === 'laboratorios' && !esLab) return false;
    if (filtroTipo === 'mantenimiento' && !enMant) return false;

    // Filtro por Estado
    if (filtroEstado === 'en_curso' && !enClase) return false;
    if (filtroEstado === 'disponible' && (enMant || enClase)) return false;

    return true;
  }).sort((a, b) => {
    const aEsLab = a.nombre.toLowerCase().startsWith('lab');
    const bEsLab = b.nombre.toLowerCase().startsWith('lab');
    if (aEsLab && !bEsLab) return 1;
    if (!aEsLab && bEsLab) return -1;
    return a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' });
  });

  const totalAulas         = aulasNormales.length;
  const capacidadInstalada = aulasNormales.reduce((t, a) => t + (Number(a.capacidad) || 0), 0);
  const aulasEnClaseAhora  = aulasNormales.filter(a => !estaEnMantenimiento(a) && !!obtenerClaseEnCurso(a.nombre)).length;
  const aulasDisponibles   = aulasNormales.filter(a => !estaEnMantenimiento(a) && !obtenerClaseEnCurso(a.nombre)).length;
  const aulasEnMant        = aulasNormales.filter(a => estaEnMantenimiento(a)).length;

  const totalLaboratorios  = laboratorios.length;
  const labsEnUso          = laboratorios.filter(a => !estaEnMantenimiento(a) && !!obtenerClaseEnCurso(a.nombre)).length;
  const labsDisponibles    = laboratorios.filter(a => !estaEnMantenimiento(a) && !obtenerClaseEnCurso(a.nombre)).length;
  const labsEnMant         = laboratorios.filter(a => estaEnMantenimiento(a)).length;

  const totalEnMantenimiento = aulasEnMant + labsEnMant;

  // Nombres de aulas disponibles para el dropdown de aula temporal
  const nombresAulas = aulas.map(a => a.nombre).filter(n => n !== modalMantAula?.nombre);

  const hoyD = ahora.getDate().toString().padStart(2, '0');
  const hoyM = ahora.getMonth() + 1;
  const hoyA = ahora.getFullYear();
  const mesesNombres = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaNombre = diasSemana[ahora.getDay()];
  const fechaTexto = `${hoyD} de ${mesesNombres[hoyM]}`;
  const fechaDDMMYYYY = `${hoyD}/${String(hoyM).padStart(2, '0')}/${hoyA}`;
  const fechaISO = `${hoyA}-${String(hoyM).padStart(2, '0')}-${hoyD}`;

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-4">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1c355e] tracking-tight">Registro Global de Aulas</h1>
          <p className="text-sm text-[#44464e]/80 mt-1 font-medium">Consulte y gestione todos los espacios en tiempo real.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-white p-2 rounded-2xl shadow-sm border border-[#c5c6cf]/40">
          {/* Buscador Inteligente */}
          <div className="relative flex-1 w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar aula o laboratorio..."
              className="w-full pl-9 pr-8 py-2 bg-[#f4f3f6] border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-[#1c355e]/30 focus:ring-2 focus:ring-[#1c355e]/10 text-[#1b1c1e] placeholder:text-[#75777f] font-semibold transition-all"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#75777f] hover:text-[#1c355e] bg-white rounded-full p-0.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
          <div className="h-8 w-px bg-[#c5c6cf]/30 hidden sm:block"></div>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            className="w-full sm:w-auto bg-[#1c355e] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#152a4a] transition-all flex items-center justify-center gap-1.5 shadow-sm flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span> Nueva Aula
          </button>
        </div>
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
                  onChange={e => {
                    const checked = e.target.checked;
                    setFormMant(prev => {
                      if (checked && (!prev.inicio_mantenimiento || !prev.fin_mantenimiento)) {
                        const now = new Date();
                        const fin = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                        const toLocalISO = (d) => {
                          const pad = n => String(n).padStart(2, '0');
                          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        };
                        return {
                          ...prev,
                          en_mantenimiento: checked,
                          inicio_mantenimiento: prev.inicio_mantenimiento || toLocalISO(now),
                          fin_mantenimiento: prev.fin_mantenimiento || toLocalISO(fin)
                        };
                      }
                      return { ...prev, en_mantenimiento: checked };
                    });
                  }}
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
                      disabled={cargandoAulasMant || !formMant.inicio_mantenimiento || !formMant.fin_mantenimiento || aulasDisponiblesMant.length === 0}
                      className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {cargandoAulasMant ? (
                        <option value="">Cargando aulas disponibles...</option>
                      ) : !formMant.inicio_mantenimiento || !formMant.fin_mantenimiento ? (
                        <option value="">Seleccione rango de fecha y hora...</option>
                      ) : aulasDisponiblesMant.length === 0 ? (
                        <option value="" disabled>Sin aulas libres en este horario</option>
                      ) : (
                        <>
                          <option value="">Sin aula alterna</option>
                          {aulasDisponiblesMant.map(a => (
                            <option key={a.nombre} value={a.nombre}>{a.nombre}</option>
                          ))}
                        </>
                      )}
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


      {/* FILTROS ELEGANTES DE ESPACIOS Y ESTADOS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-[#c5c6cf]/40 shadow-sm">
        {/* Tabs Principales por Tipo de Espacio */}
        <div className="flex items-center gap-1 bg-[#f4f3f6] p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'todos',        label: 'Todos los Espacios', icon: 'grid_view' },
            { id: 'aulas',        label: 'Aulas',             icon: 'meeting_room' },
            { id: 'laboratorios', label: 'Laboratorios',      icon: 'science' },
            { id: 'mantenimiento',label: 'Mantenimiento',     icon: 'construction' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFiltroTipo(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filtroTipo === tab.id
                  ? 'bg-white text-[#1c355e] shadow-sm'
                  : 'text-[#75777f] hover:text-[#1c355e]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro por Estado (Ocupación) */}
        <div className="flex items-center gap-2 px-2 pb-1 sm:pb-0 w-full sm:w-auto">
          <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">filter_list</span> Filtros:
          </span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-[#1c355e] cursor-pointer"
          >
            <option value="todos">Todos los Estados</option>
            <option value="en_curso">▶ Solo En Curso / En Uso</option>
            <option value="disponible">✓ Solo Disponibles</option>
          </select>
        </div>
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
            const liberacionManual = liberaciones.find(l => l.aula_nombre === aula.nombre);
            const estadoHorario = enMant ? 'mantenimiento' : obtenerEstadoAula(aula.nombre);
            const carrerasAula  = (ocupacion[aula.nombre]?.carreras || []);

            // Agrupar carreras por licenciatura para mostrar horarios agrupados
            const carrerasAgrupadas = {};
            carrerasAula.forEach(c => {
              if (!carrerasAgrupadas[c.licenciatura]) {
                carrerasAgrupadas[c.licenciatura] = [];
              }
              carrerasAgrupadas[c.licenciatura].push(c);
            });
            const carrerasKeys = Object.keys(carrerasAgrupadas);
            const tieneCarreras = carrerasKeys.length > 0;

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
            const badgeKey = enMant ? 'mantenimiento' : mantProg ? 'mant_programado' : claseActiva ? 'en_clase' : 'disponible';
            const badge    = BADGE[badgeKey] || BADGE.disponible;

            const borderClass = enMant        ? 'border-orange-200'
                              : mantProg      ? 'border-yellow-300 border-dashed'
                              : claseActiva   ? 'border-blue-300'
                              : estadoHorario === 'bloqueada' ? 'border-red-200'
                              : 'border-[#c5c6cf]/30';

            const norm = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const asignaturasEnAula = new Set(carrerasAula.map(c => norm(c.asignatura)).filter(Boolean));
            if (claseActiva?.asignatura) {
              asignaturasEnAula.add(norm(claseActiva.asignatura));
            }
            const asignaturasArr = Array.from(asignaturasEnAula);

            const examenesEnAula = examenesHoy.filter(ex => {
              const fLow = (ex.fecha || '').trim().toLowerCase();
              const dLow = (ex.dia || '').trim().toLowerCase();
              const esHoy = fLow === fechaTexto
                         || fLow === fechaDDMMYYYY.toLowerCase()
                         || fLow === fechaISO.toLowerCase()
                         || (fLow === '' && dLow === diaNombre);
              if (!esHoy) return false;

              let matReal = ex.materia;
              try { matReal = decodeURIComponent(escape(ex.materia)); } catch (e) { }
              const matNorm = norm(matReal);
              if (!matNorm || matNorm.length < 3) return false;

              return asignaturasArr.some(asigNorm => asigNorm.includes(matNorm) || matNorm.includes(asigNorm));
            });

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
                  {/* Tarjetas de exámenes si hay exámenes hoy en esta aula */}
                  {examenesEnAula.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {examenesEnAula.map((ex, i) => (
                        <div key={i} className="flex flex-col gap-0.5 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg shadow-sm">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-700 uppercase tracking-wide">
                            <span className="material-symbols-outlined text-[12px]">assignment_late</span>
                            Examen {ex.periodo}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Panel docente en tiempo real — solo visible cuando hay clase activa */}
                  {claseActiva && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 space-y-1.5">
                      <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Docente en clase ahora
                      </p>
                      <p className="text-sm font-black text-[#1b1c1e] leading-tight">{claseActiva.docente}</p>
                      <p className="text-[10px] text-[#75777f] font-semibold">{claseActiva.asignatura}</p>
                      
                      {/* Carrera, Semestre / Cuatrimestre y Grupo */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {claseActiva.licenciatura && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${obtenerColorLicenciatura(claseActiva.licenciatura)}`}>
                            {claseActiva.licenciatura}
                          </span>
                        )}
                        {claseActiva.semestre && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60">
                            Sem: {claseActiva.semestre}
                          </span>
                        )}
                        {claseActiva.cuatrimestre && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200/60">
                            Cuat: {claseActiva.cuatrimestre}
                          </span>
                        )}
                        {claseActiva.grupo && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                            Gpo: {claseActiva.grupo}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-mono font-bold text-blue-600 pt-0.5">
                        {(claseActiva.horario || '').split(' ').slice(1).join(' ')}
                      </p>

                      <button
                        onClick={() => {
                          setModalLiberarAula({ aulaNombre: aula.nombre, clase: claseActiva });
                          setMotivoLiberacion('Salida anticipada');
                        }}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">lock_open</span>
                        Liberar Aula (Clase Finalizada)
                      </button>
                    </div>
                  )}

                  {liberacionManual && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-emerald-900">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px] flex-shrink-0">event_available</span>
                        <div className="min-w-0">
                          <p className="font-bold text-[11px] leading-tight">Liberada manualmente hoy</p>
                          <p className="text-[10px] text-emerald-700 truncate">{liberacionManual.docente} • {liberacionManual.asignatura}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReactivarAula(liberacionManual.id, aula.nombre)}
                        title="Reactivar horario de clase"
                        className="px-2 py-1 bg-white border border-emerald-300 rounded-lg text-[10px] font-bold text-emerald-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all flex-shrink-0 cursor-pointer"
                      >
                        Reactivar
                      </button>
                    </div>
                  )}

                  {/* ── Estado de Disponibilidad Actual ── */}
                  {!enMant && !claseActiva && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-500 text-[20px]">check_circle</span>
                      <div>
                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">Disponible</p>
                        <p className="text-[10px] text-emerald-500 font-medium">El aula se encuentra desocupada en este momento</p>
                      </div>
                    </div>
                  )}

                  {/* ── Panel de Carreras que ocupan el aula en el día ── */}
                  {!enMant && tieneCarreras && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <span className="material-symbols-outlined text-[14px]">school</span>
                        Carreras asignadas a este espacio hoy
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {carrerasKeys.map((lic) => (
                          <button
                            key={lic}
                            onClick={() => setModalCarrera({ aulaNombre: aula.nombre, licenciatura: lic, horarios: carrerasAgrupadas[lic] })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border w-fit hover:scale-105 hover:shadow-sm cursor-pointer transition-all ${obtenerColorLicenciatura(lic)}`}
                            title={`Ver horarios de ${lic} en ${aula.nombre}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">school</span>
                            {lic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Estadísticas de Horarios ── */}
                  {!enMant && tieneCarreras && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5 text-[#44464e]">
                          <span className="material-symbols-outlined text-[18px]">list_alt</span>
                          <span className="font-medium">Horarios</span>
                        </div>
                        <span className="font-bold text-[#1c355e]">{carrerasAula.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5 text-[#44464e]">
                          <span className="material-symbols-outlined text-[18px]">schedule</span>
                          <span className="font-medium">Rango horario</span>
                        </div>
                        <span className="font-bold text-[#1c355e]">
                          {(() => {
                            let min = Infinity;
                            let max = -Infinity;
                            carrerasAula.forEach(c => {
                              const match = c.horario.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
                              if (match) {
                                const parse = (t) => {
                                  const [h, m] = t.split(':').map(Number);
                                  return h * 60 + m;
                                };
                                min = Math.min(min, parse(match[1]));
                                max = Math.max(max, parse(match[2]));
                              }
                            });
                            if (min === Infinity) return '—';
                            const format = (mins) => `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
                            return `${format(min)} a ${format(max)}`;
                          })()}
                        </span>
                      </div>
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

        {/* ── ESTADÍSTICAS (COSTADO DERECHO INTERACTIVO) ─────────────────────── */}
        <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-3 xl:sticky xl:top-24 self-start xl:max-h-[calc(100vh-8rem)] overflow-y-auto pr-1 pb-4">
          {/* Total de Aulas */}
          <div
            onClick={() => { setFiltroTipo(filtroTipo === 'aulas' ? 'todos' : 'aulas'); setFiltroEstado('todos'); }}
            className={`bg-[#1c355e] text-white p-4 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] ${
              filtroTipo === 'aulas' && filtroEstado === 'todos' ? 'ring-4 ring-[#1c355e]/40 shadow-xl' : ''
            }`}
            title="Haz clic para ver todas las Aulas"
          >
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold uppercase opacity-80">Total de Aulas</p>
              {filtroTipo === 'aulas' && filtroEstado === 'todos' && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Filtrado</span>}
            </div>
            <p className="text-4xl font-extrabold mt-1">{totalAulas}</p>
          </div>

          {/* Aulas en Clase */}
          <div
            onClick={() => { setFiltroTipo('aulas'); setFiltroEstado(filtroEstado === 'en_curso' ? 'todos' : 'en_curso'); }}
            className={`bg-white border p-4 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left cursor-pointer transition-all hover:scale-[1.02] ${
              filtroTipo === 'aulas' && filtroEstado === 'en_curso' ? 'border-blue-500 ring-4 ring-blue-100 shadow-md' : 'border-[#c5c6cf]/30'
            }`}
            title="Haz clic para ver las Aulas en clase ahora"
          >
            <div className="flex justify-between items-center w-full">
              <p className="text-xs font-bold uppercase text-[#44464e]">Aulas en Clase</p>
              {filtroTipo === 'aulas' && filtroEstado === 'en_curso' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Filtrado</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-4xl font-extrabold ${aulasEnClaseAhora > 0 ? 'text-blue-700' : 'text-[#c5c6cf]'}`}>{aulasEnClaseAhora}</p>
              {aulasEnClaseAhora > 0 && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />}
            </div>
            <p className="text-[11px] text-[#75777f] font-semibold mt-1">{aulasDisponibles} disponibles</p>
          </div>

          {/* Total Laboratorios */}
          <div
            onClick={() => { setFiltroTipo(filtroTipo === 'laboratorios' ? 'todos' : 'laboratorios'); setFiltroEstado('todos'); }}
            className={`bg-[#1c9c72] text-white p-4 rounded-2xl shadow-md cursor-pointer transition-all hover:scale-[1.02] ${
              filtroTipo === 'laboratorios' && filtroEstado === 'todos' ? 'ring-4 ring-[#1c9c72]/40 shadow-xl' : ''
            }`}
            title="Haz clic para ver todos los Laboratorios"
          >
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold uppercase opacity-90">Total Laboratorios</p>
              {filtroTipo === 'laboratorios' && filtroEstado === 'todos' && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Filtrado</span>}
            </div>
            <p className="text-4xl font-extrabold mt-1">{totalLaboratorios}</p>
          </div>

          {/* Laboratorios en Uso */}
          <div
            onClick={() => { setFiltroTipo('laboratorios'); setFiltroEstado(filtroEstado === 'en_curso' ? 'todos' : 'en_curso'); }}
            className={`bg-white border p-4 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left cursor-pointer transition-all hover:scale-[1.02] ${
              filtroTipo === 'laboratorios' && filtroEstado === 'en_curso' ? 'border-[#1c9c72] ring-4 ring-teal-100 shadow-md' : 'border-[#1c9c72]/30'
            }`}
            title="Haz clic para ver los Laboratorios en uso ahora"
          >
            <div className="flex justify-between items-center w-full">
              <p className="text-xs font-bold uppercase text-[#44464e]">Laboratorios en Uso</p>
              {filtroTipo === 'laboratorios' && filtroEstado === 'en_curso' && <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">Filtrado</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-4xl font-extrabold ${labsEnUso > 0 ? 'text-[#1c9c72]' : 'text-[#c5c6cf]'}`}>{labsEnUso}</p>
              {labsEnUso > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#1c9c72] shadow-sm" />}
            </div>
            <p className="text-[11px] text-[#75777f] font-semibold mt-1">{labsDisponibles} libres</p>
          </div>

          {/* Espacios en Mantenimiento */}
          <div
            onClick={() => { setFiltroTipo(filtroTipo === 'mantenimiento' ? 'todos' : 'mantenimiento'); setFiltroEstado('todos'); }}
            className={`bg-white border p-4 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left cursor-pointer transition-all hover:scale-[1.02] ${
              filtroTipo === 'mantenimiento' ? 'border-orange-500 ring-4 ring-orange-100 shadow-md' : 'border-orange-200'
            }`}
            title="Haz clic para ver los espacios en mantenimiento"
          >
            <div className="flex justify-between items-center w-full">
              <p className="text-xs font-bold uppercase text-[#44464e]">Espacios en Mantenimiento</p>
              {filtroTipo === 'mantenimiento' && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Filtrado</span>}
            </div>
            <p className="text-4xl font-extrabold text-orange-500 mt-1">{totalEnMantenimiento}</p>
          </div>

          {/* Capacidad Total (Aulas) */}
          <div
            onClick={() => setFiltro('aulas')}
            className="bg-white border border-[#c5c6cf]/30 p-4 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left cursor-pointer transition-all hover:scale-[1.02]"
            title="Haz clic para filtrar las Aulas"
          >
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

      {/* MODAL LIBERAR AULA */}
      {modalLiberarAula && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg space-y-4">
            <div className="flex justify-between items-center border-b border-[#c5c6cf]/30 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1c355e]">Liberar Aula Manualmente</h3>
                <p className="text-xs text-[#75777f]">Aula: <span className="font-bold text-[#1c355e]">{modalLiberarAula.aulaNombre}</span></p>
              </div>
              <button onClick={() => setModalLiberarAula(null)} className="text-[#44464e] hover:text-[#1c355e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] font-bold text-blue-500 uppercase">Clase activa actual</p>
              <p className="text-sm font-black text-[#1b1c1e]">{modalLiberarAula.clase.docente}</p>
              <p className="text-xs text-[#44464e] font-medium">{modalLiberarAula.clase.asignatura}</p>
              <p className="text-xs font-mono font-bold text-blue-600">{modalLiberarAula.clase.horario}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Motivo de Liberación</label>
              <select
                value={motivoLiberacion}
                onChange={e => setMotivoLiberacion(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
              >
                <option value="Salida anticipada">Salida anticipada / Conclusión temprana</option>
                <option value="Clase cancelada por docente">Clase cancelada por docente</option>
                <option value="Actividad fuera de aula">Actividad fuera de aula / Práctica externa</option>
                <option value="Permiso institucional">Permiso institucional</option>
                <option value="Otro motivo">Otro motivo</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModalLiberarAula(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarLiberacion}
                disabled={guardandoLiberacion}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                {guardandoLiberacion ? 'Liberando...' : 'Liberar Aula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORARIOS DE CARRERA */}
      {modalCarrera && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#c5c6cf]/30 pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#1c355e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">event_note</span>
                  Horarios Asignados
                </h3>
                <p className="text-xs text-[#75777f] mt-0.5">
                  Aula: <span className="font-bold text-[#1c355e]">{modalCarrera.aulaNombre}</span>
                </p>
              </div>
              <button onClick={() => setModalCarrera(null)} className="text-[#44464e] hover:text-[#1c355e] p-1 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase border w-fit shadow-sm ${obtenerColorLicenciatura(modalCarrera.licenciatura)}`}>
                <span className="material-symbols-outlined text-[16px]">school</span>
                {modalCarrera.licenciatura}
              </span>

              {(() => {
                const diasOrden = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
                const parseTime = (t) => {
                  const [h, m] = t.split(':').map(Number);
                  return h * 60 + m;
                };
                const formatTime = (mins) => {
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                };

                const horariosPorGrado = {};
                modalCarrera.horarios.forEach(item => {
                  const grado = item.grado || 'N/A';
                  if (!horariosPorGrado[grado]) horariosPorGrado[grado] = {};
                  
                  const parts = item.horario.split(' ');
                  const dia = parts[0];
                  const timeStr = parts.slice(1).join(' ');
                  const match = timeStr.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
                  
                  if (match) {
                    const t1 = parseTime(match[1]);
                    const t2 = parseTime(match[2]);
                    if (!horariosPorGrado[grado][dia]) {
                      horariosPorGrado[grado][dia] = { min: t1, max: t2 };
                    } else {
                      horariosPorGrado[grado][dia].min = Math.min(horariosPorGrado[grado][dia].min, t1);
                      horariosPorGrado[grado][dia].max = Math.max(horariosPorGrado[grado][dia].max, t2);
                    }
                  }
                });

                return Object.entries(horariosPorGrado).map(([grado, diasMap]) => {
                  const dias = Object.keys(diasMap).sort((a, b) => diasOrden.indexOf(a) - diasOrden.indexOf(b));
                  
                  return (
                    <div key={grado} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">stairs</span>
                        Grado: {grado}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {dias.map(dia => (
                          <div key={dia} className="flex flex-col justify-center bg-white border border-slate-200/70 rounded-lg p-2.5 shadow-sm gap-1">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wide">
                              <span className="material-symbols-outlined text-[14px] text-slate-400">calendar_today</span>
                              {dia}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#1c355e] pl-5">
                              {formatTime(diasMap[dia].min)} - {formatTime(diasMap[dia].max)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setModalCarrera(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-[#44464e] text-sm font-bold hover:bg-slate-200 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
