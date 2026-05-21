import React, { useState, useEffect } from 'react';

export default function GestionAulas() {
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(true);

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
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchAulas();
  }, []);

  // --- NUEVA FUNCIÓN PARA ELIMINAR ---
  const handleEliminar = async (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta aula? Esta acción no se puede deshacer.")) {
      try {
        const response = await fetch(`http://localhost:8000/api/aulas/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // Opción A: Volver a pedir los datos a la API
          fetchAulas(); 
          // Opción B: Filtrar el estado local (más rápido visualmente)
          // setAulas(aulas.filter(aula => aula.id !== id));
          alert("Aula eliminada con éxito");
        } else {
          alert("Hubo un error al intentar eliminar el aula");
        }
      } catch (error) {
        console.error("Error al eliminar:", error);
      }
    }
  };

  const handleCheckboxChange = (equipo) => {
    setFormData(prev => {
      if (prev.equipos.includes(equipo)) {
        return { ...prev, equipos: prev.equipos.filter(e => e !== equipo) };
      } else {
        return { ...prev, equipos: [...prev.equipos, equipo] };
      }
    });
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
  estado: "Activo" // 🔥 IMPORTANTE
        })
      });

      if (response.ok) {
        setFormData({ nombre: '', edificio: '', capacidad: '', equipos: [] });
        fetchAulas();
        alert("Aula registrada con éxito");
      }
    } catch (error) {
      console.error("Error al guardar el aula", error);
    }
  };

  const totalAulas = aulas.length;
  const espaciosHabilitados = aulas.filter(aula => aula.estado === 'Activo').length;
  const capacidadInstalada = aulas.reduce((total, aula) => total + (Number(aula.capacidad) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1c355e] tracking-tight">Registro Global de Aulas</h1>
          <p className="text-base text-[#44464e] mt-1.5">Consulte y gestione todos los espacios.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* FORMULARIO */}
        <aside className="w-full lg:w-[40%] space-y-6">
          <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1c355e] mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined">add_circle</span>
              Nueva Aula / Espacio
            </h3>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Nombre del Aula</label>
                <input 
                  required 
                  value={formData.nombre} 
                  onChange={e => setFormData({...formData, nombre: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" placeholder="Ej. A101" type="text"/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Edificio</label>
                  <select required value={formData.edificio} onChange={e => setFormData({...formData, edificio: e.target.value})} className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm">
                    <option value="">Seleccione</option>
                    <option>Edificio A</option>
                    <option>Edificio B</option>
                    <option>Edificio C</option>
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
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {['Proyector', 'Aire Acond.', 'PCs', 'Smart Board'].map((item) => (
                    <label key={item} className="flex items-center gap-3 p-3 border border-[#c5c6cf]/30 rounded-xl cursor-pointer hover:bg-[#f4f3f6]">
                      <input 
                        type="checkbox" 
                        checked={formData.equipos.includes(item)}
                        onChange={() => handleCheckboxChange(item)}
                        className="rounded text-[#1c355e] focus:ring-[#1c355e]"/>
                      <span className="text-sm font-medium">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-[#1c355e] text-white py-3 rounded-xl font-bold hover:bg-[#152a4a] transition-all shadow-md active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[20px]">save</span> Registrar Espacio
              </button>
            </form>
          </div>
        </aside>

        {/* LISTA DE AULAS */}
        <main className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cargando ? (
              <p className="col-span-full text-center">Cargando datos...</p>
            ) : aulas.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#c5c6cf]/30">Sin Aulas Registradas</div>
            ) : (
              aulas.map((aula) => (
                <div key={aula.id} className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-6 shadow-sm group hover:border-[#1c355e]/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-[#1b1c1e]">{aula.nombre}</h2>
                    <div className="flex flex-col items-end gap-2">
                        <span className="bg-[#1c9c72]/10 text-[#1c9c72] px-3 py-1 rounded-full text-[10px] font-bold uppercase">Activo</span>
                        {/* BOTÓN ELIMINAR */}
                        <button 
                          onClick={() => handleEliminar(aula.id)}
                          className="p-1.5 text-[#44464e] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar aula"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                    </div>
                  </div>
                  <div className="space-y-3 mb-2">
                    <div>
                      <p className="text-[10px] text-[#44464e] font-bold uppercase">Edificio</p>
                      <p className="text-sm font-medium">{aula.edificio}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Capacidad: <span className="text-[#1c355e] font-bold">{aula.capacidad}</span></p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-1">
                      {aula.equipos?.map((equipo, index) => (
                        <div key={index} className="flex items-center gap-1.5 px-2 py-1 bg-[#f4f3f6] rounded-lg text-[11px] font-medium text-[#44464e]">
                           {equipo}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* TARJETAS INFERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
         <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
            <p className="text-xs font-bold uppercase opacity-80">Total de Aulas</p>
            <p className="text-3xl font-extrabold">{totalAulas}</p>
         </div>
         <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
            <p className="text-xs font-bold uppercase text-[#44464e]">Espacios Habilitados</p>
            <p className="text-3xl font-extrabold text-[#1c355e]">{espaciosHabilitados}</p>
         </div>
         <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm">
            <p className="text-xs font-bold uppercase text-[#44464e]">Capacidad Instalada</p>
            <p className="text-3xl font-extrabold text-[#1c355e]">{capacidadInstalada}</p>
         </div>
      </div>
    </div>
  );
}