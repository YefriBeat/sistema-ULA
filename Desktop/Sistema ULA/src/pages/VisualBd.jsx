import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTime } from '../components/TimeContext';

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

const minToTime = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Fusiona bloques consecutivos del mismo docente/asignatura/día/aula en una sola fila
const groupConsecutiveClasses = (clases) => {
  if (!clases.length) return clases;

  const estadoPrioridad = { en_curso: 0, proxima: 1, finalizada: 2 };

  const mapGrupos = new Map();
  clases.forEach(clase => {
    const key = [clase.diaOriginal, clase.docente, clase.licenciatura, clase.asignatura, clase.aula_asignada || ''].join('||');
    if (!mapGrupos.has(key)) mapGrupos.set(key, []);
    mapGrupos.get(key).push(clase);
  });

  const resultado = [];

  mapGrupos.forEach(grupo => {
    grupo.sort((a, b) => a.inicio - b.inicio);

    let actual = { ...grupo[0], _ids: [String(grupo[0].id)] };

    for (let i = 1; i < grupo.length; i++) {
      const siguiente = grupo[i];
      // Bloques consecutivos: gap ≤ 10 minutos (tolerancia para recesos cortos)
      if (siguiente.inicio - actual.fin <= 10) {
        actual.fin = Math.max(actual.fin, siguiente.fin);
        actual.textoHora = `${minToTime(actual.inicio)}-${minToTime(actual.fin)}`;
        if ((estadoPrioridad[siguiente.estadoTiempo] ?? 2) < (estadoPrioridad[actual.estadoTiempo] ?? 2)) {
          actual.estadoTiempo = siguiente.estadoTiempo;
        }
        actual._ids.push(String(siguiente.id));
      } else {
        resultado.push(actual);
        actual = { ...siguiente, _ids: [String(siguiente.id)] };
      }
    }
    resultado.push(actual);
  });

  return resultado.sort((a, b) => {
    if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex || 0) - (b.diaClaseIndex || 0);
    return (a.inicio || 0) - (b.inicio || 0);
  });
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





  const ahora = useTime();
  const [errorConexion, setErrorConexion] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const navigate = useNavigate();



  // Conexión constante a la base de datos
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const response = await fetch('/api/horarios');
        if (response.ok) {
          const data = await response.json();
          setAsignaturas(data);
          setErrorConexion(false);
          setUltimaSync(new Date());
        } else {
          setErrorConexion(true);
        }
      } catch (error) {
        console.error("Error al cargar la BD:", error);
        setErrorConexion(true);
      } finally {
        setCargando(false);
      }
    };
    fetchDatos();
    const interval = setInterval(fetchDatos, 30000);
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

      return { ...clase, estadoTiempo, textoHora, diaClaseIndex, inicio, fin, diaOriginal: dia };
    }).sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex || 0) - (b.diaClaseIndex || 0);
      return (a.inicio || 0) - (b.inicio || 0);
    });
  }, [asignaturas, ahora]);

  // Versión agrupada de TODOS los datos (sin filtros) — base para stats y opciones de hora
  const todosAgrupados = useMemo(() => groupConsecutiveClasses(asignaturasConEstado), [asignaturasConEstado]);

  // Generar opciones dinámicas para los selectores basados en la BD real
  const opcionesLicenciatura = useMemo(() => [...new Set(asignaturas.map(a => a.licenciatura).filter(Boolean))].sort(), [asignaturas]);
  const opcionesAsignatura = useMemo(() => [...new Set(asignaturas.map(a => a.asignatura).filter(Boolean))].sort(), [asignaturas]);
  const opcionesHora = useMemo(() => [...new Set(todosAgrupados.map(a => a.textoHora).filter(Boolean))].sort(), [todosAgrupados]);

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

  const datosAgrupados = useMemo(() => groupConsecutiveClasses(datosFiltrados), [datosFiltrados]);

  // Métricas del Directorio — calculadas desde datos agrupados para consistencia con la tabla
  const stats = useMemo(() => {
    const enCurso    = todosAgrupados.filter(c => c.estadoTiempo === 'en_curso').length;
    const proximas   = todosAgrupados.filter(c => c.estadoTiempo === 'proxima').length;
    const finalizadas = todosAgrupados.filter(c => c.estadoTiempo === 'finalizada').length;
    const total      = todosAgrupados.length;
    return { enCurso, proximas, finalizadas, total };
  }, [todosAgrupados]);

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
          <div className={`bg-white rounded-xl px-5 py-3 border flex items-center gap-3 shadow-sm ${errorConexion ? 'border-orange-300' : 'border-[#c5c6cf]/50'}`}>
            {errorConexion ? (
              <>
                <span className="material-symbols-outlined text-orange-500 text-sm">wifi_off</span>
                <span className="text-xs font-bold text-orange-600">SIN CONEXIÓN</span>
                {ultimaSync && (
                  <>
                    <span className="text-[#c5c6cf]">•</span>
                    <span className="text-xs text-[#75777f]">Última sync: {ultimaSync.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-green-500 text-sm animate-pulse">sensors</span>
                <span className="text-xs font-bold text-[#75777f]">EN LÍNEA</span>
                <span className="text-[#c5c6cf]">•</span>
                <span className="text-sm font-semibold text-[#1b1c1e] capitalize">{fechaFormateada}</span>
              </>
            )}
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
          <table className="w-full text-left border-collapse table-fixed min-w-[820px]">
            <thead>
              <tr className="bg-[#1c355e] text-white text-[11px] uppercase font-bold tracking-widest">
                <th className="w-[8%]  py-4 px-4">Día</th>
                <th className="w-[15%] py-4 px-4">Docente</th>
                <th className="w-[22%] py-4 px-4">Licenciatura</th>
                <th className="w-[18%] py-4 px-4">Asignatura</th>
                <th className="w-[12%] py-4 px-4">Horario</th>
                <th className="w-[12%] py-4 px-4">Aula</th>
                <th className="w-[13%] py-4 px-4">Estado</th>
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
                datosAgrupados.map((item) => (
                  <tr key={item._ids.join('-')} className="text-sm hover:bg-[#f4f3f6]/50 transition-colors">
                    <td className="py-4 px-4 font-bold text-[#44464e] capitalize">{item.diaOriginal || "—"}</td>
                    <td className="py-4 px-4 font-bold text-[#1b1c1e] break-words">{item.docente}</td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border break-words inline-block max-w-full ${obtenerColorLicenciatura(item.licenciatura)}`}>
                        {item.licenciatura}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-medium text-[#44464e] break-words">{item.asignatura}</td>
                    <td className="py-4 px-4 font-mono text-[#1c355e] font-bold text-xs whitespace-nowrap">{item.textoHora}</td>
                    <td className="py-4 px-4">
                      {item.aula_reasignada ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-orange-600 flex items-center gap-1 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[13px]">construction</span>
                            {item.aula_asignada}
                          </span>
                          <span className="text-[10px] text-[#75777f] line-through">{item.aula_original}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-[#1c355e]">{item.aula_asignada || "—"}</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
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