import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import AgendarEventoModal from './AgendarEventoModal';

export default function AgendaEventos({ aulasList = [] }) {
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

  const fetchEventos = async () => {
    setCargando(true);
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
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchEventos();
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
      ) : eventos.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#c5c6cf]/30 p-12 text-center text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">event_busy</span>
          <p className="font-bold text-base text-slate-600">No se encontraron eventos agendados</p>
          <p className="text-xs text-slate-400 mt-1">Pruebe ajustando los filtros o cree una nueva reserva.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {eventos.map((ev) => {
            const badge = getBadgeEstado(ev.estado);
            return (
              <div
                key={ev.id}
                className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-4 ${
                  ev.estado === 'Cancelado' ? 'border-red-200 bg-red-50/20 opacity-80' : 'border-slate-200 shadow-xs hover:shadow-md'
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
                    {ev.estado !== 'Cancelado' && ev.estado !== 'Finalizado' && (
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
                <p className="font-bold text-slate-800 text-sm mt-0.5">{eventoDetalle.estado}</p>
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

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => handleEliminarEvento(eventoDetalle)}
                className="px-4 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-xl hover:bg-red-100 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                Eliminar evento
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
      )}

    </div>
  );
}
