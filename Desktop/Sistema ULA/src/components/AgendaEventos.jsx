import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import AgendarEventoModal from './AgendarEventoModal';
import { useTime } from './TimeContext';

/**
 * Calcula el estado dinámico de un evento en tiempo real comparando con la hora institucional/actual
 */
export function obtenerEstadoEvento(ev, ahoraRef = new Date()) {
  if (!ev) return 'Programado';
  if ((ev.estado || '').toLowerCase() === 'cancelado') return 'Cancelado';

  const fStr = String(ev.fecha || '').slice(0, 10);
  const hIni = String(ev.hora_inicio || '00:00').slice(0, 5);
  const hFin = String(ev.hora_fin || '00:00').slice(0, 5);

  if (!fStr || !hIni || !hFin) return ev.estado || 'Programado';

  const [y, m, d] = fStr.split('-').map(Number);
  const [h1, m1] = hIni.split(':').map(Number);
  const [h2, m2] = hFin.split(':').map(Number);

  if (!y || !m || !d) return ev.estado || 'Programado';

  const dtIni = new Date(y, m - 1, d, h1 || 0, m1 || 0, 0, 0);
  const dtFin = new Date(y, m - 1, d, h2 || 0, m2 || 0, 0, 0);
  const tRef = ahoraRef instanceof Date ? ahoraRef.getTime() : new Date(ahoraRef).getTime();

  if (tRef >= dtFin.getTime()) {
    return 'Finalizado';
  } else if (tRef >= dtIni.getTime()) {
    return 'En curso';
  } else {
    return 'Programado';
  }
}

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

