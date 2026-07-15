import { useState, useEffect, useRef } from 'react';
import { useTime } from '../components/TimeContext';
import Swal from 'sweetalert2';

export default function Calendarios() {
  const ahora = useTime();
  const [tabActual, setTabActual] = useState('generales');
  const [calendarios, setCalendarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [examenesData, setExamenesData] = useState({}); // {carrera: [...datos]}
  const [carreraExpandida, setCarreraExpandida] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');
  const [eventosSincronizados, setEventosSincronizados] = useState([]);

  // ── NUEVO: Estado para ciclos escolares ──
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [cicloSeleccionado, setCicloSeleccionado] = useState('');
  const [cicloActual, setCicloActual] = useState('');

  const carreras = ['DER', 'ENF', 'GAS', 'ISC', 'NEG', 'NUT', 'PSCF', 'PSIC', 'VMK'];
  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

  const fechaActualStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  // Cargar ciclos disponibles al montar o al cambiar la fecha
  useEffect(() => {
    const fetchCiclos = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ciclos-disponibles?fecha=${fechaActualStr}`);
        const data = await res.json();
        setCiclosDisponibles(data.ciclos || []);
        setCicloActual(data.ciclo_actual || '');
        setCicloSeleccionado(data.ciclo_actual || (data.ciclos?.[0] || ''));
      } catch (error) {
        console.error('Error al obtener ciclos:', error);
        // Fallback: generar ciclo actual
        const y = ahora.getFullYear();
        const m = ahora.getMonth();
        const ciclo = m >= 7 ? `${y}-${y+1}` : `${y-1}-${y}`;
        setCiclosDisponibles([ciclo]);
        setCicloSeleccionado(ciclo);
        setCicloActual(ciclo);
      }
    };
    fetchCiclos();
  }, [fechaActualStr]);

  const fetchCalendarios = async () => {
    if (!cicloSeleccionado) return;
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/api/calendarios?ciclo_escolar=${cicloSeleccionado}`);
      const data = await res.json();
      setCalendarios(Array.isArray(data) ? data : []);
      
      const resEv = await fetch(`${API_URL}/api/calendario-institucional/eventos`);
      const dataEv = await resEv.json();
      if (resEv.ok) setEventosSincronizados(dataEv.eventos || []);
    } catch (error) {
      console.error('Error al obtener calendarios:', error);
      setCalendarios([]);
    } finally {
      setCargando(false);
    }
  };

  // Auto-scroll al evento de hoy general
  useEffect(() => {
    if (tabActual === 'generales' && eventosSincronizados.length > 0) {
      setTimeout(() => {
        const elementoActivo = document.getElementById('evento-activo-hoy');
        if (elementoActivo) {
          elementoActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [tabActual, eventosSincronizados, cicloSeleccionado]);

  // Auto-scroll al examen de hoy
  useEffect(() => {
    if (tabActual === 'examenes' && carreraExpandida) {
      setTimeout(() => {
        const elementoExamenActivo = document.getElementById('evento-examen-hoy');
        if (elementoExamenActivo) {
          elementoExamenActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [tabActual, carreraExpandida, ahora]);

  // Función para determinar si un examen es HOY basado en strings de PDF
  const isExamToday = (ex) => {
    if (!ex.fecha) return false;
    
    const day = ahora.getDate();
    const month = ahora.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
    const monthShort = ahora.toLocaleString('es-ES', { month: 'short' }).toLowerCase();
    
    const fechaStr = String(ex.fecha).toLowerCase();
    const periodoStr = String(ex.periodo || '').toLowerCase();
    const diaStr = String(ex.dia || '').toLowerCase();
    
    // Buscar si hay rango, ej: "20 al 27", "20-27"
    let hasDay = false;
    const match = fechaStr.match(/\b(\d{1,2})\s*(?:al|-|a)\s*(\d{1,2})\b/i);
    if (match) {
       const start = parseInt(match[1]);
       const end = parseInt(match[2]);
       if (day >= start && day <= end) hasDay = true;
    }
    if (!hasDay) {
       hasDay = new RegExp(`\\b0?${day}\\b`).test(fechaStr) || new RegExp(`\\b0?${day}\\b`).test(diaStr);
    }
    
    const mesesArray = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const containsAnyMonth = mesesArray.some(m => new RegExp(`\\b${m}\\b`).test(fechaStr)) || mesesArray.some(m => new RegExp(`\\b${m}\\b`).test(diaStr));
    
    const hasMonth = fechaStr.includes(month) || fechaStr.includes(monthShort) || diaStr.includes(month) || diaStr.includes(monthShort);
    
    if (containsAnyMonth) {
      return hasDay && hasMonth;
    } else {
      const hasPeriodMonth = periodoStr.includes(month) || periodoStr.includes(monthShort);
      if (hasPeriodMonth) return hasDay;
      return hasDay; // fallback
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

  // Recargar calendarios cuando cambia el ciclo seleccionado
  useEffect(() => {
    if (cicloSeleccionado) {
      fetchCalendarios();
      setCarreraExpandida(null);
      setExamenesData({});
    }
  }, [cicloSeleccionado]);

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

    if (uploadTarget.tipo === 'institucional_csv') {
      if (file.type !== 'application/pdf') {
        Swal.fire('Error', 'Solo se permiten archivos PDF del calendario institucional.', 'error');
        return;
      }
    } else {
      if (file.type !== 'application/pdf') {
        Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');
        return;
      }
    }

    const formData = new FormData();
    formData.append('tipo', uploadTarget.tipo);
    formData.append('carrera', uploadTarget.carrera);
    formData.append('ciclo_escolar', cicloSeleccionado);
    formData.append('archivo', file);

    Swal.fire({ title: 'Procesando calendario...', text: 'Extrayendo datos del PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const endpoint = uploadTarget.tipo === 'institucional_csv' ? `${API_URL}/api/calendario-institucional/csv` : `${API_URL}/api/calendarios/upload`;
      const res = await fetch(endpoint, {
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

  const handleDeleteCiclo = async () => {
    if (!cicloSeleccionado) return;
    
    const result = await Swal.fire({
      title: `¿Eliminar ${cicloSeleccionado}?`,
      text: "Esto borrará todos los PDFs, calendarios generales y fechas de exámenes de este ciclo. ¡No se puede deshacer!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Eliminando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const res = await fetch(`${API_URL}/api/calendarios/ciclo/${cicloSeleccionado}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        
        if (res.ok) {
          Swal.fire('¡Eliminado!', data.message, 'success');
          // Forzar recarga de página para refrescar todos los estados
          setTimeout(() => window.location.reload(), 1500);
        } else {
          Swal.fire('Error', data.detail || 'Ocurrió un error al eliminar', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
      }
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

        {/* ── SELECTOR DE CICLO ESCOLAR ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-[#c5c6cf]/30 shadow-sm px-4 py-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#1c355e]">date_range</span>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Ciclo:</label>
            <select
              value={cicloSeleccionado}
              onChange={(e) => setCicloSeleccionado(e.target.value)}
              className="bg-transparent text-[#1c355e] font-black text-sm outline-none cursor-pointer pr-2"
            >
              {ciclosDisponibles.map(c => (
                <option key={c} value={c}>
                  {c} {c === cicloActual ? '(Actual)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={handleDeleteCiclo}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm border border-red-100"
            title={`Eliminar ciclo ${cicloSeleccionado}`}
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>

          {cicloSeleccionado !== cicloActual && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">info</span>
              Ciclo futuro
            </span>
          )}
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
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Columna izquierda: Tarjetas de control */}
            <div className="flex flex-col gap-6 w-full lg:w-1/3">
              {/* Calendario Institucional (Cuatrimestral y Semestral) */}
            <div className={`bg-white rounded-2xl shadow-sm border ${getCal('general') ? 'border-emerald-200' : 'border-[#c5c6cf]/30'} p-6 flex flex-col transition-colors`}>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCal('general') ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <span className="material-symbols-outlined text-[24px]">calendar_view_month</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#1b1c1e] text-lg">Calendario Institucional</h3>
                  <p className="text-xs text-slate-400 font-medium">Ciclo {cicloSeleccionado}</p>
                  {renderCardStatus(getCal('general'))}
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-6 flex-1">
                Documento oficial único con las fechas clave y programación para todos los planes (Cuatrimestral y Semestral).
              </p>
              {renderCardButton(getCal('general'), 'general')}
            </div>

            {/* Actualizar Base de Datos del Calendario */}
            <div className={`bg-white rounded-2xl shadow-sm border border-[#c5c6cf]/30 p-6 flex flex-col transition-colors`}>
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600`}>
                  <span className="material-symbols-outlined text-[24px]">sync</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#1b1c1e] text-lg">Actualizar Indicadores</h3>
                  <p className="text-xs text-slate-400 font-medium">Sincronizar fechas del calendario con el sistema</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-6 flex-1">
                Extrae automáticamente las fechas del <strong>PDF ya subido</strong> del Calendario Institucional (exámenes, días inhábiles, vacaciones) y actualiza los indicadores del sistema en tiempo real.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={async () => {
                    Swal.fire({ title: 'Sincronizando...', text: 'Extrayendo fechas del PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    try {
                      const res = await fetch(`${API_URL}/api/calendario-institucional/sincronizar/${cicloSeleccionado}`, { method: 'POST' });
                      const data = await res.json();
                      if (res.ok) {
                        Swal.fire('¡Listo!', data.message, 'success');
                        fetchCalendarios(); // Recargar los eventos
                      } else {
                        Swal.fire('Error', data.detail || 'Error al sincronizar', 'error');
                      }
                    } catch (err) {
                      Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
                    }
                  }}
                  disabled={!getCal('general')}
                  className={`flex-1 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all group ${getCal('general') ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:-translate-y-0.5 transition-transform">auto_fix_high</span>
                  {getCal('general') ? 'Extraer y Sincronizar' : 'Sube primero el PDF'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Columna derecha: Visualización de eventos sincronizados */}
          <div className="w-full lg:w-2/3">
            <div className="bg-white rounded-2xl shadow-sm border border-[#c5c6cf]/30 overflow-hidden">
              <div className="bg-[#1c355e] p-5">
                <h3 className="font-black text-white text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined">event_available</span>
                  Memoria del Sistema ({cicloSeleccionado})
                </h3>
                <p className="text-white/80 text-sm mt-1">Fechas extraídas que el sistema está utilizando actualmente.</p>
              </div>
              <div className="p-0 max-h-[500px] overflow-y-auto custom-scrollbar">
                {eventosSincronizados.filter(e => e.ciclo === cicloSeleccionado).length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                    <p>No hay eventos extraídos para el ciclo {cicloSeleccionado}.</p>
                    <p className="text-xs mt-1">Sube el PDF y haz clic en "Extraer y Sincronizar".</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700">Plan</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Periodo</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Evento</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">Fechas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const hoy = ahora;
                        const y = hoy.getFullYear();
                        const m = String(hoy.getMonth() + 1).padStart(2, '0');
                        const d = String(hoy.getDate()).padStart(2, '0');
                        const hoyStr = `${y}-${m}-${d}`;

                        const eventosCiclo = eventosSincronizados.filter(e => e.ciclo === cicloSeleccionado);
                        let yaMarcoPrimero = false;

                        return eventosCiclo.map((ev, i) => {
                          const isHoy = hoyStr >= ev.fecha_inicio && hoyStr <= ev.fecha_fin;
                          const isPasado = hoyStr > ev.fecha_fin;
                          let trProps = {};
                          if (isHoy && !yaMarcoPrimero) {
                            trProps.id = 'evento-activo-hoy';
                            yaMarcoPrimero = true;
                          }
                          
                          // Determinar estilos
                          let trClass = 'hover:bg-slate-50 transition-all';
                          let titleClass = 'text-[#1c355e]';
                          let dateClass = 'text-slate-700';
                          let iconClass = 'text-slate-400';
                          let typeClass = 'text-slate-400';
                          let tagClass = ev.plan === 'semestral' ? 'bg-indigo-50 text-indigo-600' : 'bg-cyan-50 text-cyan-600';
                          let perClass = 'text-slate-700';

                          if (isHoy) {
                            trClass = 'bg-amber-50 shadow-[inset_4px_0_0_0_#f59e0b] transition-all';
                            titleClass = 'text-amber-800';
                            dateClass = 'text-amber-700 font-bold';
                            iconClass = 'text-amber-500';
                            typeClass = 'text-amber-600/80 font-medium';
                            perClass = 'text-amber-700 font-bold';
                          } else if (isPasado) {
                            trClass = 'bg-red-50/20 hover:bg-red-50/40 transition-all opacity-70';
                            titleClass = 'text-red-900/80 line-through decoration-red-300';
                            dateClass = 'text-red-700/80';
                            iconClass = 'text-red-400/60';
                            typeClass = 'text-red-600/60';
                            perClass = 'text-red-700/80';
                            tagClass = ev.plan === 'semestral' ? 'bg-indigo-50/50 text-indigo-600/50' : 'bg-cyan-50/50 text-cyan-600/50';
                          }
                          
                          return (
                            <tr key={`${ev.tipo_evento}-${ev.fecha_inicio}-${ev.plan}-${i}`} {...trProps} className={trClass}>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${tagClass}`}>
                                  {ev.plan}
                                </span>
                              </td>
                              <td className={`px-4 py-3 font-medium ${perClass}`}>P{ev.periodo}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold ${titleClass}`}>{ev.descripcion}</p>
                                  {isHoy && (
                                    <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                      Hoy
                                    </span>
                                  )}
                                  {isPasado && (
                                    <span className="text-[10px] font-black text-red-500/60 uppercase tracking-widest ml-1">
                                      Pasado
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs capitalize ${typeClass}`}>
                                  {ev.tipo_evento.replace('_', ' ')} 
                                  {ev.suspende_clases === 1 && ev.tipo_evento !== 'inhabil' && ' (Inhábil)'}
                                </p>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className={`material-symbols-outlined text-[14px] ${iconClass}`}>calendar_today</span>
                                  <span className={`font-medium ${dateClass}`}>
                                    {ev.fecha_inicio === ev.fecha_fin ? ev.fecha_inicio : `${ev.fecha_inicio} al ${ev.fecha_fin}`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
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
                            {Object.entries(semestres).map(([semestre, examenes], sIdx) => {
                              let yaMarcoPrimero = false;
                              return examenes.map((ex, eIdx) => {
                                const isHoy = isExamToday(ex);
                                let trProps = {};
                                if (isHoy && !yaMarcoPrimero) {
                                  trProps.id = 'evento-examen-hoy';
                                  yaMarcoPrimero = true;
                                }

                                return (
                                  <tr key={`${sIdx}-${eIdx}`} {...trProps} className={`border-t transition-all ${isHoy ? 'bg-amber-50 shadow-[inset_4px_0_0_0_#f59e0b]' : `hover:${colors.bg} ${colors.border} ${eIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}`}>
                                    {eIdx === 0 && (
                                      <td rowSpan={examenes.length} className={`px-4 py-2 font-bold text-xs ${colors.text} border-r ${colors.border} align-top`}>
                                        {semestre}
                                      </td>
                                    )}
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-medium text-xs ${isHoy ? 'text-amber-800' : 'text-[#1b1c1e]'}`}>{ex.materia}</span>
                                        {isHoy && (
                                          <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                            Hoy
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className={`px-4 py-2 text-xs capitalize ${isHoy ? 'text-amber-600/80 font-medium' : 'text-slate-500'}`}>{ex.dia}</td>
                                    <td className={`px-4 py-2 text-xs ${isHoy ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>{ex.fecha}</td>
                                  </tr>
                                );
                              });
                            })}
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
