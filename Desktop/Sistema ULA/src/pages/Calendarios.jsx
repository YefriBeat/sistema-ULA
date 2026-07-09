import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

export default function Calendarios() {
  const [tabActual, setTabActual] = useState('generales');
  const [calendarios, setCalendarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null); // {tipo, carrera}

  const carreras = ['DER', 'ENF', 'GAS', 'ISC', 'NEG', 'NUT', 'PSCF', 'PSIC', 'VMK'];
  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

  const fetchCalendarios = async () => {
    try {
      const res = await fetch(`${API_URL}/api/calendarios`);
      const data = await res.json();
      setCalendarios(data);
    } catch (error) {
      console.error('Error al obtener calendarios:', error);
    } finally {
      setCargando(false);
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

    Swal.fire({ title: 'Subiendo calendario...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await fetch(`${API_URL}/api/calendarios/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        Swal.fire('¡Éxito!', data.message, 'success');
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {carreras.map(carrera => {
              const cal = getCal('examenes', carrera);
              return (
                <div key={carrera} className={`bg-white rounded-2xl shadow-sm border ${cal ? 'border-emerald-200' : 'border-[#c5c6cf]/30'} p-5 group transition-all hover:shadow-md`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${cal ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'}`}>
                      <span className="material-symbols-outlined text-[20px]">{cal ? 'check_circle' : 'calendar_month'}</span>
                    </div>
                    <div>
                      <h3 className="font-black text-[#1c355e] text-lg">{carrera}</h3>
                      <p className={`text-[10px] font-bold flex items-center gap-1 uppercase tracking-widest ${cal ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {cal ? 'Cargado' : 'Sin archivo'}
                      </p>
                    </div>
                  </div>
                  {cal ? (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <a href={`${API_URL}${cal.archivo_url}`} target="_blank" rel="noreferrer" 
                         className="w-full py-2 rounded-xl border border-emerald-200 text-emerald-600 text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1">
                        Ver PDF
                      </a>
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
        )}
      </div>
    </div>
  );
}