export default function AgendaEventos({ aulasList = [] }) {
  const ahora = useTime();
  const dragExport = useDraggableModal();

  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aulasLocales, setAulasLocales] = useState([]);
  
  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroAula, setFiltroAula] = useState('todas');
  const [filtroFecha, setFiltroFecha] = useState('');

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [eventoAEditar, setEventoAEditar] = useState(null);
  const [eventoDetalle, setEventoDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  
  // Cancelación
  const [modalCancelar, setModalCancelar] = useState(null);
  const [motivoCancelar, setMotivoCancelar] = useState('Cancelación por reorganización de espacio');
  const [cancelando, setCancelando] = useState(false);

  // Centro de Exportación
  const [mostrarCentroExportacion, setMostrarCentroExportacion] = useState(false);
  const [filtrosExport, setFiltrosExport] = useState({
    fechaInicio: '',
    fechaFin: '',
    aula: 'todas',
    estado: 'todos',
    tipo: 'todos',
    busqueda: ''
  });
  const [mostrarFormEmail, setMostrarFormEmail] = useState(false);
  const [formEmail, setFormEmail] = useState({
    destinatarios: '',
    cc: '',
    cco: '',
    asunto: 'Reporte de Reservas y Eventos — SIPREF',
    mensaje: '',
    adjuntar_pdf: true,
    adjuntar_excel: false
  });
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [usuariosRegistrados, setUsuariosRegistrados] = useState([]);
  const [mostrarSugerenciasEmails, setMostrarSugerenciasEmails] = useState(true);
  const [campoDestino, setCampoDestino] = useState('destinatarios');

  const API_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';

  useEffect(() => {
    if (aulasList && aulasList.length > 0) {
      setAulasLocales(aulasList);
    } else {
      fetch(`${API_URL}/api/aulas`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAulasLocales(data);
        })
        .catch(err => console.error('Error al cargar aulas:', err));
    }
  }, [aulasList]);

  const fetchEventos = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      let params = new URLSearchParams();
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroEstado !== 'todos') params.append('estado', filtroEstado);
      if (filtroTipo !== 'todos') params.append('tipo_evento', filtroTipo);
      if (filtroAula !== 'todas') params.append('aula', filtroAula);
      if (filtroFecha) params.append('fecha', filtroFecha);

      const res = await fetch(`${API_URL}/api/eventos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEventos(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error al cargar eventos:', err);
    } finally {
      if (!silencioso) setCargando(false);
    }
  };

  useEffect(() => {
    fetchEventos();
  }, [busqueda, filtroEstado, filtroTipo, filtroAula, filtroFecha]);

  // Polling silencioso en segundo plano cada 15 segundos para sincronizar nuevos eventos y mantener BD actualizada
  useEffect(() => {
    const timer = setInterval(() => {
      fetchEventos(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [busqueda, filtroEstado, filtroTipo, filtroAula, filtroFecha]);

  const handleVerDetalle = async (ev) => {
    setCargandoDetalle(true);
    try {
      const res = await fetch(`${API_URL}/api/eventos/${ev.id}`);
      if (res.ok) {
        const data = await res.json();
        setEventoDetalle(data);
      } else {
        setEventoDetalle(ev);
      }
    } catch (err) {
      setEventoDetalle(ev);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleEditar = async (ev) => {
    try {
      const res = await fetch(`${API_URL}/api/eventos/${ev.id}`);
      if (res.ok) {
        const data = await res.json();
        setEventoAEditar(data);
      } else {
        setEventoAEditar(ev);
      }
    } catch (err) {
      setEventoAEditar(ev);
    }
    setModalNuevo(true);
  };

  const handleCancelarEvento = async () => {
    if (!modalCancelar) return;
    setCancelando(true);
    try {
      const res = await fetch(`${API_URL}/api/eventos/${modalCancelar.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo_cancelacion: motivoCancelar,
          usuario: 'Prefectura'
        })
      });
      if (res.ok) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: 'Reserva cancelada y aula liberada con éxito',
          showConfirmButton: false,
          timer: 3500
        });
        setModalCancelar(null);
        fetchEventos();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cancelar el evento.'
        });
      }
    } catch (err) {
      console.error('Error al cancelar evento:', err);
    } finally {
      setCancelando(false);
    }
  };

  const handleEliminarEvento = async (ev) => {
    if (!ev || !ev.id) return;

    const result = await Swal.fire({
      title: '¿Eliminar evento?',
      html: `¿Estás seguro de que deseas eliminar permanentemente el evento <b>"${ev.nombre_evento}"</b>?<br/><br/><span style="font-size: 13px; color: #ef4444; font-weight: 600;">Esta acción borrará el registro de la base de datos y liberará el aula <b>${ev.aula_nombre}</b>. No se podrá recuperar.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar de la BD',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/eventos/${ev.id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Evento eliminado definitivamente de la base de datos',
            showConfirmButton: false,
            timer: 3500
          });
          if (eventoDetalle && eventoDetalle.id === ev.id) {
            setEventoDetalle(null);
          }
          fetchEventos();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: data.detail || 'No se pudo eliminar el evento.'
          });
        }
      } catch (err) {
        console.error('Error al eliminar evento:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error de conexión',
          text: 'No se pudo comunicar con el servidor para eliminar el evento.'
        });
      }
    }
  };

  const handleExportarHistorial = () => {
    dragExport.resetPos();
    setFiltrosExport({
      fechaInicio: '',
      fechaFin: '',
      aula: filtroAula,
      estado: filtroEstado,
      tipo: filtroTipo,
      busqueda: busqueda
    });
    setMostrarFormEmail(false);
    setMostrarCentroExportacion(true);
  };

  // Cargar usuarios registrados cuando se abre el centro de exportación o email
  useEffect(() => {
    if (mostrarFormEmail || mostrarCentroExportacion) {
      fetch(`${API_URL}/api/usuarios`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setUsuariosRegistrados(Array.isArray(data) ? data : []))
        .catch(() => setUsuariosRegistrados([]));
    }
  }, [mostrarFormEmail, mostrarCentroExportacion]);

  // Construir query params para los endpoints de exportación de eventos
  const buildExportParams = () => {
    const params = new URLSearchParams();
    if (filtrosExport.fechaInicio) params.append('fecha_inicio', filtrosExport.fechaInicio);
    if (filtrosExport.fechaFin) params.append('fecha_fin', filtrosExport.fechaFin);
    if (filtrosExport.aula && filtrosExport.aula !== 'todas') params.append('aula', filtrosExport.aula);
    if (filtrosExport.estado && filtrosExport.estado !== 'todos') params.append('estado', filtrosExport.estado);
    if (filtrosExport.tipo && filtrosExport.tipo !== 'todos') params.append('tipo_evento', filtrosExport.tipo);
    if (filtrosExport.busqueda) params.append('busqueda', filtrosExport.busqueda);
    return params;
  };

  const handleExportarDesdePanel = async (formato) => {
    setExportando(true);
    try {
      const params = buildExportParams();
      const endpoint = formato === 'pdf' ? '/api/eventos/exportar/pdf' : '/api/eventos/exportar/excel';
      const url = `${API_URL}${endpoint}${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.download = `Historial_Eventos_${fecha}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Reporte ${formato.toUpperCase()} generado exitosamente`, showConfirmButton: false, timer: 3500 });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.detail || `Error al generar reporte ${formato.toUpperCase()}`, showConfirmButton: false, timer: 4000 });
      }
    } catch (e) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error de conexión al generar reporte', showConfirmButton: false, timer: 4000 });
    } finally {
      setExportando(false);
    }
  };

  const handleEnviarEmailEventos = async (e) => {
    e.preventDefault();
    if (!formEmail.destinatarios) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Especifica al menos un destinatario', showConfirmButton: false, timer: 3000 });
      return;
    }
    setEnviandoEmail(true);
    try {
      const bodyData = {
        destinatarios: formEmail.destinatarios,
        cc: formEmail.cc,
        cco: formEmail.cco,
        asunto: formEmail.asunto,
        mensaje: formEmail.mensaje,
        adjuntar_pdf: formEmail.adjuntar_pdf,
        adjuntar_excel: formEmail.adjuntar_excel,
        fecha_inicio: filtrosExport.fechaInicio || null,
        fecha_fin: filtrosExport.fechaFin || null,
        aula: (filtrosExport.aula && filtrosExport.aula !== 'todas') ? filtrosExport.aula : null,
        estado: (filtrosExport.estado && filtrosExport.estado !== 'todos') ? filtrosExport.estado : null,
        tipo_evento: (filtrosExport.tipo && filtrosExport.tipo !== 'todos') ? filtrosExport.tipo : null,
        busqueda: filtrosExport.busqueda || null,
        usuario_nombre: 'Prefectura'
      };
      const res = await fetch(`${API_URL}/api/eventos/exportar/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        setMostrarFormEmail(false);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Reporte de eventos enviado por correo con éxito', showConfirmButton: false, timer: 3500 });
      } else {
        const err = await res.json().catch(() => ({}));
        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: err.detail || 'Error al enviar correo', showConfirmButton: false, timer: 4000 });
      }
    } catch {
      Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Error de conexión al enviar correo', showConfirmButton: false, timer: 4000 });
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleImprimirEventos = () => {
    window.print();
  };

  // Renderizar badges de correos escritos en los campos de email
  const renderBadgesCampo = (nombreCampo, valorCampo) => {
    const correos = (valorCampo || '').split(',').map(c => c.trim()).filter(Boolean);
    if (correos.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {correos.map((correo, idx) => {
          const usr = usuariosRegistrados.find(u => (u.correo || u.email || '').toLowerCase() === correo.toLowerCase());
          return (
            <span
              key={`${correo}-${idx}`}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
            >
              {usr ? usr.nombre : correo}
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

  const getBadgeEstado = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'programado':
        return { cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'event', label: 'Programado' };
      case 'en curso':
        return { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse', icon: 'play_circle', label: 'En curso' };
      case 'finalizado':
        return { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'check_circle', label: 'Finalizado' };
      case 'cancelado':
        return { cls: 'bg-red-100 text-red-700 border-red-200', icon: 'cancel', label: 'Cancelado' };
      default:
        return { cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'info', label: estado };
    }
  };

  return (
    <div className="space-y-6 font-manrope">
      
      {/* CABECERA CON BOTÓN Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#c5c6cf]/30 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-[#1c355e] flex items-center gap-2">
            <span className="material-symbols-outlined text-28px text-[#fdbb11]">event_upcoming</span>
            Agenda e Historial de Eventos
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Gestione reservas de conferencias, juntas y eventos especiales en aulas SIPREF con recordatorios automatizados.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
          <button
            onClick={handleExportarHistorial}
            className="w-full sm:w-auto px-4 py-3 bg-white border border-[#c5c6cf]/50 text-[#1c355e] hover:bg-slate-50 hover:border-[#1c355e]/30 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            title="Exportar historial de reservas y eventos a Excel o PDF"
          >
            <span className="material-symbols-outlined text-lg text-emerald-600">download</span>
            Exportar historial
          </button>

          <button
            onClick={() => {
              setEventoAEditar(null);
              setModalNuevo(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-[#fdbb11] to-[#e8a906] text-[#0e2045] px-5 py-3 rounded-2xl text-sm font-black hover:brightness-105 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xl">event_available</span>
            + Agendar evento
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-4 rounded-2xl border border-[#c5c6cf]/30 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* Buscador */}
          <div className="relative lg:col-span-2">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar evento, responsable o correo..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#1c355e]/20"
            />
          </div>

          {/* Filtro Aula */}
          <div>
            <select
              value={filtroAula}
              onChange={(e) => setFiltroAula(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white"
            >
              <option value="todas">Todas las Aulas</option>
              {aulasLocales.map(a => (
                <option key={a.id || a.nombre} value={a.nombre}>
                  Aula {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white"
            >
              <option value="todos">Todos los Estados</option>
              <option value="Programado">Programados</option>
              <option value="En curso">En Curso</option>
              <option value="Finalizado">Finalizados</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>

          {/* Filtro Tipo */}
          <div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white"
            >
              <option value="todos">Todos los Tipos</option>
              <option value="Conferencia">Conferencia</option>
              <option value="Junta">Junta / Reunión</option>
              <option value="Examen">Examen Especial</option>
              <option value="Presentación">Presentación</option>
              <option value="Taller">Taller</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          {/* Filtro Fecha */}
          <div>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white"
            />
          </div>

        </div>
      </div>

      {/* LISTA / TARJETAS DE EVENTOS */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#1c355e]">sync</span>
        </div>
      ) : eventos.filter(ev => {
          const est = obtenerEstadoEvento(ev, ahora);
          if (filtroEstado !== 'todos' && est.toLowerCase() !== filtroEstado.toLowerCase()) return false;
          return true;
        }).length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#c5c6cf]/30 p-12 text-center text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">event_busy</span>
          <p className="font-bold text-base text-slate-600">No se encontraron eventos agendados</p>
          <p className="text-xs text-slate-400 mt-1">Pruebe ajustando los filtros o cree una nueva reserva.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {eventos
            .filter(ev => {
              const est = obtenerEstadoEvento(ev, ahora);
              if (filtroEstado !== 'todos' && est.toLowerCase() !== filtroEstado.toLowerCase()) return false;
              return true;
            })
            .map((ev) => {
              const estadoEfectivo = obtenerEstadoEvento(ev, ahora);
              const badge = getBadgeEstado(estadoEfectivo);
              return (
                <div
                  key={ev.id}
                  className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-4 ${
                    estadoEfectivo === 'Cancelado'
                      ? 'border-red-200 bg-red-50/20 opacity-80'
                      : estadoEfectivo === 'En curso'
                      ? 'border-emerald-400 ring-2 ring-emerald-200/70 shadow-md bg-emerald-50/10'
                      : 'border-slate-200 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* CABECERA TARJETA */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-full uppercase tracking-wider">
                        {ev.tipo_evento}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center gap-1 ${badge.cls}`}>
                        <span className="material-symbols-outlined text-xs">{badge.icon}</span>
                        {badge.label}
                      </span>
                    </div>

                    {/* TÍTULO Y AULA */}
                    <h3 className="text-lg font-bold text-[#1c355e] leading-snug line-clamp-2">
                      {ev.nombre_evento}
                    </h3>

                    <div className="mt-3 space-y-2 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-2 text-indigo-900 bg-indigo-50/60 px-3 py-2 rounded-xl">
                        <span className="material-symbols-outlined text-lg text-indigo-600">meeting_room</span>
                        <span className="font-bold">Aula {ev.aula_nombre}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-slate-400">calendar_month</span>
                        <span>Fecha: <strong className="text-slate-800">{ev.fecha}</strong></span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                        <span>Horario: <strong className="text-slate-800">{String(ev.hora_inicio).slice(0, 5)} - {String(ev.hora_fin).slice(0, 5)}</strong></span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-slate-400">person</span>
                        <span className="truncate">Responsable: <strong className="text-slate-800">{ev.responsable}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* ACCIONES TARJETA */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleVerDetalle(ev)}
                      className="text-xs font-bold text-[#1c355e] hover:bg-slate-100 px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">visibility</span> Detalle / Historial
                    </button>

                    <div className="flex items-center gap-1">
                      {estadoEfectivo !== 'Cancelado' && estadoEfectivo !== 'Finalizado' && (
                        <>
                          <button
                            onClick={() => handleEditar(ev)}
                            className="p-2 text-slate-500 hover:text-[#1c355e] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                            title="Editar evento"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => setModalCancelar(ev)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all cursor-pointer"
                            title="Cancelar evento"
                          >
                            <span className="material-symbols-outlined text-lg">cancel</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleEliminarEvento(ev)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                        title="Eliminar evento permanentemente"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      <AgendarEventoModal
        isOpen={modalNuevo}
        onClose={() => {
          setModalNuevo(false);
          setEventoAEditar(null);
        }}
        onSuccess={() => {
          fetchEventos();
        }}
        eventoAEditar={eventoAEditar}
        aulasList={aulasList}
      />

      {/* MODAL CANCELAR EVENTO */}
      {modalCancelar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-lg font-bold">Cancelar Reserva de Evento</h3>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Al cancelar el evento <strong>"{modalCancelar.nombre_evento}"</strong> se liberará el aula <strong>{modalCancelar.aula_nombre}</strong> y se desactivarán sus recordatorios pendientes. El registro se conservará en el historial.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Motivo de Cancelación</label>
              <textarea
                rows="3"
                value={motivoCancelar}
                onChange={e => setMotivoCancelar(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white"
                placeholder="Escriba la razón de la cancelación..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setModalCancelar(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                No cancelar
              </button>
              <button
                onClick={handleCancelarEvento}
                disabled={cancelando}
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {cancelando ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE E HISTORIAL */}
      {eventoDetalle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                  {eventoDetalle.tipo_evento}
                </span>
                <h3 className="text-xl font-bold text-[#1c355e] mt-2">
                  {eventoDetalle.nombre_evento}
                </h3>
              </div>
              <button
                onClick={() => setEventoDetalle(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[10px]">Aula</p>
                <p className="font-bold text-[#1c355e] text-sm mt-0.5">{eventoDetalle.aula_nombre}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[10px]">Estado</p>
                {(() => {
                  const estDetalle = obtenerEstadoEvento(eventoDetalle, ahora);
                  const badgeDetalle = getBadgeEstado(estDetalle);
                  return (
                    <div className="mt-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border inline-flex items-center gap-1 ${badgeDetalle.cls}`}>
                        <span className="material-symbols-outlined text-xs">{badgeDetalle.icon}</span>
                        {badgeDetalle.label}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[10px]">Fecha</p>
                <p className="font-semibold text-slate-800 mt-0.5">{eventoDetalle.fecha}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[10px]">Horario</p>
                <p className="font-semibold text-slate-800 mt-0.5">{String(eventoDetalle.hora_inicio).slice(0, 5)} - {String(eventoDetalle.hora_fin).slice(0, 5)}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Responsable</p>
              <p className="font-bold text-slate-800">{eventoDetalle.responsable}</p>
              <p className="text-slate-500">{eventoDetalle.correo}</p>
            </div>

            {eventoDetalle.descripcion && (
              <div className="text-xs">
                <p className="text-slate-400 font-bold uppercase text-[10px] mb-1">Descripción</p>
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700">{eventoDetalle.descripcion}</p>
              </div>
            )}

            {/* SECCIÓN RECORDATORIOS */}
            <div className="space-y-2 text-xs">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Recordatorios Configurados</p>
              {Array.isArray(eventoDetalle.recordatorios) && eventoDetalle.recordatorios.length > 0 ? (
                <div className="space-y-1.5">
                  {eventoDetalle.recordatorios.map((r, i) => (
                    <div key={i} className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-[#1c355e]">
                            {r.tipo === 'correo' ? 'mail' : 'notifications'}
                          </span>
                          {r.tipo} — {r.antencion_valor} {r.antencion_unidad} antes
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          r.estado === 'enviado' ? 'bg-emerald-100 text-emerald-700' :
                          r.estado === 'error' ? 'bg-red-100 text-red-700' :
                          r.estado === 'procesando' ? 'bg-blue-100 text-blue-700' :
                          r.estado === 'cancelado' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.estado || 'pendiente'}
                        </span>
                      </div>
                      {r.fecha_envio && (
                        <p className="text-[10px] text-emerald-600 mt-1 font-medium">
                          ✓ Enviado el: {String(r.fecha_envio).replace('T', ' ').slice(0, 16)}
                        </p>
                      )}
                      {r.error_log && (
                        <p className="text-[10px] text-red-500 mt-1 font-medium truncate" title={r.error_log}>
                          ⚠ Error: {r.error_log}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">Sin recordatorios asignados.</p>
              )}
            </div>

            {/* SECCIÓN HISTORIAL */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Historial de Auditoría</p>
              {Array.isArray(eventoDetalle.historial) && eventoDetalle.historial.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {eventoDetalle.historial.map((h, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>{h.accion} — {h.usuario}</span>
                        <span className="text-slate-400 font-normal">{h.fecha ? String(h.fecha).replace('T', ' ').slice(0, 16) : ''}</span>
                      </div>
                      {h.detalles && <p className="text-slate-500 mt-1">{h.detalles}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">Creado el {eventoDetalle.created_at || 'recreado'}.</p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => handleEliminarEvento(eventoDetalle)}
                className="px-4 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                Eliminar evento
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportarHistorial}
                  className="px-4 py-2 bg-slate-100 text-[#1c355e] font-bold text-xs rounded-xl hover:bg-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-emerald-600">download</span>
                  Exportar historial
                </button>
                <button
                  onClick={() => setEventoDetalle(null)}
                  className="px-5 py-2 bg-[#1c355e] text-white font-bold text-xs rounded-xl hover:bg-[#152a4a] cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════ CENTRO DE EXPORTACIÓN DE EVENTOS ═══════════════════ */}
      {mostrarCentroExportacion && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6 pointer-events-none transition-opacity">
          <div
            style={{ transform: `translate(${dragExport.pos.x}px, ${dragExport.pos.y}px)` }}
            className="bg-white/95 backdrop-blur-xl rounded-[2.25rem] w-full max-w-5xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35)] font-manrope max-h-[92vh] flex flex-col pointer-events-auto border border-white/80 transition-shadow"
          >
            {/* Header */}
            <div
              onMouseDown={dragExport.handleMouseDown}
              className="flex justify-between items-center border-b border-[#c5c6cf]/20 p-6 sm:px-8 sm:py-5 shrink-0 cursor-grab active:cursor-grabbing select-none group bg-gradient-to-r from-white via-white to-[#f4f3f6]/60 rounded-t-[2.25rem]"
              title="Haz clic y mantén presionado para arrastrar la ventana"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c355e] to-blue-800 text-white flex items-center justify-center shadow-lg shadow-blue-900/20">
                  <span className="material-symbols-outlined text-[24px]">download</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#1b1c1e] flex items-center gap-2 tracking-tight">
                    Centro de Exportación
                    <span className="material-symbols-outlined text-[#75777f] text-base group-hover:text-[#1c355e] transition-colors">drag_indicator</span>
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-[#75777f] mt-0.5">Personaliza tus filtros de fecha y genera o envía tu reporte de eventos y reservas</p>
                </div>
              </div>
              <button onClick={() => setMostrarCentroExportacion(false)} className="w-10 h-10 rounded-2xl bg-[#f4f3f6] hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all cursor-pointer shadow-sm">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Body scrollable */}
            <div className="overflow-y-auto flex-1 p-6 sm:p-8 space-y-6">

              {/* SECCIÓN 1: Filtros de Eventos */}
              <div className="bg-[#faf9fc] border border-[#c5c6cf]/30 rounded-2xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold text-[#1c355e] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#fdbb11]">event_upcoming</span>
                    1. Filtros de Eventos y Reservas de Aulas
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-[#44464e] uppercase mb-1">Desde</label>
                    <input
                      type="date"
                      value={filtrosExport.fechaInicio}
                      onChange={(e) => setFiltrosExport({ ...filtrosExport, fechaInicio: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#44464e] uppercase mb-1">Hasta</label>
                    <input
                      type="date"
                      value={filtrosExport.fechaFin}
                      onChange={(e) => setFiltrosExport({ ...filtrosExport, fechaFin: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#44464e] uppercase mb-1">Aula</label>
                    <select
                      value={filtrosExport.aula}
                      onChange={(e) => setFiltrosExport({ ...filtrosExport, aula: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium cursor-pointer"
                    >
                      <option value="todas">Todas las aulas</option>
                      {aulasLocales.map((a) => (
                        <option key={a.id || a.nombre} value={a.nombre}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#44464e] uppercase mb-1">Tipo de Evento</label>
                    <select
                      value={filtrosExport.tipo}
                      onChange={(e) => setFiltrosExport({ ...filtrosExport, tipo: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium cursor-pointer"
                    >
                      <option value="todos">Todos los tipos</option>
                      <option value="Conferencia">Conferencia</option>
                      <option value="Junta">Junta</option>
                      <option value="Taller">Taller</option>
                      <option value="Examen">Examen</option>
                      <option value="Reunión">Reunión</option>
                      <option value="Evento Especial">Evento Especial</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#44464e] uppercase mb-1">Estado</label>
                    <select
                      value={filtrosExport.estado}
                      onChange={(e) => setFiltrosExport({ ...filtrosExport, estado: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-[#c5c6cf]/50 rounded-xl text-sm outline-none focus:border-[#1c355e] font-medium cursor-pointer"
                    >
                      <option value="todos">Todos los estados</option>
                      <option value="Programado">Programado</option>
                      <option value="En curso">En curso</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-[#75777f] italic flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-blue-600">info</span>
                  Deja los filtros vacíos para exportar todo el historial de eventos, o selecciona un rango de fechas para acotar el reporte.
                </p>
              </div>

              {/* SECCIÓN 2: Acciones */}
              <div>
                <p className="text-[10px] font-extrabold text-[#75777f] uppercase tracking-wider mb-3">2. Acciones</p>
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
                    onClick={handleImprimirEventos}
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

              {/* SECCIÓN 3: Formulario de Correo */}
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

                  <form onSubmit={handleEnviarEmailEventos} className="space-y-3 text-xs">
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

    </div>
  );
}
