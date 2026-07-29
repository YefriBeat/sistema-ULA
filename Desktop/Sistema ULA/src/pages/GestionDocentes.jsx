import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast, ToastContainer } from '../components/useToast';
import { useTime } from '../components/TimeContext';

const MINUTOS_AVISO = 30; // mostrar "Por entrar" si faltan ≤ 30 min
const DIAS_NOMBRES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const minsToHora = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

// Agrupa bloques consecutivos de la misma asignatura en un solo rango horario
const agruparClases = (slots) => {
  if (!slots || slots.length === 0) return [];
  const grupos = [{ ...slots[0] }];
  for (let i = 1; i < slots.length; i++) {
    const prev = grupos[grupos.length - 1];
    const curr = slots[i];
    // Si misma asignatura y el bloque es consecutivo (empalma o diferencia ≤ 10 min)
    if (curr.asignatura === prev.asignatura && curr.inicio_mins - prev.fin_mins <= 10) {
      prev.fin_mins = curr.fin_mins; // extender el bloque anterior
    } else {
      grupos.push({ ...curr });
    }
  }
  return grupos;
};

export default function GestionDocentes() {
  const { toast, toasts } = useToast();
  const [confirmacion, setConfirmacion] = useState(null);
  const [docentes, setDocentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [ordenAZ, setOrdenAZ] = useState(false);

  // Reloj compartido con todas las pantallas
  const ahora = useTime();

  // Modal suplente
  const [modalSuplente, setModalSuplente] = useState(null);
  const [formSuplencia, setFormSuplencia] = useState({
    suplente_nombre: '', materia: '', dia: '', fecha: '', hora_inicio: '', hora_fin: ''
  });
  const [suplanteExterno, setSuplanteExterno] = useState(false);
  const [claseSeleccionada, setClaseSeleccionada] = useState(null);
  const [guardandoSuplencia, setGuardandoSuplencia] = useState(false);

  // Modal reprogramación de clase
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [docentesConNuevaClase, setDocentesConNuevaClase] = useState({});
  const [clasesDocenteSemana, setClasesDocenteSemana] = useState([]);
  const [cargandoClasesSemana, setCargandoClasesSemana] = useState(false);
  const [aulasDisponiblesRep, setAulasDisponiblesRep] = useState([]);
  const [cargandoAulasRep, setCargandoAulasRep] = useState(false);
  const [formReprogramar, setFormReprogramar] = useState({
    clase_original_id: '',
    clase_original_horario: '',
    clase_original_asignatura: '',
    nueva_fecha: new Date().toISOString().split('T')[0],
    nuevo_dia: 'Lunes',
    nueva_hora_inicio: '07:00',
    nueva_hora_fin: '08:40',
    nueva_aula: '',
    motivo: ''
  });
  const [guardandoReprogramacion, setGuardandoReprogramacion] = useState(false);

  const [modalHistorial, setModalHistorial] = useState(false);
  const [historialReprogramaciones, setHistorialReprogramaciones] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  // Arrastre libre del modal de reprogramación
  const [posModalRep, setPosModalRep] = useState({ x: 0, y: 0 });
  const [arrastrandoModal, setArrastrandoModal] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleMouseDownModalHeader = (e) => {
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
    setArrastrandoModal(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: posModalRep.x,
      posY: posModalRep.y
    };
  };

  useEffect(() => {
    if (!arrastrandoModal) return;
    const handleMouseMove = (e) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosModalRep({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy
      });
    };
    const handleMouseUp = () => {
      setArrastrandoModal(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [arrastrandoModal]);

  // ── Fetch docentes (datos crudos del backend) ────────────────────────────
  const fetchDocentes = async () => {
    try {
      const res = await fetch(`/api/docentes-horarios?fecha_ref=${encodeURIComponent(ahora.toISOString())}`);
      const data = await res.json();
      setDocentes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar docentes:', e);
      setDocentes([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchDocentes();
    const interval = setInterval(fetchDocentes, 60000);
    return () => clearInterval(interval);
  }, [ahora]);

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const res = await fetch(`/api/reprogramaciones/historial-semanal?fecha_ref=${encodeURIComponent(ahora.toISOString())}`);
      const data = await res.json();
      setHistorialReprogramaciones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error al cargar historial:", e);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    if (modalHistorial) {
      cargarHistorial();
    }
  }, [modalHistorial, ahora]);

  const [estadoAcademico, setEstadoAcademico] = useState({ semestral: null, cuatrimestral: null });
  const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const fetchEstado = async () => {
      try {
        const [resSem, resCuat] = await Promise.all([
          fetch(`/api/estado-academico?plan=semestral&fecha=${hoyStr}`),
          fetch(`/api/estado-academico?plan=cuatrimestral&fecha=${hoyStr}`)
        ]);
        if (resSem.ok && resCuat.ok) {
          setEstadoAcademico({
            semestral: await resSem.json(),
            cuatrimestral: await resCuat.json()
          });
        }
      } catch (e) {
        console.error("Error al cargar estado académico:", e);
      }
    };
    fetchEstado();
  }, [hoyStr]);

  const hayClasesHoy = useMemo(() => {
    const diaHoy = ahora.getDay();
    if (diaHoy === 0) return false;
    if (estadoAcademico.semestral?.hay_clases === false && estadoAcademico.cuatrimestral?.hay_clases === false) return false;
    return true;
  }, [ahora, estadoAcademico]);

  const descripcionCalendario = useMemo(() => {
    if (ahora.getDay() === 0) return 'Domingo (Sin Actividad Académica Programada)';
    return estadoAcademico.semestral?.descripcion || estadoAcademico.cuatrimestral?.descripcion || 'Día sin clases regulares programadas';
  }, [ahora, estadoAcademico]);

  // Determinar si un plan tiene clases hoy según el calendario
  const planTieneClases = (planStr) => {
    const academico = estadoAcademico[planStr];
    if (!academico) return true; // sin datos → asumir que sí
    if (academico.hay_clases === false) return false;
    const esPeriodoFinales = academico?.estado?.includes('ordinario') || academico?.estado?.includes('extraordinario');
    return !esPeriodoFinales;
  };

  // ── Motor de estado en tiempo real (recalcula cada vez que cambia ahora) ─
  const docentesConEstado = useMemo(() => {
    const diaHoy    = ahora.getDay(); // 0=Dom,1=Lun,...,6=Sab — igual que dia_index del backend
    const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();

    const semClases  = planTieneClases('semestral');
    const cuatClases = planTieneClases('cuatrimestral');
    const ningunPlanTieneClases = !semClases && !cuatClases;

    // Si es domingo o ningún plan tiene clases → todos sin clases
    if (diaHoy === 0 || ningunPlanTieneClases) {
      return docentes.map(doc => ({
        ...doc,
        estado: 'sin_clases_calendario',
        suplencia_activa: null,
        cubriendo_suplencia: null,
        horarios_hoy: []
      }));
    }

    // Mapa: suplente_nombre → info de la suplencia que está cubriendo ahora
    const suplentesActivos = new Map();
    docentes.forEach(doc => {
      (doc.suplencias_hoy || []).forEach(s => {
        if (minsAhora >= s.inicio_mins && minsAhora <= s.fin_mins) {
          suplentesActivos.set(s.suplente_nombre, {
            ...s,
            docente_ausente: doc.nombre,
          });
        }
      });
    });

    return docentes.map(doc => {
      // 1) Este docente está AUSENTE y tiene suplente cubriendo ahora
      const suplencia = (doc.suplencias_hoy || []).find(
        s => minsAhora >= s.inicio_mins && minsAhora <= s.fin_mins
      ) || null;

      if (suplencia) {
        return { ...doc, estado: 'suplente_asignado', suplencia_activa: suplencia, cubriendo_suplencia: null };
      }

      // Filtrar solo los horarios del día de hoy que tengan clases según su plan
      const horarios_hoy_raw = (doc.horarios_semana || [])
        .filter(h => {
          if (h.dia_index !== diaHoy) return false;
          // Filtrar por plan: si es cuatrimestral y su plan no tiene clases hoy, excluir
          const planH = h.es_cuatri ? 'cuatrimestral' : 'semestral';
          return planTieneClases(planH);
        })
        .sort((a, b) => a.inicio_mins - b.inicio_mins);
      const horarios_hoy = agruparClases(horarios_hoy_raw);

      // 1b) Este docente está cubriendo la clase de otro ahora mismo
      const cubriendo = suplentesActivos.get(doc.nombre) || null;

      // 2) En clase ahora mismo (por horario propio o cubriendo suplencia)
      const enClasePropio = horarios_hoy.some(
        h => minsAhora >= h.inicio_mins && minsAhora <= h.fin_mins
      );
      if (enClasePropio || cubriendo) {
        return { ...doc, estado: 'en_clase', suplencia_activa: null, cubriendo_suplencia: cubriendo, horarios_hoy };
      }

      // 3) Por entrar (próxima clase en ≤ MINUTOS_AVISO minutos)
      const proxima = horarios_hoy.find(
        h => h.inicio_mins > minsAhora && h.inicio_mins - minsAhora <= MINUTOS_AVISO
      );
      if (proxima) {
        return { ...doc, estado: 'por_entrar', suplencia_activa: null, cubriendo_suplencia: null, proxima_clase: proxima, horarios_hoy };
      }

      return { ...doc, estado: 'disponible', suplencia_activa: null, cubriendo_suplencia: null, horarios_hoy };
    });
  }, [docentes, ahora, estadoAcademico]);

  // ── Badge visual ─────────────────────────────────────────────────────────
  const getBadge = (estado) => {
    switch (estado) {
      case 'en_clase':               return { label: 'En Clase',               cls: 'bg-red-100 text-red-600',         icon: 'cast_for_education' };
      case 'por_entrar':             return { label: 'Por Entrar',              cls: 'bg-amber-100 text-amber-700',     icon: 'schedule' };
      case 'suplente_asignado':      return { label: 'Suplente Asignado',      cls: 'bg-orange-100 text-orange-600',   icon: 'swap_horiz' };
      case 'sin_clases_calendario':  return { label: 'Sin Clases Regulares',   cls: 'bg-slate-100 text-slate-600',     icon: 'event_busy' };
      default:                       return { label: 'No imparte clases',       cls: 'bg-[#1c9c72]/10 text-[#1c9c72]',  icon: 'check_circle' };
    }
  };

  // ── Cancelar suplencia ───────────────────────────────────────────────────
  const handleCancelarSuplencia = (suplenciaId, nombreDocente) => {
    setConfirmacion({
      mensaje: `¿Cancelar la suplencia activa de ${nombreDocente}?`,
      onConfirmar: async () => {
        try {
          const res = await fetch(`/api/suplencias-horarios/${suplenciaId}`, { method: 'DELETE' });
          if (res.ok) { fetchDocentes(); toast('Suplencia cancelada', 'exito'); }
          else toast('Error al cancelar la suplencia', 'error');
        } catch { toast('Error de conexión con el servidor', 'error'); }
      }
    });
  };

  // ── Modal suplente ────────────────────────────────────────────────────────
  // ── Helpers de fecha/hora ─────────────────────────────────────────────────
  const proxFechaDesDia = (diaIndex) => {
    const hoy = new Date(ahora);
    let diff = diaIndex - hoy.getDay();
    if (diff < 0) diff += 7;
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diff);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSeleccionarClase = (slot) => {
    if (!slot) {
      setClaseSeleccionada(null);
      setFormSuplencia(prev => ({ ...prev, materia: '', dia: '', fecha: '', hora_inicio: '', hora_fin: '' }));
      return;
    }
    setClaseSeleccionada(slot);
    setFormSuplencia(prev => ({
      ...prev,
      materia:     slot.asignatura,
      dia:         DIAS_NOMBRES[slot.dia_index],
      fecha:       proxFechaDesDia(slot.dia_index),
      hora_inicio: minsToHora(slot.inicio_mins),
      hora_fin:    minsToHora(slot.fin_mins),
    }));
  };

  const abrirModalSuplente = (docente) => {
    setModalSuplente(docente);
    setFormSuplencia({ suplente_nombre: '', materia: '', dia: '', fecha: '', hora_inicio: '', hora_fin: '' });
    setSuplanteExterno(false);
    setClaseSeleccionada(null);
  };

  const handleGuardarSuplencia = async () => {
    const { suplente_nombre, fecha, hora_inicio, hora_fin } = formSuplencia;
    if (!suplente_nombre.trim() || !fecha || !hora_inicio || !hora_fin) {
      toast('Completa los campos obligatorios marcados con *', 'advertencia');
      return;
    }
    if (suplente_nombre.trim() === modalSuplente.nombre) {
      toast('El suplente no puede ser el mismo docente ausente', 'advertencia');
      return;
    }
    setGuardandoSuplencia(true);
    try {
      const res = await fetch('/api/suplencias-horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_nombre:  modalSuplente.nombre,
          suplente_nombre,
          materia:     formSuplencia.materia,
          dia:         formSuplencia.dia,
          fecha,
          hora_inicio,
          hora_fin
        })
      });
      if (res.ok) {
        setModalSuplente(null);
        fetchDocentes();
        toast('Suplente asignado correctamente', 'exito');
      } else {
        const err = await res.json();
        toast(err.detail || 'Error al asignar suplente', 'error');
      }
    } catch { toast('Error de conexión con el servidor', 'error'); }
    finally { setGuardandoSuplencia(false); }
  };

  const obtenerNombreDiaEs = (fechaStr) => {
    if (!fechaStr) return 'Lunes';
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dt = new Date(fechaStr + 'T00:00:00');
    return dias[dt.getDay()] || 'Lunes';
  };

  const abrirModalReprogramar = async (docente) => {
    setModalReprogramar(docente);
    setPosModalRep({ x: 0, y: 0 });
    const hoyStr = new Date().toISOString().split('T')[0];
    setFormReprogramar({
      clase_original_id: '',
      clase_original_horario: '',
      clase_original_asignatura: '',
      nueva_fecha: hoyStr,
      nuevo_dia: obtenerNombreDiaEs(hoyStr),
      nueva_hora_inicio: '07:00',
      nueva_hora_fin: '08:40',
      nueva_aula: '',
      motivo: ''
    });
    setCargandoClasesSemana(true);
    try {
      const res = await fetch(`/api/docentes/${encodeURIComponent(docente.nombre)}/clases-semana`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setClasesDocenteSemana(arr);
      if (arr.length > 0) {
        setFormReprogramar(prev => ({
          ...prev,
          clase_original_id: arr[0].id,
          clases_originales_ids: [arr[0].id],
          clase_original_horario: arr[0].horario,
          clase_original_asignatura: arr[0].asignatura
        }));
      }
    } catch (e) {
      console.error("Error al cargar clases del docente:", e);
      setClasesDocenteSemana([]);
    } finally {
      setCargandoClasesSemana(false);
    }
  };

  useEffect(() => {
    if (!modalReprogramar || !formReprogramar.nueva_fecha || !formReprogramar.nueva_hora_inicio || !formReprogramar.nueva_hora_fin) {
      setAulasDisponiblesRep([]);
      setFormReprogramar(prev => ({ ...prev, nueva_aula: '' }));
      return;
    }
    const cargarAulas = async () => {
      setCargandoAulasRep(true);
      setFormReprogramar(prev => ({ ...prev, nueva_aula: '' }));
      try {
        const url = `/api/aulas/disponibles-reprogramacion?fecha=${formReprogramar.nueva_fecha}&hora_inicio=${formReprogramar.nueva_hora_inicio}&hora_fin=${formReprogramar.nueva_hora_fin}`;
        const res = await fetch(url);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setAulasDisponiblesRep(arr);
        if (arr.length > 0) {
          setFormReprogramar(prev => ({ ...prev, nueva_aula: arr[0].nombre }));
        } else {
          setFormReprogramar(prev => ({ ...prev, nueva_aula: '' }));
        }
      } catch (e) {
        console.error("Error al cargar aulas disponibles:", e);
        setAulasDisponiblesRep([]);
        setFormReprogramar(prev => ({ ...prev, nueva_aula: '' }));
      } finally {
        setCargandoAulasRep(false);
      }
    };
    cargarAulas();
  }, [modalReprogramar, formReprogramar.nueva_fecha, formReprogramar.nueva_hora_inicio, formReprogramar.nueva_hora_fin]);

  const handleToggleClaseOriginal = (clase) => {
    setFormReprogramar(prev => {
      const idsActuales = prev.clases_originales_ids || [];
      let nuevosIds;
      if (idsActuales.includes(clase.id)) {
        nuevosIds = idsActuales.filter(id => id !== clase.id);
      } else {
        nuevosIds = [...idsActuales, clase.id];
      }
      const seleccionadas = clasesDocenteSemana.filter(item => nuevosIds.includes(item.id));
      const asignaturaStr = seleccionadas.length > 0 
        ? Array.from(new Set(seleccionadas.map(s => s.asignatura))).join(', ') 
        : '';
      const horarioStr = seleccionadas.length > 0 
        ? seleccionadas.map(s => s.horario).join(' y ') 
        : '';

      let nuevaHoraFin = prev.nueva_hora_fin;
      if (seleccionadas.length > 0 && prev.nueva_hora_inicio) {
        const [h, m] = prev.nueva_hora_inicio.split(':').map(Number);
        const inicioMins = h * 60 + m;
        const duracionMins = seleccionadas.length * 50;
        const finMins = inicioMins + duracionMins;
        const fh = Math.floor(finMins / 60);
        const fm = finMins % 60;
        nuevaHoraFin = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
      }

      return {
        ...prev,
        clase_original_id: nuevosIds[0] || '',
        clases_originales_ids: nuevosIds,
        clase_original_horario: horarioStr,
        clase_original_asignatura: asignaturaStr,
        nueva_hora_fin: nuevaHoraFin
      };
    });
  };

  const handleCambioFechaRep = (e) => {
    const val = e.target.value;
    const diaNombre = obtenerNombreDiaEs(val);
    setFormReprogramar(prev => ({ ...prev, nueva_fecha: val, nuevo_dia: diaNombre, nueva_aula: '' }));
  };

  const handleCambioHoraInicioRep = (e) => {
    const val = e.target.value;
    const count = (formReprogramar.clases_originales_ids || []).length || 1;
    const [h, m] = val.split(':').map(Number);
    const duracionMins = count * 50;
    const finMins = (h * 60 + m) + duracionMins;
    const fh = Math.floor(finMins / 60);
    const fm = finMins % 60;
    const finStr = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;

    setFormReprogramar(prev => ({ ...prev, nueva_hora_inicio: val, nueva_hora_fin: finStr, nueva_aula: '' }));
  };

  const handleCambioHoraFinRep = (e) => {
    const val = e.target.value;
    setFormReprogramar(prev => ({ ...prev, nueva_hora_fin: val, nueva_aula: '' }));
  };

  const handleSubmitReprogramacion = async (e) => {
    e.preventDefault();
    if (((!formReprogramar.clases_originales_ids || formReprogramar.clases_originales_ids.length === 0) && !formReprogramar.clase_original_id) || !formReprogramar.nueva_aula) {
      toast("Selecciona al menos una clase original a posponer y un aula disponible", "error");
      return;
    }
    setGuardandoReprogramacion(true);
    try {
      const payload = {
        docente_nombre: modalReprogramar.nombre,
        clase_original_id: Number(formReprogramar.clase_original_id),
        clases_originales_ids: formReprogramar.clases_originales_ids || [Number(formReprogramar.clase_original_id)],
        clase_original_horario: formReprogramar.clase_original_horario,
        clase_original_asignatura: formReprogramar.clase_original_asignatura,
        nueva_fecha: formReprogramar.nueva_fecha,
        nuevo_dia: formReprogramar.nuevo_dia,
        nueva_hora_inicio: formReprogramar.nueva_hora_inicio,
        nueva_hora_fin: formReprogramar.nueva_hora_fin,
        nueva_aula: formReprogramar.nueva_aula,
        motivo: formReprogramar.motivo
      };
      const res = await fetch('/api/reprogramaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDocentesConNuevaClase(prev => ({ ...prev, [modalReprogramar.nombre]: true }));
        setModalReprogramar(null);
        await fetchDocentes();
        toast("Clase reprogramada exitosamente en la base de datos", "exito");
      } else {
        const err = await res.json();
        toast(err.detail || "Error al reprogramar la clase", "error");
      }
    } catch (err) {
      toast("Error de conexión con el servidor", "error");
    } finally {
      setGuardandoReprogramacion(false);
    }
  };

  const handleCancelarReprogramacion = async () => {
    if (!formReprogramar.clase_original_id) return;
    if (!confirm("¿Estás seguro de cancelar esta reprogramación y eliminar la clase de reposición?")) return;
    setGuardandoReprogramacion(true);
    try {
      const res = await fetch(`/api/reprogramaciones/${formReprogramar.clase_original_id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setModalReprogramar(null);
        await fetchDocentes();
        toast("Reprogramación cancelada y reposición eliminada de la base de datos", "exito");
      } else {
        const err = await res.json();
        toast(err.detail || "Error al cancelar la reprogramación", "error");
      }
    } catch {
      toast("Error de conexión con el servidor", "error");
    } finally {
      setGuardandoReprogramacion(false);
    }
  };

  // ── Filtros ───────────────────────────────────────────────────────────────
  const docentesFiltrados = docentesConEstado
    .filter(d => {
      const matchFiltro   = filtro === 'todos'
        || d.estado === filtro
        || (filtro === 'suplente_asignado' && (d.estado === 'suplente_asignado' || d.estado === 'por_entrar'))
        || (filtro === 'nuevas_clases' && (d.clases_reprogramadas?.length > 0 || docentesConNuevaClase[d.nombre]));
      const matchBusqueda = !busqueda ||
        d.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        d.licenciaturas?.some(l => l.toLowerCase().includes(busqueda.toLowerCase()));
      return matchFiltro && matchBusqueda;
    })
    .sort((a, b) => {
      if (ordenAZ) return a.nombre.localeCompare(b.nombre, 'es');
      const aHoy = a.horarios_hoy?.length || 0;
      const bHoy = b.horarios_hoy?.length || 0;
      if (aHoy === 0 && bHoy === 0) return 0;
      if (aHoy === 0) return 1;
      if (bHoy === 0) return -1;
      const aPrimera = Math.min(...a.horarios_hoy.map(h => h.inicio_mins));
      const bPrimera = Math.min(...b.horarios_hoy.map(h => h.inicio_mins));
      return aPrimera - bPrimera;
    });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDocentes = docentesConEstado.length;
  const disponibles   = docentesConEstado.filter(d => d.estado === 'disponible').length;
  const enClase       = docentesConEstado.filter(d => d.estado === 'en_clase').length;
  const porEntrar     = docentesConEstado.filter(d => d.estado === 'por_entrar').length;
  const nuevasClases  = docentesConEstado.filter(d => d.clases_reprogramadas?.length > 0 || docentesConNuevaClase[d.nombre]).length;

  const horaActual = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 font-manrope p-4">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1c355e] tracking-tight">Gestión de Docentes</h1>
          <p className="text-base text-[#44464e] mt-1.5">
            Directorio en tiempo real — actualizado a las <span className="font-bold text-[#1c355e]">{horaActual}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalHistorial(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100/80 rounded-xl text-sm font-bold transition-all shadow-xs cursor-pointer"
            title="Ver historial de clases reprogramadas y descargar reporte semanal"
          >
            <span className="material-symbols-outlined text-[18px]">history_edu</span>
            <span className="hidden sm:inline">Historial y Reporte Semanal</span>
          </button>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[20px]">search</span>
            <input
              className="pl-10 pr-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/40 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1c355e] w-60"
              placeholder="Buscar por nombre o carrera..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>


      {/* ── MODAL ASIGNAR SUPLENTE ─────────────────────────────────────────── */}
      {modalSuplente && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1c355e]">Asignar Suplente</h3>
                <p className="text-sm text-[#75777f] mt-0.5">
                  Docente ausente: <span className="font-bold text-[#44464e]">{modalSuplente.nombre}</span>
                </p>
              </div>
              <button onClick={() => setModalSuplente(null)} className="text-[#44464e] hover:text-[#1c355e]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#44464e] uppercase">Docente Suplente *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setSuplanteExterno(v => !v);
                      setFormSuplencia(prev => ({ ...prev, suplente_nombre: '' }));
                    }}
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${
                      suplanteExterno
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-[#f4f3f6] border-[#c5c6cf]/50 text-[#75777f] hover:border-[#1c355e]/40 hover:text-[#1c355e]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {suplanteExterno ? 'person_off' : 'person_add'}
                    </span>
                    {suplanteExterno ? 'Suplente externo' : 'Agregar externo'}
                  </button>
                </div>

                {suplanteExterno ? (
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-[18px]">badge</span>
                    <input
                      type="text"
                      value={formSuplencia.suplente_nombre}
                      onChange={e => setFormSuplencia(prev => ({ ...prev, suplente_nombre: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder-amber-400"
                      placeholder="Nombre completo del suplente externo"
                      autoFocus
                    />
                  </div>
                ) : (
                  <select
                    value={formSuplencia.suplente_nombre}
                    onChange={e => setFormSuplencia(prev => ({ ...prev, suplente_nombre: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                  >
                    <option value="">Seleccionar suplente...</option>
                    {docentesConEstado
                      .filter(d => d.nombre !== modalSuplente.nombre)
                      .map(d => (
                        <option key={d.nombre} value={d.nombre}>
                          {d.nombre}
                          {d.estado === 'disponible' ? ' (sin clase)' : d.estado === 'en_clase' ? ' (en clase)' : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* ── Selector de clase (auto-rellena horario) ── */}
              <div>
                <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Clase a Cubrir *</label>
                {(modalSuplente.horarios_semana || []).length > 0 ? (
                  <select
                    onChange={e => {
                      const idx = e.target.value;
                      handleSeleccionarClase(idx === '' ? null : (modalSuplente.horarios_semana || [])[parseInt(idx)]);
                    }}
                    defaultValue=""
                    className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                  >
                    <option value="">Seleccionar clase a cubrir...</option>
                    {(modalSuplente.horarios_semana || []).map((slot, i) => (
                      <option key={i} value={i}>
                        {slot.asignatura} — {DIAS_NOMBRES[slot.dia_index]} {minsToHora(slot.inicio_mins)}–{minsToHora(slot.fin_mins)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={formSuplencia.materia}
                    onChange={e => setFormSuplencia(prev => ({ ...prev, materia: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                    placeholder="Nombre de la clase"
                    type="text"
                  />
                )}
              </div>

              {/* ── Preview + fecha cuando hay clase seleccionada ── */}
              {claseSeleccionada && (
                <>
                  <div className="bg-[#1c355e]/5 border border-[#1c355e]/15 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#1c355e] text-[22px]">event_available</span>
                    <div>
                      <p className="text-sm font-bold text-[#1b1c1e]">{formSuplencia.materia}</p>
                      <p className="text-xs text-[#75777f] mt-0.5">
                        {formSuplencia.dia} &nbsp;·&nbsp;
                        <span className="font-mono font-semibold text-[#1c355e]">{formSuplencia.hora_inicio}–{formSuplencia.hora_fin}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Fecha *</label>
                    <input
                      type="date"
                      value={formSuplencia.fecha}
                      onChange={e => setFormSuplencia(prev => ({ ...prev, fecha: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm"
                    />
                    <p className="text-[11px] text-[#75777f] mt-1">
                      Pre-calculada al próximo {formSuplencia.dia}. Puedes cambiarla si es necesario.
                    </p>
                  </div>
                </>
              )}

              {/* ── Campos manuales si no hay horarios registrados ── */}
              {!claseSeleccionada && (modalSuplente.horarios_semana || []).length === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Fecha *</label>
                      <input type="date" value={formSuplencia.fecha}
                        onChange={e => setFormSuplencia(prev => ({ ...prev, fecha: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Día</label>
                      <select value={formSuplencia.dia}
                        onChange={e => setFormSuplencia(prev => ({ ...prev, dia: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm">
                        <option value="">Seleccionar...</option>
                        {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Hora Inicio *</label>
                      <input type="time" value={formSuplencia.hora_inicio}
                        onChange={e => setFormSuplencia(prev => ({ ...prev, hora_inicio: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#44464e] uppercase mb-2">Hora Fin *</label>
                      <input type="time" value={formSuplencia.hora_fin}
                        onChange={e => setFormSuplencia(prev => ({ ...prev, hora_fin: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-[#f4f3f6] border border-[#c5c6cf]/50 rounded-xl text-sm" />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setModalSuplente(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarSuplencia}
                  disabled={guardandoSuplencia}
                  className="flex-1 py-2.5 rounded-xl bg-[#1c355e] text-white text-sm font-bold hover:bg-[#152a4a] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                  {guardandoSuplencia ? 'Asignando...' : 'Asignar Suplente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL REPROGRAMAR CLASE (POSPUESTAS Y REPOSICIONES) ────────────── */}
      {modalReprogramar && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50 pointer-events-none">
          <div
            style={{ transform: `translate(${posModalRep.x}px, ${posModalRep.y}px)` }}
            className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto pointer-events-auto border border-[#c5c6cf]/30 transition-shadow"
          >
            <div
              onMouseDown={handleMouseDownModalHeader}
              className="flex justify-between items-center mb-6 cursor-grab active:cursor-grabbing pb-3 border-b border-gray-100 group select-none"
              title="Haz clic y mantén presionado para arrastrar la ventana"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#75777f] text-lg group-hover:text-[#1c355e] transition-colors">drag_indicator</span>
                <div>
                  <h3 className="text-lg font-bold text-[#1c355e] leading-tight">Reprogramar Clase</h3>
                  <p className="text-xs text-[#75777f] mt-0.5">
                    Docente: <span className="font-bold text-[#44464e]">{modalReprogramar.nombre}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setModalReprogramar(null)} className="text-[#44464e] hover:text-[#1c355e] p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitReprogramacion} className="space-y-4">
              {/* 1. Clase original a posponer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#44464e] uppercase">
                    Clase(s) Original(es) a Posponer * (1 o más bloques)
                  </label>
                  <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {formReprogramar.clases_originales_ids?.length || 0} sel. ({ (formReprogramar.clases_originales_ids?.length || 0) * 50 } min)
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto border border-[#c5c6cf]/40 rounded-xl bg-white divide-y divide-[#c5c6cf]/20 shadow-xs">
                  {cargandoClasesSemana ? (
                    <div className="p-4 text-center text-xs text-[#75777f]">Cargando clases desde base de datos...</div>
                  ) : clasesDocenteSemana.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#75777f]">No hay clases regulares registradas</div>
                  ) : (
                    clasesDocenteSemana.map(c => {
                      const isSelected = formReprogramar.clases_originales_ids?.includes(c.id);
                      const isPospuesta = c.estado_slug === 'pospuesta';
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors text-xs select-none ${
                            isSelected ? 'bg-indigo-50/90 text-indigo-950 font-bold' : 'hover:bg-gray-50 text-[#191c20]'
                          } ${isPospuesta ? 'opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected || false}
                            onChange={() => handleToggleClaseOriginal(c)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className="truncate">
                              {c.asignatura} — <span className="font-mono text-[11px] font-semibold">{c.horario}</span>
                              {c.aula_asignada ? ` (${c.aula_asignada})` : ''}
                            </span>
                            {isPospuesta && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-extrabold uppercase">
                                YA POSPUESTA
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-[#75777f] mt-1 italic">
                  Tip: Puedes marcar 2 clases consecutivas (ej. 9:10-10:00 y 10:00-10:50) para posponer el bloque completo de 2 horas.
                </p>
              </div>

              {/* 2. Nueva Fecha y Horario */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-3">
                  <label className="text-xs font-bold text-[#44464e] uppercase mb-1 block">
                    Nueva Fecha *
                  </label>
                  <input
                    type="date"
                    value={formReprogramar.nueva_fecha}
                    onChange={handleCambioFechaRep}
                    className="w-full px-3 py-2 rounded-xl border border-[#c5c6cf]/40 text-sm text-[#191c20] focus:outline-none focus:border-[#1c355e]"
                    required
                  />
                  <span className="text-[11px] text-[#75777f] font-semibold mt-1 block">
                    Día seleccionado: {formReprogramar.nuevo_dia}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-1.5">
                  <label className="text-xs font-bold text-[#44464e] uppercase mb-1 block">
                    Hora Inicio *
                  </label>
                  <input
                    type="time"
                    value={formReprogramar.nueva_hora_inicio}
                    onChange={handleCambioHoraInicioRep}
                    className="w-full px-3 py-2 rounded-xl border border-[#c5c6cf]/40 text-sm text-[#191c20] focus:outline-none focus:border-[#1c355e]"
                    required
                  />
                </div>
                <div className="col-span-3 sm:col-span-1.5">
                  <label className="text-xs font-bold text-[#44464e] uppercase mb-1 block">
                    Hora Fin *
                  </label>
                  <input
                    type="time"
                    value={formReprogramar.nueva_hora_fin}
                    onChange={handleCambioHoraFinRep}
                    className="w-full px-3 py-2 rounded-xl border border-[#c5c6cf]/40 text-sm text-[#191c20] focus:outline-none focus:border-[#1c355e]"
                    required
                  />
                </div>
              </div>

              {/* 3. Nueva Aula (Validación de BD en Tiempo Real) */}
              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase mb-1.5 block">
                  Nueva Aula (Disponible en BD) *
                </label>
                <select
                  value={formReprogramar.nueva_aula}
                  onChange={(e) => setFormReprogramar(prev => ({ ...prev, nueva_aula: e.target.value }))}
                  disabled={cargandoAulasRep || !formReprogramar.nueva_fecha || !formReprogramar.nueva_hora_inicio || !formReprogramar.nueva_hora_fin || aulasDisponiblesRep.length === 0}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#c5c6cf]/40 text-sm text-[#191c20] focus:outline-none focus:border-[#1c355e] bg-white disabled:opacity-60 disabled:bg-gray-100 cursor-pointer"
                  required
                >
                  {!formReprogramar.nueva_fecha || !formReprogramar.nueva_hora_inicio || !formReprogramar.nueva_hora_fin ? (
                    <option value="">Seleccione fecha y horario primero...</option>
                  ) : cargandoAulasRep ? (
                    <option value="">Buscando aulas libres en BD para este horario...</option>
                  ) : aulasDisponiblesRep.length === 0 ? (
                    <option value="">Sin aulas libres en esta fecha y horario</option>
                  ) : (
                    aulasDisponiblesRep.map(a => (
                      <option key={a.nombre} value={a.nombre}>
                        {a.nombre} — Capacidad: {a.capacidad} ({a.ubicacion || 'General'})
                      </option>
                    ))
                  )}
                </select>
                <span className="text-[11px] text-[#75777f] mt-1 block">
                  {aulasDisponiblesRep.length} aula(s) disponible(s) sin cruce de horario.
                </span>
              </div>

              {/* Motivo o nota adicional */}
              <div>
                <label className="text-xs font-bold text-[#44464e] uppercase mb-1 block">
                  Motivo o Nota
                </label>
                <input
                  type="text"
                  placeholder="Ej. Comisión académica, congreso, etc."
                  value={formReprogramar.motivo}
                  onChange={(e) => setFormReprogramar(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-[#c5c6cf]/40 text-sm text-[#191c20] focus:outline-none focus:border-[#1c355e]"
                />
              </div>

              {/* Botón opcional para cancelar/revocar reprogramación existente */}
              {clasesDocenteSemana.find(c => c.id === Number(formReprogramar.clase_original_id))?.estado_slug === 'pospuesta' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleCancelarReprogramacion}
                    disabled={guardandoReprogramacion}
                    className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[17px]">event_busy</span>
                    Cancelar Reprogramación (Revertir a Normal)
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalReprogramar(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#c5c6cf]/50 text-sm font-bold text-[#44464e] hover:bg-[#f4f3f6] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoReprogramacion || cargandoAulasRep || aulasDisponiblesRep.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#1c355e] text-white text-sm font-bold hover:bg-[#152a4a] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">update</span>
                  {guardandoReprogramacion ? 'Reprogramando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          {[
            { id: 'todos',             label: 'Todos' },
            { id: 'en_clase',          label: 'En Clase' },
            { id: 'disponible',        label: 'No imparte clases' },
            { id: 'suplente_asignado', label: 'Con Suplente' },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFiltro(btn.id)}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                filtro === btn.id
                  ? 'bg-[#1c355e] text-white'
                  : 'bg-white border border-[#c5c6cf]/30 text-[#44464e] hover:border-[#1c355e]/50'
              }`}
            >
              {btn.label}
              {btn.id !== 'todos' && docentesConEstado.filter(d => d.estado === btn.id).length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  filtro === btn.id ? 'bg-white/20 text-white' : 'bg-[#1c355e]/10 text-[#1c355e]'
                }`}>
                  {docentesConEstado.filter(d => d.estado === btn.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOrdenAZ(v => !v)}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
            ordenAZ
              ? 'bg-[#1c355e] text-white'
              : 'bg-white border border-[#c5c6cf]/30 text-[#44464e] hover:border-[#1c355e]/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">sort_by_alpha</span>
          A–Z
        </button>
      </div>

      {/* ── CONTENEDOR PRINCIPAL: DOCENTES (Izquierda/Centro) y ESTADÍSTICAS (Derecha) ── */}
      <div className="flex flex-col xl:flex-row gap-8 items-stretch">
        
        {/* ── CARDS DE DOCENTES ──────────────────────────────────────────────── */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cargando ? (
              <div className="col-span-full flex flex-col items-center py-16 text-[#75777f]">
                <span className="material-symbols-outlined animate-spin text-3xl mb-2">sync</span>
                <p className="font-semibold">Cargando docentes...</p>
              </div>
            ) : docentesFiltrados.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-[#c5c6cf]/30">
                <span className="material-symbols-outlined text-5xl text-[#c5c6cf] mb-3 block">school</span>
                <p className="font-bold text-[#44464e]">
                  {docentes.length === 0
                    ? 'No hay docentes en la base de datos. Carga un horario en PDF primero.'
                    : 'Sin docentes en esta categoría.'}
                </p>
              </div>
            ) : (
              docentesFiltrados.map(docente => {
                const { label, cls, icon } = getBadge(docente.estado);
                const esSuplente  = docente.estado === 'suplente_asignado';
                const esPorEntrar = docente.estado === 'por_entrar';
                const minsAhora   = ahora.getHours() * 60 + ahora.getMinutes();

                return (
                  <div
                    key={docente.nombre}
                    className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col gap-3 transition-all ${
                      (docente.clases_reprogramadas?.length > 0 || docentesConNuevaClase[docente.nombre]) ? 'border-indigo-400 ring-2 ring-indigo-200/60 bg-indigo-50/10' :
                      esSuplente  ? 'border-orange-200' :
                      esPorEntrar ? 'border-amber-200'  :
                      docente.estado === 'en_clase' ? 'border-red-200' :
                      'border-[#c5c6cf]/30'
                    }`}
                  >
                    {/* ── Cabecera compacta ── */}
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#0e2045] text-white flex items-center justify-center font-bold text-base uppercase shadow-sm flex-shrink-0">
                        {docente.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-[#1b1c1e] leading-tight truncate">{docente.nombre}</h2>
                        {docente.licenciaturas?.[0] && (
                          <p className="text-[11px] text-[#75777f] truncate mt-0.5">{docente.licenciaturas[0]}</p>
                        )}
                        {(docente.clases_reprogramadas?.length > 0 || docentesConNuevaClase[docente.nombre]) && (
                          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-xs">
                            <span className="material-symbols-outlined text-[14px] text-indigo-600">event_repeat</span>
                            Nueva Clase Programada
                          </span>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-0.5 whitespace-nowrap flex-shrink-0 ${cls}`}>
                        <span className="material-symbols-outlined text-[11px]">{icon}</span>
                        {label}
                      </span>
                    </div>

                    {/* ── Banner suplencia activa ── */}
                    {esSuplente && docente.suplencia_activa && (
                      <div className="flex items-center justify-between gap-2 text-xs text-orange-600 font-semibold bg-orange-50 border border-orange-100 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-[14px] flex-shrink-0">swap_horiz</span>
                          <span className="truncate">
                            Cubre: <span className="font-bold">{docente.suplencia_activa.suplente_nombre}</span>
                          </span>
                          <span className="font-mono opacity-70 flex-shrink-0">{docente.suplencia_activa.hora_inicio}–{docente.suplencia_activa.hora_fin}</span>
                        </div>
                        <button
                          onClick={() => handleCancelarSuplencia(docente.suplencia_activa.id, docente.nombre)}
                          title="Cancelar suplencia"
                          className="text-orange-300 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                        </button>
                      </div>
                    )}

                    {/* ── Banner por entrar ── */}
                    {esPorEntrar && docente.proxima_clase && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>
                          Entra en <span className="font-bold">{docente.proxima_clase.inicio_mins - minsAhora} min</span>
                          {docente.proxima_clase.asignatura ? ` · ${docente.proxima_clase.asignatura}` : ''}
                        </span>
                      </div>
                    )}

                    {/* ── Banner cubriendo suplencia ── */}
                    {docente.cubriendo_suplencia && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-100 px-3 py-2 rounded-xl">
                        <span className="material-symbols-outlined text-[14px] flex-shrink-0">swap_horiz</span>
                        <span className="truncate">
                          Cubriendo a <span className="font-bold">{docente.cubriendo_suplencia.docente_ausente}</span>
                          {docente.cubriendo_suplencia.materia ? ` · ${docente.cubriendo_suplencia.materia}` : ''}
                        </span>
                        <span className="font-mono opacity-70 flex-shrink-0 ml-auto">
                          {docente.cubriendo_suplencia.hora_inicio}–{docente.cubriendo_suplencia.hora_fin}
                        </span>
                      </div>
                    )}

                    {/* ── Banner de Nueva Clase Programada / Reprogramada ── */}
                    {docente.clases_reprogramadas?.length > 0 && (
                      <div className="flex flex-col gap-1.5 text-xs text-indigo-900 bg-indigo-50/90 border border-indigo-200 px-3.5 py-2.5 rounded-xl shadow-xs">
                        <div className="flex items-center justify-between gap-2 font-bold text-indigo-800">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
                            Nueva Clase Programada / Reposición
                          </span>
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-extrabold uppercase border border-indigo-200">
                            Activa
                          </span>
                        </div>
                        {docente.clases_reprogramadas.map((rep, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5 text-indigo-950 mt-1 border-t border-indigo-200/60 pt-1.5 first:border-0 first:pt-0">
                            <div className="flex items-center justify-between font-semibold">
                              <span>{rep.asignatura || 'Clase Reprogramada'}</span>
                              <span className="font-mono text-[11px] bg-white/90 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">{rep.horario}</span>
                            </div>
                            {rep.aula_asignada && (
                              <div className="text-[11px] text-indigo-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">room</span>
                                Aula: <span className="font-bold">{rep.aula_asignada}</span>
                                {rep.fecha_reposicion && (
                                  <span className="ml-auto text-indigo-600 font-medium">Fecha: {rep.fecha_reposicion}</span>
                                )}
                              </div>
                            )}
                            {rep.nota_reprogramacion && (
                              <p className="text-[11px] text-indigo-700/90 italic mt-0.5">{rep.nota_reprogramacion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!docente.clases_reprogramadas?.length && docentesConNuevaClase[docente.nombre] && (
                      <div className="flex items-center gap-2 text-xs text-indigo-900 bg-indigo-50/90 border border-indigo-200 px-3.5 py-2.5 rounded-xl shadow-xs font-semibold">
                        <span className="material-symbols-outlined text-[16px] text-indigo-600">calendar_add_on</span>
                        <span>Nueva clase programada en esta sesión.</span>
                      </div>
                    )}

                    {/* ── Clases de hoy ── */}
                    {docente.horarios_hoy?.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-[#1c355e] uppercase tracking-wider flex items-center justify-between pt-1">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-blue-600">schedule</span>
                            Clases Programadas Hoy
                          </span>
                          <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                            {docente.horarios_hoy.length}
                          </span>
                        </div>
                        {docente.horarios_hoy.map((h, i) => {
                          const activa     = minsAhora >= h.inicio_mins && minsAhora <= h.fin_mins;
                          const proxima    = h.inicio_mins > minsAhora && h.inicio_mins - minsAhora <= MINUTOS_AVISO;
                          const finalizada = minsAhora > h.fin_mins;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${
                              activa     ? 'bg-red-50 text-red-700 border border-red-100 font-bold' :
                              proxima    ? 'bg-amber-50 text-amber-700 border border-amber-100 font-bold' :
                              finalizada ? 'bg-[#f4f3f6] text-[#b0b1b8]' :
                              'bg-[#f4f3f6] text-[#44464e]'
                            }`}>
                              <span className="material-symbols-outlined text-[12px] flex-shrink-0">
                                {activa ? 'play_circle' : proxima ? 'schedule' : finalizada ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span className="font-mono flex-shrink-0">{minsToHora(h.inicio_mins)}–{minsToHora(h.fin_mins)}</span>
                              <span className="truncate">{h.asignatura}</span>
                              {activa && <span className="ml-auto text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-extrabold uppercase">En curso</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f4f3f6] text-[11px] text-[#75777f]">
                        <span className="material-symbols-outlined text-[13px]">event_busy</span>
                        Sin clases programadas para hoy
                      </div>
                    )}

                    {/* ── Botones de acción (siempre al fondo) ── */}
                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button
                        onClick={() => abrirModalSuplente(docente)}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all border ${
                          esSuplente
                            ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                            : 'bg-[#f4f3f6] border-[#c5c6cf]/40 text-[#44464e] hover:bg-[#1c355e]/5 hover:border-[#1c355e]/20 hover:text-[#1c355e]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">group_add</span>
                        Suplente
                      </button>
                      <button
                        onClick={() => abrirModalReprogramar(docente)}
                        className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all border bg-[#f4f3f6] border-[#c5c6cf]/40 text-[#44464e] hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700"
                      >
                        <span className="material-symbols-outlined text-[15px]">update</span>
                        Reprogramar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── ESTADÍSTICAS (COSTADO DERECHO) ─────────────────────────────────── */}
        <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-4 xl:sticky xl:top-24 self-start">
          <button
            onClick={() => setFiltro('todos')}
            className={`text-left w-full transition-all cursor-pointer rounded-2xl ${
              filtro === 'todos' ? 'ring-4 ring-[#1c355e]/30 scale-[1.02]' : 'hover:opacity-90'
            }`}
          >
            <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
              <p className="text-xs font-bold uppercase opacity-80">Total Docentes</p>
              <p className="text-4xl font-extrabold mt-1">{totalDocentes}</p>
            </div>
          </button>

          <button
            onClick={() => setFiltro('disponible')}
            className={`text-left w-full transition-all cursor-pointer rounded-2xl ${
              filtro === 'disponible' ? 'ring-4 ring-[#1c9c72]/30 scale-[1.02]' : 'hover:opacity-90'
            }`}
          >
            <div className={`bg-white border p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left ${
              filtro === 'disponible' ? 'border-[#1c9c72] bg-[#1c9c72]/5' : 'border-[#c5c6cf]/30'
            }`}>
              <p className="text-xs font-bold uppercase text-[#44464e]">No imparte clases</p>
              <p className="text-4xl font-extrabold text-[#1c9c72] mt-1">{disponibles}</p>
            </div>
          </button>

          <button
            onClick={() => setFiltro('en_clase')}
            className={`text-left w-full transition-all cursor-pointer rounded-2xl ${
              filtro === 'en_clase' ? 'ring-4 ring-red-300 scale-[1.02]' : 'hover:opacity-90'
            }`}
          >
            <div className={`bg-white border p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left ${
              filtro === 'en_clase' ? 'border-red-400 bg-red-50/50' : 'border-red-200'
            }`}>
              <p className="text-xs font-bold uppercase text-[#44464e]">En Clase</p>
              <p className="text-4xl font-extrabold text-red-600 mt-1">{enClase}</p>
            </div>
          </button>

          <button
            onClick={() => setFiltro('suplente_asignado')}
            className={`text-left w-full transition-all cursor-pointer rounded-2xl ${
              filtro === 'suplente_asignado' ? 'ring-4 ring-amber-300 scale-[1.02]' : 'hover:opacity-90'
            }`}
          >
            <div className={`bg-white border p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left ${
              filtro === 'por_entrar' || filtro === 'suplente_asignado' ? 'border-amber-400 bg-amber-50/50' : 'border-amber-200'
            }`}>
              <p className="text-xs font-bold uppercase text-[#44464e]">Por Entrar / Suplentes</p>
              <p className="text-4xl font-extrabold text-amber-600 mt-1">{porEntrar}</p>
            </div>
          </button>

          <button
            onClick={() => setFiltro('nuevas_clases')}
            className={`text-left w-full transition-all cursor-pointer rounded-2xl ${
              filtro === 'nuevas_clases' ? 'ring-4 ring-indigo-300 scale-[1.02]' : 'hover:opacity-90'
            }`}
          >
            <div className={`bg-white border p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left ${
              filtro === 'nuevas_clases' ? 'border-indigo-400 bg-indigo-50/50' : 'border-indigo-200'
            }`}>
              <p className="text-xs font-bold uppercase text-[#44464e]">Nuevas Clases Programadas</p>
              <p className="text-4xl font-extrabold text-indigo-600 mt-1">{nuevasClases}</p>
            </div>
          </button>
        </div>

      </div>

      {/* ── MODAL CONFIRMACIÓN ─────────────────────────────────────────────── */}
      {confirmacion && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-500 text-[28px]">warning</span>
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
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL Y REPORTE SEMANAL ───────────────────────────────── */}
      {modalHistorial && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#c5c6cf]/30 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-[#1c355e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600">history_edu</span>
                  Historial de Reprogramaciones y Reposiciones Semanales
                </h3>
                <p className="text-xs text-[#75777f] mt-1">
                  Las clases reprogramadas que ya han concluido se archivan automáticamente aquí y el horario original del docente regresa a la normalidad.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/api/reprogramaciones/exportar-historial-csv"
                  download="reporte_reprogramaciones_semanal.csv"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Exportar Reporte (.CSV)
                </a>
                <button
                  type="button"
                  onClick={() => setModalHistorial(false)}
                  className="p-1.5 text-[#75777f] hover:text-[#191c20] rounded-lg transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cargandoHistorial ? (
                <div className="py-12 text-center text-sm text-[#75777f]">Cargando historial desde base de datos...</div>
              ) : historialReprogramaciones.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-[#c5c6cf] mb-2 block">inbox</span>
                  <p className="text-sm font-bold text-[#44464e]">No hay clases reprogramadas archivadas aún</p>
                  <p className="text-xs text-[#75777f] mt-1">
                    Cuando pase la fecha y hora de una reposición programada, aparecerá automáticamente aquí.
                  </p>
                </div>
              ) : (
                <div className="border border-[#c5c6cf]/30 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f4f3f6] border-b border-[#c5c6cf]/30 text-[#44464e] font-bold">
                        <th className="p-3">Docente</th>
                        <th className="p-3">Asignatura</th>
                        <th className="p-3">Horario Reposición</th>
                        <th className="p-3">Fecha Reposición</th>
                        <th className="p-3">Aula</th>
                        <th className="p-3">Semana</th>
                        <th className="p-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c5c6cf]/20">
                      {historialReprogramaciones.map((h, i) => (
                        <tr key={h.id || i} className="hover:bg-gray-50/80">
                          <td className="p-3 font-bold text-[#191c20]">{h.docente}</td>
                          <td className="p-3 text-[#44464e]">{h.asignatura}</td>
                          <td className="p-3 font-mono font-semibold text-indigo-700">{h.horario_reposicion}</td>
                          <td className="p-3 font-semibold text-[#191c20]">{h.fecha_reposicion}</td>
                          <td className="p-3 text-[#44464e]">{h.aula_asignada || 'N/A'}</td>
                          <td className="p-3 text-[#75777f]">{h.semana_anio}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Archivada / Normalizado
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#c5c6cf]/30 flex items-center justify-between text-xs text-[#75777f]">
              <span>
                Total de reposiciones concluidas: <strong className="text-[#191c20]">{historialReprogramaciones.length}</strong>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/reprogramaciones/archivar-completadas?fecha_ref=${encodeURIComponent(ahora.toISOString())}`, { method: 'POST' });
                  await cargarHistorial();
                  await fetchDocentes();
                }}
                className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                Forzar verificación de completadas ahora
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
