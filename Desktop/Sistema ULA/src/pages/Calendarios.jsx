import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

export default function Calendarios() {
  const [tabActual, setTabActual] = useState('generales');
  const [calendarios, setCalendarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [examenesData, setExamenesData] = useState({}); // {carrera: [...datos]}
  const [carreraExpandida, setCarreraExpandida] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');

  const carreras = ['DER', 'ENF', 'GAS', 'ISC', 'NEG', 'NUT', 'PSCF', 'PSIC', 'VMK'];
  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

  const fetchCalendarios = async () => {
    try {
      const res = await fetch(`${API_URL}/api/calendarios`);
      const data = await res.json();
      setCalendarios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al obtener calendarios:', error);
      setCalendarios([]);
    } finally {
      setCargando(false);
    }
  };

  const fetchExamenesCarrera = async (carrera) => {
    try {
      const res = await fetch(`${API_URL}/api/examenes-calendario/${carrera}`);
      const data = await res.json();
      setExamenesData(prev => ({ ...prev, [carrera]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      console.error(`Error al obtener exámenes de ${carrera}:`, error);
      setExamenesData(prev => ({ ...prev, [carrera]: [] }));
    }
  };

  useEffect(() => {
    fetchCalendarios();
  }, []);

  const handleUploadClick = (tipo, carrera = '') => {
    setUploadTarget({ tipo, carrera });
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTarget) return;

    if (file.type !== 'application/pdf') {
      Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('tipo', uploadTarget.tipo);
    formData.append('carrera', uploadTarget.carrera);
    formData.append('archivo', file);

    Swal.fire({ title: 'Procesando calendario...', text: 'Extrayendo datos del PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await fetch(`${API_URL}/api/calendarios/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        if (data.total) {
          Swal.fire({
            icon: 'success',
            title: '¡Datos extraídos!',
            html: `Se extrajeron <b>${data.total}</b> exámenes del PDF y se guardaron en la base de datos.`,
            confirmButtonColor: '#1c355e'
          });
          // Recargar los datos de exámenes para esta carrera
          fetchExamenesCarrera(uploadTarget.carrera);
          setCarreraExpandida(uploadTarget.carrera);
        } else {
          Swal.fire('¡Éxito!', data.message, 'success');
        }
        fetchCalendarios();
      } else {
        Swal.fire('Error', data.detail || 'Ocurrió un error al subir', 'error');
      }
    } catch (error) {
      console.error("Error al subir archivo:", error);
      Swal.fire('Error', `No se pudo completar: ${error.message}`, 'error');
    }
  };

  const getCal = (tipo, carrera = '') => calendarios.find(c => c.tipo === tipo && c.carrera === carrera);

  const handleVerDatos = async (carrera) => {
    if (carreraExpandida === carrera) {
      setCarreraExpandida(null);
      return;
    }
    if (!examenesData[carrera]) {
      await fetchExamenesCarrera(carrera);
    }
    setCarreraExpandida(carrera);
    setPeriodoFiltro('todos');
  };

  // Obtener periodos únicos de los datos de una carrera
  const getPeriodos = (carrera) => {
    const datos = examenesData[carrera] || [];
    return [...new Set(datos.map(d => d.periodo))];
  };

  // Filtrar datos por periodo
  const getDatosFiltrados = (carrera) => {
    const datos = examenesData[carrera] || [];
    if (periodoFiltro === 'todos') return datos;
    return datos.filter(d => d.periodo === periodoFiltro);
  };

  // Agrupar datos por periodo y semestre para la vista de tabla
  const getDatosAgrupados = (carrera) => {
    const datos = getDatosFiltrados(carrera);
    const agrupado = {};
    datos.forEach(d => {
      if (!agrupado[d.periodo]) agrupado[d.periodo] = {};
      if (!agrupado[d.periodo][d.semestre]) agrupado[d.periodo][d.semestre] = [];
      agrupado[d.periodo][d.semestre].push(d);
    });
    return agrupado;
  };

  // Colores por periodo
  const periodoColor = (periodo) => {
    const p = periodo.toLowerCase();
    if (p.includes('primer')) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' };
    if (p.includes('segundo')) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
    if (p.includes('ordinario')) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' };
    if (p.includes('extraordinario')) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' };
    return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' };
  };

  // Funciones para renderizar el estado del archivo
  const renderCardStatus = (cal) => {
    if (cal) {
      return (
        <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
          <span className="material-symbols-outlined text-[14px]">check_circle</span> Cargado
        </p>
      );
    }
    return (
      <p className="text-xs text-amber-500 font-bold flex items-center gap-1 mt-0.5">
        <span className="material-symbols-outlined text-[14px]">warning</span> Pendiente de carga
      </p>
    );
  };

  const renderCardButton = (cal, tipo, carrera = '') => {
    if (cal) {
      return (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <a href={`${API_URL}${cal.archivo_url}`} target="_blank" rel="noreferrer" 
             className="w-full py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[18px]">visibility</span> Ver
          </a>
          <button onClick={() => handleUploadClick(tipo, carrera)}
                  className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[18px]">update</span> Cambiar
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => handleUploadClick(tipo, carrera)}
              className="w-full mt-4 py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
        <span className="material-symbols-outlined">upload_file</span>
        Subir PDF
      </button>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Input oculto para subir archivos */}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1c355e] capitalize">Calendarios Académicos</h1>
          <p className="text-sm text-slate-500 font-medium">Gestión de calendarios generales y fechas de exámenes</p>
        </div>
      </div>

      <div className="flex gap-6 border-b border-[#c5c6cf]/30">
        <button onClick={() => setTabActual('generales')}
          className={`pb-3 text-sm font-bold transition-all border-b-[3px] ${tabActual === 'generales' ? 'border-[#fdbb11] text-[#1c355e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Calendarios Generales
        </button>
        <button onClick={() => setTabActual('examenes')}
          className={`pb-3 text-sm font-bold transition-all border-b-[3px] ${tabActual === 'examenes' ? 'border-[#fdbb11] text-[#1c355e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Calendarios de Exámenes
        </button>
      </div>

      <div className="pt-2">
        {cargando ? (
          <div className="flex justify-center items-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#1c355e]">sync</span>
          </div>
        ) : tabActual === 'generales' ? (
          <div className="grid grid-cols-1 gap-6 max-w-3xl">
            {/* Calendario Institucional (Cuatrimestral y Semestral) */}
            <div className={`bg-white rounded-2xl shadow-sm border ${getCal('general') ? 'border-emerald-200' : 'border-[#c5c6cf]/30'} p-6 flex flex-col transition-colors`}>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCal('general') ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <span className="material-symbols-outlined text-[24px]">calendar_view_month</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#1b1c1e] text-lg">Calendario Institucional</h3>
                  {renderCardStatus(getCal('general'))}
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-6 flex-1">
                Documento oficial único con las fechas clave y programación para todos los planes (Cuatrimestral y Semestral).
              </p>
              {renderCardButton(getCal('general'), 'general')}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grid de tarjetas de carreras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {carreras.map(carrera => {
                const cal = getCal('examenes', carrera);
                const isExpanded = carreraExpandida === carrera;
                return (
                  <div key={carrera} className={`bg-white rounded-2xl shadow-sm border ${cal ? 'border-emerald-200' : 'border-[#c5c6cf]/30'} ${isExpanded ? 'ring-2 ring-indigo-300' : ''} p-5 group transition-all hover:shadow-md`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${cal ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'}`}>
                        <span className="material-symbols-outlined text-[20px]">{cal ? 'check_circle' : 'calendar_month'}</span>
                      </div>
                      <div>
                        <h3 className="font-black text-[#1c355e] text-lg">{carrera}</h3>
                        <p className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest ${cal ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {cal ? 'Datos cargados' : 'Sin archivo'}
                        </p>
                      </div>
                    </div>
                    {cal ? (
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button onClick={() => handleVerDatos(carrera)}
                                className={`w-full py-2 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1 ${isExpanded ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                          <span className="material-symbols-outlined text-[16px]">{isExpanded ? 'expand_less' : 'table_chart'}</span>
                          {isExpanded ? 'Ocultar' : 'Ver Datos'}
                        </button>
                        <button onClick={() => handleUploadClick('examenes', carrera)}
                                className="w-full py-2 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1">
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleUploadClick('examenes', carrera)} 
                              className="w-full mt-4 py-2.5 rounded-xl border-2 border-dashed border-amber-200 text-amber-600 text-xs font-bold hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">upload</span> Subir Exámenes
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Panel expandido con datos de exámenes */}
            {carreraExpandida && examenesData[carreraExpandida] && (
              <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6 animate-in slide-in-from-top">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-indigo-600 text-[22px]">table_chart</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1c355e] text-lg">Exámenes — {carreraExpandida}</h3>
                      <p className="text-xs text-slate-400 font-medium">{examenesData[carreraExpandida].length} exámenes registrados</p>
                    </div>
                  </div>

                  {/* Filtro de periodo */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setPeriodoFiltro('todos')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodoFiltro === 'todos' ? 'bg-[#1c355e] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      Todos
                    </button>
                    {getPeriodos(carreraExpandida).map(p => {
                      const colors = periodoColor(p);
                      return (
                        <button key={p} onClick={() => setPeriodoFiltro(p)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${periodoFiltro === p ? colors.badge + ' ring-1 ring-offset-1' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tabla de datos agrupada por periodo */}
                {Object.entries(getDatosAgrupados(carreraExpandida)).map(([periodo, semestres]) => {
                  const colors = periodoColor(periodo);
                  return (
                    <div key={periodo} className="mb-6 last:mb-0">
                      <div className={`flex items-center gap-2 mb-3 px-1`}>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black ${colors.badge}`}>
                          <span className="material-symbols-outlined text-[14px]">event</span>
                          {periodo}
                        </span>
                      </div>

                      <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={`${colors.bg}`}>
                              <th className="text-left px-4 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-28">Semestre</th>
                              <th className="text-left px-4 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider">Materia</th>
                              <th className="text-left px-4 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-28">Día</th>
                              <th className="text-left px-4 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-36">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(semestres).map(([semestre, examenes], sIdx) => (
                              examenes.map((ex, eIdx) => (
                                <tr key={`${sIdx}-${eIdx}`} className={`border-t ${colors.border} hover:${colors.bg} transition-colors ${eIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                  {eIdx === 0 && (
                                    <td rowSpan={examenes.length} className={`px-4 py-2 font-bold text-xs ${colors.text} border-r ${colors.border} align-top`}>
                                      {semestre}
                                    </td>
                                  )}
                                  <td className="px-4 py-2 text-[#1b1c1e] font-medium text-xs">{ex.materia}</td>
                                  <td className="px-4 py-2 text-slate-500 text-xs capitalize">{ex.dia}</td>
                                  <td className="px-4 py-2 text-slate-500 text-xs">{ex.fecha}</td>
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                {getDatosFiltrados(carreraExpandida).length === 0 && (
                  <div className="text-center py-10 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
                    <p className="font-medium">No hay exámenes para este filtro</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
