import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Parser robusto para extraer día y horas
const parsearHorario = (horarioCompleto) => {
  const stringSeguro = horarioCompleto || "";
  const partes = stringSeguro.split(' ');
  
  let dia = '';
  let textoHora = '';

  if (partes.length >= 2 && /[a-zA-Z]/.test(partes[0])) {
    dia = partes[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
    textoHora = partes.slice(1).join('');
  } else {
    textoHora = stringSeguro;
  }
  
  const horasLimpias = textoHora.replace(/-+/g, '-').trim(); 
  const [strInicio, strFin] = horasLimpias.split('-');
  
  const getMinutos = (horaStr) => {
    if (!horaStr) return 0;
    const [h, m] = horaStr.trim().split(':').map(Number);
    return (h * 60) + (m || 0);
  };
  
  return { 
    dia, 
    inicio: getMinutos(strInicio), 
    fin: getMinutos(strFin), 
    textoHora: horasLimpias 
  };
};

const obtenerColorLicenciatura = (licenciatura) => {
  const lic = (licenciatura || '').toLowerCase();
  if (lic.includes('medicina')) return 'bg-blue-50 text-blue-700 border-blue-200/50';
  if (lic.includes('administración') || lic.includes('negocios')) return 'bg-orange-50 text-orange-700 border-orange-200/50';
  if (lic.includes('mecatrónica') || lic.includes('ingeniería')) return 'bg-green-50 text-green-700 border-green-200/50';
  return 'bg-gray-50 text-gray-700 border-gray-200/50';
};

// Índice jerárquico de días para ordenamiento
const diasSemanaMap = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6
};

