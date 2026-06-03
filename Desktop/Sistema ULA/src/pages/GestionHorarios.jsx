import { useState, useEffect } from 'react';
import { useToast } from '../components/useToast';

export default function GestionHorarios() {
  const { toast, ToastContainer } = useToast();
  const [confirmacion, setConfirmacion] = useState(null);

  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(false);
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

  useEffect(() => {
    fetch('/api/aulas')
      .then(res => res.ok ? res.json() : [])
      .then(data => setAulas(data))
      .catch(err => console.error("Error al precargar aulas:", err));
    
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
        toast("Error al actualizar el horario", "error");
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (tiposPermitidos.includes(file.type)) {
        setArchivo(file);
      } else {
        toast("El archivo debe ser PDF o imagen (PNG, JPG).", "advertencia");
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]);
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
      archivo: archivo.name
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
        toast("Error al intentar publicar las asignaciones.", "error");
      }
    } catch (error) {
      toast("Error de red al publicar.", "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1b1c1e] tracking-tight">Gestión de Horarios</h1>
          <p className="text-base text-[#44464e] mt-1.5">
            Administración profesional de archivos maestros y asignación inteligente de espacios académicos.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex bg-[#f4f3f6] p-1.5 rounded-full border border-[#c5c6cf]/40 w-fit">
            <button 
              onClick={() => setVistaActual('gestor')}
              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                vistaActual === 'gestor' 
                  ? "bg-[#1c355e] text-white shadow-md" 
                  : "text-[#44464e] hover:text-[#1b1c1e]"
              }`}
            >
              Mis Archivos
            </button>
            <button 
              onClick={() => setVistaActual('cargar')}
              className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                vistaActual === 'cargar' 
                  ? "bg-[#1c355e] text-white shadow-md" 
                  : "text-[#44464e] hover:text-[#1b1c1e]"
              }`}
            >
              Cargar Nuevo
            </button>
            
          </div>
          
        </div>
      </div>

      {/* VISTA GESTOR DE ARCHIVOS */}
      {vistaActual === 'gestor' && (
        <div className="space-y-6">
          {/* Opciones superiores */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-sm text-[#44464e]">
              <span className="font-bold text-[#1c355e]">{archivosGuardados.length}</span> archivos cargados
            </div>
            <button 
              onClick={() => cargarArchivosGuardados()}
              className="px-4 py-2 flex items-center gap-2 text-xs font-bold bg-[#f4f3f6] text-[#1c355e] rounded-lg hover:bg-[#eaeaee] transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Actualizar
            </button>
          </div>

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
              {archivosGuardados.map((archivoGuardado, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => verDetallesArchivo(archivoGuardado.archivo)}
                >
                  {/* Encabezado con icono */}
                  <div className="flex items-start justify-between mb-4">
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

                  {/* Nombre del archivo */}
                  <h3 className="font-bold text-[#1b1c1e] truncate mb-2 text-sm">{archivoGuardado.archivo}</h3>

                  {/* Información */}
                  <div className="space-y-2 text-xs text-[#44464e]">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        Horarios
                      </span>
                      <span className="font-bold text-[#1c355e]">{archivoGuardado.total_horarios}</span>
                    </div>
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

          {/* CONTROL DE ASIGNACIÓN AUTOMÁTICA */}
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center">
              <label className="text-xs font-bold text-[#44464e] uppercase">Asignar la misma aula a todas:</label>
              <select 
                value={aulaAsignacionAutomatica}
                onChange={(e) => setAulaAsignacionAutomatica(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Selecciona un aula --</option>
                {aulas.map((aula) => (
                  <option key={aula.id} value={aula.nombre}>
                    {aula.nombre} ({aula.edificio})
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => handleAsignarATodas(aulaAsignacionAutomatica)}
              disabled={!aulaAsignacionAutomatica}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs uppercase transition-all whitespace-nowrap ${
                aulaAsignacionAutomatica 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer' 
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                Aplicar a todas
              </span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1c355e] text-white text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4.5">Docente</th>
                  <th className="px-6 py-4.5">Licenciatura</th>
                  <th className="px-6 py-4.5">Asignatura</th>
                  <th className="px-6 py-4.5">Horario</th>
                  <th className="px-6 py-4.5">Asignar Aula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datosExtraidos.lista_horarios.map((item, index) => (
                  <tr key={index} className="hover:bg-[#f4f3f6]/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-[#44464e]">{item.docente}</td>
                    <td className="px-6 py-4 text-xs font-bold">
                      <span className="bg-[#1c355e]/10 text-[#1c355e] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                        {item.licenciatura}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[#1b1c1e]">{item.asignatura}</td>
                    <td className="px-6 py-4 text-sm font-mono font-bold text-gray-500 italic">{item.horario_resumen}</td>
                    <td className="px-6 py-4">
                      <select 
                        value={asignaciones[index] || ""}
                        onChange={(e) => handleAulaChange(index, e.target.value)}
                        className="w-full max-w-[220px] px-3.5 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm font-bold text-[#1b1c1e] focus:outline-none focus:ring-2 focus:ring-[#1c355e] hover:bg-[#eaeaee] cursor-pointer transition-all"
                      >
                        <option value="">Seleccione un aula</option>
                        {aulas.map((aula) => (
                          <option key={aula.id} value={aula.nombre}>
                            {aula.nombre} ({aula.edificio})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-5 bg-[#f4f3f6]/40 border-t border-[#c5c6cf]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[#44464e] font-semibold flex items-center gap-2 text-gray-400">
              <span className="material-symbols-outlined text-base">shield_with_heart</span>
              Las asignaciones ingresadas actualizarán de inmediato la base de datos de la prefectura.
            </span>
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

      {/* PANEL DE DETALLES */}
      {archivoSeleccionado && detallesArchivo && (
        <div className="bg-white border border-[#c5c6cf]/30 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 bg-[#f4f3f6] border-b border-[#c5c6cf]/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1c355e]/10 text-[#1c355e] rounded-xl">
                <span className="material-symbols-outlined text-xl">folder</span>
              </div>
              <div>
                <span className="text-xs font-bold text-[#44464e] uppercase block">Detalles del Archivo</span>
                <span className="text-sm font-bold text-[#1c355e] font-mono">{archivoSeleccionado}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setArchivoSeleccionado(null);
                setDetallesArchivo(null);
              }}
              className="p-2 text-[#44464e] hover:bg-white rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1c355e] text-white text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4.5">Docente</th>
                  <th className="px-6 py-4.5">Licenciatura</th>
                  <th className="px-6 py-4.5">Asignatura</th>
                  <th className="px-6 py-4.5">Horario</th>
                  <th className="px-6 py-4.5">Aula Asignada</th>
                  <th className="px-6 py-4.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detallesArchivo.map((horario) => (
                  <tr key={horario.id} className="hover:bg-[#f4f3f6]/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-[#44464e]">{horario.docente}</td>
                    <td className="px-6 py-4 text-xs font-bold">
                      <span className="bg-[#1c355e]/10 text-[#1c355e] px-2.5 py-1 rounded-lg uppercase tracking-wide">
                        {horario.licenciatura}
                      </span>
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
                ))}
              </tbody>
            </table>
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
                  {aulas.map((aula) => (
                    <option key={aula.id} value={aula.nombre}>
                      {aula.nombre} ({aula.edificio})
                    </option>
                  ))}
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

      <ToastContainer />
    </div>
  );
}
