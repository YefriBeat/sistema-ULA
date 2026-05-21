import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Función auxiliar para darle color automático a las etiquetas según la licenciatura
const obtenerColorLicenciatura = (licenciatura) => {
  const lic = licenciatura.toLowerCase();
  if (lic.includes('medicina')) return 'bg-blue-50 text-blue-700 border-blue-200/50';
  if (lic.includes('administración') || lic.includes('negocios')) return 'bg-orange-50 text-orange-700 border-orange-200/50';
  if (lic.includes('mecatrónica') || lic.includes('ingeniería')) return 'bg-green-50 text-green-700 border-green-200/50';
  return 'bg-gray-50 text-gray-700 border-gray-200/50'; // Color por defecto
};

export default function VisualBd() {
  const [asignaturas, setAsignaturas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate(); // Herramienta para redireccionar

  // Reemplaza tu useEffect actual con este:
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/horarios');
        const data = await response.json();
        setAsignaturas(data);
        setCargando(false);
      } catch (error) {
        console.error("Error al cargar la base de datos:", error);
        setCargando(false);
      }
    };

    fetchDatos();
  }, []);

  // Lógica para filtrar la tabla con el buscador
  const datosFiltrados = asignaturas.filter(item => 
    item.docente.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.asignatura.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.aula?.toLowerCase().includes(busqueda.toLowerCase()) // El "?" evita errores si no hay aula
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope">
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1b1c1e] tracking-tight">Directorio General de Asignaturas</h1>
          <p className="text-base text-[#44464e] mt-1.5">Gestión y control centralizado de la programación académica institucional.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex bg-[#f4f3f6] p-1.5 rounded-full border border-[#c5c6cf]/40 w-fit">
            
            {/* BOTÓN CON REDIRECCIÓN A CARGA DE HORARIOS */}
            <button 
              onClick={() => navigate('/horarios')}
              className="px-6 py-2 rounded-full text-xs font-bold text-[#44464e] hover:text-[#1b1c1e] transition-all"
            >
              Cargar Nuevos Horarios
            </button>
            
            <button className="px-6 py-2 rounded-full text-xs font-bold bg-[#1c355e] text-white shadow-md transition-all">
              Base de Datos Actual
            </button>
          </div>
          
          <div className="flex gap-2">
            <button className="bg-red-50 text-[#ba1a1a] font-bold px-5 py-2 rounded-xl flex items-center gap-2 hover:bg-red-100 transition-all border border-red-200 text-xs shadow-sm">
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              <span>Eliminar por Lote</span>
            </button>
            <button className="bg-[#fdbb11] text-[#000924] font-bold px-5 py-2 rounded-xl flex items-center gap-2 hover:brightness-95 transition-all shadow-md text-xs">
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-5 rounded-2xl border border-[#c5c6cf]/50 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">search</span>
          <input 
            className="w-full pl-10 pr-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/30 rounded-xl text-sm focus:bg-white focus:border-[#1c355e] focus:ring-0 outline-none transition-all" 
            placeholder="Buscar por docente, asignatura o aula..." 
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        
        {/* Selectores estáticos */}
        <div className="min-w-[180px]">
          <select className="w-full bg-[#f4f3f6] border border-[#c5c6cf]/30 rounded-xl py-2.5 text-sm focus:bg-white focus:border-[#1c355e] px-3 outline-none text-[#44464e] font-medium transition-all">
            <option value="">Todas las Licenciaturas</option>
            <option>Medicina</option>
            <option>Administración</option>
            <option>Mecatrónica</option>
          </select>
        </div>
        <div className="min-w-[140px]">
          <select className="w-full bg-[#f4f3f6] border border-[#c5c6cf]/30 rounded-xl py-2.5 text-sm focus:bg-white focus:border-[#1c355e] px-3 outline-none text-[#44464e] font-medium transition-all">
            <option value="">Todos los Días</option>
            <option>Lunes</option>
            <option>Martes</option>
            <option>Miércoles</option>
            <option>Jueves</option>
            <option>Viernes</option>
          </select>
        </div>
        
        <button className="bg-white text-[#1b1c1e] px-6 py-2.5 rounded-xl border border-[#c5c6cf]/50 hover:bg-[#e3e2e5]/20 transition-colors flex items-center space-x-2 font-bold text-sm shadow-sm">
          <span className="material-symbols-outlined text-xl">filter_alt</span>
          <span>Más Filtros</span>
        </button>
      </div>

      {/* TABLA DE DATOS MAESTRA */}
      <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c355e] text-white">
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Docente</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Licenciatura</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Asignatura</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Día</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Horario</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Aula</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest">Archivo Origen</th>
                <th className="py-4 px-6 text-[11px] font-bold uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c5c6cf]/30 text-sm text-[#1b1c1e]">
              
              {cargando ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#75777f]">
                    <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
                    <p className="font-bold">Conectando con la base de datos...</p>
                  </td>
                </tr>
              ) : datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-[#75777f]">
                    <span className="material-symbols-outlined text-5xl mb-3 text-[#c5c6cf]">database</span>
                    <p className="font-bold text-lg text-[#44464e]">La base de datos está vacía</p>
                    <p className="text-sm mt-1">Sube un archivo PDF en "Gestión de Horarios" para poblar el directorio.</p>
                  </td>
                </tr>
              ) : (
                datosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f4f3f6]/50 transition-colors">
                    <td className="py-5 px-6 font-bold">{item.docente}</td>
                    <td className="py-5 px-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${obtenerColorLicenciatura(item.lic)}`}>
                        {item.lic}
                      </span>
                    </td>
                    <td className="py-5 px-6 font-medium text-[#44464e]">{item.asignatura}</td>
                    <td className="py-5 px-6 font-medium text-[#44464e]">{item.dia}</td>
                    <td className="py-5 px-6 font-medium text-[#44464e] whitespace-nowrap">{item.horario}</td>
                    <td className="py-5 px-6 text-[#44464e] font-mono text-xs whitespace-nowrap font-bold">{item.aula}</td>
                    <td className="py-5 px-6">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#f4f3f6] text-[#44464e] text-[11px] border border-[#c5c6cf]/40 font-medium whitespace-nowrap">
                        <span className="material-symbols-outlined text-[14px] mr-1">picture_as_pdf</span>
                        {item.archivo.length > 15 ? item.archivo.substring(0, 15) + '...' : item.archivo}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button className="p-1.5 text-[#75777f] hover:text-[#1c355e] hover:bg-[#e9e7eb] rounded-lg transition-all" title="Editar registro">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button className="p-1.5 text-[#75777f] hover:text-[#ba1a1a] hover:bg-red-50 rounded-lg transition-all" title="Eliminar registro">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* ÁREA DE PAGINACIÓN */}
        <div className="px-8 py-5 border-t border-[#c5c6cf]/30 bg-[#f4f3f6]/20 flex items-center justify-between">
          <span className="text-[11px] text-[#44464e] font-medium">Mostrando {datosFiltrados.length} registros.</span>
          <div className="flex items-center gap-1.5">
            <button className="px-3 h-9 flex items-center justify-center rounded-xl border border-[#c5c6cf]/40 bg-white hover:bg-[#e3e2e5]/30 transition-colors shadow-sm text-xs font-bold disabled:opacity-50" disabled>Anterior</button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1c355e] text-white text-xs font-bold shadow-md">1</button>
            <button className="px-3 h-9 flex items-center justify-center rounded-xl border border-[#c5c6cf]/40 bg-white hover:bg-[#e3e2e5]/30 transition-colors shadow-sm text-xs font-bold disabled:opacity-50" disabled>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}