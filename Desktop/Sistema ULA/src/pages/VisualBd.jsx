import { useState, useEffect, useMemo, useRef } from 'react';
import { useTime } from '../components/TimeContext';
import { useToast, ToastContainer } from '../components/useToast';

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
        if (siguiente.tieneExamenHoy) {
          actual.tieneExamenHoy = true;
          if (!actual.nombreExamen && siguiente.nombreExamen) actual.nombreExamen = siguiente.nombreExamen;
        }
        if (siguiente.esAulaLiberada) {
          actual.esAulaLiberada = true;
          if (!actual.infoLiberacion) actual.infoLiberacion = siguiente.infoLiberacion;
        }
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

const MESES_REGEX_ARRAY = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].map(m => new RegExp(`\\b${m}\\b`));

// Función altamente optimizada para determinar si un examen es HOY basado en strings
const isExamToday = (ex, day, month, monthShort, dayRegex) => {
  if (!ex.fecha) return false;

  const fechaStr = String(ex.fecha).toLowerCase();
  const periodoStr = String(ex.periodo || '').toLowerCase();
  const diaStr = String(ex.dia || '').toLowerCase();

  let hasDay = false;
  const match = fechaStr.match(/\b(\d{1,2})\s*(?:al|-|a)\s*(\d{1,2})\b/i);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (day >= start && day <= end) hasDay = true;
  }
  if (!hasDay) {
    hasDay = dayRegex.test(fechaStr) || dayRegex.test(diaStr);
  }

  const containsAnyMonth = MESES_REGEX_ARRAY.some(regex => regex.test(fechaStr) || regex.test(diaStr));
  const hasMonth = fechaStr.includes(month) || fechaStr.includes(monthShort) || diaStr.includes(month) || diaStr.includes(monthShort);

  if (containsAnyMonth) {
    return hasDay && hasMonth;
  } else {
    const hasPeriodMonth = periodoStr.includes(month) || periodoStr.includes(monthShort);
    if (hasPeriodMonth) return hasDay;
    return hasDay; // fallback
  }
};

// Función para limpiar y estandarizar nombres de exámenes a formato corto (ej. "SEGUNDO EXAMEN PARCIAL" -> "Parcial 2")
const formatearNombreExamen = (nombre) => {
  if (!nombre) return 'Examen';
  const str = String(nombre).toLowerCase();
  if (str.includes('primer') || str.includes('1er')) return 'Parcial 1';
  if (str.includes('segundo') || str.includes('2do')) return 'Parcial 2';
  if (str.includes('extraordinario')) return 'Extraordinarios';
  if (str.includes('ordinario')) return 'Ordinarios';
  if (str.includes('parcial')) return 'Parcial';
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
};

