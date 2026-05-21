import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [fechaActual, setFechaActual] = useState('');
  const [clasesDelDia, setClasesDelDia] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    setFechaActual(new Date().toLocaleDateString('es-ES', opciones));

    const obtenerClasesDeHoy = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/clases-hoy');
        if (response.ok) {
          const datosBD = await response.json();
          setClasesDelDia(datosBD);
        }
      } catch (error) {
        console.error("Error de conexión:", error);
      } finally {
        setCargando(false);
      }
    };
    obtenerClasesDeHoy();
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1b1c1e] tracking-tight">Pase de Lista Real-Time</h1>
          <p className="text-base text-[#44464e] mt-1.5">Monitoreo de asistencia y gestión de incidencias docentes.</p>
        </div>
        <div className="bg-white rounded-xl px-4 py-2 border border-[#c5c6cf]/50 flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[#1c355e] text-sm">event</span>
          <span className="text-sm font-bold text-[#1b1c1e] capitalize">{fechaActual}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-1">CLASES ACTIVAS</p>
            <h3 className="text-4xl font-extrabold text-[#1c355e]">0</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#75777f] mt-4 bg-[#f4f3f6] px-2 py-1 rounded-full w-fit border border-[#c5c6cf]/30">
            <span className="material-symbols-outlined text-[12px]">horizontal_rule</span>
            <span>Sin registros de la BD</span>
          </div>
        </div>

        <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-1">ASISTENCIA GENERAL</p>
            <h3 className="text-4xl font-extrabold text-[#c5c6cf]">0%</h3>
            <div className="w-full bg-[#e9e7eb] h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-[#1c355e] h-full rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
          <p className="text-[10px] font-medium text-[#44464e] mt-3">Meta institucional: 98%</p>
        </div>

        <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-[#44464e] uppercase tracking-widest mb-1">INCIDENCIAS HOY</p>
            <div className="flex gap-6 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-[#c5c6cf]">0</span>
                <span className="text-[10px] font-bold text-[#75777f] uppercase tracking-wider">Faltas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-[#c5c6cf]">0</span>
                <span className="text-[10px] font-bold text-[#75777f] uppercase tracking-wider">Retardos</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#75777f] font-bold bg-[#f4f3f6] px-2 py-1 rounded-md border border-[#c5c6cf]/30 w-fit">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Sin incidencias registradas
          </div>
        </div>

        <div className="bg-[#1c355e] border border-[#1c355e] rounded-2xl p-6 shadow-md flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <span className="material-symbols-outlined text-[120px]">schedule_auto</span>
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest mb-1">PRÓXIMO TURNO</p>
            <h3 className="text-2xl font-bold text-white/50">-- : --</h3>
            <p className="text-[11px] text-white/50 mt-1">0 aulas asignadas</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#c5c6cf]/50 rounded-2xl overflow-hidden flex flex-col shadow-sm mt-8">
        <div className="p-6 border-b border-[#c5c6cf]/40 bg-[#f4f3f6]/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1c355e] text-2xl">how_to_reg</span>
              <h2 className="text-[13px] font-bold text-[#1b1c1e] uppercase tracking-widest">Gestión de Asistencia</h2>
            </div>
            <button className="bg-[#1c355e] text-white font-bold text-xs py-2 px-4 rounded-xl hover:bg-[#25467c] transition-all flex items-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">file_download</span> Reporte Excel
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#f4f3f6]/50 border-b border-[#c5c6cf]/40">
                <th className="px-6 text-[10px] font-bold text-[#44464e] uppercase tracking-widest py-5">Docente</th>
                <th className="px-6 text-[10px] font-bold text-[#44464e] uppercase tracking-widest py-5">Asignatura</th>
                <th className="px-6 text-[10px] font-bold text-[#44464e] uppercase tracking-widest py-5">Aula</th>
                <th className="px-6 text-[10px] font-bold text-[#44464e] uppercase tracking-widest text-center py-5">Registro de Asistencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c5c6cf]/30 text-sm text-[#1b1c1e]">
              {cargando && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-[#75777f] font-bold">
                    <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                    <p>Conectando con la base de datos...</p>
                  </td>
                </tr>
              )}
              {!cargando && clasesDelDia.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#75777f]">
                    <span className="material-symbols-outlined text-5xl mb-2 text-[#c5c6cf]">event_busy</span>
                    <p className="font-bold">No hay clases registradas en la base de datos para el día de hoy.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}