import { useState, useEffect } from 'react';
import { useToast, ToastContainer } from '../components/useToast';

export default function GestionHorarios() {
  const { toast, toasts } = useToast();
  const [confirmacion, setConfirmacion] = useState(null);

  const [tipoSubida, setTipoSubida] = useState('individual'); // 'individual' o 'lote'
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [nombreCicloCierre, setNombreCicloCierre] = useState('');
  const [modalidadCierre, setModalidadCierre] = useState('ambos');
  const [cargandoCierre, setCargandoCierre] = useState(false);
  // Estados para Visor de Historial
  const [modalHistorial, setModalHistorial] = useState(false);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [datosHistorial, setDatosHistorial] = useState([]);
  
  // -- ESTADOS PARA HISTORIAL AGRUPADO --
  const [archivoExpandido, setArchivoExpandido] = useState(null);
  const [filtroH_semestre, setFiltroH_semestre] = useState('');
  const [filtroH_cuatri, setFiltroH_cuatri] = useState('');
  const [filtroH_carrera, setFiltroH_carrera] = useState('');
  
  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://sistema-ula-backend.onrender.com';

  
  const abrirHistorial = async () => {
    setModalHistorial(true);
    setCargandoHistorial(true);
    try {
      const res = await fetch(`${API_URL}/api/historial-periodos`);
      const data = await res.json();
      if (res.ok) setDatosHistorial(data);
      else toast(data.detail || "Error al cargar el historial.", "error");
    } catch (error) {
      toast("Error de red al cargar el historial.", "error");
    } finally {
      setCargandoHistorial(false);
    }
  };


  const handleCierrePeriodo = async (e) => {
    e.preventDefault();
    if (!nombreCicloCierre.trim()) {
      toast("Debe ingresar un nombre para el ciclo.", "advertencia");
      return;
    }
    setCargandoCierre(true);
    try {
      const res = await fetch('/api/horarios/cierre-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_ciclo: nombreCicloCierre.trim(),
          modalidad: modalidadCierre
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || "Periodo cerrado exitosamente.", "exito");
        setModalCierre(false);
        setNombreCicloCierre('');
        // Recargar horarios y/o archivos
        if (typeof cargarArchivosGuardados === 'function') cargarArchivosGuardados();
      } else {
        toast(data.detail || "Error al cerrar el periodo.", "error");
      }
    } catch (error) {
      toast("Error de red al cerrar periodo.", "error");
    } finally {
      setCargandoCierre(false);
    }
  };
  const [dragActivo, setDragActivo] = useState(false);
  const [asignaciones, setAsignaciones] = useState({});
  const [aulaAsignacionAutomatica, setAulaAsignacionAutomatica] = useState('');
  const [archivosGuardados, setArchivosGuardados] = useState([]);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [detallesArchivo, setDetallesArchivo] = useState(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [horarioAEditar, setHorarioAEditar] = useState(null);
  const [cargandoArchivos, setCargandoArchivos] = useState(false);
  const [vistaActual, setVistaActual] = useState('gestor'); // 'gestor' o 'cargar'
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // ocupacion: { "A24": { matutino: true, vespertino: true }, ... }
  const [ocupacion, setOcupacion] = useState({});
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [orden, setOrden] = useState('original');
  const [busquedaArchivos, setBusquedaArchivos] = useState('');
  const [filtroModal, setFiltroModal] = useState('');
  const [filtroMaestroModal, setFiltroMaestroModal] = useState('');
  const [filtroHoraModal, setFiltroHoraModal] = useState('');

  const esBloqueada = (nombreAula) => {
    const d = ocupacion[nombreAula];
    return d ? (d.matutino && d.vespertino) : false;
  };

  const calcularRangoHorario = (horarios) => {
    if (!horarios || !horarios.length) return null;
    let minInicio = null;
    let maxFin = null;
    horarios.forEach(item => {
      const str = item.horario || item.horario_resumen || '';
      const regex = /(\d{1,2}):(\d{2})\s*[-aA–—]\s*(\d{1,2}):(\d{2})/g;
      let match;
      while ((match = regex.exec(str)) !== null) {
        const startMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const endMins = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        if (minInicio === null || startMins < minInicio) minInicio = startMins;
        if (maxFin === null || endMins > maxFin) maxFin = endMins;
      }
    });
    if (minInicio === null || maxFin === null) return null;
    const hi = Math.floor(minInicio / 60);
    const mi = String(minInicio % 60).padStart(2, '0');
    const hf = Math.floor(maxFin / 60);
    const mf = String(maxFin % 60).padStart(2, '0');
    return `${hi}:${mi} a ${hf}:${mf}`;
  };

  const handleExportarHistorial = (grupoId, grupoData) => {
    if (!grupoId) {
      window.location.href = `${API_URL}/api/historial-periodos/exportar`;
      return;
    }
    
    // Si hay un grupo seleccionado, comprobamos si tiene filtros activos
    const hasFiltros = filtroH_semestre || filtroH_cuatri || filtroH_carrera;
    
    const { nombre_ciclo, tipo_periodo, fecha_archivado } = grupoData[0];
    const fecha = fecha_archivado ? fecha_archivado.split(' ')[0] : '';
    
    if (hasFiltros) {
      Swal.fire({
        title: '¿Qué deseas exportar?',
        text: "Tienes filtros aplicados en la vista actual.",
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#1c355e',
        denyButtonColor: '#10b981',
        confirmButtonText: 'Todo el Archivo',
        denyButtonText: 'Solo lo Filtrado',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
           let url = `${API_URL}/api/historial-periodos/exportar?ciclo=${encodeURIComponent(nombre_ciclo)}&modalidad=${encodeURIComponent(tipo_periodo)}&fecha=${encodeURIComponent(fecha)}`;
           window.location.href = url;
        } else if (result.isDenied) {
           let url = `${API_URL}/api/historial-periodos/exportar?ciclo=${encodeURIComponent(nombre_ciclo)}&modalidad=${encodeURIComponent(tipo_periodo)}&fecha=${encodeURIComponent(fecha)}`;
           if (filtroH_semestre) url += `&semestre=${encodeURIComponent(filtroH_semestre)}`;
           if (filtroH_cuatri) url += `&cuatrimestre=${encodeURIComponent(filtroH_cuatri)}`;
           if (filtroH_carrera) url += `&carrera=${encodeURIComponent(filtroH_carrera)}`;
           window.location.href = url;
        }
      });
    } else {
       let url = `${API_URL}/api/historial-periodos/exportar?ciclo=${encodeURIComponent(nombre_ciclo)}&modalidad=${encodeURIComponent(tipo_periodo)}&fecha=${encodeURIComponent(fecha)}`;
       window.location.href = url;
    }
  };


  const obtenerHorasUnicasModal = (horarios) => {
    if (!horarios || !horarios.length) return [];
    const slotsSet = new Set();
    horarios.forEach(h => {
      const str = h.horario || h.horario_resumen || '';
      const match = str.match(/(\d{1,2}:\d{2})\s*[-–—]*\s*(\d{1,2}:\d{2})/);
      if (match) {
        slotsSet.add(`${match[1]} - ${match[2]}`);
      } else {
        const singleMatches = str.match(/\d{1,2}:\d{2}/g);
        if (singleMatches) {
          singleMatches.forEach(m => slotsSet.add(m));
        }
      }
    });
    return Array.from(slotsSet).sort((a, b) => {
      const mA = a.match(/(\d{1,2}):(\d{2})/);
      const mB = b.match(/(\d{1,2}):(\d{2})/);
      const minA = mA ? parseInt(mA[1], 10) * 60 + parseInt(mA[2], 10) : 0;
      const minB = mB ? parseInt(mB[1], 10) * 60 + parseInt(mB[2], 10) : 0;
      return minA - minB;
    });
  };

  useEffect(() => {
    fetch('/api/aulas')
      .then(res => res.ok ? res.json() : [])
      .then(data => setAulas(data))
      .catch(err => console.error("Error al precargar aulas:", err));

    fetch('/api/aulas/ocupacion')
      .then(res => res.ok ? res.json() : {})
      .then(data => setOcupacion(data))
      .catch(() => {});

    // Cargar archivos guardados
    cargarArchivosGuardados();
  }, []);

  const cargarArchivosGuardados = async () => {
    setCargandoArchivos(true);
    try {
      const response = await fetch('/api/archivos');
      if (response.ok) {
        const data = await response.json();
        setArchivosGuardados(data);
      }
    } catch (err) {
      console.error("Error al cargar archivos:", err);
    } finally {
      setCargandoArchivos(false);
    }
  };

  const verDetallesArchivo = async (nombreArchivo) => {
    try {
      const response = await fetch(`/api/archivos/${encodeURIComponent(nombreArchivo)}/horarios`);
      if (response.ok) {
        const horarios = await response.json();
        setDetallesArchivo(horarios);
        setArchivoSeleccionado(nombreArchivo);
      }
    } catch (err) {
      console.error("Error al obtener detalles del archivo:", err);
    }
  };

  const eliminarArchivo = (nombreArchivo) => {
    setConfirmacion({
      mensaje: `¿Está seguro de que desea eliminar "${nombreArchivo}" y todos sus horarios?`,
      onConfirmar: async () => {
        try {
          const response = await fetch(`/api/archivos/${encodeURIComponent(nombreArchivo)}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            toast("Archivo eliminado exitosamente", "exito");
            cargarArchivosGuardados();
            setArchivoSeleccionado(null);
            setDetallesArchivo(null);
          } else {
            toast("Error al eliminar el archivo", "error");
          }
        } catch (err) {
          console.error("Error al eliminar archivo:", err);
          toast("Error en la comunicación con el servidor", "error");
        }
      }
    });
  };

  const toggleSeleccionArchivo = (e, nombreArchivo) => {
    e.stopPropagation();
    setArchivosSeleccionados(prev => 
      prev.includes(nombreArchivo)
        ? prev.filter(n => n !== nombreArchivo)
        : [...prev, nombreArchivo]
    );
  };

  const seleccionarTodos = () => {
    if (archivosSeleccionados.length === archivosGuardados.length) {
      setArchivosSeleccionados([]);
    } else {
      setArchivosSeleccionados(archivosGuardados.map(a => a.archivo));
    }
  };

  const eliminarArchivosSeleccionados = () => {
    if (archivosSeleccionados.length === 0) return;
    
    setConfirmacion({
      mensaje: `¿Está seguro de que desea eliminar los ${archivosSeleccionados.length} archivos seleccionados y todos sus horarios?`,
      onConfirmar: async () => {
        try {
          const promesas = archivosSeleccionados.map(nombre => 
            fetch(`/api/archivos/${encodeURIComponent(nombre)}`, { method: 'DELETE' })
          );
          await Promise.all(promesas);
          
          toast(`${archivosSeleccionados.length} archivos eliminados exitosamente`, "exito");
          cargarArchivosGuardados();
          if (archivosSeleccionados.includes(archivoSeleccionado)) {
            setArchivoSeleccionado(null);
            setDetallesArchivo(null);
          }
          setArchivosSeleccionados([]);
        } catch (err) {
          console.error("Error al eliminar archivos:", err);
          toast("Error al eliminar algunos archivos", "error");
        }
      }
    });
  };

  const abrirModalEditar = (horario) => {
    setHorarioAEditar({ ...horario });
    setModalEditarAbierto(true);
  };

  const guardarHorarioEditado = async () => {
    if (!horarioAEditar) return;
    setGuardandoEdicion(true);
    try {
      const response = await fetch(`/api/horarios/${horarioAEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aula_asignada: horarioAEditar.aula_asignada,
          docente: horarioAEditar.docente,
          asignatura: horarioAEditar.asignatura
        })
      });

      if (response.ok) {
        toast("Horario actualizado exitosamente", "exito");
        setModalEditarAbierto(false);
        setHorarioAEditar(null);
        if (archivoSeleccionado) verDetallesArchivo(archivoSeleccionado);
      } else {
        const err = await response.json().catch(() => ({}));
        toast(err.detail || "Error al actualizar el horario", "error");
      }
    } catch (err) {
      console.error("Error al guardar horario:", err);
      toast("Error en la comunicación con el servidor", "error");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleProcesarYAsignar = async () => {
    if (!archivo) {
      toast("Por favor, arrastra o selecciona un archivo (PDF o imagen).", "advertencia");
      return;
    }

    setCargando(true);
    setDatosExtraidos(null);

    const formData = new FormData();
    formData.append("archivo", archivo);

    try {
      const response = await fetch('/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const respuestaTexto = await response.text();

      if (response.ok) {
        const resultado = JSON.parse(respuestaTexto);
        setDatosExtraidos(resultado.datos_extraidos);
        setAsignaciones({});
      } else {
        const errorJson = JSON.parse(respuestaTexto);
        toast(errorJson.detail || "Error al analizar el documento.", "error");
        setArchivo(null);
      }
    } catch (error) {
      console.error(error);
      toast("Error en la comunicación con el servidor.", "error");
      setArchivo(null);
    } finally {
      setCargando(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActivo(true);
    } else if (e.type === "dragleave") {
      setDragActivo(false);
    }
  };

  const validarArchivoNoDuplicado = (file) => {
    const duplicado = archivosGuardados.some(
      (guardado) => guardado.archivo.toLowerCase() === file.name.toLowerCase()
    );
    if (duplicado) {
      toast(`Ya existe un archivo cargado con el nombre "${file.name}".`, "error");
      return false;
    }
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!tiposPermitidos.includes(file.type)) {
        toast("El archivo debe ser PDF o imagen (PNG, JPG).", "advertencia");
        return;
      }
      if (!validarArchivoNoDuplicado(file)) return;
      setArchivo(file);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!validarArchivoNoDuplicado(file)) {
        e.target.value = null;
        return;
      }
      setArchivo(file);
    }
  };

  const handleAulaChange = (index, valor) => {
    setAsignaciones(prev => ({ ...prev, [index]: valor }));
  };

  const handleAsignarATodas = (aulaSeleccionada) => {
    if (!aulaSeleccionada) {
      toast("Por favor selecciona un aula primero.", "advertencia");
      return;
    }
    
    // Crear un nuevo objeto con la misma aula para todos los índices
    const nuevasAsignaciones = {};
    if (datosExtraidos?.lista_horarios) {
      datosExtraidos.lista_horarios.forEach((_, index) => {
        nuevasAsignaciones[index] = aulaSeleccionada;
      });
      setAsignaciones(nuevasAsignaciones);
      setAulaAsignacionAutomatica('');
    }
  };

  const handleGuardarHorarios = async () => {
    if (!datosExtraidos?.lista_horarios) return;

    const payload = datosExtraidos.lista_horarios.map((item, index) => ({
      docente: item.docente,
      licenciatura: item.licenciatura,
      asignatura: item.asignatura,
      horario: item.horario_resumen,
      aulaAsignada: asignaciones[index] || "Por asignar",
      archivo: archivo.name,
      semestre: item.semestre || "",
      cuatrimestre: item.cuatrimestre || "",
      grupo: item.grupo || ""
    }));

    try {
      const response = await fetch('/api/guardar-horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast("¡Horarios validados y publicados con éxito!", "exito");
        setDatosExtraidos(null);
        setArchivo(null);
        setAsignaciones({});
        setVistaActual('gestor');
        cargarArchivosGuardados();
      } else {
        const err = await response.json().catch(() => ({}));
        toast(err.detail || "Error al intentar publicar las asignaciones.", "error");
      }
    } catch (error) {
      toast("Error de red al publicar.", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope">
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ENCABEZADO PRINCIPAL                                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-5">

        {/* Fila 1: Título + Acciones principales */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Título y descripción */}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c355e] tracking-tight leading-tight">
              Gestión de Horarios por Grupos
            </h1>
            <p className="text-sm text-[#44464e]/80 mt-1 leading-relaxed">
              Administración profesional de archivos maestros y asignación inteligente de espacios académicos.
            </p>
          </div>

          {/* Grupo de acciones */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {/* Navegación de vistas */}
            <div className="flex bg-[#f4f3f6] p-1 rounded-lg border border-[#c5c6cf]/30">
              <button 
                onClick={() => setVistaActual('gestor')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                  vistaActual === 'gestor' 
                    ? "bg-[#1c355e] text-white shadow-sm" 
                    : "text-[#44464e] hover:text-[#1b1c1e] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  Mis Archivos
                </span>
              </button>
              <button 
                onClick={() => setVistaActual('cargar')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                  vistaActual === 'cargar' 
                    ? "bg-[#1c355e] text-white shadow-sm" 
                    : "text-[#44464e] hover:text-[#1b1c1e] hover:bg-white/60"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  Cargar Nuevo
                </span>
              </button>
            </div>

            {/* Separador vertical */}
            <div className="hidden sm:block w-px h-8 bg-[#c5c6cf]/40"></div>

            {/* Acciones de periodo */}
            <button 
              onClick={abrirHistorial} 
              className="px-4 py-2 rounded-lg text-xs font-bold border border-[#c5c6cf]/40 bg-white text-[#1c355e] hover:bg-[#f4f3f6] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              Historial
            </button>
            <button 
              onClick={() => setModalCierre(true)} 
              className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">archive</span>
              Cierre de Periodo
            </button>
          </div>
        </div>

        {/* Fila 2: Controles del gestor (solo visible en vista gestor) */}
        {vistaActual === 'gestor' && (
          <div className="bg-white border border-[#c5c6cf]/25 rounded-xl p-3 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Barra de búsqueda */}
              <div className="relative flex-1 min-w-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[20px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Buscar archivo por carrera o código (ej. ISC, Nut, Neg, Derecho)..."
                  value={busquedaArchivos}
                  onChange={(e) => setBusquedaArchivos(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 bg-[#faf9fc] border border-[#c5c6cf]/30 rounded-lg text-sm font-medium text-[#1b1c1e] placeholder-[#75777f]/70 focus:outline-none focus:border-[#1c355e] focus:ring-2 focus:ring-[#1c355e]/10 transition-all"
                />
                {busquedaArchivos && (
                  <button
                    onClick={() => setBusquedaArchivos('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#75777f] hover:text-[#1b1c1e] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Separador */}
              <div className="hidden sm:block w-px h-8 bg-[#c5c6cf]/30 flex-shrink-0"></div>

              {/* Contador + Acciones en línea */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Contador */}
                <div className="text-xs text-[#44464e] font-medium whitespace-nowrap px-2">
                  <span className="font-bold text-[#1c355e] text-sm">
                    {[...archivosGuardados].filter(a =>
                      !busquedaArchivos ||
                      a.archivo.toLowerCase().includes(busquedaArchivos.toLowerCase().trim()) ||
                      (a.turno && a.turno.toLowerCase().includes(busquedaArchivos.toLowerCase().trim())) ||
                      (a.plan && a.plan.toLowerCase().includes(busquedaArchivos.toLowerCase().trim()))
                    ).length}
                  </span>
                  <span className="text-[#75777f]"> / {archivosGuardados.length}</span>
                </div>

                {/* Separador fino */}
                <div className="hidden sm:block w-px h-6 bg-[#c5c6cf]/30"></div>

                {/* Botones de acción */}
                {archivosGuardados.length > 0 && (
                  <button 
                    onClick={seleccionarTodos}
                    className="p-2 rounded-lg text-[#44464e] hover:bg-[#f4f3f6] hover:text-[#1c355e] transition-all group relative"
                    title={archivosSeleccionados.length === archivosGuardados.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {archivosSeleccionados.length === archivosGuardados.length ? 'deselect' : 'select_all'}
                    </span>
                  </button>
                )}
                {archivosSeleccionados.length > 0 && (
                  <button 
                    onClick={eliminarArchivosSeleccionados}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all relative"
                    title={`Eliminar ${archivosSeleccionados.length} seleccionados`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
                <button 
                  onClick={() => setOrden(orden === 'original' ? 'az' : 'original')}
                  className="p-2 rounded-lg text-[#44464e] hover:bg-[#f4f3f6] hover:text-[#1c355e] transition-all"
                  title={orden === 'original' ? 'Ordenar A-Z' : 'Orden de creación'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {orden === 'original' ? 'sort_by_alpha' : 'history'}
                  </span>
                </button>
                <button 
                  onClick={() => cargarArchivosGuardados()}
                  className="p-2 rounded-lg text-[#44464e] hover:bg-[#f4f3f6] hover:text-[#1c355e] transition-all"
                  title="Actualizar lista"
                >
                  <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VISTA GESTOR DE ARCHIVOS */}
      {vistaActual === 'gestor' && (
        <div className="space-y-6">
          {/* Lista de archivos */}
          {cargandoArchivos ? (
            <div className="flex justify-center items-center h-48">
              <span className="material-symbols-outlined text-5xl text-[#1c355e] animate-spin">sync</span>
            </div>
          ) : archivosGuardados.length === 0 ? (
            <div className="bg-white border border-[#c5c6cf]/30 rounded-3xl p-12 text-center">
              <div className="p-4 bg-[#f4f3f6] rounded-2xl inline-block text-[#1c355e] mb-4">
                <span className="material-symbols-outlined text-4xl">folder_open</span>
              </div>
              <h3 className="text-xl font-bold text-[#1b1c1e] mb-2">No hay archivos cargados</h3>
              <p className="text-sm text-[#44464e] mb-6">Carga tu primer archivo de horarios para comenzar.</p>
              <button 
                onClick={() => setVistaActual('cargar')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1c355e] text-white font-bold rounded-xl hover:bg-[#152a4a] transition-all"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                Cargar archivo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...archivosGuardados]
                .filter(a => {
                  if (!busquedaArchivos || !busquedaArchivos.trim()) return true;
                  const q = busquedaArchivos.toLowerCase().trim();
                  return (
                    a.archivo.toLowerCase().includes(q) ||
                    (a.turno && a.turno.toLowerCase().includes(q)) ||
                    (a.plan && a.plan.toLowerCase().includes(q))
                  );
                })
                .sort((a, b) => orden === 'az' ? a.archivo.localeCompare(b.archivo) : 0)
                .map((archivoGuardado, idx) => (
                <div
                  key={idx}
                  className={`bg-white border rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer group relative ${archivosSeleccionados.includes(archivoGuardado.archivo) ? 'border-[#1c355e] ring-1 ring-[#1c355e]/50 bg-[#1c355e]/5' : 'border-[#c5c6cf]/30'}`}
                  onClick={() => verDetallesArchivo(archivoGuardado.archivo)}
                >
                  {/* Checkbox de selección */}
                  <div 
                    className="absolute top-4 left-4 z-10"
                    onClick={(e) => toggleSeleccionArchivo(e, archivoGuardado.archivo)}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${archivosSeleccionados.includes(archivoGuardado.archivo) ? 'bg-[#1c355e] border-[#1c355e]' : 'border-[#c5c6cf] bg-white group-hover:border-[#1c355e]/50'}`}>
                      {archivosSeleccionados.includes(archivoGuardado.archivo) && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                    </div>
                  </div>

                  {/* Encabezado con icono */}
                  <div className="flex items-start justify-between mb-4 pl-8">
                    <div className="p-3 bg-[#1c355e]/10 text-[#1c355e] rounded-xl group-hover:bg-[#1c355e]/20 transition-all">
                      <span className="material-symbols-outlined text-2xl">description</span>
                    </div>
                    <div className="relative group/menu">
                      <button className="p-2 text-[#44464e] hover:bg-[#f4f3f6] rounded-lg transition-all">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                      <div className="absolute right-0 mt-1 bg-white border border-[#c5c6cf]/30 rounded-xl shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 w-48">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            verDetallesArchivo(archivoGuardado.archivo);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-[#1c355e] font-semibold hover:bg-[#f4f3f6] transition-all flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                          Ver detalles
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarArchivo(archivoGuardado.archivo);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 transition-all flex items-center gap-2 border-t border-[#c5c6cf]/30"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nombre del archivo y turno/plan */}
                  <div className="mb-3 flex flex-wrap gap-1.5 items-center">
                    <h3 className="font-bold text-[#1b1c1e] truncate text-sm mb-1.5 w-full" title={archivoGuardado.archivo}>
                      {archivoGuardado.archivo}
                    </h3>
                    {archivoGuardado.turno && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                        archivoGuardado.turno === 'Matutino' ? 'bg-amber-100 text-amber-700' :
                        archivoGuardado.turno === 'Vespertino' ? 'bg-indigo-100 text-indigo-700' :
                        archivoGuardado.turno === 'Ambos Turnos' ? 'bg-purple-100 text-purple-700' :
                        'bg-[#f4f3f6] text-[#75777f]'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {archivoGuardado.turno === 'Matutino' ? 'wb_sunny' : archivoGuardado.turno === 'Vespertino' ? 'nights_stay' : archivoGuardado.turno === 'Ambos Turnos' ? 'domain' : 'schedule'}
                        </span>
                        {archivoGuardado.turno}
                      </span>
                    )}
                    {archivoGuardado.plan && archivoGuardado.plan !== 'No definido' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                        archivoGuardado.plan === 'Semestral' ? 'bg-blue-100 text-blue-700' :
                        archivoGuardado.plan === 'Cuatrimestral' ? 'bg-fuchsia-100 text-fuchsia-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">
                          {archivoGuardado.plan === 'Semestral' ? 'calendar_month' : 'event'}
                        </span>
                        {archivoGuardado.plan}
                      </span>
                    )}
                  </div>

                  {/* Información */}
                  <div className="space-y-2 text-xs text-[#44464e]">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">list_alt</span>
                        Horarios
                      </span>
                      <span className="font-bold text-[#1c355e]">{archivoGuardado.total_horarios}</span>
                    </div>
                    {archivoGuardado.rango_horario && (
                      <div className="flex justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">schedule</span>
                          Rango horario
                        </span>
                        <span className="font-bold text-[#1c355e] font-mono">{archivoGuardado.rango_horario}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">domain</span>
                        Asignadas
                      </span>
                      <span className="font-bold text-emerald-600">{archivoGuardado.aulas_asignadas}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#c5c6cf]/30">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        Cargado
                      </span>
                      <span className="font-mono text-xs">
                        {new Date(archivoGuardado.fecha_carga).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </div>

                  {/* Aulas Ocupadas */}
                  {archivoGuardado.aulas_ocupadas && (
                    <div className="mt-4 pt-4 border-t border-[#c5c6cf]/30">
                      <span className="text-[10px] font-bold text-[#44464e] uppercase tracking-wider block mb-2">Aulas Ocupadas</span>
                      <div className="flex flex-wrap gap-1.5">
                        {archivoGuardado.aulas_ocupadas.split(', ').map((aula, i) => (
                          <span key={i} className="px-2 py-1 bg-[#1c355e]/5 border border-[#1c355e]/10 text-[#1c355e] text-[10px] font-bold rounded-md">
                            {aula}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Barra de progreso */}
                  <div className="mt-4 pt-4 border-t border-[#c5c6cf]/30">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-[#44464e]">Cobertura de aulas</span>
                      <span className="text-xs font-bold text-[#1c355e]">
                        {archivoGuardado.total_horarios > 0 ? Math.round((archivoGuardado.aulas_asignadas / archivoGuardado.total_horarios) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-[#f4f3f6] rounded-full h-2">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${archivoGuardado.total_horarios > 0 ? (archivoGuardado.aulas_asignadas / archivoGuardado.total_horarios) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA CARGAR ARCHIVO */}
      {vistaActual === 'cargar' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 bg-[#f4f3f6] p-1.5 rounded-xl border border-[#c5c6cf]/30 self-start">
            <button
              onClick={() => setTipoSubida('individual')}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${tipoSubida === 'individual' ? 'bg-[#1c355e] text-white shadow-sm' : 'text-[#44464e] hover:bg-[#eaeaee]'}`}
            >
              Subir 1 Horario
            </button>
            <button
              onClick={() => setTipoSubida('lote')}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${tipoSubida === 'lote' ? 'bg-[#1c355e] text-white shadow-sm' : 'text-[#44464e] hover:bg-[#eaeaee]'}`}
            >
              Subir por Lotes
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              className={`lg:col-span-2 border-2 border-dashed rounded-3xl p-12 text-center transition-all flex flex-col items-center justify-center min-h-[340px] bg-white relative ${
                dragActivo ? "border-[#1c355e] bg-[#1c355e]/5" : "border-[#c5c6cf]/60 hover:border-[#1c355e]/50"
              }`}
            >
            {cargando ? (
              <div className="space-y-4 animate-pulse">
                <span className="material-symbols-outlined text-5xl text-[#1c355e] animate-spin">sync</span>
                <h3 className="text-xl font-bold text-[#1c355e]">Procesando documento e indexando datos...</h3>
                <p className="text-sm text-[#44464e]">Extrayendo horarios, docentes y asignaturas del archivo.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 bg-[#f4f3f6] rounded-2xl inline-block text-[#1c355e]">
                  <span className="material-symbols-outlined text-4xl">
                    {archivo ? (archivo.type === 'application/pdf' ? 'description' : 'image') : 'upload_file'}
                  </span>
                </div>
                
                <div>
                  {archivo ? (
                    <>
                      <h3 className="text-xl font-bold text-emerald-600">¡Documento Cargado Exitosamente!</h3>
                      <p className="text-sm font-mono text-[#1c355e] mt-1 font-bold bg-[#f4f3f6] px-3 py-1 rounded-lg inline-block">
                        {archivo.name}
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-[#1b1c1e]">Subir Horario Maestro</h3>
                      <p className="text-sm text-[#44464e] mt-1 max-w-sm mx-auto">
                        Arrastra y suelta tu archivo (PDF o imagen) aquí o haz clic para seleccionarlo.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <label className="bg-[#f4f3f6] text-[#1b1c1e] px-5 py-2.5 rounded-xl text-sm font-bold border border-[#c5c6cf]/40 hover:bg-[#eaeaee] transition-all cursor-pointer active:scale-95">
                    {archivo ? "Cambiar Archivo" : "Examinar Archivos"}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Formatos: PDF, PNG, JPG (Máx. 10MB)</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-6 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-[#44464e] uppercase tracking-wider">Acciones del Módulo</h4>
              
              <div className="text-sm text-gray-500">
                {archivo ? (
                  <p className="text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 p-2.5 rounded-xl">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Listo para procesar.
                  </p>
                ) : (
                  <p className="bg-amber-50 text-amber-800 p-2.5 rounded-xl font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">info</span>
                    Esperando archivo...
                  </p>
                )}
              </div>

              <button
                onClick={handleProcesarYAsignar}
                disabled={!archivo || cargando}
                className={`w-full py-4 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                  archivo && !cargando 
                    ? "bg-[#1c355e] hover:bg-[#152a4a] cursor-pointer" 
                    : "bg-gray-300 cursor-not-allowed shadow-none"
                }`}
              >
                <span className="material-symbols-outlined text-base">analytics</span>
                Procesar documento y asignar aulas
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* TABLA DE RESULTADOS */}
      {datosExtraidos && (
        <div className="bg-white border border-[#c5c6cf]/30 rounded-3xl shadow-sm overflow-hidden animate-fadeIn">
          <div className="p-5 bg-[#f4f3f6] border-b border-[#c5c6cf]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1c355e]/10 text-[#1c355e] rounded-xl flex items-center">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <div>
                <span className="text-xs font-bold text-[#44464e] uppercase block">Resultados de Lectura</span>
                <span className="text-sm font-bold text-[#1c355e] font-mono">{archivo?.name}</span>
              </div>
            </div>
            <button 
              onClick={() => { setDatosExtraidos(null); setArchivo(null); }}
              className="text-xs bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors"
            >
              Cargar otro documento
            </button>
          </div>

          {/* CONTROL DE ASIGNACIÓN AUTOMÁTICA Y TABLAS */}
          {(() => {
            let grupos = [];
            if (tipoSubida === 'individual') {
              grupos = [{
                titulo: 'Todos los horarios',
                items: datosExtraidos.lista_horarios.map((item, i) => ({ item, originalIndex: i }))
              }];
            } else {
              const mapaGrupos = {};
              datosExtraidos.lista_horarios.forEach((item, i) => {
                const key = `${item.licenciatura || 'Sin Licenciatura'} - Sem/Cuat: ${item.semestre || item.cuatrimestre || 'N/A'} - Gpo: ${item.grupo || 'N/A'}`;
                if (!mapaGrupos[key]) mapaGrupos[key] = [];
                mapaGrupos[key].push({ item, originalIndex: i });
              });
              grupos = Object.entries(mapaGrupos).map(([titulo, items]) => ({ titulo, items }));
            }

            return (
              <div className="flex flex-col">
                {tipoSubida === 'individual' && (
                  <div className="px-5 py-4 border-b border-[#c5c6cf]/30 bg-[#faf9fc]">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-[#1c355e]/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[16px] text-[#1c355e]">auto_awesome</span>
                        </div>
                        <span className="text-xs font-bold text-[#44464e] uppercase tracking-wider whitespace-nowrap">Asignar aula a todas las filas</span>
                      </div>
                      <div className="flex flex-1 gap-2">
                        <select
                          value={aulaAsignacionAutomatica}
                          onChange={(e) => setAulaAsignacionAutomatica(e.target.value)}
                          className="flex-1 px-3.5 py-2.5 bg-white border border-[#c5c6cf]/60 rounded-xl text-sm font-semibold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] cursor-pointer transition-all"
                        >
                          <option value="">— Seleccionar aula —</option>
                          {aulas.map((aula) => {
                            const bloqueada = esBloqueada(aula.nombre);
                            return (
                              <option key={aula.id} value={aula.nombre} disabled={bloqueada}>
                                {bloqueada ? '🔴 ' : ''}{aula.nombre}{aula.edificio ? ` · ${aula.edificio}` : ''}{bloqueada ? ' (Bloqueada)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          onClick={() => handleAsignarATodas(aulaAsignacionAutomatica)}
                          disabled={!aulaAsignacionAutomatica}
                          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            aulaAsignacionAutomatica
                              ? 'bg-[#1c355e] text-white hover:bg-[#152a4a] shadow-sm'
                              : 'bg-[#e8e8ef] text-[#c5c6cf] cursor-not-allowed'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">done_all</span>
                          Aplicar a todas
                        </button>
                      </div>
                    </div>
                    {aulaAsignacionAutomatica && (
                      <p className="text-[10px] text-[#1c355e] font-semibold mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">info</span>
                        Se asignará <span className="font-black">{aulaAsignacionAutomatica}</span> a los {datosExtraidos.lista_horarios.length} horarios extraídos.
                      </p>
                    )}
                  </div>
                )}

                {grupos.map((grupo, gIndex) => (
                  <div key={gIndex} className="border-b border-[#c5c6cf]/30 last:border-0">
                    {tipoSubida === 'lote' && (
                      <div className="bg-[#eaeaee] px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#c5c6cf]/30 gap-3">
                        <h4 className="text-sm font-bold text-[#1c355e]">{grupo.titulo}</h4>
                        <div className="flex gap-2 items-center w-full sm:w-auto">
                          <select
                            onChange={(e) => {
                              const aula = e.target.value;
                              if (!aula) return;
                              const nuevasAsignaciones = { ...asignaciones };
                              grupo.items.forEach(({ originalIndex }) => {
                                nuevasAsignaciones[originalIndex] = aula;
                              });
                              setAsignaciones(nuevasAsignaciones);
                              e.target.value = '';
                            }}
                            className="px-3 py-1.5 bg-white border border-[#c5c6cf]/60 rounded-lg text-xs font-semibold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 cursor-pointer w-full sm:w-auto"
                          >
                            <option value="">Asignar aula al grupo...</option>
                            {aulas.map((aula) => {
                              const bloqueada = esBloqueada(aula.nombre);
                              return (
                                <option key={aula.id} value={aula.nombre} disabled={bloqueada}>
                                  {bloqueada ? '🔴 ' : ''}{aula.nombre}{aula.edificio ? ` · ${aula.edificio}` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr style={{ background: 'linear-gradient(135deg, #1c355e 0%, #162c50 100%)' }} className="text-white text-[10px] uppercase font-bold tracking-widest">
                            <th className="px-5 py-4">Docente</th>
                            <th className="px-5 py-4">Licenciatura / Nivel</th>
                            <th className="px-5 py-4">Asignatura</th>
                            <th className="px-5 py-4">Horario</th>
                            <th className="px-5 py-4 w-[220px]">Aula Asignada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0f0f4]">
                          {grupo.items.map(({ item, originalIndex }) => {
                            const index = originalIndex;
                            const aulaSeleccionada = asignaciones[index] || '';
                            const aulaObj = aulas.find(a => a.nombre === aulaSeleccionada);
                            return (
                              <tr key={index} className={`hover:bg-[#faf9fc] transition-colors ${aulaSeleccionada ? 'bg-emerald-50/30' : ''}`}>
                                <td className="px-5 py-3.5 text-sm font-semibold text-[#44464e]">{item.docente}</td>
                                <td className="px-5 py-3.5 text-xs font-bold">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="bg-[#1c355e]/8 text-[#1c355e] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                                      {item.licenciatura}
                                    </span>
                                    {item.semestre && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px]">Sem: {item.semestre}</span>}
                                    {item.cuatrimestre && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px]">Cuat: {item.cuatrimestre}</span>}
                                    {item.grupo && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px]">Gpo: {item.grupo}</span>}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-sm font-bold text-[#1b1c1e]">{item.asignatura}</td>
                                <td className="px-5 py-3.5">
                                  <span className="text-xs font-mono font-bold text-[#1c355e] bg-[#1c355e]/6 px-2 py-1 rounded-lg whitespace-nowrap">{item.horario_resumen}</span>
                                </td>
                                <td className="px-5 py-3.5">
                                  {aulaSeleccionada ? (
                                    <div className="flex items-center gap-2 group">
                                      <div className="flex-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-black text-emerald-700 truncate">{aulaSeleccionada}</p>
                                          {aulaObj?.edificio && <p className="text-[9px] text-emerald-500 font-semibold">{aulaObj.edificio}</p>}
                                        </div>
                                        <button
                                          onClick={() => handleAulaChange(index, '')}
                                          className="text-emerald-400 hover:text-emerald-700 transition-colors flex-shrink-0"
                                          title="Quitar aula"
                                        >
                                          <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <select
                                      value=""
                                      onChange={(e) => handleAulaChange(index, e.target.value)}
                                      className="w-full px-3 py-2 bg-[#f4f3f6] border border-[#c5c6cf]/40 border-dashed rounded-xl text-xs font-semibold text-[#75777f] focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] hover:border-[#1c355e]/40 cursor-pointer transition-all"
                                    >
                                      <option value="">Seleccionar aula...</option>
                                      {aulas.map((aula) => {
                                        const bloqueada = esBloqueada(aula.nombre);
                                        return (
                                          <option key={aula.id} value={aula.nombre} disabled={bloqueada}>
                                            {bloqueada ? '🔴 ' : ''}{aula.nombre}{aula.edificio ? ` · ${aula.edificio}` : ''}{bloqueada ? ' (Bloqueada)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}          <div className="p-5 bg-[#faf9fc] border-t border-[#c5c6cf]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {(() => {
                const total = datosExtraidos.lista_horarios.length;
                const asignadas = Object.values(asignaciones).filter(Boolean).length;
                const pct = total > 0 ? Math.round((asignadas / total) * 100) : 0;
                return (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#44464e] uppercase tracking-wider">Cobertura de aulas</span>
                      <span className="text-xs font-semibold text-[#75777f]">
                        <span className={`font-black ${asignadas === total ? 'text-emerald-600' : 'text-[#1c355e]'}`}>{asignadas}</span> de {total} asignadas
                      </span>
                    </div>
                    <div className="w-24 h-1.5 bg-[#e8e8ef] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${asignadas === total ? 'bg-emerald-500' : 'bg-[#1c355e]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black ${asignadas === total ? 'text-emerald-600' : 'text-[#1c355e]'}`}>{pct}%</span>
                  </>
                );
              })()}
            </div>
            <button
              onClick={handleGuardarHorarios}
              className="w-full sm:w-auto bg-[#1c355e] text-white px-7 py-3.5 rounded-xl font-bold shadow-md hover:bg-[#152a4a] transition-all active:scale-[0.97] flex items-center justify-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-base">cloud_done</span>
              Publicar Asignaciones Globales
            </button>
          </div>
        </div>
      )}

      {/* PANEL DE DETALLES (MODAL) */}
      {archivoSeleccionado && detallesArchivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn m-2">
            <div className="p-4 md:p-5 bg-[#f4f3f6] border-b border-[#c5c6cf]/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 flex-shrink-0">
              
              <div className="flex items-center justify-between w-full lg:w-auto gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-[#1c355e]/10 text-[#1c355e] rounded-xl flex-shrink-0">
                    <span className="material-symbols-outlined text-xl">folder</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-[#44464e] uppercase block truncate">Detalles del Archivo</span>
                    <span className="text-sm font-bold text-[#1c355e] font-mono block truncate max-w-[200px] sm:max-w-xs">{archivoSeleccionado}</span>
                    {calcularRangoHorario(detallesArchivo) && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        Rango: {calcularRangoHorario(detallesArchivo)}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setArchivoSeleccionado(null);
                    setDetallesArchivo(null);
                    setFiltroModal('');
                    setFiltroMaestroModal('');
                    setFiltroHoraModal('');
                  }}
                  className="p-2 text-[#44464e] hover:bg-white rounded-lg transition-all lg:hidden flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                {detallesArchivo && (
                  <select
                    value={filtroMaestroModal}
                    onChange={(e) => setFiltroMaestroModal(e.target.value)}
                    className="px-4 py-2 bg-white border border-[#c5c6cf]/40 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 w-full sm:max-w-[200px]"
                  >
                    <option value="">Todos los maestros</option>
                    {[...new Set(detallesArchivo.map(h => h.docente))].sort().map(docente => (
                      <option key={docente} value={docente}>{docente}</option>
                    ))}
                  </select>
                )}
                {detallesArchivo && (
                  <select
                    value={filtroHoraModal}
                    onChange={(e) => setFiltroHoraModal(e.target.value)}
                    className="px-4 py-2 bg-white border border-[#c5c6cf]/40 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 w-full sm:max-w-[190px]"
                  >
                    <option value="">Todos los horarios</option>
                    {obtenerHorasUnicasModal(detallesArchivo).map(hora => (
                      <option key={hora} value={hora}>{hora}</option>
                    ))}
                  </select>
                )}
                <div className="relative w-full sm:w-auto">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#c5c6cf]">search</span>
                  <input 
                    type="text"
                    placeholder="Filtrar por docente, asignatura..."
                    value={filtroModal}
                    onChange={(e) => setFiltroModal(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-[#c5c6cf]/40 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 w-full sm:w-64"
                  />
                </div>
                <button 
                  onClick={() => {
                    setArchivoSeleccionado(null);
                    setDetallesArchivo(null);
                    setFiltroModal('');
                    setFiltroMaestroModal('');
                    setFiltroHoraModal('');
                  }}
                  className="p-2 text-[#44464e] hover:bg-white rounded-lg transition-all hidden lg:block"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr className="bg-[#1c355e] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4.5">Docente</th>
                    <th className="px-6 py-4.5">Licenciatura / Nivel</th>
                    <th className="px-6 py-4.5">Asignatura</th>
                    <th className="px-6 py-4.5">Horario</th>
                    <th className="px-6 py-4.5">Aula Asignada</th>
                    <th className="px-6 py-4.5">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const listaFiltrada = detallesArchivo.filter(h => {
                      const term = filtroModal.toLowerCase();
                      const coincideTexto = h.docente?.toLowerCase().includes(term) ||
                             h.asignatura?.toLowerCase().includes(term) ||
                             h.horario?.toLowerCase().includes(term) ||
                             h.aula_asignada?.toLowerCase().includes(term);
                      const coincideMaestro = filtroMaestroModal === '' || h.docente === filtroMaestroModal;

                      let coincideHora = true;
                      if (filtroHoraModal) {
                        const hStr = h.horario || h.horario_resumen || '';
                        const cleanH = hStr.replace(/--/g, ' - ');
                        const cleanF = filtroHoraModal.replace(/--/g, ' - ');
                        const fTimeMatch = cleanF.match(/(\d{1,2}:\d{2})/);
                        if (fTimeMatch) {
                          coincideHora = cleanH.includes(fTimeMatch[1]) || hStr.includes(fTimeMatch[1]);
                        } else {
                          coincideHora = cleanH.includes(cleanF);
                        }
                      }

                      return coincideTexto && coincideMaestro && coincideHora;
                    });

                    if (listaFiltrada.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">filter_alt_off</span>
                            <p className="text-sm font-bold text-[#1b1c1e]">No se encontraron horarios con los filtros seleccionados</p>
                            <button
                              onClick={() => {
                                setFiltroModal('');
                                setFiltroMaestroModal('');
                                setFiltroHoraModal('');
                              }}
                              className="mt-3 text-xs font-bold text-[#1c355e] hover:underline"
                            >
                              Limpiar todos los filtros
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return listaFiltrada.map((horario) => (
                      <tr key={horario.id} className="hover:bg-[#f4f3f6]/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-[#44464e]">{horario.docente}</td>
                        <td className="px-6 py-4 text-xs font-bold">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-[#1c355e]/10 text-[#1c355e] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                              {horario.licenciatura}
                            </span>
                            {horario.semestre && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px]">Sem: {horario.semestre}</span>}
                            {horario.cuatrimestre && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px]">Cuat: {horario.cuatrimestre}</span>}
                            {horario.grupo && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px]">Gpo: {horario.grupo}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-[#1b1c1e]">{horario.asignatura}</td>
                        <td className="px-6 py-4 text-sm font-mono font-bold text-gray-500 italic">{horario.horario}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            horario.aula_asignada === 'Por asignar'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {horario.aula_asignada}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => abrirModalEditar(horario)}
                            className="p-2 text-[#1c355e] hover:bg-[#f4f3f6] rounded-lg transition-all"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL EDITAR HORARIO */}
      {modalEditarAbierto && horarioAEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-[#f4f3f6] border-b border-[#c5c6cf]/30 flex items-center justify-between sticky top-0">
              <div>
                <h2 className="text-lg font-bold text-[#1b1c1e]">Editar Horario</h2>
                <p className="text-xs text-[#44464e] mt-1">Modifica los datos de esta clase</p>
              </div>
              <button 
                onClick={() => {
                  setModalEditarAbierto(false);
                  setHorarioAEditar(null);
                }}
                className="p-2 text-[#44464e] hover:bg-white rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase block mb-2">Docente</label>
                <input 
                  type="text"
                  value={horarioAEditar.docente || ''}
                  onChange={(e) => setHorarioAEditar({ ...horarioAEditar, docente: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm font-bold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase block mb-2">Asignatura</label>
                <input 
                  type="text"
                  value={horarioAEditar.asignatura || ''}
                  onChange={(e) => setHorarioAEditar({ ...horarioAEditar, asignatura: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm font-bold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase block mb-2">Horario</label>
                <input 
                  type="text"
                  value={horarioAEditar.horario || ''}
                  disabled
                  className="w-full px-4 py-2.5 bg-gray-100 border border-[#c5c6cf]/40 rounded-xl text-sm font-bold text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase block mb-2">Aula Asignada</label>
                <select
                  value={horarioAEditar.aula_asignada || ''}
                  onChange={(e) => setHorarioAEditar({ ...horarioAEditar, aula_asignada: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm font-bold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e] cursor-pointer"
                >
                  <option value="Por asignar">Por asignar</option>
                  {aulas.map((aula) => {
                    const bloqueada = esBloqueada(aula.nombre);
                    return (
                      <option key={aula.id} value={aula.nombre} disabled={bloqueada}>
                        {bloqueada ? '🔴 ' : ''}{aula.nombre}{aula.edificio ? ` · ${aula.edificio}` : ''}{bloqueada ? ' (Bloqueada)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="p-6 bg-[#f4f3f6] border-t border-[#c5c6cf]/30 flex gap-3 justify-end sticky bottom-0">
              <button 
                onClick={() => {
                  setModalEditarAbierto(false);
                  setHorarioAEditar(null);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-[#44464e] hover:bg-white transition-all border border-[#c5c6cf]/40"
              >
                Cancelar
              </button>
              <button
                onClick={guardarHorarioEditado}
                disabled={guardandoEdicion}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-[#1c355e] text-white hover:bg-[#152a4a] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {guardandoEdicion ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />

      {/* Modal Cierre de Periodo */}
      {modalCierre && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#c5c6cf]/30 flex justify-between items-center bg-red-50">
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span> Cierre de Periodo
              </h2>
              <button onClick={() => setModalCierre(false)} className="text-[#75777f] hover:bg-red-100 rounded-full p-1 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <p className="text-sm text-[#44464e] mb-4">
                Esta acción moverá los horarios actuales a un <strong>historial permanente</strong> y luego los eliminará de la vista principal. 
                Utiliza esto únicamente cuando finalice un ciclo escolar.
              </p>
              <form onSubmit={handleCierrePeriodo} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1c355e] mb-1">Nombre del Ciclo a Archivar</label>
                  <input type="text" required placeholder="Ej: Agosto-Diciembre 2026" className="w-full p-2.5 border border-[#c5c6cf] rounded-xl focus:outline-none focus:border-[#1c355e]" value={nombreCicloCierre} onChange={e => setNombreCicloCierre(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1c355e] mb-1">¿Qué modalidad deseas limpiar?</label>
                  <select className="w-full p-2.5 border border-[#c5c6cf] rounded-xl focus:outline-none focus:border-[#1c355e]" value={modalidadCierre} onChange={e => setModalidadCierre(e.target.value)}>
                    <option value="ambos">Ambas (Semestre y Cuatrimestre)</option>
                    <option value="semestral">Solo Semestral</option>
                    <option value="cuatrimestral">Solo Cuatrimestral</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setModalCierre(false)} className="px-4 py-2 text-[#44464e] font-semibold hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                  <button type="submit" disabled={cargandoCierre} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all">
                    {cargandoCierre ? 'Procesando...' : 'Archivar y Limpiar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* Modal Visor de Historial */}
      {modalHistorial && (() => {
        // Agrupar los datos del historial
        const ORDEN_GRADOS = ["PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "SÉPTIMO", "OCTAVO", "NOVENO", "DECIMO", "DÉCIMO"];
        const gruposHistorial = {};
        datosHistorial.forEach(reg => {
          const truncDate = reg.fecha_archivado ? reg.fecha_archivado.split(' ')[0] : 'Desconocida';
          const key = `${reg.nombre_ciclo}|${reg.tipo_periodo}|${truncDate}`;
          if (!gruposHistorial[key]) {
            gruposHistorial[key] = { key, nombre_ciclo: reg.nombre_ciclo, tipo_periodo: reg.tipo_periodo, fecha: truncDate, registros: [] };
          }
          gruposHistorial[key].registros.push(reg);
        });
        
        const archivos = Object.values(gruposHistorial);
        const hayDatos = archivos.length > 0;
        
        const archivoActivo = archivoExpandido ? gruposHistorial[archivoExpandido] : null;

        // Filtrar registros del archivo activo
        let registrosFiltrados = archivoActivo ? archivoActivo.registros : [];
        if (archivoActivo) {
          if (filtroH_semestre) {
            registrosFiltrados = registrosFiltrados.filter(r => r.semestre == filtroH_semestre);
          }
          if (filtroH_cuatri) {
            registrosFiltrados = registrosFiltrados.filter(r => r.cuatrimestre == filtroH_cuatri);
          }
          if (filtroH_carrera) {
            registrosFiltrados = registrosFiltrados.filter(r => r.carrera === filtroH_carrera || r.licenciatura === filtroH_carrera);
          }
        }

        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#faf9fc] rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="p-5 border-b border-[#c5c6cf]/30 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-[#1c355e] flex items-center gap-2">
                <span className="material-symbols-outlined">history</span> {archivoActivo ? `Historial: ${archivoActivo.nombre_ciclo}` : 'Archivos Históricos'}
              </h2>
              <div className="flex gap-2 items-center">
                {archivoActivo && (
                  <button onClick={() => {
                    setArchivoExpandido(null);
                    setFiltroH_semestre('');
                    setFiltroH_cuatri('');
                    setFiltroH_carrera('');
                  }} className="mr-2 text-sm font-bold text-[#44464e] hover:text-[#1c355e] flex items-center gap-1 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span> Volver
                  </button>
                )}
                <button
                  onClick={() => handleExportarHistorial(archivoExpandido, archivoActivo ? archivoActivo.registros : null)}
                  disabled={!hayDatos}
                  className={`font-bold py-2 px-4 rounded-xl shadow flex items-center gap-2 transition-all text-sm ${
                    !hayDatos
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">download</span> {archivoActivo ? 'Exportar Archivo' : 'Exportar Todo'}
                </button>
                <button onClick={() => {
                  setModalHistorial(false);
                  setArchivoExpandido(null);
                }} className="text-[#75777f] hover:bg-slate-100 rounded-full p-2 transition-colors ml-1">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-5 flex-1 overflow-auto bg-[#f8f9fa]">
              {cargandoHistorial ? (
                <div className="flex justify-center items-center h-full">
                  <div className="w-10 h-10 border-4 border-[#1c355e] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : !hayDatos ? (
                <div className="flex flex-col items-center justify-center h-full text-[#75777f]">
                  <span className="material-symbols-outlined text-5xl mb-2">inbox</span>
                  <p>No hay registros de historial archivados.</p>
                </div>
              ) : !archivoActivo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivos.map(arch => (
                    <div key={arch.key} onClick={() => setArchivoExpandido(arch.key)} className="bg-white border border-[#c5c6cf]/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#1c355e]/30 cursor-pointer transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-[24px]">folder_zip</span>
                        </div>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg">
                          {arch.tipo_periodo}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-[#1c355e] mb-1">{arch.nombre_ciclo}</h3>
                      <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        Archivado: {arch.fecha}
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center border border-slate-100">
                         <span className="text-xs font-bold text-slate-500">Registros guardados</span>
                         <span className="text-sm font-black text-[#1c355e]">{arch.registros.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4 h-full flex flex-col">
                  {/* Filtros Internos */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#c5c6cf]/40 flex flex-wrap gap-4 items-center shrink-0">
                    <span className="text-sm font-bold text-slate-600 mr-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">filter_list</span> Filtros:
                    </span>
                    
                    {archivoActivo.tipo_periodo === 'semestral' ? (
                      <select value={filtroH_semestre} onChange={(e) => setFiltroH_semestre(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20">
                        <option value="">Todos los Semestres</option>
                        {[...new Set(archivoActivo.registros.map(r => r.semestre).filter(Boolean))].sort((a,b) => {
                           const ia = ORDEN_GRADOS.indexOf(a.toUpperCase());
                           const ib = ORDEN_GRADOS.indexOf(b.toUpperCase());
                           return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                        }).map(s => <option key={s} value={s}>Semestre {s}</option>)}
                      </select>
                    ) : (
                      <select value={filtroH_cuatri} onChange={(e) => setFiltroH_cuatri(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20">
                        <option value="">Todos los Cuatrimestres</option>
                        {[...new Set(archivoActivo.registros.map(r => r.cuatrimestre).filter(Boolean))].sort((a,b) => {
                           const ia = ORDEN_GRADOS.indexOf(a.toUpperCase());
                           const ib = ORDEN_GRADOS.indexOf(b.toUpperCase());
                           return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                        }).map(s => <option key={s} value={s}>Cuatrimestre {s}</option>)}
                      </select>
                    )}
                    
                    <select value={filtroH_carrera} onChange={(e) => setFiltroH_carrera(e.target.value)} className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20">
                      <option value="">Todas las Carreras</option>
                      {[...new Set(archivoActivo.registros.map(r => r.carrera || r.licenciatura).filter(Boolean))].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    
                    <div className="ml-auto text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                      {registrosFiltrados.length} registros
                    </div>
                  </div>
                  
                  {/* Tabla de registros filtrados */}
                  <div className="overflow-x-auto rounded-xl border border-[#c5c6cf]/40 bg-white shadow-sm flex-1 custom-scrollbar">
                    {registrosFiltrados.length > 0 ? (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[#1c355e] text-white sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 font-semibold rounded-tl-xl">Asignatura</th>
                          <th className="px-4 py-3 font-semibold">Docente</th>
                          <th className="px-4 py-3 font-semibold">Día / Horario</th>
                          <th className="px-4 py-3 font-semibold">Aula</th>
                          <th className="px-4 py-3 font-semibold">Carrera/Grupo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c5c6cf]/20">
                        {registrosFiltrados.map((reg) => (
                          <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-[#1b1c1e] max-w-[250px] truncate" title={reg.asignatura}>{reg.asignatura}</td>
                            <td className="px-4 py-3 text-[#44464e] truncate max-w-[200px]" title={reg.docente}>{reg.docente}</td>
                            <td className="px-4 py-3 text-[#44464e]">{reg.horario}</td>
                            <td className="px-4 py-3 font-semibold">{reg.aula_asignada}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className="font-bold text-[#1c355e]">{reg.carrera || reg.licenciatura}</span>
                              <span className="text-slate-400 mx-1">/</span>
                              <span className="text-[#44464e] font-medium">{reg.grupo}</span>
                              {reg.semestre && <span className="ml-2 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">{reg.semestre}</span>}
                              {reg.cuatrimestre && <span className="ml-2 bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded text-[10px] font-black uppercase">{reg.cuatrimestre}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-[#75777f]">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                        <p>No hay registros que coincidan con estos filtros.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
}