export default function VisualBd() {
  const [asignaturas, setAsignaturas] = useState([]);
  
  // ESTADOS DE FILTROS (Por defecto muestra 'en_curso')
  const [busqueda, setBusqueda] = useState('');
  const [filtroLic, setFiltroLic] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroHora, setFiltroHora] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('en_curso'); 
  const [mostrarFinalizadas, setMostrarFinalizadas] = useState(false);
  
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(new Date('2026-05-25T16:30:00')); // Fecha fija para pruebas, cambiar a new Date() para producción
  const navigate = useNavigate();

  // Reloj interno del sistema
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Conexión constante a la base de datos
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/horarios');
        if (response.ok) {
          const data = await response.json();
          setAsignaturas(data);
        }
      } catch (error) {
        console.error("Error al cargar la BD:", error);
      } finally {
        setCargando(false);
      }
    };
    fetchDatos();
    const interval = setInterval(fetchDatos, 5000);
    return () => clearInterval(interval);
  }, []);

  // Motor Temporal y de Ordenamiento
  const asignaturasConEstado = useMemo(() => {
    const diaActualIndex = ahora.getDay();
    const minutosActuales = (ahora.getHours() * 60) + ahora.getMinutes();

    return asignaturas.map(clase => {
      const { dia, inicio, fin, textoHora } = parsearHorario(clase.horario);
      const diaClaseIndex = dia ? diasSemanaMap[dia] : diaActualIndex;
      let estadoTiempo = 'proxima';

      if (diaClaseIndex !== undefined) {
        if (diaClaseIndex < diaActualIndex) {
          estadoTiempo = 'finalizada';
        } else if (diaClaseIndex > diaActualIndex) {
          estadoTiempo = 'proxima';
        } else {
          if (minutosActuales > fin) estadoTiempo = 'finalizada';
          else if (minutosActuales >= inicio && minutosActuales <= fin) estadoTiempo = 'en_curso';
        }
      }

      return { ...clase, estadoTiempo, textoHora, diaClaseIndex, inicio, diaOriginal: dia };
    }).sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex || 0) - (b.diaClaseIndex || 0);
      return (a.inicio || 0) - (b.inicio || 0);
    });
  }, [asignaturas, ahora]);

  // Generar opciones dinámicas para los selectores basados en la BD real
  const opcionesLicenciatura = useMemo(() => [...new Set(asignaturas.map(a => a.licenciatura).filter(Boolean))].sort(), [asignaturas]);
  const opcionesAsignatura = useMemo(() => [...new Set(asignaturas.map(a => a.asignatura).filter(Boolean))].sort(), [asignaturas]);
  const opcionesHora = useMemo(() => [...new Set(asignaturasConEstado.map(a => a.textoHora).filter(Boolean))].sort(), [asignaturasConEstado]);

  // Lógica combinada de filtros
  const datosFiltrados = useMemo(() => {
    let resultado = asignaturasConEstado.filter(item => {
      const coincideBusqueda = 
        item.docente?.toLowerCase().includes(busqueda.toLowerCase()) || 
        item.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
        
      const coincideLic = filtroLic === '' || item.licenciatura === filtroLic;
      const coincideAsignatura = filtroAsignatura === '' || item.asignatura === filtroAsignatura;
      const coincideHora = filtroHora === '' || item.textoHora === filtroHora;
      const coincideDia = filtroDia === '' || item.horario?.toLowerCase().includes(filtroDia.toLowerCase());
      
      return coincideBusqueda && coincideLic && coincideAsignatura && coincideHora && coincideDia;
    });

    if (filtroEstado !== 'todas') {
      resultado = resultado.filter(item => item.estadoTiempo === filtroEstado);
    }

    if (!mostrarFinalizadas && filtroEstado === 'todas') {
      resultado = resultado.filter(item => item.estadoTiempo !== 'finalizada');
    }

    return resultado;
  }, [asignaturasConEstado, busqueda, filtroLic, filtroAsignatura, filtroHora, filtroDia, filtroEstado, mostrarFinalizadas]);

  // Métricas del Directorio
  const stats = useMemo(() => {
    const enCurso = asignaturasConEstado.filter(c => c.estadoTiempo === 'en_curso').length;
    const proximas = asignaturasConEstado.filter(c => c.estadoTiempo === 'proxima').length;
    const finalizadas = asignaturasConEstado.filter(c => c.estadoTiempo === 'finalizada').length;
    const total = asignaturasConEstado.length;
    return { enCurso, proximas, finalizadas, total };
  }, [asignaturasConEstado]);

  // Funciones rápidas para cambiar de vistas
  const verBaseDatosTotal = () => {
    setFiltroEstado('todas');
    setMostrarFinalizadas(true);
    setFiltroLic('');
    setFiltroAsignatura('');
    setFiltroHora('');
    setFiltroDia('');
    setBusqueda('');
  };

  const verClasesEnCurso = () => {
    setFiltroEstado('en_curso');
    setMostrarFinalizadas(false);
  };

  const fechaFormateada = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="max-w-[1280px] mx-auto space-y-8 font-manrope p-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1b1c1e] tracking-tight">Directorio General de Horarios</h1>
          <p className="text-base text-[#44464e] mt-1.5">Visualización centralizada con monitoreo en tiempo real.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="bg-white rounded-xl px-5 py-3 border border-[#c5c6cf]/50 flex items-center gap-3 shadow-sm">
            <span className="material-symbols-outlined text-green-500 text-sm animate-pulse">sensors</span>
            <span className="text-xs font-bold text-[#75777f]">EN LÍNEA</span>
            <span className="text-[#c5c6cf]">•</span>
            <span className="text-sm font-semibold text-[#1b1c1e] capitalize">{fechaFormateada}</span>
          </div>
          <button 
            onClick={() => navigate('/horarios')}
            className="bg-[#1c355e] text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-[#152a4a] transition-all flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span> Cargar BD
          </button>
        </div>
      </div>

      {/* MÉTRICAS SUPERIORES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
        <div className={`border rounded-2xl p-4 lg:p-6 flex flex-col justify-between shadow-sm cursor-pointer transition-transform hover:scale-[1.02] ${stats.enCurso > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#c5c6cf]/50'}`} onClick={verClasesEnCurso}>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-2">En Curso</p>
            <h3 className={`text-3xl lg:text-5xl font-extrabold ${stats.enCurso > 0 ? 'text-blue-700' : 'text-[#c5c6cf]'}`}>{stats.enCurso}</h3>
          </div>
          <p className="text-[10px] lg:text-xs font-semibold text-[#75777f] mt-2">Click para filtrar</p>
        </div>

        <div className={`border rounded-2xl p-4 lg:p-6 flex flex-col justify-between shadow-sm ${stats.proximas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#c5c6cf]/50'}`}>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Próximas</p>
            <h3 className={`text-3xl lg:text-5xl font-extrabold ${stats.proximas > 0 ? 'text-amber-700' : 'text-[#c5c6cf]'}`}>{stats.proximas}</h3>
          </div>
          <p className="text-[10px] lg:text-xs font-semibold text-[#75777f] mt-2">de {stats.total}</p>
        </div>

        <div className={`border rounded-2xl p-4 lg:p-6 flex flex-col justify-between shadow-sm ${stats.finalizadas > 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-[#c5c6cf]/50'}`}>
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-2">Finalizadas</p>
            <h3 className={`text-3xl lg:text-5xl font-extrabold ${stats.finalizadas > 0 ? 'text-gray-700' : 'text-[#c5c6cf]'}`}>{stats.finalizadas}</h3>
          </div>
          <p className="text-[10px] lg:text-xs font-semibold text-[#75777f] mt-2">de {stats.total}</p>
        </div>

        <div 
          onClick={verBaseDatosTotal}
          className="bg-gradient-to-br from-[#1c355e] to-[#0f1f3a] border border-[#1c355e] rounded-2xl p-4 lg:p-6 shadow-lg text-white flex flex-col justify-between cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <div>
            <p className="text-[10px] lg:text-[11px] font-bold text-white/70 uppercase tracking-widest mb-2">Ver BD Total</p>
            <h3 className="text-3xl lg:text-5xl font-extrabold text-white">{stats.total}</h3>
          </div>
          <p className="text-[10px] lg:text-xs text-white/70 mt-2 font-semibold">Click para mostrar todo</p>
        </div>
      </div>

      {/* FILTROS AVANZADOS */}
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-[#c5c6cf]/50 shadow-sm space-y-4">
        
        {/* Fila 1: Búsqueda y Botones de acción rápida */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="w-full lg:w-1/3 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#75777f] text-[20px]">search</span>
            <input 
              className="w-full pl-10 pr-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
              placeholder="Buscar por docente o aula..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full lg:w-auto">
             <button 
              onClick={verClasesEnCurso}
              className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filtroEstado === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-[#44464e] border-[#c5c6cf]/50 hover:bg-gray-50'}`}
            >
              Solo En Curso
            </button>
            <button 
              onClick={verBaseDatosTotal}
              className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filtroEstado === 'todas' && mostrarFinalizadas ? 'bg-[#1c355e] text-white border-[#1c355e]' : 'bg-white text-[#44464e] border-[#c5c6cf]/50 hover:bg-gray-50'}`}
            >
              Base de Datos Total
            </button>
          </div>
        </div>

        <hr className="border-[#c5c6cf]/30" />

        {/* Fila 2: Selectores de Filtro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select 
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
            onChange={(e) => setFiltroEstado(e.target.value)}
            value={filtroEstado}
          >
            <option value="todas">Todos los Estados</option>
            <option value="en_curso">▶ Solo En Curso</option>
            <option value="proxima">Próximas</option>
            <option value="finalizada">Finalizadas</option>
          </select>

          <select 
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
            onChange={(e) => setFiltroLic(e.target.value)}
            value={filtroLic}
          >
            <option value="">Todas las Licenciaturas</option>
            {opcionesLicenciatura.map(lic => <option key={lic} value={lic}>{lic}</option>)}
          </select>

          <select 
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
            onChange={(e) => setFiltroAsignatura(e.target.value)}
            value={filtroAsignatura}
          >
            <option value="">Todas las Asignaturas</option>
            {opcionesAsignatura.map(asig => <option key={asig} value={asig}>{asig}</option>)}
          </select>

          <select 
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
            onChange={(e) => setFiltroHora(e.target.value)}
            value={filtroHora}
          >
            <option value="">Todas las Horas</option>
            {opcionesHora.map(hora => <option key={hora} value={hora}>{hora}</option>)}
          </select>

          <select 
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]" 
            onChange={(e) => setFiltroDia(e.target.value)}
            value={filtroDia}
          >
            <option value="">Todos los Días</option>
            <option value="Lunes">Lunes</option>
            <option value="Martes">Martes</option>
            <option value="Miércoles">Miércoles</option>
            <option value="Jueves">Jueves</option>
            <option value="Viernes">Viernes</option>
            <option value="Sábado">Sábado</option>
          </select>
        </div>

        {/* Mostrar finalizadas extra toggle */}
        {filtroEstado === 'todas' && (
          <div className="flex justify-end pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#44464e] select-none hover:text-[#1c355e] transition-colors">
              <input 
                type="checkbox" 
                checked={mostrarFinalizadas} 
                onChange={(e) => setMostrarFinalizadas(e.target.checked)}
                className="w-4 h-4 rounded accent-[#1c355e] cursor-pointer"
              />
              Incluir clases finalizadas en la vista
            </label>
          </div>
        )}
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#1c355e] text-white text-[11px] uppercase font-bold tracking-widest">
                <th className="py-4 px-6">Día</th>
                <th className="py-4 px-6">Docente</th>
                <th className="py-4 px-6">Licenciatura</th>
                <th className="py-4 px-6">Asignatura</th>
                <th className="py-4 px-6">Horario</th>
                <th className="py-4 px-6">Aula</th>
                <th className="py-4 px-6">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c5c6cf]/30">
              {cargando ? (
                <tr><td colSpan="7" className="py-12 text-center text-[#75777f] font-bold"><span className="material-symbols-outlined animate-spin text-2xl mb-2">sync</span><p>Sincronizando datos...</p></td></tr>
              ) : asignaturas.length === 0 ? (
                <tr><td colSpan="7" className="py-16 text-center text-[#75777f]"><span className="material-symbols-outlined text-5xl mb-3 text-[#c5c6cf]">database</span><p className="font-bold text-lg">Directorio Vacío</p><p className="text-sm mt-1">No hay horarios cargados en la base de datos.</p></td></tr>
              ) : datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-[#75777f]">
                    <span className="material-symbols-outlined text-5xl mb-3 text-[#c5c6cf]">filter_list_off</span>
                    <p className="font-bold text-lg">No hay clases visibles</p>
                    <p className="text-sm mt-1">Intenta dar clic en <b>"Base de Datos Total"</b> o limpia los filtros.</p>
                  </td>
                </tr>
              ) : (
                datosFiltrados.map((item, index) => (
                  <tr key={item.Id || item.id || index} className="text-sm hover:bg-[#f4f3f6]/50 transition-colors">
                    <td className="py-5 px-6 font-bold text-[#44464e] capitalize">{item.diaOriginal || "—"}</td>
                    <td className="py-5 px-6 font-bold text-[#1b1c1e]">{item.docente}</td>
                    <td className="py-5 px-6">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border whitespace-nowrap ${obtenerColorLicenciatura(item.licenciatura)}`}>
                        {item.licenciatura}
                      </span>
                    </td>
                    <td className="py-5 px-6 font-medium text-[#44464e]">{item.asignatura}</td>
                    <td className="py-5 px-6 font-mono text-[#1c355e] font-bold text-xs whitespace-nowrap">{item.textoHora}</td>
                    <td className="py-5 px-6 font-bold text-[#1c355e]">{item.aula_asignada || "—"}</td>
                    <td className="py-5 px-6">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${
                        item.estadoTiempo === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {item.estadoTiempo === 'en_curso' ? 'play_circle' : item.estadoTiempo === 'finalizada' ? 'stop_circle' : 'schedule'}
                        </span>
                        {item.estadoTiempo.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}