import { useState, useEffect } from 'react';
import { useToast } from '../components/useToast';
import { useTime } from '../components/TimeContext';

export default function GestionAulas() {
  const { toast, ToastContainer } = useToast();
  const ahora = useTime();
  const [confirmacion, setConfirmacion] = useState(null);

  const [aulas, setAulas] = useState([]);
  const [clases, setClases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  // Estado para el modal de mantenimiento
  const [modalMantAula, setModalMantAula] = useState(null);
  const [formMant, setFormMant] = useState({ en_mantenimiento: false, fin_mantenimiento: '', aula_temporal: '' });
  const [guardandoMant, setGuardandoMant] = useState(false);

  const [formData, setFormData] = useState({ nombre: '', edificio: '', capacidad: '', equipos: [] });

  const fetchAulas = async () => {
    try {
      const response = await fetch('/api/aulas');
      const data = await response.json();
      setAulas(data);
    } catch (error) {
      console.error("Error al cargar aulas:", error);
    }
  };

  const fetchClasesHoy = async (t) => {
    const ref = t || new Date();
    const dia  = ref.getDay();
    const mins = ref.getHours() * 60 + ref.getMinutes();
    try {
      const response = await fetch(`/api/clases-hoy?dia=${dia}&mins=${mins}`);
      const data = await response.json();
      setClases(data);
    } catch (error) {
      console.error("Error al cargar clases:", error);
    } finally {
      setCargando(false);
    }
  };

  // Carga inicial y refresco periódico (solo fetchAulas aquí)
  useEffect(() => {
    fetchAulas();
    const intervalo = setInterval(() => { fetchAulas(); fetchClasesHoy(new Date()); }, 30000);
    return () => clearInterval(intervalo);
  }, []);

  // Resincroniza clases cuando el TimeContext cambia (cada 60 s) y en el montaje inicial
  useEffect(() => {
    fetchClasesHoy(ahora);
  }, [ahora]);

  // Compara por nombre de aula (el backend ya aplica reasignación de mantenimiento)
  const esAulaOcupada = (nombreAula) => clases.some(c => c.aula_asignada === nombreAula);

  // Mantenimiento vigente = flag true Y fecha futura
  const estaEnMantenimiento = (aula) => {
    if (!aula.en_mantenimiento) return false;
    if (!aula.fin_mantenimiento) return aula.en_mantenimiento;
    return new Date(aula.fin_mantenimiento) > new Date();
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

  const abrirModalMant = (aula) => {
    setModalMantAula(aula);
    setFormMant({
      en_mantenimiento: aula.en_mantenimiento || false,
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
        body: JSON.stringify(formMant)
      });
      if (response.ok) {
        setModalMantAula(null);
        fetchAulas();
        toast("Estado de mantenimiento actualizado", "exito");
      } else {
        const err = await response.json();
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
    if (!formData.nombre || !formData.edificio) {
      toast("Por favor llena los campos obligatorios", "advertencia");
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
    if (filtro === 'ocupadas') return esAulaOcupada(aula.nombre);
    if (filtro === 'vacias') return !esAulaOcupada(aula.nombre);
    if (filtro === 'mantenimiento') return estaEnMantenimiento(aula);
    return true;
  });

  const totalAulas = aulas.length;
  const capacidadInstalada = aulas.reduce((t, a) => t + (Number(a.capacidad) || 0), 0);
  const aulasOcupadas = aulas.filter(a => esAulaOcupada(a.nombre)).length;
  const aulasEnMant = aulas.filter(a => estaEnMantenimiento(a)).length;

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
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Planta</label>
                <select required value={formData.edificio} onChange={e => setFormData({...formData, edificio: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm">
                  <option value="">Seleccione</option>
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
                  <div>
                    <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Fecha y Hora de Fin</label>
                    <input
                      type="datetime-local"
                      value={formMant.fin_mantenimiento}
                      onChange={e => setFormMant(prev => ({ ...prev, fin_mantenimiento: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                    />
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

      {/* FILTROS */}
      <div className="flex gap-3 flex-wrap">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'ocupadas', label: 'Ocupadas' },
          { id: 'vacias', label: 'Vacías' },
          { id: 'mantenimiento', label: 'Mantenimiento' }
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

      {/* LISTA DE AULAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cargando ? (
          <p className="col-span-full text-center">Cargando datos...</p>
        ) : aulasFiltradas.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#c5c6cf]/30">Sin Aulas en esta categoría</div>
        ) : (
          aulasFiltradas.map((aula) => {
            const enMant = estaEnMantenimiento(aula);
            const ocupada = !enMant && esAulaOcupada(aula.nombre);

            return (
              <div key={aula.id} className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${enMant ? 'border-orange-200' : 'border-[#c5c6cf]/30'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-[#1b1c1e]">{aula.nombre}</h2>
                  <div className="flex flex-col items-end gap-2">
                    {/* Etiqueta de estado */}
                    {enMant ? (
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">construction</span>
                        Mantenimiento
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ocupada ? 'bg-red-100 text-red-600' : 'bg-[#1c9c72]/10 text-[#1c9c72]'}`}>
                        {ocupada ? 'Ocupada' : 'Disponible'}
                      </span>
                    )}
                    {/* Botones de acción */}
                    <div className="flex gap-1">
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
                  <div>
                    <p className="text-[10px] text-[#44464e] font-bold uppercase">Edificio</p>
                    <p className="text-sm font-medium">{aula.edificio}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Capacidad: <span className="text-[#1c355e] font-bold">{aula.capacidad}</span></p>
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

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase opacity-80">Total de Aulas</p>
          <p className="text-3xl font-extrabold">{totalAulas}</p>
        </div>
        <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase text-[#44464e]">Aulas Ocupadas</p>
          <p className="text-3xl font-extrabold text-red-600">{aulasOcupadas}</p>
        </div>
        <div className="bg-white border border-orange-200 p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase text-[#44464e]">En Mantenimiento</p>
          <p className="text-3xl font-extrabold text-orange-500">{aulasEnMant}</p>
        </div>
        <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase text-[#44464e]">Capacidad Total</p>
          <p className="text-3xl font-extrabold text-[#1c355e]">{capacidadInstalada}</p>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
