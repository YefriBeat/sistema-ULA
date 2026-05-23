import { useState, useEffect } from 'react';

export default function GestionAulas() {
  const [aulas, setAulas] = useState([]);
  const [clases, setClases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [filtro, setFiltro] = useState('todos'); // 'todos', 'ocupadas', 'vacias'

  const [formData, setFormData] = useState({
    nombre: '',
    edificio: '',
    capacidad: '',
    equipos: []
  });

  const fetchAulas = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/aulas');
      const data = await response.json();
      setAulas(data);
    } catch (error) {
      console.error("Error al cargar aulas:", error);
    }
  };

  const fetchClasesHoy = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/clases-hoy');
      const data = await response.json();
      setClases(data);
    } catch (error) {
      console.error("Error al cargar clases:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchAulas();
    fetchClasesHoy();
    // Refrescar cada 30 segundos
    const intervalo = setInterval(() => {
      fetchAulas();
      fetchClasesHoy();
    }, 30000);
    return () => clearInterval(intervalo);
  }, []);

  const esAulaOcupada = (aulaId) => {
    return clases.some(clase => clase.aula_id === aulaId);
  };

  const handleEliminar = async (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta aula?")) {
      try {
        const response = await fetch(`http://localhost:8000/api/aulas/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchAulas();
          alert("Aula eliminada con éxito");
        }
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
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
    if (!formData.nombre || !formData.edificio || !formData.capacidad) {
      alert("Por favor llena los campos obligatorios");
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/aulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          edificio: formData.edificio,
          capacidad: parseInt(formData.capacidad),
          equipos: formData.equipos,
          estado: "Activo"
        })
      });

      if (response.ok) {
        setFormData({ nombre: '', edificio: '', capacidad: '', equipos: [] });
        setMostrarFormulario(false);
        fetchAulas();
        alert("Aula registrada con éxito");
      }
    } catch (error) {
      console.error("Error al guardar el aula", error);
    }
  };

  // Filtrar aulas según estado
  const aulasFiltradas = aulas.filter(aula => {
    if (filtro === 'ocupadas') return esAulaOcupada(aula.id);
    if (filtro === 'vacias') return !esAulaOcupada(aula.id);
    return true;
  });

  const totalAulas = aulas.length;
  const capacidadInstalada = aulas.reduce((total, aula) => total + (Number(aula.capacidad) || 0), 0);
  const aulasOcupadas = aulas.filter(aula => esAulaOcupada(aula.id)).length;

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

      {/* MODAL FORMULARIO */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[#1c355e]">Nueva Aula / Espacio</h3>
              <button 
                onClick={() => setMostrarFormulario(false)}
                className="text-[#44464e] hover:text-[#1c355e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Nombre del Aula</label>
                <input 
                  required 
                  value={formData.nombre} 
                  onChange={e => setFormData({...formData, nombre: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" 
                  placeholder="Ej. A101" 
                  type="text"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Planta</label>
                  <select required value={formData.edificio} onChange={e => setFormData({...formData, edificio: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm">
                    <option value="">Seleccione</option>
                    <option>Planta A</option>
                    <option>Planta B</option>
                    <option>Planta C</option>
                    <option>Explanada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Capacidad</label>
                  <input required value={formData.capacidad} onChange={e => setFormData({...formData, capacidad: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" placeholder="Ej. 40" type="number"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Equipamiento</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Proyector', 'Aire Acond.', 'PCs', 'Smart Board'].map((item) => (
                    <label key={item} className="flex items-center gap-3 p-3 border border-[#c5c6cf]/30 rounded-xl cursor-pointer hover:bg-[#f4f3f6]">
                      <input 
                        type="checkbox" 
                        checked={formData.equipos.includes(item)}
                        onChange={() => handleCheckboxChange(item)}
                        className="rounded text-[#1c355e]"
                      />
                      <span className="text-sm font-medium">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-[#1c355e] text-white py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all">
                Registrar Espacio
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div className="flex gap-3">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'ocupadas', label: 'Ocupadas' },
          { id: 'vacias', label: 'Vacías' }
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
            const ocupada = esAulaOcupada(aula.id);
            return (
              <div key={aula.id} className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-[#1b1c1e]">{aula.nombre}</h2>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      ocupada 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-[#1c9c72]/10 text-[#1c9c72]'
                    }`}>
                      {ocupada ? 'Ocupada' : 'Disponible'}
                    </span>
                    <button 
                      onClick={() => handleEliminar(aula.id)}
                      className="p-1.5 text-[#44464e] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    {aula.equipos?.map((equipo, index) => (
                      <div key={index} className="px-2 py-1 bg-[#f4f3f6] rounded-lg text-[11px] font-medium text-[#44464e]">
                        {equipo}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
          <p className="text-xs font-bold uppercase opacity-80">Total de Aulas</p>
          <p className="text-3xl font-extrabold">{totalAulas}</p>
        </div>
        <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase text-[#44464e]">Aulas Ocupadas</p>
          <p className="text-3xl font-extrabold text-red-600">{aulasOcupadas}</p>
        </div>
        <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-bold uppercase text-[#44464e]">Capacidad Total</p>
          <p className="text-3xl font-extrabold text-[#1c355e]">{capacidadInstalada}</p>
        </div>
      </div>
    </div>
  );
}