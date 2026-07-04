import { useState, useEffect, useMemo } from 'react';
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

  // ── Fetch docentes (datos crudos del backend) ────────────────────────────
  const fetchDocentes = async () => {
    try {
      const res = await fetch('/api/docentes-horarios');
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
  }, []);

  // ── Motor de estado en tiempo real (recalcula cada vez que cambia ahora) ─
  const docentesConEstado = useMemo(() => {
    const diaHoy    = ahora.getDay(); // 0=Dom,1=Lun,...,6=Sab — igual que dia_index del backend
    const minsAhora = ahora.getHours() * 60 + ahora.getMinutes();

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

      // Filtrar solo los horarios del día de hoy, ordenar y agrupar bloques consecutivos
      const horarios_hoy_raw = (doc.horarios_semana || [])
        .filter(h => h.dia_index === diaHoy)
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
  }, [docentes, ahora]);

  // ── Badge visual ─────────────────────────────────────────────────────────
  const getBadge = (estado) => {
    switch (estado) {
      case 'en_clase':          return { label: 'En Clase',          cls: 'bg-red-100 text-red-600',        icon: 'cast_for_education' };
      case 'por_entrar':        return { label: 'Por Entrar',         cls: 'bg-amber-100 text-amber-700',    icon: 'schedule' };
      case 'suplente_asignado': return { label: 'Suplente Asignado', cls: 'bg-orange-100 text-orange-600',  icon: 'swap_horiz' };
      default:                  return { label: 'Disponible',         cls: 'bg-[#1c9c72]/10 text-[#1c9c72]', icon: 'check_circle' };
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

  // ── Filtros ───────────────────────────────────────────────────────────────
  const docentesFiltrados = docentesConEstado
    .filter(d => {
      const matchFiltro   = filtro === 'todos' || d.estado === filtro;
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
                          {d.estado === 'disponible' ? ' ✓' : d.estado === 'en_clase' ? ' (en clase)' : ''}
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

      {/* ── FILTROS ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          {[
            { id: 'todos',             label: 'Todos' },
            { id: 'en_clase',          label: 'En Clase' },
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

                    {/* ── Clases de hoy ── */}
                    {docente.horarios_hoy?.length > 0 ? (
                      <div className="space-y-1">
                        {docente.horarios_hoy.map((h, i) => {
                          const activa     = minsAhora >= h.inicio_mins && minsAhora <= h.fin_mins;
                          const proxima    = h.inicio_mins > minsAhora && h.inicio_mins - minsAhora <= MINUTOS_AVISO;
                          const finalizada = minsAhora > h.fin_mins;
                          return (
                            <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium ${
                              activa     ? 'bg-red-50 text-red-700 border border-red-100' :
                              proxima    ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              finalizada ? 'bg-[#f4f3f6] text-[#b0b1b8]' :
                              'bg-[#f4f3f6] text-[#44464e]'
                            }`}>
                              <span className="material-symbols-outlined text-[12px] flex-shrink-0">
                                {activa ? 'play_circle' : proxima ? 'schedule' : finalizada ? 'check_circle' : 'radio_button_unchecked'}
                              </span>
                              <span className="font-mono flex-shrink-0">{minsToHora(h.inicio_mins)}–{minsToHora(h.fin_mins)}</span>
                              <span className="truncate">{h.asignatura}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f4f3f6] text-[11px] text-[#75777f]">
                        <span className="material-symbols-outlined text-[13px]">event_busy</span>
                        Sin clases hoy
                      </div>
                    )}

                    {/* ── Botón asignar suplente (siempre al fondo) ── */}
                    <button
                      onClick={() => abrirModalSuplente(docente)}
                      className={`mt-auto w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        esSuplente
                          ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                          : 'bg-[#f4f3f6] border-[#c5c6cf]/40 text-[#44464e] hover:bg-[#1c355e]/5 hover:border-[#1c355e]/20 hover:text-[#1c355e]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">group_add</span>
                      Asignar Suplente
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── ESTADÍSTICAS (COSTADO DERECHO) ─────────────────────────────────── */}
        <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-4 xl:sticky xl:top-24 self-start">
          <div className="bg-[#1c355e] text-white p-6 rounded-2xl shadow-lg">
            <p className="text-xs font-bold uppercase opacity-80">Total Docentes</p>
            <p className="text-4xl font-extrabold mt-1">{totalDocentes}</p>
          </div>
          <div className="bg-white border border-[#c5c6cf]/30 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">Disponibles</p>
            <p className="text-4xl font-extrabold text-[#1c9c72] mt-1">{disponibles}</p>
          </div>
          <div className="bg-white border border-red-200 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">En Clase</p>
            <p className="text-4xl font-extrabold text-red-600 mt-1">{enClase}</p>
          </div>
          <div className="bg-white border border-amber-200 p-6 rounded-2xl shadow-sm flex flex-col items-center xl:items-start text-center xl:text-left">
            <p className="text-xs font-bold uppercase text-[#44464e]">Por Entrar</p>
            <p className="text-4xl font-extrabold text-amber-600 mt-1">{porEntrar}</p>
          </div>
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

      <ToastContainer toasts={toasts} />
    </div>
  );
}
