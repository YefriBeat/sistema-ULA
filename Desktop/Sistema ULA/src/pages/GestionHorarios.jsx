import React, { useState, useEffect } from 'react';

export default function GestionHorarios() {
  const [archivo, setArchivo] = useState(null); // Retiene el objeto File cargado
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [dragActivo, setDragActivo] = useState(false);
  const [asignaciones, setAsignaciones] = useState({});

  // Precargar el catálogo de aulas de la base de datos
  useEffect(() => {
    fetch('http://localhost:8000/api/aulas')
      .then(res => res.ok ? res.json() : [])
      .then(data => setAulas(data))
      .catch(err => console.error("Error al precargar aulas:", err));
  }, []);

  // Función que se ejecuta UNICAMENTE al presionar el botón de procesar
  const handleProcesarYAsignar = async () => {
    if (!archivo) {
      alert("Por favor, arrastra o selecciona un archivo PDF primero.");
      return;
    }

    setCargando(true);
    setDatosExtraidos(null);

    const formData = new FormData();
    formData.append("archivo", archivo);

    try {
      const response = await fetch('http://localhost:8000/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const respuestaTexto = await response.text();

      if (response.ok) {
        const resultado = JSON.parse(respuestaTexto);
        setDatosExtraidos(resultado.datos_extraidos);
        setAsignaciones({}); // Limpiar asignaciones previas
      } else {
        const errorJson = JSON.parse(respuestaTexto);
        alert(errorJson.detail || "Error al analizar el documento.");
        setArchivo(null);
      }
    } catch (error) {
      console.error(error);
      alert("Error en la comunicación con el servidor.");
      setArchivo(null);
    } finally {
      setCargando(false);
    }
  };

  // Manejadores para el área de Drag and Drop
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
      if (file.type === "application/pdf") {
        setArchivo(file); // Solo almacena el archivo, no procesa automáticamente
      } else {
        alert("El archivo debe ser formato PDF.");
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setArchivo(e.target.files[0]); // Solo almacena el archivo
    }
  };

  const handleAulaChange = (index, valor) => {
    setAsignaciones(prev => ({ ...prev, [index]: valor }));
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
      const response = await fetch('http://localhost:8000/api/guardar-horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("¡Horarios validados y publicados con éxito!");
        setDatosExtraidos(null);
        setArchivo(null);
      } else {
        alert("Error al intentar publicar las asignaciones.");
      }
    } catch (error) {
      alert("Error de red al publicar.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-6">
      {/* Encabezado Principal */}
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-3xl font-bold text-[#1c355e] tracking-tight">Gestión de Horarios</h1>
        <p className="text-base text-[#44464e] mt-1.5">
          Carga del archivo maestro y asignación inteligente de espacios académicos de la prefectura.
        </p>
      </div>

      {/* VISTA DE CARGA (Aparece si aún no se han extraído los datos del PDF) */}
      {!datosExtraidos && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Zona de Drop Interactiva */}
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
                <h3 className="text-xl font-bold text-[#1c355e]">Procesando matriz e indexando celdas...</h3>
                <p className="text-sm text-[#44464e]">Extrayendo correspondencias de materias y docentes.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 bg-[#f4f3f6] rounded-2xl inline-block text-[#1c355e]">
                  <span className="material-symbols-outlined text-4xl">
                    {archivo ? "task" : "upload_file"}
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
                        Arrastra y suelta tu PDF aquí o haz clic para seleccionarlo de tus archivos.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <label className="bg-[#f4f3f6] text-[#1b1c1e] px-5 py-2.5 rounded-xl text-sm font-bold border border-[#c5c6cf]/40 hover:bg-[#eaeaee] transition-all cursor-pointer active:scale-95">
                    {archivo ? "Cambiar Archivo" : "Examinar Archivos"}
                    <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Formatos admitidos: .PDF</span>
              </div>
            )}
          </div>

          {/* Panel Lateral de Control y Acción */}
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
                    Esperando archivo PDF...
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

      {/* TABLA DE RESULTADOS DE EXTRACCIÓN (Se renderiza tras presionar el botón) */}
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
    </div>
  );
}