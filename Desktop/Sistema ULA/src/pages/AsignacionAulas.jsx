import React, { useState, useEffect, useCallback } from 'react';

export default function GestionHorarios() {
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [aulas, setAulas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [dragActivo, setDragActivo] = useState(false);
  const [asignaciones, setAsignaciones] = useState({});

  // Precargar catálogo de aulas en segundo plano
  useEffect(() => {
    fetch('http://localhost:8000/api/aulas')
      .then(res => res.ok ? res.json() : [] )
      .then(data => setAulas(data))
      .catch(err => console.error("Error al precargar aulas:", err));
  }, []);

  // Procesar archivo de manera unificada
  const procesarDocumentoPDF = async (fileObject) => {
    if (!fileObject || fileObject.type !== "application/pdf") {
      alert("Por favor, sube un archivo válido en formato PDF.");
      return;
    }

    setArchivo(fileObject);
    setCargando(true);
    setDatosExtraidos(null);

    const formData = new FormData();
    formData.append("archivo", fileObject);

    try {
      const response = await fetch('http://localhost:8000/upload-pdf', {
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
        alert(errorJson.detail || "Error en el procesamiento analítico.");
        setArchivo(null);
      }
    } catch (error) {
      console.error(error);
      alert("Error de comunicación con el backend de procesamiento.");
      setArchivo(null);
    } finally {
      setCargando(false);
    }
  };

  // Manejadores del área Drag and Drop real
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
      procesarDocumentoPDF(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      procesarDocumentoPDF(e.target.files[0]);
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
      horario: item.horario,
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
        alert("¡Horarios validados y publicados con éxito en la base de datos!");
        setDatosExtraidos(null);
        setArchivo(null);
      } else {
        alert("Ocurrió un error al intentar publicar las asignaciones.");
      }
    } catch (error) {
      alert("Error de red al publicar.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-6 transition-all duration-300">
      {/* HEADER DE GESTIÓN */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-[#1c355e] tracking-tight">Gestión de Horarios</h1>
          <p className="text-base text-[#44464e] mt-1.5">
            Actualización y cruce automatizado de la base de datos institucional mediante lectura inteligente de PDF.
          </p>
        </div>
      </div>

      {/* COMPONENTE INTERACTIVO DE CARGA AUTOMÁTICA (DRAG AND DROP REAL) */}
      {!datosExtraidos && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div 
            onDragEnter={handleDrag} 
            onDragOver={handleDrag} 
            onDragLeave={handleDrag} 
            onDrop={handleDrop}
            className={`lg:col-span-2 border-2 border-dashed rounded-3xl p-12 text-center transition-all flex flex-col items-center justify-center min-h-[380px] bg-white relative ${
              dragActivo ? "border-[#1c355e] bg-[#1c355e]/5 scale-[0.99]" : "border-[#c5c6cf]/60 hover:border-[#1c355e]/50"
            }`}
          >
            {cargando ? (
              <div className="space-y-4 animate-pulse">
                <span className="material-symbols-outlined text-5xl text-[#1c355e] animate-spin">sync</span>
                <h3 className="text-xl font-bold text-[#1c355e]">Analizando e indexando matriz del PDF...</h3>
                <p className="text-sm text-[#44464e]">Extrayendo relaciones espaciales, horarios y asignaturas.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="p-4 bg-[#f4f3f6] rounded-2xl inline-block text-[#1c355e]">
                  <span className="material-symbols-outlined text-4xl">upload_file</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1b1c1e]">Subir Horario Maestro</h3>
                  <p className="text-sm text-[#44464e] mt-1 max-w-sm mx-auto">
                    Arrastra y suelta el archivo PDF exportado del sistema analítico o haz clic para examinar tus archivos locales.
                  </p>
                </div>
                <div>
                  <label className="bg-[#1c355e] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-[#152a4a] transition-all cursor-pointer active:scale-95 inline-block">
                    Examinar Archivos
                    <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                  </label>
                </div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Solo archivos PDF (Máx. 10MB)</span>
              </div>
            )}
          </div>

          {/* ASIDE DE CONTROL LATERAL */}
          <div className="space-y-6">
            <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-[#44464e] uppercase tracking-wider mb-3">Estado del Análisis</h4>
              <div className="flex items-center gap-3 p-3.5 bg-[#f4f3f6] rounded-xl text-sm font-medium text-[#44464e]">
                <span className="material-symbols-outlined text-[#1c355e] animate-pulse">hourglass_empty</span>
                <span>Esperando documento analítico...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASO B: GRILLA DE RESULTADOS AUTOMÁTICA */}
      {datosExtraidos && (
        <div className="bg-white border border-[#c5c6cf]/30 rounded-3xl shadow-sm overflow-hidden transform transition-all duration-300 animate-fadeIn">
          <div className="p-5 bg-[#f4f3f6] border-b border-[#c5c6cf]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#1c355e]/10 text-[#1c355e] rounded-xl flex items-center">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
              <div>
                <span className="text-xs font-bold text-[#44464e] uppercase block">Archivo Indexado</span>
                <span className="text-sm font-bold text-[#1c355e] font-mono">{archivo?.name}</span>
              </div>
            </div>
            <button 
              onClick={() => { setDatosExtraidos(null); setArchivo(null); }}
              className="text-xs bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors"
            >
              Remover y Volver
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
                  <th className="px-6 py-4.5">Asignar Espacio / Aula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datosExtraidos.lista_horarios.map((item, index) => (
                  <tr key={index} className="hover:bg-[#f4f3f6]/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-[#44464e]">{item.docente}</td>
                    <td className="px-6 py-4 text-xs font-bold">
                      <span className="bg-[#1c355e]/10 text-[#1c355e] px-2.5 py-1 rounded-lg inline-block uppercase tracking-wide">
                        {item.licenciatura}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[#1b1c1e]">{item.asignatura}</td>
                    <td className="px-6 py-4 text-sm font-mono font-bold text-gray-500 italic">{item.horario}</td>
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
            <div className="flex items-center gap-2.5 text-xs text-[#44464e] font-semibold">
              <span className="material-symbols-outlined text-base text-gray-400">shield_with_heart</span>
              <span>Los registros publicados alimentarán inmediatamente el Pase de Lista y Directorios Generales.</span>
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
    </div>
  );
}