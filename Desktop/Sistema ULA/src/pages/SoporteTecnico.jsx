import logo from '../components/logo.png';

export default function SoporteTecnico() {
  return (
    <div className="min-h-screen bg-[#faf9fc]">

      {/* ── CABECERA ── */}
      <div style={{ background: 'linear-gradient(135deg, #1c355e 0%, #162c50 100%)' }} className="px-6 py-10 text-white">
        <div className="max-w-2xl mx-auto flex items-center gap-5">
          <img src={logo} alt="Logo Universidad Latino" className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-1">Universidad Latino</p>
            <h1 className="text-2xl font-black">Soporte Técnico</h1>
            <p className="text-sm text-white/70 mt-1">Sistema de Gestión de Prefectura — Versión 2.0</p>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO ── */}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Descripción */}
        <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-[#44464e] leading-relaxed">
            Para cualquier problema técnico, duda o solicitud relacionada con el sistema, comunícate directamente con el desarrollador responsable.
          </p>
        </div>

        {/* Tarjeta de contacto */}
        <div className="bg-white border border-[#c5c6cf]/30 rounded-2xl overflow-hidden shadow-sm">
          {/* Header de la tarjeta */}
          <div style={{ background: 'linear-gradient(135deg, #1c355e 0%, #162c50 100%)' }} className="px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-white text-3xl">person</span>
            </div>
            <div>
              <p className="text-white font-black text-lg leading-tight">Yenri Efren Moo May</p>
              <p className="text-white/70 text-xs font-medium mt-0.5">Ingeniero en Sistemas Computacionales</p>
            </div>
          </div>

          {/* Datos de contacto */}
          <div className="divide-y divide-[#f0f0f4]">
            <a
              href="tel:9997666713"
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#faf9fc] transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#1c355e]/8 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1c355e]/15 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#1c355e]">call</span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#75777f] font-bold">Teléfono</p>
                <p className="text-sm font-bold text-[#1b1c1e] mt-0.5">999 766 6713</p>
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#c5c6cf] ml-auto group-hover:text-[#1c355e] transition-colors">chevron_right</span>
            </a>

            <a
              href="mailto:mooefrendjx@gmail.com"
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#faf9fc] transition-colors group"
            >
              <div className="w-9 h-9 rounded-xl bg-[#1c355e]/8 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1c355e]/15 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-[#1c355e]">mail</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[#75777f] font-bold">Correo electrónico</p>
                <p className="text-sm font-bold text-[#1b1c1e] mt-0.5 truncate">mooefrendjx@gmail.com</p>
              </div>
              <span className="material-symbols-outlined text-[16px] text-[#c5c6cf] ml-auto flex-shrink-0 group-hover:text-[#1c355e] transition-colors">chevron_right</span>
            </a>
          </div>
        </div>

        {/* Nota */}
        <div className="flex gap-2.5 p-3.5 rounded-xl border bg-blue-50 border-blue-200">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 text-blue-700">info</span>
          <p className="text-xs leading-relaxed font-medium text-blue-700">
            El soporte cubre incidencias técnicas del sistema: acceso, errores de carga de datos, comportamiento inesperado y reportes de fallas. Para temas académicos, contacta directamente a la prefectura.
          </p>
        </div>

      </div>
    </div>
  );
}
