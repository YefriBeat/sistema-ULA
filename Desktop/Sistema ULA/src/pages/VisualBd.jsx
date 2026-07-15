import { useState, useEffect, useMemo, useRef } from 'react';
import { useTime } from '../components/TimeContext';

// ─── Parser de horario ────────────────────────────────────────────────────────
const parsearHorario = (horarioCompleto) => {
  const stringSeguro = horarioCompleto || "";
  const partes = stringSeguro.split(' ');
  let dia = '';
  let textoHora = '';
  if (partes.length >= 2 && /[a-zA-Z]/.test(partes[0])) {
    dia = partes[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    textoHora = partes.slice(1).join('');
  } else {
    textoHora = stringSeguro;
  }
  const horasLimpias = textoHora.replace(/-+/g, '-').trim();
  const [strInicio, strFin] = horasLimpias.split('-');
  const getMinutos = (horaStr) => {
    if (!horaStr || !horaStr.trim()) return null;
    const partes = horaStr.trim().split(':');
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1] || '0', 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };
  return { dia, inicio: getMinutos(strInicio), fin: getMinutos(strFin), textoHora: horasLimpias };
};

const obtenerColorLicenciatura = (licenciatura) => {
  const lic = (licenciatura || '').toLowerCase();
  if (lic.includes('medicina') || lic === 'med') return 'bg-blue-50 text-blue-700 border-blue-200/50';
  if (lic.includes('administración') || lic.includes('negocios') || lic === 'adm' || lic === 'neg') return 'bg-orange-50 text-orange-700 border-orange-200/50';
  if (lic.includes('mecatrónica') || lic.includes('ingeniería') || lic === 'isc' || lic === 'sis' || lic === 'imc') return 'bg-green-50 text-green-700 border-green-200/50';
  if (lic.includes('enfermería') || lic === 'enf') return 'bg-teal-50 text-teal-700 border-teal-200/50';
  if (lic.includes('derecho') || lic === 'der') return 'bg-red-50 text-red-700 border-red-200/50';
  if (lic.includes('nutrición') || lic === 'nut') return 'bg-lime-50 text-lime-700 border-lime-200/50';
  if (lic.includes('psicología') || lic === 'psi') return 'bg-purple-50 text-purple-700 border-purple-200/50';
  return 'bg-gray-50 text-gray-700 border-gray-200/50';
};

const normalizarNombreLic = (nombre) => {
  if (!nombre) return '';
  // Eliminar palabras pegadas repetidas: "LICENCIATURALICENCIATURA" → "LICENCIATURA"
  let limpio = nombre.replace(/([A-Za-záéíóúÁÉÍÓÚñÑ]{5,})\1/g, '$1');
  // Eliminar palabras separadas repetidas: "Licenciatura Licenciatura" → "Licenciatura"
  limpio = limpio.replace(/\b(\w+)\s+\1\b/gi, '$1');
  return limpio.replace(/\s+/g, ' ').trim();
};

const extraerClaveLic = (licenciatura) => {
  if (!licenciatura) return '';
  const norm = normalizarNombreLic(licenciatura);
  
  // Si ya es un acrónimo (por el nuevo extractor del backend), devolverlo directo
  if (/^[A-Z]{2,6}$/i.test(norm)) return norm.toUpperCase();

  // Patrón explícito: (ENF), (ADM), etc.
  const mParens = norm.match(/\(([A-Z]{2,6})\)/);
  if (mParens) return mParens[1];
  // Mapa de palabras clave → abreviatura
  const mapas = [
    [/enferm/i, 'ENF'], [/administrac/i, 'ADM'], [/negocios/i, 'NEG'],
    [/mercadotecnia|marketing/i, 'VMK'], [/derecho/i, 'DER'],
    [/nutrici/i, 'NUT'], [/contabilidad/i, 'CONT'], [/psicolog/i, 'PSI'],
    [/gastronom/i, 'GAS'], [/inform[áa]tica|sistemas/i, 'SIS'],
    [/medicina/i, 'MED'], [/odontolog/i, 'ODO'], [/turismo/i, 'TUR'],
  ];
  for (const [re, abr] of mapas) if (re.test(norm)) return abr;
  // Fallback: iniciales de palabras significativas (sin "Licenciatura en")
  const palabras = norm.replace(/licenciatura\s*(en\s*)?/gi, '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length > 0) return palabras.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 5) || norm.slice(0, 10);
  return norm.slice(0, 10);
};

const diasSemanaMap = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6
};

const minToTime = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const getBloqueEstandar = (inicio) => {
  if (inicio >= 420 && inicio < 550) return "07:00-08:40";
  if (inicio >= 550 && inicio < 650) return "09:10-10:50";
  if (inicio >= 650 && inicio < 750) return "10:50-12:30";
  if (inicio >= 750 && inicio < 850) return "12:30-14:10";
  if (inicio >= 850 && inicio < 950) return "14:10-15:50";
  if (inicio >= 950 && inicio < 1030) return "15:50-17:30";
  if (inicio >= 1030 && inicio < 1150) return "17:10-18:50";
  if (inicio >= 1150) return "19:10-20:50";
  return `${minToTime(inicio)}-${minToTime(inicio + 100)}`;
};