// Hook reutilizable para mover ventanas modales arrastrando su encabezado
function useDraggableModal() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleMouseDown = (e) => {
    if (
      e.target.closest('button') ||
      e.target.closest('select') ||
      e.target.closest('input') ||
      e.target.closest('textarea') ||
      e.target.closest('a')
    )
      return;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const resetPos = () => setPos({ x: 0, y: 0 });

  return { pos, handleMouseDown, resetPos };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VisualBd() {
  const { toast, toasts } = useToast();
  const dragExport = useDraggableModal();
  const [asignaturas, setAsignaturas] = useState([]);
  const [aulasData, setAulasData] = useState([]);
  const [suplenciasActivas, setSuplenciasActivas] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroLic, setFiltroLic] = useState('');
  const [filtroAsignatura, setFiltroAsignatura] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroHora, setFiltroHora] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('en_curso');
  const [filtroPlan, setFiltroPlan] = useState('todos'); // 'todos' | 'semestral' | 'cuatrimestral'
  const [cargando, setCargando] = useState(true);
  const [examenesHoy, setExamenesHoy] = useState([]);
  const [liberacionesActivas, setLiberacionesActivas] = useState([]);
  const [estadoAcademico, setEstadoAcademico] = useState({
    semestral: { hay_clases: true, estado: 'clases' },
    cuatrimestral: { hay_clases: true, estado: 'clases' }
  });

  const [mostrarCentroExportacion, setMostrarCentroExportacion] = useState(false);
  const [origenExportacion, setOrigenExportacion] = useState('dashboard'); // 'dashboard' | 'historial'
  const [mostrarFormEmail, setMostrarFormEmail] = useState(false);
  const [formEmail, setFormEmail] = useState({
    destinatarios: '',
    cc: '',
    cco: '',
    asunto: 'Reporte de Horarios y Eventos Académicos — ULA',
    mensaje: '',
    adjuntar_pdf: true,
    adjuntar_excel: false,
    es_historial: false
  });
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [usuariosRegistrados, setUsuariosRegistrados] = useState([]);
  const [mostrarSugerenciasEmails, setMostrarSugerenciasEmails] = useState(true);
  const [campoDestino, setCampoDestino] = useState('destinatarios');

  const [filtrosDisponiblesHistorial, setFiltrosDisponiblesHistorial] = useState({
    usuarios: [],
    modulos: []
  });
  const [cargandoFiltrosHistorial, setCargandoFiltrosHistorial] = useState(false);
  const [filtrosHistorial, setFiltrosHistorial] = useState({
    fechaInicio: '',
    fechaFin: '',
    usuario: 'Todos',
    modulo: 'Todos'
  });

  const renderBadgesCampo = (nombreCampo, valorCampo) => {
    if (!valorCampo || !valorCampo.trim()) return null;
    const correos = valorCampo.split(',').map(e => e.trim()).filter(Boolean);
    if (correos.length === 0) return null;

    return (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {correos.map((correo, idx) => {
          const esReg = usuariosRegistrados.some(u => u.correo?.toLowerCase() === correo.toLowerCase());
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${esReg
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-sky-50 text-sky-800 border-sky-300'
                }`}
            >
              <span className="material-symbols-outlined text-[11px]">
                {esReg ? 'verified' : 'mail'}
              </span>
              <span className="truncate max-w-[130px]" title={correo}>{correo}</span>
              <span className={`px-1 py-0.2 rounded text-[8px] uppercase font-extrabold ${esReg ? 'bg-emerald-200 text-emerald-900' : 'bg-sky-200 text-sky-900'}`}>
                {esReg ? 'Registrado' : 'Externo'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const rest = valorCampo
                    .split(',')
                    .map(c => c.trim())
                    .filter(c => c.toLowerCase() !== correo.toLowerCase())
                    .join(', ');
                  setFormEmail({ ...formEmail, [nombreCampo]: rest });
                }}
                className="ml-0.5 hover:text-red-600 font-extrabold text-[11px]"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (mostrarFormEmail || mostrarCentroExportacion) {
      fetch('/api/usuarios')
        .then(res => res.ok ? res.json() : [])
        .then(data => setUsuariosRegistrados(Array.isArray(data) ? data : []))
        .catch(() => setUsuariosRegistrados([]));
    }
  }, [mostrarFormEmail, mostrarCentroExportacion]);

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
          fetch(`/api/examenes-hoy`)
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
      .catch(() => { });
  }, []);

  // Fetch suplencias activas hoy (polling cada 30s sincronizado con horarios)
  useEffect(() => {
    const fetchSuplencias = () => {
      fetch('/api/suplencias-activas')
        .then(r => r.ok ? r.json() : [])
        .then(data => setSuplenciasActivas(Array.isArray(data) ? data : []))
        .catch(() => { });
    };
    fetchSuplencias();
    const interval = setInterval(fetchSuplencias, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch liberaciones manuales de aulas hoy (polling cada 30s)
  useEffect(() => {
    const fetchLiberaciones = () => {
      fetch(`/api/aulas/liberadas?fecha=${hoyStr}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setLiberacionesActivas(Array.isArray(data) ? data : []))
        .catch(() => { });
    };
    fetchLiberaciones();
    const interval = setInterval(fetchLiberaciones, 30000);
    return () => clearInterval(interval);
  }, [hoyStr]);

  // Motor temporal
  const asignaturasConEstado = useMemo(() => {
    const diaActualIndex = ahora.getDay();
    const minutosActuales = (ahora.getHours() * 60) + ahora.getMinutes();
    const liberacionesMap = new Map(liberacionesActivas.map(l => [l.aula_nombre, l]));

    // Pre-calcular valores y pre-filtrar exámenes para evitar congelamiento de la app
    const dayNum = ahora.getDate();
    const monthStr = ahora.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
    const monthShortStr = ahora.toLocaleString('es-ES', { month: 'short' }).toLowerCase();
    const dayRegex = new RegExp(`\\b0?${dayNum}\\b`);
    const examenesHoyValidos = examenesHoy.filter(ex => isExamToday(ex, dayNum, monthStr, monthShortStr, dayRegex));

    return asignaturas.map(clase => {
      const { dia, inicio, fin, textoHora } = parsearHorario(clase.horario);
      const diaClaseIndex = dia ? diasSemanaMap[dia] : undefined;

      const isCuatri = (clase.cuatrimestre && clase.cuatrimestre !== '');
      const planStr = isCuatri ? 'cuatrimestral' : 'semestral';
      const academico = estadoAcademico[planStr];
      const esPeriodoFinales = academico?.estado?.includes('ordinario') || academico?.estado?.includes('extraordinario');

      // En periodo de ordinarios/extraordinarios NO hay clases regulares, solo aplican los exámenes
      const hayClasesPlan = (academico?.hay_clases !== false) && !esPeriodoFinales;
      const estadoRazon = esPeriodoFinales ? 'Periodo de Evaluación Final' : (academico?.descripcion || 'Receso/Vacaciones');

      // Detectar si la clase tiene examen programado para hoy
      const norm = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const asigNorm = norm(clase.asignatura);
      let nombreExamen = null;
      let tieneExamenHoy = false;

      if (diaClaseIndex === diaActualIndex) {
        tieneExamenHoy = examenesHoyValidos.some(ex => {
          let matReal = ex.materia;
          try { matReal = decodeURIComponent(escape(ex.materia)); } catch (e) { }
          const matNorm = norm(matReal);
          if (!matNorm || matNorm.length < 3) return false;
          if (asigNorm.includes(matNorm) || matNorm.includes(asigNorm)) {
            nombreExamen = ex.periodo || 'EXAMEN';
            return true;
          }
          return false;
        });
      }

      const esHoraOriginalAhora = Boolean(
        diaClaseIndex === diaActualIndex &&
        inicio !== null && fin !== null &&
        minutosActuales >= inicio &&
        minutosActuales <= fin
      );

      let estadoTiempo = 'programada';
      if (clase.estado_slug === 'pospuesta') {
        estadoTiempo = 'pospuesta';
      } else if (diaClaseIndex === undefined || inicio === null || fin === null) {
        estadoTiempo = 'programada';
      } else if (diaClaseIndex < diaActualIndex) {
        estadoTiempo = 'finalizada';
      } else if (!hayClasesPlan && !tieneExamenHoy) {
        // Si el plan no tiene clases regulares (Receso / Inhábil / Vacaciones), las clases se marcan como suspendidas
        estadoTiempo = 'suspendida';
      } else if (diaClaseIndex > diaActualIndex) {
        estadoTiempo = 'programada';
      } else {
        // Es una clase del día de HOY
        if (minutosActuales > fin) {
          estadoTiempo = 'finalizada';
        } else if (minutosActuales >= inicio && minutosActuales <= fin) {
          if (tieneExamenHoy) {
            estadoTiempo = 'examen_ordinario';
          } else {
            estadoTiempo = 'en_curso';
          }
        } else {
          estadoTiempo = 'proxima';
        }
      }

      const esAulaLiberada = Boolean(
        diaClaseIndex === diaActualIndex &&
        minutosActuales >= (inicio ?? 0) &&
        minutosActuales <= (fin ?? 0) &&
        clase.aula_asignada &&
        liberacionesMap.has(clase.aula_asignada)
      );
      const infoLiberacion = esAulaLiberada ? liberacionesMap.get(clase.aula_asignada) : null;

      return {
        ...clase,
        estadoTiempo,
        estadoRazon: (estadoTiempo === 'suspendida' || estadoTiempo === 'pospuesta') ? (estadoTiempo === 'pospuesta' ? (clase.nota_reprogramacion || 'Pospuesta') : estadoRazon) : undefined,
        esHoraOriginalAhora,
        nombreExamen,
        textoHora,
        diaClaseIndex,
        inicio,
        fin,
        diaOriginal: dia,
        tieneExamenHoy,
        esAulaLiberada,
        infoLiberacion
      };
    }).sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex ?? 99) - (b.diaClaseIndex ?? 99);
      return (a.inicio ?? 0) - (b.inicio ?? 0);
    });
  }, [asignaturas, ahora, estadoAcademico, examenesHoy, liberacionesActivas]);

  // Todas las suplencias de hoy → filas sintéticas con estado calculado en tiempo real
  const filasSuplencias = useMemo(() => {
    const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return suplenciasActivas.map(s => {
      let estadoTiempo;
      if (minsAhora > s.fin_mins) estadoTiempo = 'finalizada';
      else if (minsAhora >= s.inicio_mins) estadoTiempo = 'en_curso';
      else estadoTiempo = 'proxima';
      return {
        id: `suplencia-${s.id}`,
        _ids: [`suplencia-${s.id}`],
        docente: s.suplente_nombre,
        asignatura: s.materia,
        licenciatura: s.licenciatura || '',
        aula_asignada: s.aula_asignada || '—',
        textoHora: `${s.hora_inicio}-${s.hora_fin}`,
        inicio: s.inicio_mins,
        fin: s.fin_mins,
        diaOriginal: (s.dia || '').toLowerCase(),
        diaClaseIndex: undefined,
        estadoTiempo,
        es_suplencia: true,
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

  const todosSegunPlan = useMemo(() => {
    if (filtroPlan === 'todos') return todosAgrupados;
    return todosAgrupados.filter(c => {
      const esCuatri = Boolean(c.cuatrimestre && c.cuatrimestre !== '');
      return filtroPlan === 'cuatrimestral' ? esCuatri : !esCuatri;
    });
  }, [todosAgrupados, filtroPlan]);

  const datosFiltrados = useMemo(() => {
    let resultado = todosAgrupados.filter(item => {
      const esCuatri = Boolean(item.cuatrimestre && item.cuatrimestre !== '');
      const coincidePlanFilter = filtroPlan === 'todos' || (filtroPlan === 'cuatrimestral' ? esCuatri : !esCuatri);

      const coincideBusqueda =
        item.docente?.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
      const coincideLic = filtroLic === '' || extraerClaveLic(item.licenciatura) === filtroLic;
      const coincideAsignatura = filtroAsignatura === '' || item.asignatura === filtroAsignatura;
      const coincideHora = filtroHora === '' || getBloqueEstandar(item.inicio) === filtroHora;
      const coincideDia = filtroDia === '' || item.diaOriginal === filtroDia;
      return coincidePlanFilter && coincideBusqueda && coincideLic && coincideAsignatura && coincideHora && coincideDia;
    });
    if (filtroEstado !== 'todas') {
      const diaHoy = ahora.getDay();
      resultado = resultado.filter(item => {
        if (filtroEstado === 'en_curso' && item.estadoTiempo === 'examen_ordinario') return true;
        if (filtroEstado === 'en_curso' && item.estadoTiempo === 'pospuesta' && item.esHoraOriginalAhora) return true;
        if (item.estadoTiempo !== filtroEstado) return false;
        if (filtroEstado === 'finalizada') return item.diaClaseIndex === diaHoy;
        return true;
      });
    }
    const suplFiltradas = filasSuplencias.filter(s => {
      const esCuatri = Boolean(s.cuatrimestre && s.cuatrimestre !== '');
      const coincidePlanFilter = filtroPlan === 'todos' || (filtroPlan === 'cuatrimestral' ? esCuatri : !esCuatri);
      const coincideEstado = filtroEstado === 'todas' || s.estadoTiempo === filtroEstado;
      const coincideBusqueda = !busqueda ||
        s.docente?.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
      const coincideLic = filtroLic === '' || extraerClaveLic(s.licenciatura) === filtroLic;
      const coincideAsignatura = filtroAsignatura === '' || s.asignatura === filtroAsignatura;
      const coincideHora = filtroHora === '' || getBloqueEstandar(s.inicio) === filtroHora;
      return coincidePlanFilter && coincideEstado && coincideBusqueda && coincideLic && coincideAsignatura && coincideHora;
    });
    resultado = [...resultado, ...suplFiltradas];
    return resultado.sort((a, b) => {
      if (a.diaClaseIndex !== b.diaClaseIndex) return (a.diaClaseIndex ?? 99) - (b.diaClaseIndex ?? 99);
      return (a.inicio ?? 0) - (b.inicio ?? 0);
    });
  }, [todosAgrupados, filasSuplencias, busqueda, filtroLic, filtroAsignatura, filtroHora, filtroDia, filtroEstado, filtroPlan, ahora]);

  const datosAgrupados = useMemo(() => datosFiltrados, [datosFiltrados]);

  const stats = useMemo(() => {
    const diaHoy = ahora.getDay();
    const enCurso = todosSegunPlan.filter(c => c.estadoTiempo === 'en_curso' || c.estadoTiempo === 'examen_ordinario').length;
    const proximas = todosSegunPlan.filter(c => c.estadoTiempo === 'proxima').length;
    const finalizadas = todosSegunPlan.filter(c => c.estadoTiempo === 'finalizada' && c.diaClaseIndex === diaHoy).length;
    const programadas = todosSegunPlan.filter(c => c.estadoTiempo === 'programada').length;
    const total = todosSegunPlan.length;
    const docentesEnCurso = new Set(todosSegunPlan.filter(c => c.estadoTiempo === 'en_curso' || c.estadoTiempo === 'examen_ordinario').map(c => c.docente)).size;
    const docentesTotales = new Set(todosSegunPlan.map(c => c.docente)).size;
    return { enCurso, proximas, finalizadas, programadas, total, docentesEnCurso, docentesTotales };
  }, [todosSegunPlan, ahora]);

  const donutStats = useMemo(() => {
    const esLaboratorio = (nombre) => nombre?.toLowerCase().startsWith('lab');
    const aulasNormales = aulasData.filter(a => !esLaboratorio(a.nombre));
    const laboratorios = aulasData.filter(a => esLaboratorio(a.nombre));

    const total = aulasNormales.length;
    const aulasEnCursoSet = new Set(
      todosSegunPlan
        .filter(c => (c.estadoTiempo === 'en_curso' || c.estadoTiempo === 'examen_ordinario') && !c.esAulaLiberada && c.aula_asignada && c.aula_asignada !== 'Por asignar' && !esLaboratorio(c.aula_asignada))
        .map(c => c.aula_asignada)
    );
    const labsEnCursoSet = new Set(
      todosSegunPlan
        .filter(c => (c.estadoTiempo === 'en_curso' || c.estadoTiempo === 'examen_ordinario') && !c.esAulaLiberada && c.aula_asignada && c.aula_asignada !== 'Por asignar' && esLaboratorio(c.aula_asignada))
        .map(c => c.aula_asignada)
    );

    const ocupadas = aulasEnCursoSet.size;
    const disponibles = Math.max(0, total - ocupadas);
    const porcentaje = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    const totalLabs = laboratorios.length;
    const labsOcupados = labsEnCursoSet.size;

    return { total, ocupadas, disponibles, porcentaje, totalLabs, labsOcupados };
  }, [aulasData, todosSegunPlan]);

  const RADIO_DONUT = 38;
  const CIRC_DONUT = 2 * Math.PI * RADIO_DONUT;
  const dashOcupadas = (donutStats.porcentaje / 100) * CIRC_DONUT;

  // Acciones rápidas
  const resetFiltros = () => { setFiltroLic(''); setFiltroAsignatura(''); setFiltroHora(''); setFiltroDia(''); setBusqueda(''); };

  const scrollToTable = () => {
    document.getElementById('tabla-resultados')?.scrollIntoView({ behavior: 'smooth' });
  };

  const verBaseDatosTotal = () => { setFiltroEstado('todas'); resetFiltros(); scrollToTable(); };
  const verClasesEnCurso = () => { setFiltroEstado('en_curso'); resetFiltros(); scrollToTable(); };
  const verClasesProximas = () => { setFiltroEstado('proxima'); resetFiltros(); scrollToTable(); };
  const verClasesFinalizadas = () => { setFiltroEstado('finalizada'); resetFiltros(); scrollToTable(); };

  const obtenerResumenFiltros = () => {
    return {
      Licenciatura: filtroLic || 'Todas',
      Asignatura: filtroAsignatura || 'Todas',
      Docente: busqueda || 'Todos',
      Estado: filtroEstado,
      Plan: filtroPlan,
      Dia: filtroDia || 'Todos los días'
    };
  };

  const getUrlExportarReposiciones = () => {
    const params = new URLSearchParams();
    if (busqueda) params.append('busqueda', busqueda);
    if (filtroLic) params.append('licenciatura', filtroLic);
    if (filtroAsignatura) params.append('asignatura', filtroAsignatura);
    const qs = params.toString();
    return `/api/reprogramaciones/exportar-historial-csv${qs ? `?${qs}` : ''}`;
  };

  const obtenerRegistrosAExportar = async (esHistorial) => {
    if (esHistorial) {
      try {
        const res = await fetch('/api/clases-historico?rango_fecha=esta_semana');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapeados = data.map(r => ({
              docente: r.docente_nombre,
              licenciatura: r.licenciatura_codigo,
              semestre: r.semestre,
              grupo: r.grupo,
              asignatura: r.asignatura_nombre,
              textoHora: `${r.horario_inicio}-${r.horario_fin}`,
              aula_asignada: r.aula_actual || r.aula_original,
              estadoTiempo: r.estado_slug,
              estadoRazon: r.estado_label,
              diaOriginal: r.dia_semana
            }));
            const historicosFiltrados = mapeados.filter(item => {
              const coincideBusqueda = !busqueda ||
                item.docente?.toLowerCase().includes(busqueda.toLowerCase()) ||
                item.aula_asignada?.toLowerCase().includes(busqueda.toLowerCase());
              const coincideLic = filtroLic === '' || extraerClaveLic(item.licenciatura) === filtroLic;
              const coincideAsignatura = filtroAsignatura === '' || item.asignatura === filtroAsignatura;
              const coincideDia = filtroDia === '' || item.diaOriginal === filtroDia;
              return coincideBusqueda && coincideLic && coincideAsignatura && coincideDia;
            });
            return historicosFiltrados.length > 0 ? historicosFiltrados : mapeados;
          }
        }
      } catch (e) {
        console.error("Error obteniendo histórico:", e);
      }
      return todosAgrupados;
    }
    return datosFiltrados.length > 0 ? datosFiltrados : todosAgrupados;
  };

  const abrirCentroExportacion = async () => {
    setMostrarCentroExportacion(true);
    dragExport.resetPos();
    setOrigenExportacion('dashboard');
    setMostrarFormEmail(false);
    setFiltrosHistorial({ licenciatura: 'Todos', semestre: 'Todos', asignatura: 'Todos' });
    setCargandoFiltrosHistorial(true);
    try {
      const res = await fetch('/api/bitacora/filtros-disponibles');
      if (res.ok) {
        const data = await res.json();
        setFiltrosDisponiblesHistorial(data);
      }
    } catch (e) {
      console.error("Error al cargar filtros históricos:", e);
    } finally {
      setCargandoFiltrosHistorial(false);
    }
  };

  const handleExportarDesdePanel = async (formato) => {
    setExportando(true);
    const esHistorial = origenExportacion === 'historial';
    const endpoint = formato === 'pdf' ? '/api/exportar/pdf' : '/api/exportar/excel';
    const ext = formato === 'pdf' ? 'pdf' : 'xlsx';
    try {
      let registrosAExportar = [];
      let bodyData = {
        usuario_nombre: 'Administrador',
        usuario_correo: 'admin@universidadlatino.edu.mx',
        es_historial_completo: esHistorial,
        filtros_aplicados: esHistorial ? {
          fecha_inicio: filtrosHistorial.fechaInicio,
          fecha_fin: filtrosHistorial.fechaFin,
          modulo: filtrosHistorial.modulo,
          usuario: filtrosHistorial.usuario
        } : obtenerResumenFiltros(),
        registros: []
      };
      if (esHistorial) {
        bodyData.filtros_bitacora = {
          fecha_inicio: filtrosHistorial.fechaInicio,
          fecha_fin: filtrosHistorial.fechaFin,
          modulo: filtrosHistorial.modulo,
          usuario: filtrosHistorial.usuario
        };
      } else {
        registrosAExportar = await obtenerRegistrosAExportar(false);
        bodyData.registros = registrosAExportar;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = esHistorial ? `Bitacora_Eventos_${hoyStr}.${ext}` : `Dashboard_Clases_${hoyStr}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast(`Reporte ${ext.toUpperCase()} generado exitosamente`, "exito");
      } else {
        toast(`Error al generar reporte ${ext.toUpperCase()}`, "error");
      }
    } catch (e) {
      toast("Error de conexión al generar reporte", "error");
    } finally {
      setExportando(false);
    }
  };

  const handleEnviarEmailSubmit = async (e) => {
    e.preventDefault();
    if (!formEmail.destinatarios) {
      toast("Especifica al menos un destinatario", "error");
      return;
    }
    setEnviandoEmail(true);
    const esHistorial = origenExportacion === 'historial';
    const registrosAExportar = esHistorial ? [] : await obtenerRegistrosAExportar(false);
    try {
      const res = await fetch('/api/exportar/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_nombre: 'Administrador',
          usuario_correo: 'admin@universidadlatino.edu.mx',
          destinatarios: formEmail.destinatarios,
          cc: formEmail.cc,
          cco: formEmail.cco,
          asunto: formEmail.asunto,
          mensaje: formEmail.mensaje,
          adjuntar_pdf: formEmail.adjuntar_pdf,
          adjuntar_excel: formEmail.adjuntar_excel,
          es_historial_completo: esHistorial,
          licenciatura: esHistorial ? filtrosHistorial.licenciatura : undefined,
          semestre: esHistorial ? filtrosHistorial.semestre : undefined,
          asignatura: esHistorial ? filtrosHistorial.asignatura : undefined,
          filtros_aplicados: esHistorial ? {
            licenciatura: filtrosHistorial.licenciatura,
            semestre: filtrosHistorial.semestre,
            asignatura: filtrosHistorial.asignatura
          } : obtenerResumenFiltros(),
          registros: registrosAExportar
        })
      });
      if (res.ok) {
        setMostrarFormEmail(false);
        toast("Reporte enviado por correo con éxito", "exito");
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.detail || "Error al enviar correo", "error");
      }
    } catch {
      toast("Error de conexión al enviar correo", "error");
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const fechaFormateada = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });


  return (
    <div className="max-w-[1400px] mx-auto space-y-5 font-manrope relative z-0">
      {/* Elementos decorativos de fondo (opcional, muy sutil) */}
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-blue-300/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-50px] w-72 h-72 bg-purple-300/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* ENCABEZADO + CONTROLES Y FILTRO DE PLAN */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/70 backdrop-blur-md border border-white/50 rounded-[2rem] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1b1c1e] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#1c355e] to-blue-800">Panel de Control</h1>
          <p className="text-xs sm:text-sm text-[#75777f] font-medium mt-1">Gestión y seguimiento de horarios en tiempo real.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Selector de Plan */}
          <div className="flex bg-[#f4f3f6]/80 backdrop-blur p-1.5 rounded-[1.25rem] border border-[#c5c6cf]/20 shadow-inner">
            <button
              onClick={() => setFiltroPlan('todos')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${filtroPlan === 'todos'
                  ? 'bg-white text-[#1c355e] shadow-[0_2px_10px_rgb(0,0,0,0.08)] scale-[1.02]'
                  : 'text-[#44464e] hover:text-[#1b1c1e]'
                }`}
            >
              Todos los Planes
            </button>
            <button
              onClick={() => setFiltroPlan('semestral')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${filtroPlan === 'semestral'
                  ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.25)] scale-[1.02]'
                  : 'text-[#44464e] hover:text-[#1b1c1e]'
                }`}
            >
              Semestral
            </button>
            <button
              onClick={() => setFiltroPlan('cuatrimestral')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 ${filtroPlan === 'cuatrimestral'
                  ? 'bg-purple-600 text-white shadow-[0_4px_15px_rgba(147,51,234,0.25)] scale-[1.02]'
                  : 'text-[#44464e] hover:text-[#1b1c1e]'
                }`}
            >
              Cuatrimestral
            </button>
          </div>

          {/* Indicador de estado */}
          <div className={`flex items-center gap-2.5 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 border shadow-sm transition-all ${errorConexion ? 'border-orange-300 shadow-orange-100' : 'border-[#c5c6cf]/20'}`}>
            {errorConexion ? (
              <>
                <span className="material-symbols-outlined text-orange-500 text-[18px]">wifi_off</span>
                <span className="text-xs font-extrabold text-orange-600">Sin conexión</span>
              </>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">sensors</span>
                  <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                </div>
                <span className="text-xs font-bold text-[#1b1c1e] capitalize">{fechaFormateada}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ ESTADO DEL CALENDARIO ACADÉMICO (RESUMEN COMPACTO) ════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Plan Semestral */}
        {(() => {
          const sem = estadoAcademico.semestral;
          const esReceso = sem?.estado === 'receso' || !sem?.hay_clases;
          const esExamen = sem?.estado?.includes('ordinario') || sem?.estado?.includes('extraordinario') || sem?.estado?.includes('parcial');
          return (
            <div className={`px-4 sm:px-5 py-4 rounded-3xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${esReceso ? 'bg-gradient-to-r from-amber-50/80 to-white/60 border-amber-200/60 shadow-amber-100/50' : esExamen ? 'bg-gradient-to-r from-indigo-50/80 to-white/60 border-indigo-200/60 shadow-indigo-100/50' : 'bg-gradient-to-r from-blue-50/80 to-white/60 border-blue-200/50 shadow-blue-100/50'
              } backdrop-blur-sm`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-xs shadow-sm ${esReceso ? 'bg-amber-100 text-amber-700' : esExamen ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                  SEM
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-0.5">Plan Semestral</span>
                  <p className="text-[13px] font-bold text-[#1c355e] truncate leading-tight">
                    {sem?.descripcion || 'Seguimiento oficial de actividades.'}
                  </p>
                </div>
              </div>
              <span className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex-shrink-0 shadow-sm ${esReceso ? 'bg-amber-100 text-amber-800 border border-amber-300/30' :
                  esExamen ? 'bg-indigo-100 text-indigo-800 border border-indigo-300/30' :
                    'bg-blue-600 text-white shadow-blue-500/20'
                }`}>
                {sem?.hay_clases ? (sem?.estado?.toUpperCase() || 'CLASES REGULARES') : 'RECESO / INHÁBIL'}
              </span>
            </div>
          );
        })()}

        {/* Plan Cuatrimestral */}
        {(() => {
          const cuat = estadoAcademico.cuatrimestral;
          const esReceso = cuat?.estado === 'receso' || !cuat?.hay_clases;
          const esExamen = cuat?.estado?.includes('ordinario') || cuat?.estado?.includes('extraordinario') || cuat?.estado?.includes('parcial');
          return (
            <div className={`px-4 sm:px-5 py-4 rounded-3xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${esReceso ? 'bg-gradient-to-r from-amber-50/80 to-white/60 border-amber-200/60 shadow-amber-100/50' : esExamen ? 'bg-gradient-to-r from-fuchsia-50/80 to-white/60 border-fuchsia-200/60 shadow-fuchsia-100/50' : 'bg-gradient-to-r from-purple-50/80 to-white/60 border-purple-200/50 shadow-purple-100/50'
              } backdrop-blur-sm`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-xs shadow-sm ${esReceso ? 'bg-amber-100 text-amber-700' : esExamen ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-purple-100 text-purple-700'}`}>
                  CUAT
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-0.5">Plan Cuatrimestral</span>
                  <p className="text-[13px] font-bold text-[#1c355e] truncate leading-tight">
                    {cuat?.descripcion || 'Seguimiento oficial de actividades.'}
                  </p>
                </div>
              </div>
              <span className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex-shrink-0 shadow-sm ${esReceso ? 'bg-amber-100 text-amber-800 border border-amber-300/30' :
                  esExamen ? 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300/30' :
                    'bg-purple-600 text-white shadow-purple-500/20'
                }`}>
                {cuat?.hay_clases ? (cuat?.estado?.toUpperCase() || 'CLASES REGULARES') : 'RECESO / INHÁBIL'}
              </span>
            </div>
          );
        })()}
      </div>

      {/* ══ MÉTRICAS + DONUT ════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch mb-8">

        {/* 4 tarjetas de estadísticas */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* En Curso */}
          <div
            onClick={verClasesEnCurso}
            className={`rounded-[1.5rem] p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border ${stats.enCurso > 0
                ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-400 shadow-blue-500/30 text-white'
                : 'bg-white/70 backdrop-blur-md border-[#c5c6cf]/30 shadow-sm text-[#44464e] hover:border-[#c5c6cf]/60'
              }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className={`text-[10px] font-extrabold uppercase tracking-widest ${stats.enCurso > 0 ? 'text-blue-100' : 'text-[#75777f]'}`}>En Curso</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm transition-colors ${stats.enCurso > 0 ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-[#f4f3f6] text-[#c5c6cf]'}`}>
                <span className="material-symbols-outlined text-[18px]">play_circle</span>
              </div>
            </div>
            <div>
              <h3 className={`text-4xl lg:text-5xl font-black leading-none drop-shadow-sm ${stats.enCurso > 0 ? 'text-white' : 'text-[#c5c6cf]'}`}>
                {stats.enCurso}
              </h3>
              {stats.enCurso > 0 && (
                <p className="text-[11px] font-bold text-blue-100 mt-2 opacity-90">{stats.docentesEnCurso} maestros activos</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className={`text-[10px] font-bold ${stats.enCurso > 0 ? 'text-blue-200' : 'text-[#75777f]'}`}>Click para filtrar</p>
              {stats.enCurso > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-white/20 backdrop-blur-sm text-white uppercase tracking-wider shadow-sm">Ahora</span>
              )}
            </div>
          </div>

          {/* Próximas Hoy */}
          <div
            onClick={verClasesProximas}
            className={`rounded-[1.5rem] p-5 flex flex-col justify-between border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${(stats.proximas + stats.programadas) > 0 ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/80 shadow-amber-500/10' : 'bg-white/70 backdrop-blur-md border-[#c5c6cf]/30 hover:border-[#c5c6cf]/60'
              }`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-widest">Próximas</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${(stats.proximas + stats.programadas) > 0 ? 'bg-amber-100 text-amber-600' : 'bg-[#f4f3f6] text-[#c5c6cf]'}`}>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
              </div>
            </div>
            <h3 className={`text-4xl lg:text-5xl font-black leading-none ${(stats.proximas + stats.programadas) > 0 ? 'text-amber-600' : 'text-[#c5c6cf]'}`}>
              {stats.proximas + stats.programadas}
            </h3>
            <p className="text-[11px] text-[#75777f] font-bold mt-3">
              {(stats.proximas + stats.programadas) === 0
                ? 'Sin clases pendientes'
                : `${stats.proximas} hoy · ${stats.programadas} sem`}
            </p>
          </div>

          {/* Finalizadas Hoy */}
          <div
            onClick={verClasesFinalizadas}
            className={`rounded-[1.5rem] p-5 flex flex-col justify-between border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer ${stats.finalizadas > 0 ? 'bg-gradient-to-br from-gray-50 to-slate-100/50 border-gray-200 shadow-slate-500/10' : 'bg-white/70 backdrop-blur-md border-[#c5c6cf]/30 hover:border-[#c5c6cf]/60'
              }`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-widest">Finalizadas</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${stats.finalizadas > 0 ? 'bg-gray-200 text-gray-600' : 'bg-[#f4f3f6] text-[#c5c6cf]'}`}>
                <span className="material-symbols-outlined text-[18px]">stop_circle</span>
              </div>
            </div>
            <h3 className={`text-4xl lg:text-5xl font-black leading-none ${stats.finalizadas > 0 ? 'text-gray-700' : 'text-[#c5c6cf]'}`}>
              {stats.finalizadas}
            </h3>
            <p className="text-[11px] text-[#75777f] font-bold mt-3">de {stats.total} totales</p>
          </div>

          {/* Ver BD Total */}
          <div
            onClick={verBaseDatosTotal}
            className="rounded-[1.5rem] p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:shadow-[0_15px_40px_-10px_rgba(28,53,94,0.5)] hover:-translate-y-1 border border-[#1c355e]/20 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #162c50 0%, #0a1324 100%)' }}
          >
            {/* Decoración de brillo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl"></div>
            <div className="relative z-10 flex items-start justify-between mb-3">
              <p className="text-[10px] font-extrabold text-blue-200/80 uppercase tracking-widest">BD Total</p>
              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-white">database</span>
              </div>
            </div>
            <div className="relative z-10 min-w-0">
              <h3 className="text-4xl lg:text-5xl font-black text-white leading-none drop-shadow-md">{stats.total}</h3>
              <p className="text-[11px] font-bold text-blue-100 mt-2 opacity-90 truncate">{stats.docentesTotales} m. registrados</p>
            </div>
            <p className="text-[10px] text-white/50 font-bold mt-3 relative z-10">Click para mostrar todo</p>
          </div>
        </div>

        {/* ── Contenedor Derecho: Donut de Aulas y Stats de Laboratorios ── */}
        <div className="flex flex-col gap-4 lg:w-56 xl:w-60 flex-shrink-0">

          {/* Tarjeta Donut — Ocupación de Aulas */}
          <div className="bg-white/70 backdrop-blur-md rounded-[1.5rem] border border-[#c5c6cf]/30 shadow-sm p-5 flex flex-col flex-1 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-widest">Aulas Ocupadas</p>
              <div className="w-8 h-8 rounded-xl bg-[#f4f3f6]/80 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[18px] text-[#1c355e]">meeting_room</span>
              </div>
            </div>

            {donutStats.total === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4 opacity-70">
                <span className="material-symbols-outlined text-4xl text-[#c5c6cf]">meeting_room</span>
                <p className="text-[11px] font-bold text-[#75777f] text-center">Sin aulas registradas</p>
              </div>
            ) : (
              <div className="flex lg:flex-col items-center gap-4 flex-1 mt-3">
                {/* SVG Donut */}
                <div className="relative flex-shrink-0 group">
                  <svg viewBox="0 0 100 100" className="w-28 h-28 lg:w-32 lg:h-32 drop-shadow-md transition-transform duration-500 group-hover:scale-105">
                    {/* Track (disponibles) */}
                    <circle cx="50" cy="50" r={RADIO_DONUT} fill="none" stroke="#e0f2fe" strokeWidth="10" />
                    {/* Ocupadas */}
                    <circle
                      cx="50" cy="50" r={RADIO_DONUT}
                      fill="none"
                      stroke="url(#gradientDonut)"
                      strokeWidth="10"
                      strokeDasharray={`${dashOcupadas} ${CIRC_DONUT}`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                      className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id="gradientDonut" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1c355e" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    {/* Porcentaje central */}
                    <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="900" fill="#1b1c1e">
                      {donutStats.porcentaje}%
                    </text>
                    <text x="50" y="60" textAnchor="middle" fontSize="6.5" fill="#75777f" fontWeight="800" letterSpacing="0.5">
                      EN USO
                    </text>
                  </svg>
                </div>

                {/* Leyenda */}
                <div className="flex-1 lg:w-full space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-br from-[#1c355e] to-blue-500 shadow-sm flex-shrink-0" />
                      <span className="text-xs text-[#44464e] font-bold">Ocupadas</span>
                    </div>
                    <span className="text-xs font-black text-[#1b1c1e] bg-[#f4f3f6] px-2 py-0.5 rounded-md">{donutStats.ocupadas}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-[#e0f2fe] shadow-sm flex-shrink-0 border border-sky-100" />
                      <span className="text-xs text-[#44464e] font-bold">Libres</span>
                    </div>
                    <span className="text-xs font-black text-[#1b1c1e] bg-[#f4f3f6] px-2 py-0.5 rounded-md">{donutStats.disponibles}</span>
                  </div>
                  <div className="pt-2.5 border-t border-[#c5c6cf]/30 flex items-center justify-between">
                    <span className="text-[10px] text-[#75777f] font-extrabold uppercase tracking-wider">Total Aulas</span>
                    <span className="text-sm font-black text-[#1c355e]">{donutStats.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta Laboratorios */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-[1.5rem] shadow-emerald-600/30 shadow-lg p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            <div className="relative z-10 flex items-center justify-between mb-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-100">Laboratorios</p>
              <span className="material-symbols-outlined text-[18px] text-emerald-100">biotech</span>
            </div>
            <div className="relative z-10 flex items-end justify-between">
              <h3 className="text-4xl font-black drop-shadow-sm">{donutStats.totalLabs}</h3>
              <div className="text-right">
                <p className="text-sm font-black text-white">{donutStats.labsOcupados} en uso</p>
                <p className="text-[11px] font-bold text-emerald-100/90">{donutStats.totalLabs - donutStats.labsOcupados} libres</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ PANEL DE FILTROS ════════════════════════════════════════════════════ */}
      <div id="tabla-resultados" className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-30">

        {/* Fila 1: Búsqueda + acciones rápidas */}
        <div className="px-6 pt-6 pb-5 flex flex-col lg:flex-row gap-4 items-center border-b border-[#c5c6cf]/20">
          <div className="w-full lg:w-80 relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#c5c6cf] group-focus-within:text-blue-500 transition-colors text-[20px]">search</span>
            <input
              className="w-full pl-12 pr-4 py-3 bg-[#f4f3f6]/60 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-[#a0a2aa] placeholder:font-medium shadow-inner"
              placeholder="Buscar por docente o aula..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2.5 ml-auto flex-wrap w-full lg:w-auto justify-end">
            <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-wider hidden lg:block mr-2">Vistas:</p>
            <button
              onClick={verClasesEnCurso}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filtroEstado === 'en_curso'
                  ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-[#44464e] border-[#c5c6cf]/40 hover:bg-[#f4f3f6]/80 hover:shadow-sm'
                }`}
            >
              Solo En Curso
            </button>
            <button
              onClick={verBaseDatosTotal}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${filtroEstado === 'todas'
                  ? 'bg-[#1c355e] text-white border-[#1c355e] shadow-sm'
                  : 'bg-white text-[#44464e] border-[#c5c6cf]/40 hover:bg-[#f4f3f6]/80 hover:shadow-sm'
                }`}
            >
              BD Total
            </button>

            {/* BOTÓN ÚNICO: CENTRO DE EXPORTACIÓN */}
            <button
              onClick={abrirCentroExportacion}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#1c355e] to-blue-800 text-white hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer ml-1"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Exportar
            </button>
          </div>
        </div>

        {/* Fila 2: Selectores avanzados */}
        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select
            className="bg-[#f4f3f6]/50 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-xl py-3 px-3.5 text-sm font-bold text-[#1b1c1e] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
            onChange={(e) => { setFiltroEstado(e.target.value); resetFiltros(); }}
            value={filtroEstado}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2375777f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
          >
            <option value="todas">Todos los Estados</option>
            <option value="en_curso">▶ En Curso</option>
            <option value="proxima">Próximas (hoy)</option>
            <option value="finalizada">Finalizadas (hoy)</option>
            <option value="suspendida">Suspendidas (Asueto)</option>
            <option value="pospuesta">Pospuestas</option>
          </select>

          <select
            className="bg-[#f4f3f6]/50 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-xl py-3 px-3.5 text-sm font-bold text-[#1b1c1e] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
            onChange={(e) => { setFiltroLic(e.target.value); setFiltroAsignatura(''); setFiltroHora(''); }}
            value={filtroLic}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2375777f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
          >
            <option value="">Todas las Licenciaturas</option>
            {opcionesLicenciatura.map(({ valor, etiqueta }) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>

          <select
            className="bg-[#f4f3f6]/50 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-xl py-3 px-3.5 text-sm font-bold text-[#1b1c1e] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
            onChange={(e) => { setFiltroAsignatura(e.target.value); setFiltroHora(''); }}
            value={filtroAsignatura}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2375777f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
          >
            <option value="">Todas las Asignaturas</option>
            {opcionesAsignatura.map(asig => <option key={asig} value={asig}>{asig}</option>)}
          </select>

          <select
            className="bg-[#f4f3f6]/50 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-xl py-3 px-3.5 text-sm font-bold text-[#1b1c1e] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
            onChange={(e) => setFiltroHora(e.target.value)}
            value={filtroHora}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2375777f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
          >
            <option value="">Horarios</option>
            {opcionesHora.map(hora => <option key={hora} value={hora}>{hora}</option>)}
          </select>

          <select
            className="bg-[#f4f3f6]/50 backdrop-blur-sm border border-[#c5c6cf]/30 rounded-xl py-3 px-3.5 text-sm font-bold text-[#1b1c1e] outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all cursor-pointer appearance-none"
            onChange={(e) => setFiltroDia(e.target.value)}
            value={filtroDia}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2375777f'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
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
          <div className="px-6 py-3 bg-[#f4f3f6]/50 border-t border-[#c5c6cf]/20 flex items-center justify-between rounded-b-[2rem]">
            <p className="text-xs text-[#75777f] font-medium">
              Mostrando <span className="font-black text-[#1b1c1e] bg-white px-2 py-0.5 rounded-md shadow-sm">{datosAgrupados.length}</span> resultado{datosAgrupados.length !== 1 ? 's' : ''}
            </p>
            {(busqueda || filtroLic || filtroAsignatura || filtroHora || filtroDia) && (
              <button onClick={resetFiltros} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-lg">
                <span className="material-symbols-outlined text-[14px]">close</span>
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
                <div key={item._ids.join('-')} className={`px-5 py-4 transition-all duration-300 border-b border-[#c5c6cf]/20 last:border-0 ${item.es_suplencia ? 'bg-blue-50/30' : 'hover:bg-blue-50/50'} group`}>
                  {/* Día + badge de estado */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-black text-[#44464e] uppercase tracking-wider capitalize">{item.diaOriginal || '—'}</span>
                    {item.es_suplencia ? (
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-md border flex-shrink-0 ${item.estadoTiempo === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                        <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                        {item.estadoTiempo === 'en_curso' ? 'Suplencia' : item.estadoTiempo === 'finalizada' ? 'Finalizada' : 'Próxima'}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-md border flex-shrink-0 ${item.estadoTiempo === 'examen_ordinario' ? 'bg-red-50 text-red-600 border-red-200/60 shadow-sm' :
                          item.estadoTiempo === 'pospuesta' ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' :
                            item.estadoTiempo === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-blue-200' :
                                item.estadoTiempo === 'suspendida' ? 'bg-red-50 text-red-600 border-red-200 opacity-80' :
                                  item.estadoTiempo === 'proxima' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                        <span className="material-symbols-outlined text-[11px]">
                          {item.estadoTiempo === 'examen_ordinario' ? 'edit_document' :
                            item.estadoTiempo === 'pospuesta' ? 'update' :
                              item.estadoTiempo === 'suspendida' ? 'block' :
                                item.estadoTiempo === 'en_curso' ? 'play_circle' :
                                  item.estadoTiempo === 'finalizada' ? 'stop_circle' :
                                    item.estadoTiempo === 'proxima' ? 'schedule' : 'event'}
                        </span>
                        {item.estadoTiempo === 'programada' ? 'Programada' :
                          item.estadoTiempo === 'pospuesta' ? (item.estadoRazon || 'Pospuesta') :
                            item.estadoTiempo === 'suspendida' ? `En Pausa (${item.estadoRazon || 'Asueto'})` :
                              item.estadoTiempo === 'examen_ordinario' && item.nombreExamen ? (
                                <span className="truncate max-w-[140px]" title={item.nombreExamen}>
                                  {formatearNombreExamen(item.nombreExamen)}
                                </span>
                              ) :
                                <span className="capitalize">{item.estadoTiempo.replace('_', ' ')}</span>}
                      </span>
                    )}
                    {Boolean(item.es_reposicion) && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm ml-1.5">
                        <span className="material-symbols-outlined text-[11px]">event_repeat</span>
                        Reposición
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
                  {Boolean(item.es_reposicion) && (
                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5 mt-0.5" title={item.nota_reprogramacion}>
                      <span className="material-symbols-outlined text-[10px]">event_repeat</span>
                      {item.nota_reprogramacion || 'Clase de reposición'}
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
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs font-medium text-[#44464e] leading-snug">{item.asignatura}</p>
                    {item.tieneExamenHoy && (
                      <div title="Examen programado para hoy" className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse ml-1 flex-shrink-0"></div>
                    )}
                  </div>
                  {/* Horario + Aula */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0f0f4]">
                    <span className="font-mono text-xs font-bold text-[#1c355e]">{item.textoHora}</span>
                    {item.esAulaLiberada ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-bold text-emerald-700 flex items-center gap-1 text-xs">
                          <span className="material-symbols-outlined text-[12px]">lock_open</span>
                          Fuera del Salón
                        </span>
                        <span className="text-[9px] text-[#75777f] line-through">Salón {item.aula_asignada}</span>
                      </div>
                    ) : item.aula_reasignada ? (
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
        <div className="hidden lg:block overflow-x-auto rounded-b-[2rem]">
          <table className="w-full text-left border-collapse table-fixed min-w-[820px] bg-white/50 backdrop-blur-sm">
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
                  <tr key={item._ids.join('-')} className={`text-sm hover:bg-blue-50/50 transition-all duration-200 group ${item.es_suplencia ? 'bg-blue-50/20' : ''}`}>
                    <td className="py-4 px-5 font-bold text-[#44464e] capitalize text-xs">{item.diaOriginal || '—'}</td>
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
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#44464e] break-words text-xs">{item.asignatura}</span>
                        {item.tieneExamenHoy && (
                          <div title="Examen programado para hoy" className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse ml-1 flex-shrink-0"></div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#1c355e] font-bold text-xs whitespace-nowrap">{item.textoHora}</td>
                    <td className="py-3.5 px-5">
                      {item.esAulaLiberada ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-emerald-700 flex items-center gap-1 whitespace-nowrap text-xs">
                            <span className="material-symbols-outlined text-[12px]">lock_open</span>
                            Fuera de Aula
                          </span>
                          <span className="text-[9px] text-[#75777f] line-through">Salón {item.aula_asignada}</span>
                        </div>
                      ) : item.aula_reasignada ? (
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
                      {item.esAulaLiberada ? (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-md border flex-shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm">
                          <span className="material-symbols-outlined text-[11px]">lock_open</span>
                          Aula Liberada ({item.infoLiberacion?.motivo || 'Fuera del salón'})
                        </span>
                      ) : item.es_suplencia ? (
                        <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-md border flex-shrink-0 ${item.estadoTiempo === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                          <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                          {item.estadoTiempo === 'en_curso' ? 'Suplencia' : item.estadoTiempo === 'finalizada' ? 'Finalizada' : 'Próxima'}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-md border flex-shrink-0 ${item.estadoTiempo === 'examen_ordinario' ? 'bg-red-50 text-red-600 border-red-200/60 shadow-sm' :
                            item.estadoTiempo === 'pospuesta' ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm' :
                              item.estadoTiempo === 'en_curso' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                item.estadoTiempo === 'finalizada' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                                  item.estadoTiempo === 'suspendida' ? 'bg-red-50 text-red-600 border-red-200 opacity-80' :
                                    item.estadoTiempo === 'proxima' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                          <span className="material-symbols-outlined text-[11px]">
                            {item.estadoTiempo === 'examen_ordinario' ? 'edit_document' :
                              item.estadoTiempo === 'pospuesta' ? 'update' :
                                item.estadoTiempo === 'suspendida' ? 'block' :
                                  item.estadoTiempo === 'en_curso' ? 'play_circle' :
                                    item.estadoTiempo === 'finalizada' ? 'stop_circle' :
                                      item.estadoTiempo === 'proxima' ? 'schedule' : 'event'}
                          </span>
                          {item.estadoTiempo === 'programada' ? 'Programada' :
                            item.estadoTiempo === 'pospuesta' ? (item.estadoRazon || 'Pospuesta') :
                              item.estadoTiempo === 'suspendida' ? `En Pausa (${item.estadoRazon || 'Asueto'})` :
                                item.estadoTiempo === 'examen_ordinario' && item.nombreExamen ? (
                                  <span className="truncate max-w-[140px]" title={item.nombreExamen}>
                                    {formatearNombreExamen(item.nombreExamen)}
                                  </span>
                                ) :
                                  <span className="capitalize">{item.estadoTiempo.replace('_', ' ')}</span>}
                        </span>
                      )}
                      {Boolean(item.es_reposicion) && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm ml-1.5">
                          <span className="material-symbols-outlined text-[11px]">event_repeat</span>
                          Reposición
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

      {/* ═══════════════════ CENTRO DE EXPORTACIÓN UNIFICADO ═══════════════════ */}
      {mostrarCentroExportacion && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] p-4 pointer-events-none transition-opacity">
          <div
            style={{ transform: `translate(${dragExport.pos.x}px, ${dragExport.pos.y}px)` }}
            className="bg-white/95 backdrop-blur-xl rounded-[2rem] w-full max-w-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] font-manrope max-h-[90vh] flex flex-col pointer-events-auto border border-white/60 transition-shadow"
          >
            {/* Header */}
            <div
              onMouseDown={dragExport.handleMouseDown}
              className="flex justify-between items-center border-b border-[#c5c6cf]/20 p-6 shrink-0 cursor-grab active:cursor-grabbing select-none group bg-gradient-to-r from-white to-[#f4f3f6]/50 rounded-t-[2rem]"
              title="Haz clic y mantén presionado para arrastrar la ventana"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c355e] to-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
                  <span className="material-symbols-outlined text-[24px]">download</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#1b1c1e] flex items-center gap-2 tracking-tight">
                    Centro de Exportación
                    <span className="material-symbols-outlined text-[#75777f] text-base group-hover:text-[#1c355e] transition-colors">drag_indicator</span>
                  </h3>
                  <p className="text-sm font-medium text-[#75777f] mt-0.5">Selecciona el origen de datos, filtra y elige la acción</p>
                </div>
              </div>
              <button onClick={() => setMostrarCentroExportacion(false)} className="w-10 h-10 rounded-2xl bg-[#f4f3f6] hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all cursor-pointer shadow-sm">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Body scrollable */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">

              {/* SECCIÓN 1: Toggle Origen */}
              <div>
                <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-wider mb-2">1. Origen de Datos</p>
                <div className="flex bg-[#f4f3f6] p-1 rounded-2xl border border-[#c5c6cf]/40">
                  <button
                    onClick={() => setOrigenExportacion('dashboard')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${origenExportacion === 'dashboard'
                        ? 'bg-white text-[#1c355e] shadow-sm border border-[#c5c6cf]/30'
                        : 'text-[#75777f] hover:text-[#44464e]'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">dashboard</span>
                    Dashboard Actual
                  </button>
                  <button
                    onClick={() => setOrigenExportacion('historial')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${origenExportacion === 'historial'
                        ? 'bg-white text-[#1c355e] shadow-sm border border-[#c5c6cf]/30'
                        : 'text-[#75777f] hover:text-[#44464e]'
                      }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    Bitácora Histórica
                  </button>
                </div>
              </div>

              {/* SECCIÓN 2: Filtros Historial */}
              {origenExportacion === 'historial' && (
                <div className="bg-[#faf9fc] border border-[#c5c6cf]/30 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-wider">2. Filtros de Bitácora</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Desde</label>
                      <input
                        type="date"
                        value={filtrosHistorial.fechaInicio}
                        onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, fechaInicio: e.target.value })}
                        disabled={cargandoFiltrosHistorial}
                        className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Hasta</label>
                      <input
                        type="date"
                        value={filtrosHistorial.fechaFin}
                        onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, fechaFin: e.target.value })}
                        disabled={cargandoFiltrosHistorial}
                        className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Módulo</label>
                      <select
                        value={filtrosHistorial.modulo}
                        onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, modulo: e.target.value })}
                        disabled={cargandoFiltrosHistorial}
                        className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium cursor-pointer"
                      >
                        <option value="Todos">Todos los Módulos</option>
                        {filtrosDisponiblesHistorial.modulos?.map((mod) => (
                          <option key={mod} value={mod}>{mod}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Usuario</label>
                      <select
                        value={filtrosHistorial.usuario}
                        onChange={(e) => setFiltrosHistorial({ ...filtrosHistorial, usuario: e.target.value })}
                        disabled={cargandoFiltrosHistorial}
                        className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium cursor-pointer"
                      >
                        <option value="Todos">Todos los Usuarios</option>
                        {filtrosDisponiblesHistorial.usuarios?.map((usr) => (
                          <option key={usr} value={usr}>{usr}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {cargandoFiltrosHistorial && (
                    <p className="text-xs text-[#75777f] italic flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      Cargando filtros desde la base de datos...
                    </p>
                  )}
                </div>
              )}

              {/* Indicador Dashboard */}
              {origenExportacion === 'dashboard' && (
                <div className="bg-blue-50/50 border border-blue-200/50 rounded-2xl p-4">
                  <p className="text-xs text-blue-700 font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">info</span>
                    Se exportarán los datos del dashboard con los filtros activos actuales
                  </p>
                </div>
              )}

              {/* SECCIÓN 3: Acciones */}
              <div>
                <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-wider mb-3">
                  {origenExportacion === 'historial' ? '3' : '2'}. Acciones
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    disabled={exportando}
                    onClick={() => handleExportarDesdePanel('pdf')}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#c5c6cf]/40 hover:border-red-300 hover:bg-red-50/50 transition-all cursor-pointer group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">picture_as_pdf</span>
                    </div>
                    <span className="text-xs font-bold text-[#1b1c1e]">Descargar PDF</span>
                  </button>

                  <button
                    disabled={exportando}
                    onClick={() => handleExportarDesdePanel('excel')}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#c5c6cf]/40 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">table_chart</span>
                    </div>
                    <span className="text-xs font-bold text-[#1b1c1e]">Descargar Excel</span>
                  </button>

                  <button
                    onClick={() => setMostrarFormEmail(!mostrarFormEmail)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer group ${mostrarFormEmail
                        ? 'border-blue-400 bg-blue-50/80 ring-2 ring-blue-200/50'
                        : 'border-[#c5c6cf]/40 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${mostrarFormEmail ? 'bg-blue-200 text-blue-700' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>
                      <span className="material-symbols-outlined text-[22px]">mail</span>
                    </div>
                    <span className="text-xs font-bold text-[#1b1c1e]">Enviar Correo</span>
                  </button>

                  <button
                    onClick={handleImprimir}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#c5c6cf]/40 hover:border-slate-300 hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">print</span>
                    </div>
                    <span className="text-xs font-bold text-[#1b1c1e]">Imprimir</span>
                  </button>
                </div>
              </div>

              {exportando && (
                <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 animate-spin">progress_activity</span>
                  <span className="text-xs font-bold text-amber-800">Generando reporte, por favor espera...</span>
                </div>
              )}

              {/* SECCIÓN 4: Formulario de Correo */}
              {mostrarFormEmail && (
                <div className="bg-[#faf9fc] border border-blue-200/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">mail</span>
                      Enviar Reporte por Correo Electrónico
                    </p>
                    <button type="button" onClick={() => setMostrarFormEmail(false)} className="text-[#75777f] hover:text-[#44464e] transition-colors cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">expand_less</span>
                    </button>
                  </div>

                  <form onSubmit={handleEnviarEmailSubmit} className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-[#44464e] uppercase">Destinatario(s) *</label>
                        {usuariosRegistrados.length > 0 && (
                          <button type="button" onClick={() => setMostrarSugerenciasEmails(!mostrarSugerenciasEmails)} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                            <span className="material-symbols-outlined text-[14px]">how_to_reg</span>
                            {mostrarSugerenciasEmails ? 'Ocultar usuarios' : `Ver registrados (${usuariosRegistrados.length})`}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Escribe correos separados por coma..."
                        value={formEmail.destinatarios}
                        onFocus={() => setCampoDestino('destinatarios')}
                        onChange={(e) => setFormEmail({ ...formEmail, destinatarios: e.target.value })}
                        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm outline-none transition-all font-medium ${campoDestino === 'destinatarios' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-[#c5c6cf]/50'}`}
                      />
                      {renderBadgesCampo('destinatarios', formEmail.destinatarios)}

                      {mostrarSugerenciasEmails && usuariosRegistrados.length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50/80 border border-blue-200/90 rounded-xl space-y-1.5">
                          <p className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-blue-600">verified_user</span>
                            Usuarios Registrados:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {usuariosRegistrados.map((user) => {
                              const correo = user.correo || user.email || '';
                              const yaAgregado = formEmail[campoDestino]?.split(',').map(e => e.trim()).includes(correo);
                              return (
                                <button
                                  key={correo}
                                  type="button"
                                  onClick={() => {
                                    const actual = formEmail[campoDestino] || '';
                                    if (!yaAgregado) {
                                      const nuevo = actual ? `${actual}, ${correo}` : correo;
                                      setFormEmail({ ...formEmail, [campoDestino]: nuevo });
                                    }
                                  }}
                                  className={`px-2 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${yaAgregado ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-900 border-blue-200 hover:bg-blue-100/80'}`}
                                >
                                  <span className="material-symbols-outlined text-[12px]">{yaAgregado ? 'check_circle' : 'add_circle'}</span>
                                  {user.nombre || correo}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#44464e] uppercase mb-1">CC</label>
                        <input type="text" placeholder="copia@ula.edu.mx" value={formEmail.cc} onFocus={() => setCampoDestino('cc')} onChange={(e) => setFormEmail({ ...formEmail, cc: e.target.value })} className={`w-full px-3 py-2 bg-white border rounded-xl text-xs outline-none transition-all ${campoDestino === 'cc' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-[#c5c6cf]/50'}`} />
                      </div>
                      <div>
                        <label className="block font-bold text-[#44464e] uppercase mb-1">CCO</label>
                        <input type="text" placeholder="oculta@ula.edu.mx" value={formEmail.cco} onFocus={() => setCampoDestino('cco')} onChange={(e) => setFormEmail({ ...formEmail, cco: e.target.value })} className={`w-full px-3 py-2 bg-white border rounded-xl text-xs outline-none transition-all ${campoDestino === 'cco' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-[#c5c6cf]/50'}`} />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Asunto</label>
                      <input type="text" required value={formEmail.asunto} onChange={(e) => setFormEmail({ ...formEmail, asunto: e.target.value })} className="w-full px-3 py-2 bg-white border border-[#c5c6cf]/50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600/20 font-medium" />
                    </div>

                    <div>
                      <label className="block font-bold text-[#44464e] uppercase mb-1">Mensaje</label>
                      <textarea rows="2" placeholder="Escribe una nota..." value={formEmail.mensaje} onChange={(e) => setFormEmail({ ...formEmail, mensaje: e.target.value })} className="w-full px-3 py-2 bg-white border border-[#c5c6cf]/50 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-600/20"></textarea>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-[#c5c6cf]/30 flex items-center gap-4">
                      <p className="font-bold text-[#1c355e] uppercase text-[10px]">Adjuntar:</p>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={formEmail.adjuntar_pdf} onChange={(e) => setFormEmail({ ...formEmail, adjuntar_pdf: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
                        <span className="font-bold text-gray-700 text-xs">PDF</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={formEmail.adjuntar_excel} onChange={(e) => setFormEmail({ ...formEmail, adjuntar_excel: e.target.checked })} className="w-4 h-4 rounded text-emerald-600" />
                        <span className="font-bold text-gray-700 text-xs">Excel</span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setMostrarFormEmail(false)} className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all cursor-pointer">
                        Cancelar
                      </button>
                      <button type="submit" disabled={enviandoEmail} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        {enviandoEmail ? 'Enviando...' : 'Enviar Reporte'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[#c5c6cf]/30 p-4 flex justify-end shrink-0">
              <button onClick={() => setMostrarCentroExportacion(false)} className="px-5 py-2 rounded-xl border border-[#c5c6cf]/50 text-xs font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

