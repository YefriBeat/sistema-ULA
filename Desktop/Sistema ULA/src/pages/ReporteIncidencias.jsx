import logo from '../components/logo.png';
import { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import { useTime } from '../components/TimeContext';

const LICENCIATURAS_DISPONIBLES = [
  { codigo: 'DER', nombre: 'Derecho' },
  { codigo: 'ENF', nombre: 'Enfermería' },
  { codigo: 'GAS', nombre: 'Gastronomía' },
  { codigo: 'ISC', nombre: 'Ing. Sistemas Computacionales' },
  { codigo: 'MERG', nombre: 'Mercadotecnia Global' },
  { codigo: 'NEG', nombre: 'Negocios Internacionales' },
  { codigo: 'NUT', nombre: 'Nutrición' },
  { codigo: 'NUTF', nombre: 'Nutrición y Fitoterapia' },
  { codigo: 'PSCF', nombre: 'Psicología Clínica y de la Salud' },
  { codigo: 'PSIC', nombre: 'Psicología' },
  { codigo: 'VMK', nombre: 'Ventas y Mercadotecnia' },
];

export default function ReporteIncidencias() {
  const ahora = useTime();
  const hoyStr = ahora.toISOString().slice(0, 10);

  // Estados principales de datos
  const [incidencias, setIncidencias] = useState([]);
  const [resumen, setResumen] = useState({
    total_incidencias: 0,
    total_faltas: 0,
    total_horas_falta: 0,
    total_retardos: 0,
    total_salidas_anticipadas: 0,
    docentes_afectados: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [docentesDisponibles, setDocentesDisponibles] = useState([]);

  // Filtros de fecha y búsqueda
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroLicenciatura, setFiltroLicenciatura] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [periodoActivo, setPeriodoActivo] = useState('todo'); // 'quincena1', 'quincena2', 'mes', 'todo', 'personalizado'

  // Modal de captura / edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario de incidencia
  const [formulario, setFormulario] = useState({
    fecha: hoyStr,
    docente_nombre: '',
    tipo_incidencia: 'falta', // 'falta', 'retardo', 'salida_anticipada'
    falta_horas: '2',
    retardo: '',
    salida_anticipada: '',
    licenciatura: '',
    grado_grupo: '',
    asignatura: '',
    aula: '',
    observaciones: '',
  });
  // Estados para modal de envío por correo electrónico
  const [modalEmailAbierto, setModalEmailAbierto] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [usuariosRegistrados, setUsuariosRegistrados] = useState([]);
  const [mostrarSugerenciasEmails, setMostrarSugerenciasEmails] = useState(false);
  const [campoDestinoEmail, setCampoDestinoEmail] = useState('destinatarios');
  const [formEmail, setFormEmail] = useState({
    destinatarios: '',
    cc: '',
    cco: '',
    asunto: '',
    mensaje: '',
    adjuntar_excel: true,
    adjuntar_pdf: true,
  });

  // Cargar usuarios para autocompletar correos
  useEffect(() => {
    if (modalEmailAbierto && usuariosRegistrados.length === 0) {
      fetch('/api/usuarios')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setUsuariosRegistrados(Array.isArray(data) ? data : []))
        .catch(() => setUsuariosRegistrados([]));
    }
  }, [modalEmailAbierto, usuariosRegistrados.length]);


  // Sugerencias de docentes al teclear
  const [mostrarSugerenciasDocente, setMostrarSugerenciasDocente] = useState(false);
  const sugerenciasRef = useRef(null);

  // Cargar docentes para autocompletado
  useEffect(() => {
    fetch('/api/docentes-horarios')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const nombres = data
            .map((d) => d.nombre || d.docente || '')
            .filter((n) => n.trim().length > 0);
          setDocentesDisponibles([...new Set(nombres)].sort());
        }
      })
      .catch(() => {});
  }, []);

  // Cargar datos de incidencias según filtros
  const cargarIncidencias = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append('fecha_inicio', fechaInicio);
      if (fechaFin) params.append('fecha_fin', fechaFin);
      if (filtroDocente) params.append('docente', filtroDocente);
      if (filtroLicenciatura) params.append('licenciatura', filtroLicenciatura);
      if (filtroTipo) params.append('tipo_incidencia', filtroTipo);
      if (filtroBusqueda) params.append('busqueda', filtroBusqueda);

      const res = await fetch(`/api/incidencias?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidencias(data.incidencias || []);
        setResumen(
          data.resumen || {
            total_incidencias: 0,
            total_faltas: 0,
            total_horas_falta: 0,
            total_retardos: 0,
            total_salidas_anticipadas: 0,
            docentes_afectados: 0,
          }
        );
      }
    } catch (error) {
      console.error('Error al cargar incidencias:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarIncidencias();
  }, [fechaInicio, fechaFin, filtroLicenciatura, filtroTipo]);

  // Manejar búsqueda con debounce sutil
  useEffect(() => {
    const timer = setTimeout(() => {
      cargarIncidencias();
    }, 300);
    return () => clearTimeout(timer);
  }, [filtroBusqueda, filtroDocente]);

  // Accesos rápidos de período (Quincenas y Meses)
  const aplicarPeriodoRapido = (tipo) => {
    setPeriodoActivo(tipo);
    const ahoraRef = new Date();
    const anio = ahoraRef.getFullYear();
    const mes = ahoraRef.getMonth(); // 0 a 11

    if (tipo === 'quincena_actual') {
      const diaHoy = ahoraRef.getDate();
      if (diaHoy <= 15) {
        // Primera quincena del mes
        setFechaInicio(`${anio}-${String(mes + 1).padStart(2, '0')}-01`);
        setFechaFin(`${anio}-${String(mes + 1).padStart(2, '0')}-15`);
      } else {
        // Segunda quincena del mes
        const ultimoDia = new Date(anio, mes + 1, 0).getDate();
        setFechaInicio(`${anio}-${String(mes + 1).padStart(2, '0')}-16`);
        setFechaFin(`${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`);
      }
    } else if (tipo === 'mes_actual') {
      const ultimoDia = new Date(anio, mes + 1, 0).getDate();
      setFechaInicio(`${anio}-${String(mes + 1).padStart(2, '0')}-01`);
      setFechaFin(`${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoDia}`);

    } else if (tipo === 'todo') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  // Abrir modal para crear
  const abrirModalCrear = () => {
    setModoEdicion(false);
    setIdEditando(null);
    setFormulario({
      fecha: hoyStr,
      docente_nombre: '',
      tipo_incidencia: 'falta',
      falta_horas: '2',
      retardo: '',
      salida_anticipada: '',
      licenciatura: '',
      grado_grupo: '',
      asignatura: '',
      aula: '',
      observaciones: '',
    });
    setModalAbierto(true);
  };

  // Abrir modal para editar
  const abrirModalEditar = (inc) => {
    setModoEdicion(true);
    setIdEditando(inc.id);
    setFormulario({
      fecha: inc.fecha || hoyStr,
      docente_nombre: inc.docente_nombre || '',
      tipo_incidencia: inc.tipo_incidencia || 'falta',
      falta_horas: inc.falta_horas || '',
      retardo: inc.retardo || '',
      salida_anticipada: inc.salida_anticipada || '',
      licenciatura: inc.licenciatura || '',
      grado_grupo: inc.grado_grupo || '',
      asignatura: inc.asignatura || '',
      aula: inc.aula || '',
      observaciones: inc.observaciones || '',
    });
    setModalAbierto(true);
  };

  // Guardar formulario (crear o actualizar)
  const guardarIncidencia = async (e) => {
    e.preventDefault();
    if (!formulario.fecha || !formulario.docente_nombre.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Por favor complete la fecha y el nombre del docente.',
        confirmButtonColor: '#1c355e',
      });
      return;
    }

    setGuardando(true);
    try {
      const url = modoEdicion ? `/api/incidencias/${idEditando}` : '/api/incidencias';
      const metodo = modoEdicion ? 'PUT' : 'POST';

            let nombreUsuario = 'Prefectura';
      try {
        const rawUser = localStorage.getItem('usuarioLogueado');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          nombreUsuario = parsed.nombre_completo || parsed.nombre || parsed.correo || 'Prefectura';
        }
      } catch {
        nombreUsuario = localStorage.getItem('usuarioLogueado') || 'Prefectura';
      }

        const datosLimpios = {
          ...formulario,
          falta_horas: formulario.tipo_incidencia === 'falta' ? formulario.falta_horas : '',
          retardo: formulario.tipo_incidencia === 'retardo' ? formulario.retardo : '',
          salida_anticipada: formulario.tipo_incidencia === 'salida_anticipada' ? formulario.salida_anticipada : '',
          registrado_por: nombreUsuario,
        };
        const res = await fetch(url, {
          method: metodo,
          headers: {
            'Content-Type': 'application/json',
            'x-usuario': encodeURIComponent(nombreUsuario),
          },
          body: JSON.stringify(datosLimpios),
        });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: modoEdicion ? 'Incidencia actualizada' : 'Incidencia registrada',
          text: modoEdicion
            ? 'Los cambios han sido guardados correctamente.'
            : 'La incidencia docente fue agregada al reporte.',
          timer: 1800,
          showConfirmButton: false,
        });
        setModalAbierto(false);
        cargarIncidencias();
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Error al guardar la incidencia.');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        confirmButtonColor: '#1c355e',
      });
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar incidencia
  const confirmarEliminar = (inc) => {
    Swal.fire({
      title: '¿Eliminar incidencia?',
      text: `Se borrará el registro de ${inc.docente_nombre} del día ${inc.fecha}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
                let nombreUsuario = 'Prefectura';
      try {
        const rawUser = localStorage.getItem('usuarioLogueado');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          nombreUsuario = parsed.nombre_completo || parsed.nombre || parsed.correo || 'Prefectura';
        }
      } catch {
        nombreUsuario = localStorage.getItem('usuarioLogueado') || 'Prefectura';
      }
          const res = await fetch(`/api/incidencias/${inc.id}`, {
            method: 'DELETE',
            headers: {
              'x-usuario': encodeURIComponent(nombreUsuario),
            },
          });

          if (res.ok) {
            Swal.fire({
              icon: 'success',
              title: 'Eliminado',
              text: 'La incidencia ha sido eliminada con éxito.',
              timer: 1500,
              showConfirmButton: false,
            });
            cargarIncidencias();
          } else {
            throw new Error('No se pudo eliminar el registro.');
          }
        } catch (error) {
          Swal.fire('Error', error.message, 'error');
        }
      }
    });
  };

  // Descargar Excel
  const descargarExcel = () => {
    let nombreUsuario = 'Prefectura';
    try {
      const rawUser = localStorage.getItem('usuarioLogueado');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        nombreUsuario = parsed.nombre_completo || parsed.nombre || 'Prefectura';
      }
    } catch {}

    const params = new URLSearchParams();
    if (fechaInicio) params.append('fecha_inicio', fechaInicio);
    if (fechaFin) params.append('fecha_fin', fechaFin);
    if (filtroDocente) params.append('docente', filtroDocente);
    if (filtroLicenciatura) params.append('licenciatura', filtroLicenciatura);
    if (filtroTipo) params.append('tipo_incidencia', filtroTipo);
    params.append('usuario_nombre', nombreUsuario);

    window.open(`/api/incidencias/exportar-excel?${params.toString()}`, '_blank');
  };

  // Imprimir
  const imprimirReporte = () => {
    window.print();
  };

  // Abrir modal de correo preparando asunto y valores
  const abrirModalEmail = () => {
    let periodoTxt = 'Corte General Completo';
    if (fechaInicio && fechaFin) {
      periodoTxt = `Período del ${fechaInicio} al ${fechaFin}`;
    } else if (fechaInicio) {
      periodoTxt = `A partir del ${fechaInicio}`;
    } else if (fechaFin) {
      periodoTxt = `Hasta el ${fechaFin}`;
    }

    setFormEmail((prev) => ({
      ...prev,
      asunto: `Relación de Incidencias Docentes — Universidad Latino (${periodoTxt})`,
    }));
    setModalEmailAbierto(true);
  };

  // Enviar reporte por correo
  const handleEnviarEmail = async (e) => {
    e.preventDefault();
    if (!formEmail.destinatarios || !formEmail.destinatarios.includes('@')) {
      Swal.fire({
        icon: 'warning',
        title: 'Correo requerido',
        text: 'Por favor ingresa al menos un correo electrónico válido.',
        confirmButtonColor: '#1c355e',
      });
      return;
    }

    if (!formEmail.adjuntar_excel && !formEmail.adjuntar_pdf) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un formato',
        text: 'Debes seleccionar al menos un formato para adjuntar (Excel o PDF).',
        confirmButtonColor: '#1c355e',
      });
      return;
    }

    setEnviandoEmail(true);

    let nombreUsuario = 'Prefectura';
    let correoUsuario = '';
    try {
      const rawUser = localStorage.getItem('usuarioLogueado');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        nombreUsuario = parsed.nombre_completo || parsed.nombre || 'Prefectura';
        correoUsuario = parsed.correo || parsed.email || '';
      }
    } catch {}

    try {
      const payload = {
        destinatarios: formEmail.destinatarios,
        cc: formEmail.cc,
        cco: formEmail.cco,
        asunto: formEmail.asunto,
        mensaje: formEmail.mensaje,
        adjuntar_excel: formEmail.adjuntar_excel,
        adjuntar_pdf: formEmail.adjuntar_pdf,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        docente: filtroDocente || null,
        licenciatura: filtroLicenciatura || null,
        tipo_incidencia: filtroTipo || null,
        busqueda: filtroBusqueda || null,
        usuario_nombre: nombreUsuario,
        usuario_correo: correoUsuario,
      };

      const res = await fetch('/api/incidencias/exportar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setModalEmailAbierto(false);
        Swal.fire({
          icon: 'success',
          title: '¡Reporte enviado!',
          text: data.message || 'El reporte de incidencias se ha enviado con éxito por correo electrónico.',
          confirmButtonColor: '#1c355e',
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al enviar correo',
          text: data.detail || 'Ocurrió un error al enviar el reporte. Verifica la configuración SMTP en el servidor.',
          confirmButtonColor: '#1c355e',
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: `No se pudo conectar con el servidor: ${err.message}`,
        confirmButtonColor: '#1c355e',
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Renderizar badges de correos en campos de email
  const renderBadgesCampoEmail = (campo, valor) => {
    const correos = (valor || '').split(',').map((c) => c.trim()).filter(Boolean);
    if (correos.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {correos.map((correo, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-semibold"
          >
            <span className="material-symbols-outlined text-[12px]">mail</span>
            {correo}
          </span>
        ))}
      </div>
    );
  };

  // Filtrado de sugerencias de docentes
  const docentesFiltrados = useMemo(() => {
    if (!formulario.docente_nombre) return [];
    const busq = formulario.docente_nombre.toLowerCase().trim();
    return docentesDisponibles.filter((d) => d.toLowerCase().includes(busq)).slice(0, 8);
  }, [formulario.docente_nombre, docentesDisponibles]);

  // Cerrar sugerencias al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sugerenciasRef.current && !sugerenciasRef.current.contains(e.target)) {
        setMostrarSugerenciasDocente(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Nombre de usuario logueado para reporte impreso
  let nombreUsuarioActual = 'Prefectura';
  try {
    const rawUser = localStorage.getItem('usuarioLogueado');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      nombreUsuarioActual = parsed.nombre_completo || parsed.nombre || parsed.username || 'Prefectura';
    }
  } catch {
    nombreUsuarioActual = localStorage.getItem('usuarioLogueado') || 'Prefectura';
  }

  // Fecha y hora formateada estilo México (DD/MM/YYYY HH:MM:SS)
  const dNow = new Date();
  const padN = (n) => String(n).padStart(2, '0');
  const fechaHoraImpresion = `${padN(dNow.getDate())}/${padN(dNow.getMonth() + 1)}/${dNow.getFullYear()} ${padN(dNow.getHours())}:${padN(dNow.getMinutes())}:${padN(dNow.getSeconds())}`;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 print:max-w-none print:w-full print:m-0 print:p-0 print:space-y-0 print:pb-0">
      {/* =========================================================================
          ENCABEZADO PRINCIPAL (Estilo Corporativo SIPREF ULA - Oculto al imprimir)
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1c355e] via-[#244275] to-[#1c355e] p-6 sm:p-8 text-white shadow-xl border border-white/10 print:hidden">
        {/* Adorno sutil de fondo */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#fdbb11]/10 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Título e ícono institucional */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#fdbb11]/20 border border-[#fdbb11]/30 flex items-center justify-center text-[#fdbb11] shrink-0">
                <span className="material-symbols-outlined text-2xl">assignment_late</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Relación de Incidencias Docentes
              </h1>
            </div>

            {/* Descripción y Pill de Período Activo */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs sm:text-sm text-slate-300 font-normal">
              <span>Control, auditoría y reporte periódico de faltas, retardos y salidas anticipadas.</span>
              {fechaInicio && fechaFin ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#fdbb11]/15 text-[#fdbb11] font-semibold text-xs border border-[#fdbb11]/30 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-[15px]">date_range</span>
                  Período: {fechaInicio} al {fechaFin}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/10 text-slate-300 text-xs border border-white/10">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  Historial general completo
                </span>
              )}
            </div>
          </div>

          {/* Botones de acción superior con microinteracciones */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 print:hidden">
            <button
              onClick={abrirModalCrear}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#fdbb11] to-[#e8a906] hover:from-[#fec738] hover:to-[#f0b518] text-[#1c355e] font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span>Nueva Incidencia</span>
            </button>

            <button
              onClick={descargarExcel}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all duration-200"
              title="Descargar reporte oficial en formato Microsoft Excel (.xlsx)"
            >
              <span className="material-symbols-outlined text-[20px]">table_view</span>
              <span>Excel</span>
            </button>

            <button
              onClick={abrirModalEmail}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all duration-200"
              title="Enviar reporte de incidencias por correo electrónico"
            >
              <span className="material-symbols-outlined text-[20px]">mail</span>
              <span>Correo</span>
            </button>

            <button
              onClick={imprimirReporte}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-all duration-200"
              title="Imprimir reporte oficial en formato carta horizontal"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TARJETAS DE MÉTRICAS (KPIs DEL PERÍODO - Estilo Institucional ULA)
      ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 print:hidden">
        {/* KPI 1: Total incidencias */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Registros
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1c355e] tracking-tight mt-1">
                {resumen.total_incidencias}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-slate-400">person</span>
            <span className="text-[11px] text-slate-500 font-medium">{resumen.docentes_afectados} docentes involucrados</span>
          </div>
        </div>

        {/* KPI 2: Faltas (Horas) */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Faltas
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1c355e] tracking-tight mt-1">
                {resumen.total_faltas}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">cancel</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-[#fdbb11]">alarm_off</span>
            <span className="text-[11px] text-slate-500 font-medium">{resumen.total_horas_falta} hrs acumuladas</span>
          </div>
        </div>

        {/* KPI 3: Retardos */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Retardos
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1c355e] tracking-tight mt-1">
                {resumen.total_retardos}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">schedule</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-[#fdbb11]">timelapse</span>
            <span className="text-[11px] text-slate-500 font-medium">Llegadas tardías</span>
          </div>
        </div>

        {/* KPI 4: Salidas Anticipadas */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Salidas Anticipadas
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1c355e] tracking-tight mt-1">
                {resumen.total_salidas_anticipadas}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">logout</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-[#fdbb11]">exit_to_app</span>
            <span className="text-[11px] text-slate-500 font-medium">Antes de concluir clase</span>
          </div>
        </div>

        {/* KPI 5: Docentes Únicos */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Docentes Únicos
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#1c355e] tracking-tight mt-1">
                {resumen.docentes_afectados}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#1c355e]/10 text-[#1c355e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px] text-[#fdbb11]">badge</span>
            <span className="text-[11px] text-slate-500 font-medium">Con alguna incidencia</span>
          </div>
        </div>
      </div>


      {/* =========================================================================
          BARRA DE CONTROL: SELECTOR DE PERÍODOS Y FILTROS
      ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/80 space-y-4 print:hidden">
        {/* Accesos rápidos de período */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período de Reporte:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => aplicarPeriodoRapido('quincena_actual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  periodoActivo === 'quincena_actual'
                    ? 'bg-white text-[#1c355e] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Esta Quincena
              </button>
              <button
                type="button"
                onClick={() => aplicarPeriodoRapido('mes_actual')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  periodoActivo === 'mes_actual'
                    ? 'bg-white text-[#1c355e] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Actual
              </button>

              <button
                type="button"
                onClick={() => aplicarPeriodoRapido('todo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  periodoActivo === 'todo'
                    ? 'bg-white text-[#1c355e] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo el Historial
              </button>
            </div>
          </div>

          {(fechaInicio || fechaFin || filtroLicenciatura || filtroTipo || filtroBusqueda) && (
            <button
              onClick={() => {
                setFechaInicio('');
                setFechaFin('');
                setFiltroLicenciatura('');
                setFiltroTipo('');
                setFiltroBusqueda('');
                setFiltroDocente('');
                setPeriodoActivo('todo');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
              Limpiar todos los filtros
            </button>
          )}
        </div>

        {/* Controles de filtros en fila */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Rango de fechas */}
          <div className="lg:col-span-4 flex items-center gap-2">
            <div className="w-1/2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Desde:
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => {
                  setFechaInicio(e.target.value);
                  setPeriodoActivo('personalizado');
                }}
                className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none"
              />
            </div>
            <div className="w-1/2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Hasta:
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => {
                  setFechaFin(e.target.value);
                  setPeriodoActivo('personalizado');
                }}
                className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none"
              />
            </div>
          </div>

          {/* Filtro Licenciatura */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Licenciatura:
            </label>
            <select
              value={filtroLicenciatura}
              onChange={(e) => setFiltroLicenciatura(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none"
            >
              <option value="">Todas las licenciaturas</option>
              {LICENCIATURAS_DISPONIBLES.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} - {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Incidencia */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tipo:
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="falta">Faltas</option>
              <option value="retardo">Retardos</option>
              <option value="salida_anticipada">Salidas anticipadas</option>
            </select>
          </div>

          {/* Búsqueda por texto libre */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Buscar docente u observación:
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="text"
                placeholder="Nombre, motivo..."
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
                className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TABLA DE INCIDENCIAS (PANTALLA - Oculta en impresión)
      ========================================================================= */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Nivel 1 de encabezado */}
              <tr className="bg-[#1c355e] text-white text-[11px] uppercase tracking-wider font-bold">
                <th rowSpan={2} className="py-3 px-4 border-r border-[#244275] text-center w-28">
                  Fecha
                </th>
                <th rowSpan={2} className="py-3 px-4 border-r border-[#244275] min-w-[220px]">
                  Nombre del Docente
                </th>
                <th colSpan={3} className="py-2 px-3 border-b border-r border-[#244275] text-center bg-[#244275]">
                  INCIDENCIAS
                </th>
                <th rowSpan={2} className="py-3 px-3 border-r border-[#244275] text-center w-28">
                  Licenciatura
                </th>
                <th rowSpan={2} className="py-3 px-3 border-r border-[#244275] text-center w-24">
                  Grado - Grupo
                </th>
                <th rowSpan={2} className="py-3 px-4 min-w-[260px]">
                  Observaciones
                </th>
                <th rowSpan={2} className="py-3 px-3 text-center w-24 print:hidden">
                  Acciones
                </th>
              </tr>

              {/* Nivel 2 de sub-encabezado para Incidencias */}
              <tr className="bg-[#244275] text-white text-[10px] uppercase font-bold">
                <th className="py-2 px-3 text-center border-r border-[#30538f] bg-red-950/40 text-red-200 w-24">
                  Falta (horas)
                </th>
                <th className="py-2 px-3 text-center border-r border-[#30538f] bg-amber-950/40 text-amber-200 w-28">
                  Retardo
                </th>
                <th className="py-2 px-3 text-center border-r border-[#30538f] bg-orange-950/40 text-orange-200 w-32">
                  Salida anticipada
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {cargando ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl animate-spin text-[#1c355e] mb-2 block">
                      sync
                    </span>
                    <p className="text-sm font-semibold">Cargando reporte de incidencias...</p>
                  </td>
                </tr>
              ) : incidencias.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="w-16 h-16 bg-blue-50 text-[#1c355e] rounded-full flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-3xl">task_alt</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800">No hay incidencias registradas</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        No se encontraron incidencias docentes para el período o los filtros seleccionados.
                      </p>
                      <button
                        onClick={abrirModalCrear}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1c355e] text-white font-semibold rounded-xl text-xs hover:bg-[#244275] transition-all"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Registrar Primera Incidencia
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                incidencias.map((inc, idx) => {
                  const tieneFalta = inc.falta_horas && inc.falta_horas.trim().length > 0;
                  const tieneRetardo = inc.retardo && inc.retardo.trim().length > 0;
                  const tieneSalida = inc.salida_anticipada && inc.salida_anticipada.trim().length > 0;

                  return (
                    <tr
                      key={inc.id || idx}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Fecha */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-center whitespace-nowrap">
                        {inc.fecha}
                      </td>

                      {/* Nombre */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 print:hidden">
                            {inc.docente_nombre.charAt(0)}
                          </div>
                          <span>{inc.docente_nombre}</span>
                        </div>
                      </td>

                      {/* Falta (horas) */}
                      <td className="py-3 px-3 text-center border-l border-r border-slate-100 font-bold">
                        {tieneFalta ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            {inc.falta_horas} {isNaN(inc.falta_horas) ? '' : Number(inc.falta_horas) === 1 ? 'hr' : 'hrs'}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Retardo */}
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-bold">
                        {tieneRetardo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {inc.retardo}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Salida anticipada */}
                      <td className="py-3 px-3 text-center border-r border-slate-100 font-bold">
                        {tieneSalida ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs">
                            <span className="material-symbols-outlined text-[14px]">logout</span>
                            {inc.salida_anticipada}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Licenciatura */}
                      <td className="py-3 px-3 text-center font-bold">
                        {inc.licenciatura ? (
                          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-mono border border-slate-200">
                            {inc.licenciatura}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Grado - Grupo */}
                      <td className="py-3 px-3 text-center font-medium text-slate-700">
                        {inc.grado_grupo || '—'}
                      </td>

                      {/* Observaciones */}
                      <td className="py-3 px-4 text-slate-600 text-xs leading-relaxed">
                        {inc.observaciones ? (
                          <span>{inc.observaciones}</span>
                        ) : (
                          <span className="text-slate-300 italic">Sin observaciones</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center whitespace-nowrap print:hidden">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => abrirModalEditar(inc)}
                            className="p-1.5 text-slate-500 hover:text-[#1c355e] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar incidencia"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => confirmarEliminar(inc)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar incidencia"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Fila de Totales al pie de la tabla */}
            {incidencias.length > 0 && (
              <tfoot className="bg-slate-100 text-xs font-bold text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="py-3.5 px-4 text-right uppercase tracking-wider text-[#1c355e]">
                    Total del período ({incidencias.length} registros):
                  </td>
                  <td className="py-3.5 px-3 text-center text-red-700 font-extrabold border-l border-r border-slate-200">
                    {resumen.total_horas_falta > 0 ? `${resumen.total_horas_falta} hrs` : '0 hrs'}
                  </td>
                  <td className="py-3.5 px-3 text-center text-amber-700 font-extrabold border-r border-slate-200">
                    {resumen.total_retardos > 0 ? `${resumen.total_retardos} ret.` : '0'}
                  </td>
                  <td className="py-3.5 px-3 text-center text-orange-700 font-extrabold border-r border-slate-200">
                    {resumen.total_salidas_anticipadas > 0 ? `${resumen.total_salidas_anticipadas} sal.` : '0'}
                  </td>
                  <td colSpan={4} className="py-3.5 px-4 text-slate-500 text-xs font-normal">
                    Reporte auditado por Prefectura SIPREF
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      </div>

      {/* =========================================================================
          FORMATO INSTITUCIONAL EXCLUSIVO PARA IMPRESIÓN OFICIAL (IDÉNTICO A PDF)
      ========================================================================= */}
      <div className="hidden print:block w-full text-slate-800" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        {/* Encabezado con Logo y Metadatos en una sola fila */}
        <div className="flex items-center gap-3 pb-2">
          <img src={logo} alt="Universidad Latino" className="w-12 h-12 object-contain shrink-0" />
          <div className="flex-1">
            <h1 className="text-[15px] font-black uppercase text-[#1c355e] leading-tight m-0 tracking-tight">
              UNIVERSIDAD LATINO
            </h1>
            <h2 className="text-[11px] font-black uppercase text-[#1c355e] leading-tight mt-0.5 m-0 tracking-normal">
              RELACIÓN DE INCIDENCIAS DOCENTES
            </h2>
            <p className="text-[8.5px] text-[#64748b] leading-tight mt-1 m-0">
              <span className="font-bold text-[#334155]">Periodo:</span> {fechaInicio && fechaFin ? `Del ${fechaInicio} al ${fechaFin}` : fechaInicio ? `A partir del ${fechaInicio}` : fechaFin ? `Hasta el ${fechaFin}` : 'Corte General Completo'}
              {filtroLicenciatura ? ` | Licenciatura: ${filtroLicenciatura}` : ''}
              {filtroTipo ? ` | Tipo: ${filtroTipo}` : ''}
              {filtroDocente ? ` | Docente: ${filtroDocente}` : ''}
              {' | '}
              <span className="font-bold text-[#334155]">Generado por:</span> {nombreUsuarioActual}
              {' | '}
              <span className="font-bold text-[#334155]">Fecha y hora:</span> {fechaHoraImpresion}
              {' | '}
              <span className="font-bold text-[#334155]">Total registros:</span> {incidencias.length}
            </p>
          </div>
        </div>

        {/* Barra Resumen / KPIs (5 columnas fondo #f1f5f9) */}
        <div className="grid grid-cols-5 text-center text-[8.5px] bg-[#f1f5f9] border border-[#cbd5e1] divide-x divide-[#e2e8f0] py-1 mt-1 mb-2 font-bold text-[#1c355e] print-exact">
          <div>Faltas: {resumen.total_faltas} ({resumen.total_horas_falta} hrs)</div>
          <div>Retardos: {resumen.total_retardos}</div>
          <div>Salidas Anticipadas: {resumen.total_salidas_anticipadas}</div>
          <div>Docentes involucrados: {resumen.docentes_afectados}</div>
          <div>Total incidencias: {incidencias.length}</div>
        </div>

        {/* Tabla de Incidencias estilo PDF ReportLab */}
        <table className="w-full text-left border-collapse border border-[#94a3b8] text-[8px]" style={{ width: '100%' }}>
          <thead>
            <tr className="bg-[#1c355e] text-white font-bold text-center print-exact">
              <th rowSpan={2} className="py-1 px-1.5 border border-[#94a3b8] w-[70px] text-center align-middle">
                Fecha
              </th>
              <th rowSpan={2} className="py-1 px-2 border border-[#94a3b8] text-left align-middle" style={{ width: '170px' }}>
                Nombre del Docente
              </th>
              <th colSpan={3} className="py-0.5 px-1 border border-[#94a3b8] text-center bg-[#1c355e]">
                INCIDENCIAS
              </th>
              <th rowSpan={2} className="py-1 px-1 border border-[#94a3b8] w-[80px] text-center align-middle">
                Licenciatura
              </th>
              <th rowSpan={2} className="py-1 px-1 border border-[#94a3b8] w-[70px] text-center align-middle">
                Grado - Gpo
              </th>
              <th rowSpan={2} className="py-1 px-2 border border-[#94a3b8] text-left align-middle">
                Observaciones
              </th>
            </tr>
            <tr className="bg-[#244275] sub-header-print font-bold text-center print-exact">
              <th className="py-0.5 px-1 border border-[#94a3b8] sub-header-print w-[55px] text-[#fca5a5] text-center">
                Falta (h)
              </th>
              <th className="py-0.5 px-1 border border-[#94a3b8] sub-header-print w-[55px] text-[#fde68a] text-center">
                Retardo
              </th>
              <th className="py-0.5 px-1 border border-[#94a3b8] sub-header-print w-[60px] text-[#fed7aa] text-center">
                Salida ant.
              </th>
            </tr>
          </thead>
          <tbody>
            {incidencias.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-slate-500 italic border border-[#cbd5e1]">
                  No hay incidencias registradas en este período
                </td>
              </tr>
            ) : (
              incidencias.map((inc, idx) => {
                const tieneFalta = inc.falta_horas && inc.falta_horas.trim().length > 0;
                const tieneRetardo = inc.retardo && inc.retardo.trim().length > 0;
                const tieneSalida = inc.salida_anticipada && inc.salida_anticipada.trim().length > 0;

                let textoFalta = '-';
                if (tieneFalta) {
                  const fStr = inc.falta_horas.trim();
                  textoFalta = fStr.toLowerCase().includes('hr') ? fStr : `${fStr} hrs`;
                }

                let textoRet = '-';
                if (tieneRetardo) {
                  const rStr = inc.retardo.trim();
                  textoRet = rStr.toLowerCase().includes('min') ? rStr : `${rStr} min.`;
                }

                let textoSal = '-';
                if (tieneSalida) {
                  const sStr = inc.salida_anticipada.trim();
                  textoSal = sStr.toLowerCase().includes('min') ? sStr : `${sStr} min.`;
                }

                return (
                  <tr
                    key={`print-${inc.id || idx}`}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc] print-exact'}
                  >
                    <td className="py-1 px-1.5 text-center border border-[#cbd5e1] font-mono text-slate-700 whitespace-nowrap">
                      {inc.fecha}
                    </td>
                    <td className="py-1 px-2 text-left border border-[#cbd5e1] font-bold text-slate-900">
                      {inc.docente_nombre}
                    </td>
                    <td className={`py-1 px-1 text-center border border-[#cbd5e1] ${tieneFalta ? 'font-bold text-[#b91c1c]' : 'text-slate-400'}`}>
                      {textoFalta}
                    </td>
                    <td className={`py-1 px-1 text-center border border-[#cbd5e1] ${tieneRetardo ? 'font-bold text-[#b45309]' : 'text-slate-400'}`}>
                      {textoRet}
                    </td>
                    <td className={`py-1 px-1 text-center border border-[#cbd5e1] ${tieneSalida ? 'font-bold text-[#c2410c]' : 'text-slate-400'}`}>
                      {textoSal}
                    </td>
                    <td className="py-1 px-1 text-center border border-[#cbd5e1] text-slate-700">
                      {inc.licenciatura || '-'}
                    </td>
                    <td className="py-1 px-1 text-center border border-[#cbd5e1] text-slate-700">
                      {inc.grado_grupo || '-'}
                    </td>
                    <td className="py-1 px-2 text-left border border-[#cbd5e1] text-slate-700">
                      {inc.observaciones || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {incidencias.length > 0 && (
            <tfoot>
              <tr className="bg-[#ebf2fa] font-bold border-t-2 border-[#94a3b8] print-exact">
                <td className="py-1 px-1.5 border border-[#94a3b8]"></td>
                <td className="py-1 px-2 text-right border border-[#94a3b8] uppercase text-[#1c355e]">
                  TOTALES:
                </td>
                <td className="py-1 px-1 text-center border border-[#94a3b8] text-[#b91c1c]">
                  {resumen.total_horas_falta > 0 ? `${resumen.total_horas_falta} hrs` : '-'}
                </td>
                <td className="py-1 px-1 text-center border border-[#94a3b8] text-[#b45309]">
                  {resumen.total_retardos > 0 ? `${resumen.total_retardos} ret.` : '-'}
                </td>
                <td className="py-1 px-1 text-center border border-[#94a3b8] text-[#c2410c]">
                  {resumen.total_salidas_anticipadas > 0 ? `${resumen.total_salidas_anticipadas} sal.` : '-'}
                </td>
                <td className="py-1 px-1 border border-[#94a3b8]"></td>
                <td className="py-1 px-1 border border-[#94a3b8]"></td>
                <td className="py-1 px-2 border border-[#94a3b8]"></td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Firma de Prefectura (Centrada) */}
        <div className="pt-10 pb-4 text-center" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <div className="w-56 mx-auto">
            <div className="w-48 mx-auto border-b border-slate-700 mb-1.5"></div>
            <p className="font-bold text-slate-900 uppercase text-[9px] m-0">Prefectura de Turno</p>
            <p className="text-slate-500 text-[8px] m-0">Elaboró / Reportó</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL PARA REGISTRAR / EDITAR INCIDENCIA
      ========================================================================= */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-slate-100 flex flex-col">
            {/* Encabezado del modal */}
            <div className="bg-gradient-to-r from-[#1c355e] to-[#244275] p-5 sm:p-6 text-white flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#fdbb11]/20 rounded-xl text-[#fdbb11]">
                  <span className="material-symbols-outlined text-2xl">
                    {modoEdicion ? 'edit_note' : 'add_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {modoEdicion ? 'Editar Incidencia Docente' : 'Registrar Incidencia Docente'}
                  </h3>
                  <p className="text-xs text-slate-300">Prefectura Universidad Latino</p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={guardarIncidencia} className="p-5 sm:p-6 space-y-4 text-xs">
              {/* Fecha y Docente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Fecha de Incidencia <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formulario.fecha}
                    onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none font-medium text-slate-800"
                  />
                </div>

                <div className="relative" ref={sugerenciasRef}>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Nombre del Docente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Buscar o escribir nombre completo..."
                    value={formulario.docente_nombre}
                    onChange={(e) => {
                      setFormulario({ ...formulario, docente_nombre: e.target.value });
                      setMostrarSugerenciasDocente(true);
                    }}
                    onFocus={() => setMostrarSugerenciasDocente(true)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none font-medium text-slate-800"
                  />

                  {/* Sugerencias desplegables */}
                  {mostrarSugerenciasDocente && docentesFiltrados.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {docentesFiltrados.map((nom, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setFormulario({ ...formulario, docente_nombre: nom });
                            setMostrarSugerenciasDocente(false);
                          }}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer font-medium text-slate-700 text-xs flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm text-[#1c355e]">person</span>
                          <span>{nom}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selector de Tipo de Incidencia */}
              <div>
                <label className="block text-slate-700 font-bold mb-2 uppercase tracking-wider text-[11px]">
                  Tipo de Incidencia
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormulario({ ...formulario, tipo_incidencia: 'falta', falta_horas: formulario.falta_horas || '2', retardo: '', salida_anticipada: '' })}
                    className={`py-2.5 px-3 rounded-2xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition-all ${
                      formulario.tipo_incidencia === 'falta'
                        ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                    <span>Falta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormulario({ ...formulario, tipo_incidencia: 'retardo', falta_horas: '', retardo: formulario.retardo || '30min.', salida_anticipada: '' })}
                    className={`py-2.5 px-3 rounded-2xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition-all ${
                      formulario.tipo_incidencia === 'retardo'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                    <span>Retardo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormulario({ ...formulario, tipo_incidencia: 'salida_anticipada', falta_horas: '', retardo: '', salida_anticipada: formulario.salida_anticipada || '30min.' })}
                    className={`py-2.5 px-3 rounded-2xl font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition-all ${
                      formulario.tipo_incidencia === 'salida_anticipada'
                        ? 'bg-orange-50 border-orange-500 text-orange-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Salida Anticipada</span>
                  </button>
                </div>
              </div>

              {/* Campos dinámicos según el tipo de incidencia */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                {formulario.tipo_incidencia === 'falta' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                      Horas de Falta:
                    </label>
                    <div className="flex items-center gap-2">
                      {['1', '2', '3', '4', '5'].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setFormulario({ ...formulario, falta_horas: h })}
                          className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                            formulario.falta_horas === h
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-white border border-slate-300 text-slate-700 hover:border-red-400'
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                      <input
                        type="text"
                        placeholder="Otras horas..."
                        value={formulario.falta_horas}
                        onChange={(e) => setFormulario({ ...formulario, falta_horas: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                )}

                {formulario.tipo_incidencia === 'retardo' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                      Tiempo de Retardo:
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['15min.', '30min.', '45min.', '60min.', '1hra. 30min.'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setFormulario({ ...formulario, retardo: r })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            formulario.retardo === r
                              ? 'bg-amber-500 text-white border-amber-600'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Ej. 15min., 60min., 1hra. 30min."
                      value={formulario.retardo}
                      onChange={(e) => setFormulario({ ...formulario, retardo: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {formulario.tipo_incidencia === 'salida_anticipada' && (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                      Tiempo antes de concluir clase:
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['20min.', '35min.', '45min.', '1hra.', '2hrs.'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormulario({ ...formulario, salida_anticipada: s })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            formulario.salida_anticipada === s
                              ? 'bg-orange-500 text-white border-orange-600'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Ej. 35min., 1hra., 2hrs."
                      value={formulario.salida_anticipada}
                      onChange={(e) => setFormulario({ ...formulario, salida_anticipada: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Licenciatura y Grado-Grupo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Licenciatura / Depto.
                  </label>
                  <select
                    value={formulario.licenciatura}
                    onChange={(e) => setFormulario({ ...formulario, licenciatura: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none font-medium text-slate-800"
                  >
                    <option value="">Seleccionar carrera...</option>
                    {LICENCIATURAS_DISPONIBLES.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.codigo} - {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Grado - Grupo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 4º, 2º, 6° A, 8º"
                    value={formulario.grado_grupo}
                    onChange={(e) => setFormulario({ ...formulario, grado_grupo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    Observaciones de Prefectura
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setFormulario({ ...formulario, observaciones: 'No asistió a impartir clase.' })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-600"
                    >
                      + No asistió
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormulario({ ...formulario, observaciones: 'Inasistencia sin avisar con anticipación.' })}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-600"
                    >
                      + Sin avisar
                    </button>
                  </div>
                </div>
                <textarea
                  rows={3}
                  placeholder="Detalles sobre lo ocurrido, justificación reportada, hora de ingreso o retiro..."
                  value={formulario.observaciones}
                  onChange={(e) => setFormulario({ ...formulario, observaciones: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-[#1c355e] focus:outline-none font-normal text-slate-800 leading-relaxed"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#1c355e] to-[#244275] hover:from-[#172d50] hover:to-[#1e3863] text-white rounded-xl font-bold shadow-lg shadow-[#1c355e]/20 transition-all disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>{modoEdicion ? 'Guardar Cambios' : 'Registrar Incidencia'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =========================================================================
          MODAL PARA ENVIAR REPORTE POR CORREO ELECTRÓNICO
      ========================================================================= */}
      {modalEmailAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-slate-100 flex flex-col">
            {/* Encabezado del modal */}
            <div className="bg-gradient-to-r from-[#1c355e] to-[#244275] p-5 sm:p-6 text-white flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-500/20 rounded-xl text-sky-300">
                  <span className="material-symbols-outlined text-2xl">mail</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Enviar Reporte por Correo</h3>
                  <p className="text-xs text-slate-300">Relación de Incidencias Docentes ULA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEmailAbierto(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleEnviarEmail} className="p-5 sm:p-6 space-y-4">
              {/* Tarjeta de alcance del reporte */}
              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-bold text-[#1c355e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-600">assessment</span>
                    Alcance del reporte a enviar:
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {fechaInicio && fechaFin ? `Período: ${fechaInicio} al ${fechaFin}` : 'Corte general completo'}
                    {filtroDocente ? ` • Docente: ${filtroDocente}` : ''}
                    {filtroLicenciatura ? ` • Carrera: ${filtroLicenciatura}` : ''}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-bold text-[11px] whitespace-nowrap">
                  {incidencias.length} {incidencias.length === 1 ? 'incidencia' : 'incidencias'}
                </span>
              </div>

              {/* Destinatarios */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Destinatario(s) *
                  </label>
                  {usuariosRegistrados.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMostrarSugerenciasEmails(!mostrarSugerenciasEmails)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      {mostrarSugerenciasEmails ? 'Ocultar usuarios' : `Ver registrados (${usuariosRegistrados.length})`}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="ejemplo@universidadlatino.edu.mx, otro@correo.com"
                  value={formEmail.destinatarios}
                  onFocus={() => setCampoDestinoEmail('destinatarios')}
                  onChange={(e) => setFormEmail({ ...formEmail, destinatarios: e.target.value })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-800 outline-none transition-all ${
                    campoDestinoEmail === 'destinatarios'
                      ? 'border-[#1c355e] ring-2 ring-[#1c355e]/20 bg-white'
                      : 'border-slate-300'
                  }`}
                />
                {renderBadgesCampoEmail('destinatarios', formEmail.destinatarios)}

                {/* Chips de usuarios registrados */}
                {mostrarSugerenciasEmails && usuariosRegistrados.length > 0 && (
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-blue-600">verified_user</span>
                      Seleccionar destinatario rápido:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                      {usuariosRegistrados.map((user) => {
                        const correo = user.correo || user.email || '';
                        if (!correo) return null;
                        const listaActual = (formEmail[campoDestinoEmail] || '')
                          .split(',')
                          .map((e) => e.trim());
                        const yaAgregado = listaActual.includes(correo);

                        return (
                          <button
                            key={user.id || correo}
                            type="button"
                            onClick={() => {
                              const actual = formEmail[campoDestinoEmail] || '';
                              if (!yaAgregado) {
                                const nuevo = actual ? `${actual}, ${correo}` : correo;
                                setFormEmail({ ...formEmail, [campoDestinoEmail]: nuevo });
                              }
                            }}
                            className={`px-2 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                              yaAgregado
                                ? 'bg-[#1c355e] text-white border-[#1c355e]'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {yaAgregado ? 'check' : 'add'}
                            </span>
                            {user.nombre || user.nombre_completo || correo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* CC y CCO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    CC (Con Copia)
                  </label>
                  <input
                    type="text"
                    placeholder="copia@universidadlatino.edu.mx"
                    value={formEmail.cc}
                    onFocus={() => setCampoDestinoEmail('cc')}
                    onChange={(e) => setFormEmail({ ...formEmail, cc: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-800 outline-none transition-all ${
                      campoDestinoEmail === 'cc'
                        ? 'border-[#1c355e] ring-2 ring-[#1c355e]/20 bg-white'
                        : 'border-slate-300'
                    }`}
                  />
                  {renderBadgesCampoEmail('cc', formEmail.cc)}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    CCO (Copia Oculta)
                  </label>
                  <input
                    type="text"
                    placeholder="oculta@universidadlatino.edu.mx"
                    value={formEmail.cco}
                    onFocus={() => setCampoDestinoEmail('cco')}
                    onChange={(e) => setFormEmail({ ...formEmail, cco: e.target.value })}
                    className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-800 outline-none transition-all ${
                      campoDestinoEmail === 'cco'
                        ? 'border-[#1c355e] ring-2 ring-[#1c355e]/20 bg-white'
                        : 'border-slate-300'
                    }`}
                  />
                  {renderBadgesCampoEmail('cco', formEmail.cco)}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Asunto del Correo *
                </label>
                <input
                  type="text"
                  required
                  value={formEmail.asunto}
                  onChange={(e) => setFormEmail({ ...formEmail, asunto: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1c355e] focus:ring-2 focus:ring-[#1c355e]/20 font-medium"
                />
              </div>

              {/* Mensaje / Observación personalizada */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Mensaje o Nota Adicional (Opcional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Escribe un mensaje explicativo para los destinatarios..."
                  value={formEmail.mensaje}
                  onChange={(e) => setFormEmail({ ...formEmail, mensaje: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-[#1c355e] focus:ring-2 focus:ring-[#1c355e]/20"
                ></textarea>
              </div>

              {/* Formatos a adjuntar */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-500">attach_file</span>
                  Formatos a Adjuntar:
                </span>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formEmail.adjuntar_excel}
                      onChange={(e) =>
                        setFormEmail({ ...formEmail, adjuntar_excel: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">table_view</span>
                      Excel (.xlsx)
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formEmail.adjuntar_pdf}
                      onChange={(e) =>
                        setFormEmail({ ...formEmail, adjuntar_pdf: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-red-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                      PDF Oficial
                    </span>
                  </label>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEmailAbierto(false)}
                  disabled={enviandoEmail}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={enviandoEmail}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1c355e] hover:bg-[#244275] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  {enviandoEmail ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      <span>Enviar Reporte</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}