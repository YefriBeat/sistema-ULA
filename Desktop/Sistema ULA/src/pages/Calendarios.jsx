import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTime } from '../components/TimeContext';
import Swal from 'sweetalert2';
import AgendaEventos from '../components/AgendaEventos';

export default function Calendarios() {
  const location = useLocation();
  const ahora = useTime();
  const [tabActual, setTabActual] = useState(
    location.state?.tab || sessionStorage.getItem('calendarios_tab') || 'generales'
  );
  
  useEffect(() => {
    if (location.state?.tab) {
      setTabActual(location.state.tab);
    }
  }, [location.state?.tab]);

  useEffect(() => {
    sessionStorage.setItem('calendarios_tab', tabActual);
  }, [tabActual]);

  const [calendarios, setCalendarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [examenesData, setExamenesData] = useState({}); // {carrera: [...datos]}
  const [carreraExpandida, setCarreraExpandida] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');
  const [eventosSincronizados, setEventosSincronizados] = useState([]);

  // ── Estado para modal de exportación ──
  const [modalExportar, setModalExportar] = useState(false);
  const [exportCarreras, setExportCarreras] = useState([]);
  const [exportTipoFecha, setExportTipoFecha] = useState('todas'); // 'todas', 'actual', 'personalizada'
  const [exportFechaCustom, setExportFechaCustom] = useState('');
  const [exportCorreo, setExportCorreo] = useState('');
  const [formatoCorreo, setFormatoCorreo] = useState('pdf');
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);

  // ── Estado para modal de carga masiva Excel ──
  const [modalSubirExcel, setModalSubirExcel] = useState(false);
  const [subiendoExcel, setSubiendoExcel] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ── NUEVO: Estado para ciclos escolares ──
  const [ciclosDisponibles, setCiclosDisponibles] = useState([]);
  const [cicloSeleccionado, setCicloSeleccionado] = useState('');
  const [cicloActual, setCicloActual] = useState('');

  // ── Handler para subir archivo Excel masivo ──
  const handleSubirExcelMasivo = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      Swal.fire('Error', 'Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)', 'error');
      return;
    }

    setSubiendoExcel(true);
    Swal.fire({ title: 'Procesando archivo...', html: 'Analizando carreras, materias y fechas de exámenes...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('ciclo_escolar', cicloSeleccionado);

    try {
      const res = await fetch(`${API_URL}/api/examenes-calendario/upload-excel`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        const detalleHtml = Object.entries(data.detalle || {})
          .map(([c, n]) => `<b>${c}</b>: ${n} exámenes`)
          .join('<br/>');
        await Swal.fire({
          icon: 'success',
          title: '¡Carga masiva exitosa!',
          html: `Se procesaron <b>${data.total}</b> exámenes de <b>${data.carreras?.length || 0}</b> carreras.<br/><br/><div class="text-left text-sm">${detalleHtml}</div>`,
          confirmButtonColor: '#1c355e'
        });
        setModalSubirExcel(false);
        fetchCalendarios();
        setExamenesData({});
        setCarreraExpandida(null);
      } else {
        Swal.fire('Error', data.detail || 'No se pudo procesar el archivo', 'error');
      }
    } catch (err) {
      Swal.fire('Error', `Error de conexión: ${err.message}`, 'error');
    } finally {
      setSubiendoExcel(false);
    }
  };

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

  // Limpia cualquier hora (ej. '12:00 a. m.') y formatea solo la fecha (DD/MM/YYYY)
  const formatearSoloFecha = (val) => {
    if (!val) return '—';
    const str = String(val).trim();
    // Formato ISO: YYYY-MM-DD
    const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (matchIso) {
      const y = matchIso[1];
      const m = matchIso[2].padStart(2, '0');
      const d = matchIso[3].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    // Formato DD/MM/YYYY
    const matchDmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (matchDmy) {
      const d = matchDmy[1].padStart(2, '0');
      const m = matchDmy[2].padStart(2, '0');
      const y = matchDmy[3];
      return `${d}/${m}/${y}`;
    }
    // Quitar cualquier hora en texto
    const limpia = str.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?/gi, '').trim();
    return limpia || '—';
  };

  // Función para determinar si un examen es HOY basado en strings de PDF o Excel
  const isExamToday = (ex) => {
    const fechasToCheck = [ex.primer_parcial, ex.segundo_parcial, ex.ordinario, ex.fecha].filter(Boolean);
    if (fechasToCheck.length === 0) return false;
    
    const day = ahora.getDate();
    const dayPad = String(day).padStart(2, '0');
    const monthNum = String(ahora.getMonth() + 1).padStart(2, '0');
    const year = ahora.getFullYear();
    const month = ahora.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
    const monthShort = ahora.toLocaleString('es-ES', { month: 'short' }).toLowerCase();

    return fechasToCheck.some(f => {
      const fStr = String(f).toLowerCase();
      
      // Match formatos numéricos: DD/MM/YYYY o YYYY-MM-DD
      if (fStr.includes(`${dayPad}/${monthNum}/${year}`) || fStr.includes(`${day}/${monthNum}/${year}`)) {
        return true;
      }
      if (fStr.includes(`${year}-${monthNum}-${dayPad}`) || fStr.includes(`${year}-${monthNum}-${day}`)) {
        return true;
      }

      // Buscar si hay rango, ej: "20 al 27", "20-27"
      let hasDay = false;
      const match = fStr.match(/\b(\d{1,2})\s*(?:al|-|a)\s*(\d{1,2})\b/i);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (day >= start && day <= end) hasDay = true;
      }
      if (!hasDay) {
        hasDay = new RegExp(`\\b0?${day}\\b`).test(fStr) || new RegExp(`\\b0?${day}\\b`).test(String(ex.dia || ''));
      }
      
      const mesesArray = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const containsAnyMonth = mesesArray.some(m => new RegExp(`\\b${m}\\b`).test(fStr));
      const hasMonth = fStr.includes(month) || fStr.includes(monthShort);
      
      if (containsAnyMonth) {
        return hasDay && hasMonth;
      }
      return false;
    });
  };

  // ── NUEVO: CRUD Modal Eventos ──
  const [modalAbierto, setModalAbierto] = useState(false);
  const [eventoEditar, setEventoEditar] = useState(null);
  const [formData, setFormData] = useState({
    plan: 'cuatrimestral', ciclo: '', periodo: 1, tipo_evento: 'inicio_periodo',
    descripcion: '', fecha_inicio: '', fecha_fin: '', suspende_clases: 0
  });

  const abrirModalNuevo = () => {
    setEventoEditar(null);
    setFormData({
      plan: 'cuatrimestral', ciclo: cicloSeleccionado, periodo: 1, tipo_evento: 'inicio_periodo',
      descripcion: '', fecha_inicio: fechaActualStr, fecha_fin: fechaActualStr, suspende_clases: 0
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (ev) => {
    setEventoEditar(ev);
    setFormData({
      plan: ev.plan, ciclo: ev.ciclo, periodo: ev.periodo, tipo_evento: ev.tipo_evento,
      descripcion: ev.descripcion, fecha_inicio: ev.fecha_inicio, fecha_fin: ev.fecha_fin, suspende_clases: ev.suspende_clases
    });
    setModalAbierto(true);
  };

  const guardarEvento = async (e) => {
    e.preventDefault();
    try {
      const url = eventoEditar 
        ? `${API_URL}/api/calendario-institucional/evento/${eventoEditar.id}`
        : `${API_URL}/api/calendario-institucional/evento`;
      
      const res = await fetch(url, {
        method: eventoEditar ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        Swal.fire('¡Éxito!', 'Evento guardado correctamente', 'success');
        setModalAbierto(false);
        fetchCalendarios();
      } else {
        const error = await res.json();
        Swal.fire('Error', error.detail || 'No se pudo guardar', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de conexión', 'error');
    }
  };

  const eliminarEvento = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar evento?',
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/calendario-institucional/evento/${id}`, { method: 'DELETE' });
        if (res.ok) {
          Swal.fire('Eliminado', 'Evento eliminado', 'success');
          fetchCalendarios();
        } else {
          Swal.fire('Error', 'No se pudo eliminar', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Error de conexión', 'error');
      }
    }
  };

  const fetchExamenesCarrera = async (carrera) => {
    try {
      const res = await fetch(`${API_URL}/api/examenes-calendario/${carrera}?ciclo_escolar=${cicloSeleccionado}`);
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
          await Swal.fire({
            icon: 'success',
            title: '¡Datos extraídos!',
            html: `Se extrajeron <b>${data.total}</b> exámenes del PDF y se guardaron en la base de datos.`,
            confirmButtonColor: '#1c355e'
          });
          fetchCalendarios();
          if (uploadTarget.carrera) {
            fetchExamenesCarrera(uploadTarget.carrera);
          }
        } else {
          await Swal.fire('¡Éxito!', data.message, 'success');
          fetchCalendarios();
        }
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

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1c355e] tracking-tight">Calendarios Académicos</h1>
          <p className="text-sm text-[#44464e]/80 mt-1 font-medium">Gestión de calendarios generales y fechas de exámenes</p>
        </div>

        {/* ── SELECTOR DE CICLO ESCOLAR ── */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-white p-2 rounded-2xl shadow-sm border border-[#c5c6cf]/40">
          {cicloSeleccionado !== cicloActual && (
            <span className="hidden sm:flex text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">info</span>
              Ciclo futuro
            </span>
          )}
          <div className="flex flex-1 items-center gap-2 bg-[#f4f3f6] rounded-xl px-4 py-2 w-full sm:w-64">
            <span className="material-symbols-outlined text-[18px] text-[#75777f]">date_range</span>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">Ciclo:</label>
            <select
              value={cicloSeleccionado}
              onChange={(e) => setCicloSeleccionado(e.target.value)}
              className="bg-transparent text-[#1c355e] font-bold text-sm outline-none cursor-pointer flex-1 w-full"
            >
              {ciclosDisponibles.map(c => (
                <option key={c} value={c}>
                  {c} {c === cicloActual ? '(Actual)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="h-8 w-px bg-[#c5c6cf]/30 hidden sm:block"></div>
          <button 
            onClick={handleDeleteCiclo}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition-all shadow-sm flex-shrink-0"
            title={`Eliminar ciclo ${cicloSeleccionado}`}
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            <span className="sm:hidden">Eliminar Ciclo</span>
          </button>
        </div>
      </div>

      {/* ── TABS NAVEGACIÓN ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-[#c5c6cf]/40 shadow-sm">
        <div className="flex items-center gap-1 bg-[#f4f3f6] p-1 rounded-xl overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'generales', label: 'Calendarios Generales', icon: 'event' },
            { id: 'examenes',  label: 'Calendarios de Exámenes', icon: 'assignment' },
            { id: 'agenda',    label: 'Agenda de Eventos', icon: 'event_available' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTabActual(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                tabActual === tab.id
                  ? 'bg-white text-[#1c355e] shadow-sm'
                  : 'text-[#75777f] hover:text-[#1c355e]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        {/* Botones de acción (solo en tab exámenes) */}
        {tabActual === 'examenes' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalSubirExcel(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#1c355e] text-white hover:bg-[#284a7e] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Subir Fechas (Excel)
            </button>
            <button
              onClick={() => setModalExportar(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Exportar / Enviar
            </button>
          </div>
        )}
      </div>

      <div className="pt-2">
        {cargando ? (
          <div className="flex justify-center items-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#1c355e]">sync</span>
          </div>
        ) : tabActual === 'agenda' ? (
          <AgendaEventos />
        ) : tabActual === 'generales' ? (
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Columna izquierda: Tarjetas de control */}
            <div className="flex flex-col gap-6 w-full lg:w-1/3 lg:sticky lg:top-6 self-start">
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
                        await Swal.fire('¡Listo!', data.message, 'success');
                        window.location.reload();
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
              <div className="bg-[#1c355e] p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-white text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined">event_available</span>
                    Memoria del Sistema ({cicloSeleccionado})
                  </h3>
                  <p className="text-white/80 text-sm mt-1">Fechas extraídas que el sistema está utilizando actualmente.</p>
                </div>
                <button 
                  onClick={abrirModalNuevo}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Nuevo Evento
                </button>
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
                        <th className="px-4 py-3 font-semibold text-slate-700 text-right">Acciones</th>
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
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => abrirModalEditar(ev)}
                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-colors"
                                    title="Editar"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                  </button>
                                  <button 
                                    onClick={() => eliminarEvento(ev.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                    title="Eliminar"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
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
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-20">Grado</th>
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider">Materia</th>
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider">Docente</th>
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-36">1er Parcial</th>
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-36">2do Parcial</th>
                              <th className="text-left px-3 py-2.5 font-bold text-[#1c355e] text-xs uppercase tracking-wider w-36">Ordinario</th>
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
                                  <tr key={`${sIdx}-${eIdx}`} {...trProps} className={`border-t transition-all ${isHoy ? 'bg-emerald-50 shadow-[inset_4px_0_0_0_#10b981]' : `hover:${colors.bg} ${colors.border} ${eIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}`}>
                                    {eIdx === 0 && (
                                      <td rowSpan={examenes.length} className={`px-3 py-2 font-bold text-xs ${colors.text} border-r ${colors.border} align-top`}>
                                        {semestre}
                                      </td>
                                    )}
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-medium text-xs ${isHoy ? 'text-emerald-800' : 'text-[#1b1c1e]'}`}>{ex.materia}</span>
                                        {isHoy && (
                                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Hoy
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className={`px-3 py-2 text-xs ${isHoy ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>{ex.docente || '—'}</td>
                                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${isHoy ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{formatearSoloFecha(ex.primer_parcial || ex.dia)}</td>
                                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${isHoy ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{formatearSoloFecha(ex.segundo_parcial)}</td>
                                    <td className={`px-3 py-2 text-xs whitespace-nowrap ${isHoy ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>{formatearSoloFecha(ex.ordinario || ex.fecha)}</td>
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

      {/* Modal CRUD Evento */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#1c355e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#fdbb11]">event</span>
                {eventoEditar ? 'Editar Evento' : 'Nuevo Evento'}
              </h2>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-xl transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={guardarEvento} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Plan</label>
                  <select value={formData.plan} onChange={e => setFormData({...formData, plan: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium">
                    <option value="cuatrimestral">Cuatrimestral</option>
                    <option value="semestral">Semestral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Periodo</label>
                  <input type="number" min="1" max="6" value={formData.periodo} onChange={e => setFormData({...formData, periodo: parseInt(e.target.value)})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Tipo de Evento</label>
                <select value={formData.tipo_evento} onChange={e => setFormData({...formData, tipo_evento: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium">
                  <option value="inicio_periodo">Inicio de Periodo / Ciclo</option>
                  <option value="fin_periodo">Fin de Periodo / Ciclo</option>
                  <option value="examen_parcial">Examen Parcial</option>
                  <option value="examen_ordinario">Examen Ordinario</option>
                  <option value="examen_extraordinario">Examen Extraordinario</option>
                  <option value="inscripcion">Inscripción</option>
                  <option value="evaluacion">Evaluación Docente</option>
                  <option value="inhabil">Día Inhábil</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Descripción</label>
                <input type="text" required value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} placeholder="Ej: Primer examen parcial" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Fecha Inicio</label>
                  <input type="date" required value={formData.fecha_inicio} onChange={e => setFormData({...formData, fecha_inicio: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Fecha Fin</label>
                  <input type="date" required value={formData.fecha_fin} onChange={e => setFormData({...formData, fecha_fin: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium" />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <input type="checkbox" id="suspende" checked={formData.suspende_clases === 1} onChange={e => setFormData({...formData, suspende_clases: e.target.checked ? 1 : 0})} className="w-5 h-5 accent-indigo-500 cursor-pointer" />
                <label htmlFor="suspende" className="text-sm font-bold text-slate-700 cursor-pointer">
                  ¿Suspende clases regulares?
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 p-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 p-3 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Exportar Exámenes ── */}
      {modalExportar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined">download</span>
                Exportar Exámenes
              </h2>
              <button onClick={() => setModalExportar(false)} className="text-white/60 hover:text-white p-1.5 rounded-xl transition-colors hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Seleccionar carreras */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Carreras</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-0.5">
                  {/* Todas */}
                  <button
                    onClick={() => setExportCarreras([])}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      exportCarreras.length === 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      exportCarreras.length === 0 ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                    }`}>
                      {exportCarreras.length === 0 && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                    </div>
                    Todas las carreras
                  </button>
                  {carreras.map(c => {
                    const selected = exportCarreras.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          setExportCarreras(prev =>
                            selected ? prev.filter(x => x !== c) : [...prev, c]
                          );
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selected
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                        }`}>
                          {selected && <span className="material-symbols-outlined text-white text-[12px]">check</span>}
                        </div>
                        {c}
                      </button>
                    );
                  })}
                </div>
                {exportCarreras.length > 0 && (
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                    {exportCarreras.length} carrera{exportCarreras.length > 1 ? 's' : ''} seleccionada{exportCarreras.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Filtro de fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Filtrar por fecha</label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'todas', label: 'Todas las fechas', icon: 'date_range' },
                    { id: 'actual', label: 'Fecha actual', icon: 'today' },
                    { id: 'personalizada', label: 'Fecha personalizada', icon: 'edit_calendar' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setExportTipoFecha(opt.id);
                        if (opt.id === 'actual') {
                          const d = ahora.getDate();
                          const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
                          setExportFechaCustom(`${String(d).padStart(2,'0')} de ${meses[ahora.getMonth()]}`);
                        } else if (opt.id === 'todas') {
                          setExportFechaCustom('');
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        exportTipoFecha === opt.id
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {exportTipoFecha === 'personalizada' && (
                  <input
                    type="text"
                    placeholder="Ej: septiembre, 28 de septiembre, octubre..."
                    value={exportFechaCustom}
                    onChange={(e) => setExportFechaCustom(e.target.value)}
                    className="w-full mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium"
                  />
                )}
                {exportTipoFecha === 'actual' && (
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Filtrará por: "{exportFechaCustom}"
                  </p>
                )}
              </div>

              {/* Separador */}
              <div className="border-t border-slate-100"></div>

              {/* Botones de Descarga */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.append('ciclo_escolar', cicloSeleccionado);
                    if (exportCarreras.length > 0) params.append('carrera', exportCarreras.join(','));
                    if (exportFechaCustom) params.append('fecha_filtro', exportFechaCustom);
                    window.location.href = `${API_URL}/api/examenes-calendario/exportar/excel?${params.toString()}`;
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <span className="material-symbols-outlined text-[20px]">table_chart</span>
                  Excel
                </button>

                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.append('ciclo_escolar', cicloSeleccionado);
                    if (exportCarreras.length > 0) params.append('carrera', exportCarreras.join(','));
                    if (exportFechaCustom) params.append('fecha_filtro', exportFechaCustom);
                    window.location.href = `${API_URL}/api/examenes-calendario/exportar/pdf?${params.toString()}`;
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
                >
                  <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  PDF
                </button>
              </div>

              {/* Enviar por correo */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Enviar por correo electrónico</p>
                
                {/* Selector de formato */}
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-1.5">Formato del archivo adjunto:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFormatoCorreo('pdf')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                        formatoCorreo === 'pdf'
                          ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      PDF
                    </button>
                    <button
                      onClick={() => setFormatoCorreo('excel')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all border ${
                        formatoCorreo === 'excel'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">table_chart</span>
                      Excel
                    </button>
                  </div>
                </div>

                {/* Email + Enviar */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={exportCorreo}
                    onChange={(e) => setExportCorreo(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-medium"
                  />
                  <button
                    onClick={async () => {
                      if (!exportCorreo || !exportCorreo.includes('@')) {
                        Swal.fire('Error', 'Ingresa un correo válido', 'error');
                        return;
                      }
                      setEnviandoCorreo(true);
                      try {
                        const res = await fetch(`${API_URL}/api/examenes-calendario/enviar-correo`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            correo: exportCorreo,
                            carrera: exportCarreras.length > 0 ? exportCarreras.join(',') : '',
                            ciclo_escolar: cicloSeleccionado,
                            fecha_filtro: exportFechaCustom,
                            formato: formatoCorreo
                          })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          Swal.fire('¡Enviado!', data.message, 'success');
                          setExportCorreo('');
                        } else {
                          Swal.fire('Error', data.detail || 'No se pudo enviar', 'error');
                        }
                      } catch (err) {
                        Swal.fire('Error', 'Error de conexión', 'error');
                      } finally {
                        setEnviandoCorreo(false);
                      }
                    }}
                    disabled={enviandoCorreo}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {enviandoCorreo ? (
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">send</span>
                    )}
                    Enviar
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Se enviará un archivo <strong>{formatoCorreo === 'pdf' ? 'PDF' : 'Excel (.xlsx)'}</strong> adjunto al correo
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Subir Fechas Excel Masivo ── */}
      {modalSubirExcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100">
            <div className="bg-[#1c355e] px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined">upload_file</span>
                Carga Masiva de Exámenes
              </h2>
              <button onClick={() => setModalSubirExcel(false)} className="text-white/60 hover:text-white p-1.5 rounded-xl transition-colors hover:bg-white/10">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0">info</span>
                  <span>Sube un archivo <strong>Excel (.xlsx)</strong> o <strong>CSV</strong> con las fechas de exámenes. El sistema detectará automáticamente cada carrera y llenará todos los cuadros con sus materias, docentes y fechas de parciales/ordinarios.</span>
                </p>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p className="font-bold text-slate-600">Columnas esperadas:</p>
                <p>Grado · Asignatura (Materia) · Docente · 1er. Parcial · 2do. Parcial · Ordinario</p>
                <p className="text-slate-400 mt-1">Puede tener múltiples hojas (una por carrera) o una sola hoja con títulos de licenciatura.</p>
              </div>

              {/* Zona de Drag & Drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleSubirExcelMasivo(file);
                }}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-[#1c355e] bg-indigo-50 scale-[1.02]'
                    : 'border-slate-300 hover:border-[#1c355e] hover:bg-slate-50'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xlsx,.xls,.csv';
                  input.onchange = (e) => {
                    if (e.target.files[0]) handleSubirExcelMasivo(e.target.files[0]);
                  };
                  input.click();
                }}
              >
                <span className={`material-symbols-outlined text-5xl mb-3 block transition-colors ${dragActive ? 'text-[#1c355e]' : 'text-slate-300'}`}>
                  cloud_upload
                </span>
                <p className="font-bold text-[#1c355e] text-sm">Arrastra tu archivo aquí</p>
                <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
                <p className="text-[10px] text-slate-300 mt-3 uppercase tracking-widest font-bold">.xlsx · .xls · .csv</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">warning</span>
                  <span>Esta acción <strong>reemplazará</strong> los datos de exámenes existentes para las carreras detectadas en el archivo del ciclo <strong>{cicloSeleccionado}</strong>.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