const groupConsecutiveClasses = (clases) => {
  if (!clases.length) return clases;
  const estadoPrioridad = { examen_ordinario: -1, en_curso: 0, proxima: 1, finalizada: 2, programada: 3 };
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
      if (siguiente.inicio - actual.fin <= 10) {
        actual.fin = Math.max(actual.fin, siguiente.fin);
        actual.textoHora = `${minToTime(actual.inicio)}-${minToTime(actual.fin)}`;
        if ((estadoPrioridad[siguiente.estadoTiempo] ?? 2) < (estadoPrioridad[actual.estadoTiempo] ?? 2)) {
          actual.estadoTiempo = siguiente.estadoTiempo;
        }
        actual._ids.push(String(siguiente.id));
        if (siguiente.tieneExamenHoy) actual.tieneExamenHoy = true;
      } else {
        resultado.push(actual);
        actual = { ...siguiente, _ids: [String(siguiente.id)] };
      }
    }
    resultado.push(actual);
  });
  return resultado.sort((a, b) => {
    if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex ?? 99) - (b.diaClaseIndex ?? 99);
    return (a.inicio ?? 0) - (b.inicio ?? 0);
  });
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VisualBd() {
  const [asignaturas, setAsignaturas] = useState([]);
  const [aulasData, setAulasData] = useState([]);
  const [suplenciasActivas, setSuplenciasActivas] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroLic, setFiltroLic] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroHora, setFiltroHora] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('en_curso');
  const [cargando, setCargando] = useState(true);
  const [examenesHoy, setExamenesHoy] = useState([]);
  const [estadoAcademico, setEstadoAcademico] = useState({
    semestral: { hay_clases: true, estado: 'clases' },
    cuatrimestral: { hay_clases: true, estado: 'clases' }
  });

  const ahoraRaw = useTime();
  // 🔧 Throttle: solo recalcular cuando cambia el MINUTO (no cada segundo)
  const minutoActual = ahoraRaw.getHours() * 60 + ahoraRaw.getMinutes();
  const ahora = useMemo(() => ahoraRaw, [minutoActual]);
  // 🔧 String de fecha que solo cambia al cambiar el DÍA (evita refetch cada segundo)
  const hoyStr = useMemo(() => {
    const y = ahora.getFullYear();
    const m = String(ahora.getMonth() + 1).padStart(2, '0');
    const d = String(ahora.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [ahora.getFullYear(), ahora.getMonth(), ahora.getDate()]);
  const [errorConexion, setErrorConexion] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);

  // Fetch horarios (polling cada 30s)
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

  // Fetch estado academico y examenes de hoy — solo cuando cambia el DÍA (no cada segundo)
  useEffect(() => {
    const fetchEstado = async () => {
      try {
        const formatter = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long' });
        const fechaStrFormat = formatter.format(ahora);

        const [resSem, resCuat, resExamenes] = await Promise.all([
          fetch(`/api/estado-academico?plan=semestral&fecha=${hoyStr}`),
          fetch(`/api/estado-academico?plan=cuatrimestral&fecha=${hoyStr}`),
          fetch(`/api/examenes-hoy?fecha=${encodeURIComponent(fechaStrFormat)}`)
        ]);

        if (resSem.ok && resCuat.ok) {
          setEstadoAcademico({
            semestral: await resSem.json(),
            cuatrimestral: await resCuat.json()
          });
        }
        if (resExamenes.ok) {
          const dataEx = await resExamenes.json();
          setExamenesHoy(Array.isArray(dataEx) ? dataEx : []);
        }
      } catch (e) {
        console.error("Error cargando contexto académico:", e);
      }
    };
    fetchEstado();
  }, [hoyStr]);

  // Fetch aulas para el donut chart
  useEffect(() => {
    fetch('/api/aulas')
      .then(r => r.ok ? r.json() : [])
      .then(data => setAulasData(data))
      .catch(() => {});
  }, []);

  // Fetch suplencias activas hoy (polling cada 30s sincronizado con horarios)
  useEffect(() => {
    const fetchSuplencias = () => {
      fetch('/api/suplencias-activas')
        .then(r => r.ok ? r.json() : [])
        .then(data => setSuplenciasActivas(Array.isArray(data) ? data : []))
        .catch(() => {});
    };
    fetchSuplencias();
    const interval = setInterval(fetchSuplencias, 30000);
    return () => clearInterval(interval);
  }, []);

  // Motor temporal
  const asignaturasConEstado = useMemo(() => {
    const diaActualIndex = ahora.getDay();
    const minutosActuales = (ahora.getHours() * 60) + ahora.getMinutes();
    
    return asignaturas.map(clase => {
      const { dia, inicio, fin, textoHora } = parsearHorario(clase.horario);
      const diaClaseIndex = dia ? diasSemanaMap[dia] : undefined;
      
      const isCuatri = (clase.cuatrimestre && clase.cuatrimestre !== '');
      const planStr = isCuatri ? 'cuatrimestral' : 'semestral';
      const academico = estadoAcademico[planStr];
      const hayClasesPlan = academico?.hay_clases !== false;
      const estadoRazon = academico?.estado || 'receso';

      let estadoTiempo = 'programada';
      if (diaClaseIndex === undefined || inicio === null || fin === null) {
        estadoTiempo = 'programada';
      } else if (diaClaseIndex < diaActualIndex) {
        estadoTiempo = 'finalizada';
      } else if (diaClaseIndex > diaActualIndex) {
        estadoTiempo = 'programada';
      } else {
        // Es una clase del día de HOY
        if (!hayClasesPlan) {
          estadoTiempo = 'suspendida';
        } else if (minutosActuales > fin) {
          estadoTiempo = 'finalizada';
        } else if (minutosActuales >= inicio && minutosActuales <= fin) {
          estadoTiempo = 'en_curso';
        } else {
          estadoTiempo = 'proxima';
        }
      }

      // Detectar si la clase tiene examen programado para hoy (tiene precedencia si hay clases)
      const norm = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const asigNorm = norm(clase.asignatura);
      const tieneExamenHoy = examenesHoy.some(ex => {
        let matReal = ex.materia;
        try { matReal = decodeURIComponent(escape(ex.materia)); } catch (e) {}
        const matNorm = norm(matReal);
        return asigNorm.includes(matNorm) || matNorm.includes(asigNorm);
      });

      if (tieneExamenHoy && estadoTiempo === 'en_curso' && hayClasesPlan) {
        estadoTiempo = 'examen_ordinario';
      }

      return { 
        ...clase, 
        estadoTiempo, 
        estadoRazon: estadoTiempo === 'suspendida' ? estadoRazon : undefined,
        textoHora, 
        diaClaseIndex, 
        inicio, 
        fin, 
        diaOriginal: dia, 
        tieneExamenHoy 
      };
    }).sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex ?? 99) - (b.diaClaseIndex ?? 99);
      return (a.inicio ?? 0) - (b.inicio ?? 0);
    });
  }, [asignaturas, ahora, estadoAcademico, examenesHoy]);

  // Todas las suplencias de hoy → filas sintéticas con estado calculado en tiempo real
  const filasSuplencias = useMemo(() => {
    const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return suplenciasActivas.map(s => {
      let estadoTiempo;
      if (minsAhora > s.fin_mins)        estadoTiempo = 'finalizada';
      else if (minsAhora >= s.inicio_mins) estadoTiempo = 'en_curso';
      else                                estadoTiempo = 'proxima';
      return {
        id:              `suplencia-${s.id}`,
        _ids:            [`suplencia-${s.id}`],
        docente:         s.suplente_nombre,
        asignatura:      s.materia,
        licenciatura:    s.licenciatura || '',
        aula_asignada:   s.aula_asignada || '—',
        textoHora:       `${s.hora_inicio}-${s.hora_fin}`,
        inicio:          s.inicio_mins,
        fin:             s.fin_mins,
        diaOriginal:     (s.dia || '').toLowerCase(),
        diaClaseIndex:   undefined,
        estadoTiempo,
        es_suplencia:    true,
        docente_ausente: s.docente_nombre,
      };
    });
  }, [suplenciasActivas, ahora]);

  const todosAgrupados = useMemo(() => groupConsecutiveClasses(asignaturasConEstado), [asignaturasConEstado]);

  const opcionesLicenciatura = useMemo(() => {
    // Deduplicar por abreviatura, no por nombre completo.
    // Dos licenciaturas distintas en BD (e.g. "DER Plan 2020" y "DER Plan 2025")
    // generan la misma abreviatura → deben aparecer como una sola opción.
    const mapaAbr = new Map(); // abreviatura → primer nombre completo encontrado
    asignaturas.forEach(a => {
      if (!a.licenciatura) return;
      const abr = extraerClaveLic(a.licenciatura);
      if (!mapaAbr.has(abr)) mapaAbr.set(abr, abr);
    });
    return [...mapaAbr.keys()].sort().map(abr => ({ valor: abr, etiqueta: abr }));
  }, [asignaturas]);

  const datosPorLic = useMemo(() => {
    if (!filtroLic) return todosAgrupados;
    // filtroLic ahora es la abreviatura → comparar con la abreviatura de cada clase
    return todosAgrupados.filter(a => extraerClaveLic(a.licenciatura) === filtroLic);
  }, [todosAgrupados, filtroLic]);

  const opcionesAsignatura = useMemo(() => (
    [...new Set(datosPorLic.map(a => a.asignatura).filter(Boolean))].sort()
  ), [datosPorLic]);

  const opcionesHora = useMemo(() => {
    const base = filtroAsignatura
      ? datosPorLic.filter(a => a.asignatura === filtroAsignatura)
      : datosPorLic;
    return [...new Set(base.map(a => getBloqueEstandar(a.inicio)).filter(Boolean))].sort();
  }, [datosPorLic, filtroAsignatura]);

  const datosFiltrados = useMemo(() => {
    let resultado = todosAgrupados.filter(item => {
      const coincideBusqueda =
        item.docente?.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
      const coincideLic       = filtroLic       === '' || extraerClaveLic(item.licenciatura) === filtroLic;
      const coincideAsignatura = filtroAsignatura === '' || item.asignatura  === filtroAsignatura;
      const coincideHora      = filtroHora      === '' || getBloqueEstandar(item.inicio) === filtroHora;
      const coincideDia       = filtroDia       === '' || item.diaOriginal  === filtroDia;
      return coincideBusqueda && coincideLic && coincideAsignatura && coincideHora && coincideDia;
    });
    if (filtroEstado !== 'todas') {
      const diaHoy = ahora.getDay();
      resultado = resultado.filter(item => {
        if (item.estadoTiempo !== filtroEstado) return false;
        // "Finalizadas" → solo clases del día actual; las de días anteriores van a BD Total
        if (filtroEstado === 'finalizada') return item.diaClaseIndex === diaHoy;
        return true;
      });
    }
    // Agregar filas de suplencias (filtradas por estado y criterios de búsqueda)
    const suplFiltradas = filasSuplencias.filter(s => {
      const coincideEstado     = filtroEstado === 'todas' || s.estadoTiempo === filtroEstado;
      const coincideBusqueda   = !busqueda ||
        s.docente?.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
      const coincideLic        = filtroLic       === '' || extraerClaveLic(s.licenciatura) === filtroLic;
      const coincideAsignatura = filtroAsignatura === '' || s.asignatura  === filtroAsignatura;
      const coincideHora       = filtroHora      === '' || getBloqueEstandar(s.inicio) === filtroHora;
      return coincideEstado && coincideBusqueda && coincideLic && coincideAsignatura && coincideHora;
    });
    resultado = [...resultado, ...suplFiltradas];
    return resultado.sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex ?? 99) - (b.diaClaseIndex ?? 99);
      return (a.inicio ?? 0) - (b.inicio ?? 0);
    });
  }, [todosAgrupados, filasSuplencias, busqueda, filtroLic, filtroAsignatura, filtroHora, filtroDia, filtroEstado, ahora]);

  const datosAgrupados = useMemo(() => datosFiltrados, [datosFiltrados]);

  const stats = useMemo(() => {
    const diaHoy      = ahora.getDay();
    const enCurso     = todosAgrupados.filter(c => c.estadoTiempo === 'en_curso').length;
    const proximas    = todosAgrupados.filter(c => c.estadoTiempo === 'proxima').length;
    // Solo clases del día actual que ya concluyeron (no días anteriores de la semana)
    const finalizadas = todosAgrupados.filter(c => c.estadoTiempo === 'finalizada' && c.diaClaseIndex === diaHoy).length;
    const programadas = todosAgrupados.filter(c => c.estadoTiempo === 'programada').length;
    const total       = todosAgrupados.length;
    const docentesEnCurso = new Set(todosAgrupados.filter(c => c.estadoTiempo === 'en_curso').map(c => c.docente)).size;
    const docentesTotales = new Set(todosAgrupados.map(c => c.docente)).size;
    return { enCurso, proximas, finalizadas, programadas, total, docentesEnCurso, docentesTotales };
  }, [todosAgrupados, ahora]);

  const donutStats = useMemo(() => {
    const esLaboratorio = (nombre) => nombre?.toLowerCase().startsWith('lab');
    const aulasNormales = aulasData.filter(a => !esLaboratorio(a.nombre));
    const laboratorios = aulasData.filter(a => esLaboratorio(a.nombre));

    const total = aulasNormales.length;
    const aulasEnCursoSet = new Set(
      todosAgrupados
        .filter(c => c.estadoTiempo === 'en_curso' && c.aula_asignada && c.aula_asignada !== 'Por asignar' && !esLaboratorio(c.aula_asignada))
        .map(c => c.aula_asignada)
    );
    const labsEnCursoSet = new Set(
      todosAgrupados
        .filter(c => c.estadoTiempo === 'en_curso' && c.aula_asignada && c.aula_asignada !== 'Por asignar' && esLaboratorio(c.aula_asignada))
        .map(c => c.aula_asignada)
    );

    const ocupadas    = aulasEnCursoSet.size;
    const disponibles = Math.max(0, total - ocupadas);
    const porcentaje  = total > 0 ? Math.round((ocupadas / total) * 100) : 0;
    
    const totalLabs = laboratorios.length;
    const labsOcupados = labsEnCursoSet.size;

    return { total, ocupadas, disponibles, porcentaje, totalLabs, labsOcupados };
  }, [aulasData, todosAgrupados]);

  const RADIO_DONUT = 38;
  const CIRC_DONUT  = 2 * Math.PI * RADIO_DONUT;
  const dashOcupadas = (donutStats.porcentaje / 100) * CIRC_DONUT;

  // Acciones rápidas
  const resetFiltros = () => { setFiltroLic(''); setFiltroAsignatura(''); setFiltroHora(''); setFiltroDia(''); setBusqueda(''); };

  const scrollToTable = () => {
    document.getElementById('tabla-resultados')?.scrollIntoView({ behavior: 'smooth' });
  };

  const verBaseDatosTotal    = () => { setFiltroEstado('todas'); resetFiltros(); scrollToTable(); };
  const verClasesEnCurso     = () => { setFiltroEstado('en_curso'); resetFiltros(); scrollToTable(); };
  const verClasesProximas    = () => { setFiltroEstado('proxima'); resetFiltros(); scrollToTable(); };
  const verClasesFinalizadas = () => { setFiltroEstado('finalizada'); resetFiltros(); scrollToTable(); };

  const fechaFormateada = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });


  return (
    <div className="max-w-[1400px] mx-auto space-y-5 font-manrope">

      
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#1b1c1e] tracking-tight">Panel de Control</h1>
            <p className="text-sm text-[#75777f] mt-1 font-medium">Gestión y seguimiento de horarios en tiempo real.</p>
          </div>

          {/* Indicador de estado */}
        <div className={`flex items-center gap-3 bg-white rounded-2xl px-5 py-3 border shadow-sm ${errorConexion ? 'border-orange-300' : 'border-[#c5c6cf]/40'}`}>
          {errorConexion ? (
            <>
              <span className="material-symbols-outlined text-orange-500 text-[18px]">wifi_off</span>
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Sin conexión</p>
                {ultimaSync && (
                  <p className="text-[10px] text-[#75777f]">Última sync: {ultimaSync.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <span className="material-symbols-outlined text-green-500 text-[18px]">sensors</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-ping" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#75777f] uppercase tracking-wider">En Línea</p>
                <p className="text-xs font-semibold text-[#1b1c1e] capitalize">{fechaFormateada}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ MÉTRICAS + DONUT ════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">

        {/* 4 tarjetas de estadísticas */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* En Curso */}
          <div
            onClick={verClasesEnCurso}
            className={`rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border ${
              stats.enCurso > 0
                ? 'bg-blue-50 border-blue-200 shadow-sm shadow-blue-100'
                : 'bg-white border-[#c5c6cf]/40 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-[#44464e] uppercase tracking-widest">En Curso</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stats.enCurso > 0 ? 'bg-blue-100' : 'bg-[#f4f3f6]'}`}>
                <span className={`material-symbols-outlined text-[16px] ${stats.enCurso > 0 ? 'text-blue-600' : 'text-[#c5c6cf]'}`}>play_circle</span>
              </div>
            </div>
            <div>
              <h3 className={`text-4xl lg:text-5xl font-black leading-none ${stats.enCurso > 0 ? 'text-blue-700' : 'text-[#c5c6cf]'}`}>
                {stats.enCurso}
              </h3>
              {stats.enCurso > 0 && (
                <p className="text-[11px] font-bold text-blue-600 mt-2">{stats.docentesEnCurso} maestros activos</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-[#75777f] font-semibold">Click para filtrar</p>
              {stats.enCurso > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 uppercase tracking-wider">Ahora</span>
              )}
            </div>
          </div>

          {/* Próximas Hoy */}
          <div 
            onClick={verClasesProximas}
            className={`rounded-2xl p-5 flex flex-col justify-between border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
            (stats.proximas + stats.programadas) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#c5c6cf]/40'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-[#44464e] uppercase tracking-widest">Próximas</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${(stats.proximas + stats.programadas) > 0 ? 'bg-amber-100' : 'bg-[#f4f3f6]'}`}>
                <span className={`material-symbols-outlined text-[16px] ${(stats.proximas + stats.programadas) > 0 ? 'text-amber-600' : 'text-[#c5c6cf]'}`}>schedule</span>
              </div>
            </div>
            <h3 className={`text-4xl lg:text-5xl font-black leading-none ${(stats.proximas + stats.programadas) > 0 ? 'text-amber-700' : 'text-[#c5c6cf]'}`}>
              {stats.proximas + stats.programadas}
            </h3>
            <p className="text-[10px] text-[#75777f] font-semibold mt-3">
              {(stats.proximas + stats.programadas) === 0
                ? 'Sin clases pendientes'
                : `${stats.proximas} hoy · ${stats.programadas} semana`}
            </p>
          </div>

          {/* Finalizadas Hoy */}
          <div 
            onClick={verClasesFinalizadas}
            className={`rounded-2xl p-5 flex flex-col justify-between border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${
            stats.finalizadas > 0 ? 'bg-gray-50 border-gray-200' : 'bg-white border-[#c5c6cf]/40'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-[#44464e] uppercase tracking-widest">Finalizadas Hoy</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stats.finalizadas > 0 ? 'bg-gray-200' : 'bg-[#f4f3f6]'}`}>
                <span className={`material-symbols-outlined text-[16px] ${stats.finalizadas > 0 ? 'text-gray-600' : 'text-[#c5c6cf]'}`}>stop_circle</span>
              </div>
            </div>
            <h3 className={`text-4xl lg:text-5xl font-black leading-none ${stats.finalizadas > 0 ? 'text-gray-700' : 'text-[#c5c6cf]'}`}>
              {stats.finalizadas}
            </h3>
            <p className="text-[10px] text-[#75777f] font-semibold mt-3">de {stats.total} totales</p>
          </div>

          {/* Ver BD Total */}
          <div
            onClick={verBaseDatosTotal}
            className="rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border border-[#1c355e] shadow-lg shadow-[#1c355e]/10"
            style={{ background: 'linear-gradient(145deg, #1c355e 0%, #0e1f3d 100%)' }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Clases Totales</p>
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-white/80">database</span>
              </div>
            </div>
            <div>
              <h3 className="text-4xl lg:text-5xl font-black text-white leading-none">{stats.total}</h3>
              <p className="text-[11px] font-bold text-white/80 mt-2">{stats.docentesTotales} maestros registrados</p>
            </div>
            <p className="text-[10px] text-white/50 font-semibold mt-3">Click para mostrar todo</p>
          </div>
        </div>

        {/* ── Contenedor Derecho: Donut de Aulas y Stats de Laboratorios ── */}
        <div className="flex flex-col gap-4 lg:w-56 xl:w-60 flex-shrink-0">
          
          {/* Tarjeta Donut — Ocupación de Aulas */}
          <div className="bg-white rounded-2xl border border-[#c5c6cf]/40 shadow-sm p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-[#44464e] uppercase tracking-widest">Ocupación de Aulas</p>
              <div className="w-7 h-7 rounded-lg bg-[#f4f3f6] flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-[#1c355e]">meeting_room</span>
              </div>
            </div>

            {donutStats.total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
                <span className="material-symbols-outlined text-4xl text-[#c5c6cf]">meeting_room</span>
                <p className="text-[11px] text-[#75777f] text-center">Sin aulas registradas</p>
              </div>
            ) : (
              <div className="flex lg:flex-col items-center gap-4 flex-1 mt-3">
                {/* SVG Donut */}
                <div className="relative flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-28 h-28 lg:w-32 lg:h-32 drop-shadow-sm">
                    {/* Track (disponibles) */}
                    <circle cx="50" cy="50" r={RADIO_DONUT} fill="none" stroke="#bbf7d0" strokeWidth="11" />
                    {/* Ocupadas */}
                    <circle
                      cx="50" cy="50" r={RADIO_DONUT}
                      fill="none"
                      stroke="#1c355e"
                      strokeWidth="11"
                      strokeDasharray={`${dashOcupadas} ${CIRC_DONUT}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    {/* Porcentaje central */}
                    <text x="50" y="45" textAnchor="middle" fontSize="17" fontWeight="800" fill="#1b1c1e">
                      {donutStats.porcentaje}%
                    </text>
                    <text x="50" y="58" textAnchor="middle" fontSize="6.5" fill="#75777f" fontWeight="700" letterSpacing="0.5">
                      OCUPADAS
                    </text>
                  </svg>
                </div>

                {/* Leyenda */}
                <div className="flex-1 lg:w-full space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1c355e] flex-shrink-0" />
                      <span className="text-xs text-[#44464e] font-medium">Ocupadas</span>
                    </div>
                    <span className="text-xs font-black text-[#1b1c1e]">{donutStats.ocupadas}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-300 flex-shrink-0" />
                      <span className="text-xs text-[#44464e] font-medium">Disponibles</span>
                    </div>
                    <span className="text-xs font-black text-[#1b1c1e]">{donutStats.disponibles}</span>
                  </div>
                  <div className="pt-2 border-t border-[#c5c6cf]/30 flex items-center justify-between">
                    <span className="text-[10px] text-[#75777f] font-bold uppercase tracking-wider">Total Aulas</span>
                    <span className="text-xs font-black text-[#1c355e]">{donutStats.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta Laboratorios */}
          <div className="bg-[#1c9c72] text-white rounded-2xl shadow-md p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">Total Laboratorios</p>
            </div>
            <div className="flex items-end justify-between">
              <h3 className="text-4xl font-black">{donutStats.totalLabs}</h3>
              <div className="text-right">
                <p className="text-sm font-bold">{donutStats.labsOcupados} en uso</p>
                <p className="text-[10px] opacity-75">{donutStats.totalLabs - donutStats.labsOcupados} libres</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ PANEL DE FILTROS ════════════════════════════════════════════════════ */}
      <div id="tabla-resultados" className="bg-white rounded-2xl border border-[#c5c6cf]/40 shadow-sm overflow-hidden">

        {/* Fila 1: Búsqueda + acciones rápidas */}
        <div className="px-5 pt-5 pb-4 flex flex-col lg:flex-row gap-3 items-center border-b border-[#c5c6cf]/30">
          <div className="w-full lg:w-72 relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c5c6cf] text-[18px]">search</span>
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] transition-all placeholder:text-[#c5c6cf]"
              placeholder="Buscar por docente o aula..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <p className="text-[10px] font-bold text-[#75777f] uppercase tracking-wider hidden lg:block">Vista rápida:</p>
            <button
              onClick={verClasesEnCurso}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                filtroEstado === 'en_curso'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-[#44464e] border-[#c5c6cf]/50 hover:bg-[#f4f3f6]'
              }`}
            >
              Solo En Curso
            </button>
            <button
              onClick={verBaseDatosTotal}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                filtroEstado === 'todas'
                  ? 'bg-[#1c355e] text-white border-[#1c355e]'
                  : 'bg-white text-[#44464e] border-[#c5c6cf]/50 hover:bg-[#f4f3f6]'
              }`}
            >
              BD Total
            </button>
          </div>
        </div>

        {/* Fila 2: Selectores avanzados */}
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <select
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] text-[#1b1c1e] font-medium"
            onChange={(e) => { setFiltroEstado(e.target.value); resetFiltros(); }}
            value={filtroEstado}
          >
            <option value="todas">Todos los Estados</option>
            <option value="en_curso">▶ En Curso</option>
            <option value="proxima">Próximas (hoy)</option>
            <option value="finalizada">Finalizadas (hoy)</option>
            <option value="suspendida">Suspendidas (Asueto)</option>
          </select>

          <select
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] text-[#1b1c1e] font-medium"
            onChange={(e) => { setFiltroLic(e.target.value); setFiltroAsignatura(''); setFiltroHora(''); }}
            value={filtroLic}
          >
            <option value="">Todas las Licenciaturas</option>
            {opcionesLicenciatura.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>

          <select
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] text-[#1b1c1e] font-medium"
            onChange={(e) => { setFiltroAsignatura(e.target.value); setFiltroHora(''); }}
            value={filtroAsignatura}
          >
            <option value="">Todas las Asignaturas</option>
            {opcionesAsignatura.map(asig => <option key={asig} value={asig}>{asig}</option>)}
          </select>

          <select
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] text-[#1b1c1e] font-medium"
            onChange={(e) => setFiltroHora(e.target.value)}
            value={filtroHora}
          >
            <option value="">Horarios</option>
            {opcionesHora.map(hora => <option key={hora} value={hora}>{hora}</option>)}
          </select>

          <select
            className="bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1c355e]/15 focus:border-[#1c355e] text-[#1b1c1e] font-medium"
            onChange={(e) => setFiltroDia(e.target.value)}
            value={filtroDia}
          >
            <option value="">Todos los Días</option>
            <option value="lunes">Lunes</option>
            <option value="martes">Martes</option>
            <option value="miercoles">Miércoles</option>
            <option value="jueves">Jueves</option>
            <option value="viernes">Viernes</option>
            <option value="sabado">Sábado</option>
          </select>
        </div>

        {/* Barra de resultado */}
        {!cargando && asignaturas.length > 0 && (
          <div className="px-5 py-2.5 bg-[#faf9fc] border-t border-[#c5c6cf]/30 flex items-center justify-between">
            <p className="text-[11px] text-[#75777f] font-medium">
              Mostrando <span className="font-black text-[#1b1c1e]">{datosAgrupados.length}</span> resultado{datosAgrupados.length !== 1 ? 's' : ''}
            </p>
            {(busqueda || filtroLic || filtroAsignatura || filtroHora || filtroDia) && (
              <button onClick={resetFiltros} className="text-[11px] font-bold text-[#1c355e] hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">close</span>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ TABLA DE RESULTADOS ══════════════════════════════════════════════════ */}
      <div className="bg-white border border-[#c5c6cf]/40 rounded-2xl overflow-hidden shadow-sm">
        {/* ── VISTA MÓVIL: tarjetas (< lg) ────────────────────────────────────── */}
        <div className="lg:hidden">
          {cargando ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-[#1c355e] block mx-auto mb-3">sync</span>
              <p className="text-sm font-bold text-[#44464e]">Sincronizando datos...</p>
              <p className="text-xs text-[#75777f] mt-1">Conectando con la base de datos</p>
            </div>
          ) : asignaturas.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-6xl text-[#e0e0e8] block mx-auto mb-4">table_chart</span>
              <p className="font-black text-lg text-[#1b1c1e]">Directorio Vacío</p>
              <p className="text-sm text-[#75777f] mt-2">No hay horarios cargados en la base de datos.</p>
            </div>
          ) : datosFiltrados.length === 0 ? (
            <div className="py-20 text-center px-4">
              <span className="material-symbols-outlined text-6xl text-[#e0e0e8] block mx-auto mb-4">filter_list_off</span>
              <p className="font-black text-lg text-[#1b1c1e]">Sin resultados para este filtro</p>
              <p className="text-sm text-[#75777f] mt-2">
                Prueba con <button onClick={verBaseDatosTotal} className="text-[#1c355e] font-bold hover:underline">Base de Datos Total</button> o limpia los filtros.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f4]">
              {datosAgrupados.map((item) => (
                <div key={item._ids.join('-')} className={`px-4 py-3.5 transition-colors ${item.es_suplencia ? 'bg-blue-50/30' : 'hover:bg-[#faf9fc]'}`}>
                  {/* Día + badge de estado */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-black text-[#44464e] uppercase tracking-wider capitalize">{item.diaOriginal || '—'}</span>
                    {item.es_suplencia ? (
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 ${
                        item.estadoTiempo === 'en_curso'   ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                        {item.estadoTiempo === 'en_curso' ? 'Suplencia' : item.estadoTiempo === 'finalizada' ? 'Finalizada' : 'Próxima'}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 ${
                        item.estadoTiempo === 'examen_ordinario' ? 'bg-red-50 text-red-700 border-red-200' :
                        item.estadoTiempo === 'en_curso'         ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        item.estadoTiempo === 'finalizada'       ? 'bg-gray-50 text-gray-600 border-blue-200' :
                        item.estadoTiempo === 'suspendida'       ? 'bg-red-50 text-red-600 border-red-200 opacity-80' :
                        item.estadoTiempo === 'proxima'          ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">
                          {item.estadoTiempo === 'examen_ordinario' ? 'edit_document' :
                           item.estadoTiempo === 'suspendida'       ? 'block' :
                           item.estadoTiempo === 'en_curso'         ? 'play_circle' :
                           item.estadoTiempo === 'finalizada'       ? 'stop_circle' :
                           item.estadoTiempo === 'proxima'          ? 'schedule' : 'event'}
                        </span>
                        {item.estadoTiempo === 'programada' ? 'Programada' : 
                         item.estadoTiempo === 'suspendida' ? `Sin Clases (${item.estadoRazon || 'Asueto'})` : 
                         item.estadoTiempo.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {/* Docente */}
                  <p className="text-sm font-semibold text-[#1b1c1e] leading-tight">{item.docente || '—'}</p>
                  {item.es_suplencia && (
                    <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 mt-0.5">
                      <span className="material-symbols-outlined text-[10px]">swap_horiz</span>
                      Cubre a {item.docente_ausente}
                    </span>
                  )}
                  {item.tieneExamenHoy && (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mt-1.5 border border-red-200">
                      <span className="material-symbols-outlined text-[12px]">edit_document</span>
                      EXAMEN HOY
                    </span>
                  )}
                  {/* Licenciatura */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border break-words ${obtenerColorLicenciatura(item.licenciatura)}`}>
                      {item.licenciatura}
                    </span>
                    {item.semestre && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Sem: {item.semestre}</span>}
                    {item.cuatrimestre && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Cuat: {item.cuatrimestre}</span>}
                    {item.grupo && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Gpo: {item.grupo}</span>}
                  </div>
                  {/* Asignatura */}
                  <p className="text-xs font-medium text-[#44464e] mt-1 leading-snug">{item.asignatura}</p>
                  {/* Horario + Aula */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0f0f4]">
                    <span className="font-mono text-xs font-bold text-[#1c355e]">{item.textoHora}</span>
                    {item.aula_reasignada ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold text-orange-600 flex items-center gap-1 text-xs">
                          <span className="material-symbols-outlined text-[12px]">construction</span>
                          {item.aula_asignada}
                        </span>
                        <span className="text-[9px] text-[#75777f] line-through">{item.aula_original}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-[#1c355e] text-xs">{item.aula_asignada || '—'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── VISTA ESCRITORIO: tabla (≥ lg) ──────────────────────────────────── */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[820px]">
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #1c355e 0%, #162c50 100%)' }} className="text-white text-[10px] uppercase font-bold tracking-widest">
                <th className="w-[8%]  py-4 px-5">Día</th>
                <th className="w-[16%] py-4 px-5">Docente</th>
                <th className="w-[21%] py-4 px-5">Licenciatura</th>
                <th className="w-[18%] py-4 px-5">Asignatura</th>
                <th className="w-[12%] py-4 px-5">Horario</th>
                <th className="w-[12%] py-4 px-5">Aula</th>
                <th className="w-[13%] py-4 px-5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f4]">
              {cargando ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-[#1c355e] block mx-auto mb-3">sync</span>
                    <p className="text-sm font-bold text-[#44464e]">Sincronizando datos...</p>
                    <p className="text-xs text-[#75777f] mt-1">Conectando con la base de datos</p>
                  </td>
                </tr>
              ) : asignaturas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <span className="material-symbols-outlined text-6xl text-[#e0e0e8] block mx-auto mb-4">table_chart</span>
                    <p className="font-black text-lg text-[#1b1c1e]">Directorio Vacío</p>
                    <p className="text-sm text-[#75777f] mt-2">No hay horarios cargados en la base de datos.</p>
                  </td>
                </tr>
              ) : datosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <span className="material-symbols-outlined text-6xl text-[#e0e0e8] block mx-auto mb-4">filter_list_off</span>
                    <p className="font-black text-lg text-[#1b1c1e]">Sin resultados para este filtro</p>
                    <p className="text-sm text-[#75777f] mt-2">
                      Prueba con <button onClick={verBaseDatosTotal} className="text-[#1c355e] font-bold hover:underline">Base de Datos Total</button> o limpia los filtros.
                    </p>
                  </td>
                </tr>
              ) : (
                datosAgrupados.map((item) => (
                  <tr key={item._ids.join('-')} className={`text-sm hover:bg-[#faf9fc] transition-colors group ${item.es_suplencia ? 'bg-blue-50/40' : ''}`}>
                    <td className="py-3.5 px-5 font-bold text-[#44464e] capitalize text-xs">{item.diaOriginal || '—'}</td>
                    <td className="py-3.5 px-5 break-words text-xs">
                      <span className="font-semibold text-[#1b1c1e]">{item.docente || '—'}</span>
                      {item.es_suplencia && (
                        <span className="block text-[10px] text-blue-600 font-medium mt-0.5 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">swap_horiz</span>
                          Cubre a {item.docente_ausente}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border break-words ${obtenerColorLicenciatura(item.licenciatura)}`}>
                          {item.licenciatura}
                        </span>
                        {item.semestre && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Sem: {item.semestre}</span>}
                        {item.cuatrimestre && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Cuat: {item.cuatrimestre}</span>}
                        {item.grupo && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold">Gpo: {item.grupo}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#44464e] break-words text-xs">
                      {item.asignatura}
                      {item.tieneExamenHoy && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider mt-1.5 border border-red-200 block w-max">
                          <span className="material-symbols-outlined text-[10px]">edit_document</span>
                          EXAMEN HOY
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#1c355e] font-bold text-xs whitespace-nowrap">{item.textoHora}</td>
                    <td className="py-3.5 px-5">
                      {item.aula_reasignada ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-orange-600 flex items-center gap-1 whitespace-nowrap text-xs">
                            <span className="material-symbols-outlined text-[12px]">construction</span>
                            {item.aula_asignada}
                          </span>
                          <span className="text-[9px] text-[#75777f] line-through">{item.aula_original}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-[#1c355e] text-xs">{item.aula_asignada || '—'}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      {item.es_suplencia ? (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border whitespace-nowrap ${
                          item.estadoTiempo === 'en_curso'   ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                          {item.estadoTiempo === 'en_curso' ? 'Suplencia' : item.estadoTiempo === 'finalizada' ? 'Finalizada' : 'Próxima'}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border whitespace-nowrap ${
                          item.estadoTiempo === 'examen_ordinario' ? 'bg-red-50 text-red-700 border-red-200' :
                          item.estadoTiempo === 'en_curso'         ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.estadoTiempo === 'finalizada'       ? 'bg-gray-50 text-gray-600 border-gray-200' :
                          item.estadoTiempo === 'suspendida'       ? 'bg-red-50 text-red-600 border-red-200 opacity-80' :
                          item.estadoTiempo === 'proxima'          ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className="material-symbols-outlined text-[11px]">
                            {item.estadoTiempo === 'examen_ordinario' ? 'edit_document' :
                             item.estadoTiempo === 'suspendida'       ? 'block' :
                             item.estadoTiempo === 'en_curso'         ? 'play_circle' :
                             item.estadoTiempo === 'finalizada'       ? 'stop_circle' :
                             item.estadoTiempo === 'proxima'          ? 'schedule' : 'event'}
                          </span>
                          {item.estadoTiempo === 'programada' ? 'Programada' : 
                           item.estadoTiempo === 'suspendida' ? `Sin Clases (${item.estadoRazon || 'Asueto'})` : 
                           item.estadoTiempo.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer de la tabla */}
        {!cargando && datosAgrupados.length > 0 && (
          <div className="px-5 py-3 bg-[#faf9fc] border-t border-[#f0f0f4] flex items-center justify-between">
            <p className="text-[10px] text-[#75777f] font-medium">
              {datosAgrupados.length} clase{datosAgrupados.length !== 1 ? 's' : ''} en la vista actual
            </p>
            <p className="text-[10px] text-[#75777f] font-medium">
              Actualización automática cada 30 segundos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
