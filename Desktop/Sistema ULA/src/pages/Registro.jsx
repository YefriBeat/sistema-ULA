import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../components/logo.png';
import { useToast, ToastContainer } from '../components/useToast';

export default function Registro() {
  const navigate = useNavigate();
  const { toast, toasts } = useToast();

  const [paso, setPaso] = useState('formulario'); // 'formulario' | 'verificacion'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [turno, setTurno] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Estado para la verificación OTP
  const [codigoOtp, setCodigoOtp] = useState('');
  const [cargandoVerificacion, setCargandoVerificacion] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const isTypingConfirm = confirmPassword.length > 0;
  const isValidEmail = email.trim().length > 0 && email.trim().toLowerCase().endsWith('universidadlatino.edu.mx');

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value.trim().length > 0 && !value.trim().toLowerCase().endsWith('universidadlatino.edu.mx')) {
      setEmailError('El correo debe terminar con universidadlatino.edu.mx');
    } else {
      setEmailError('');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!isValidEmail) {
      toast("El correo debe pertenecer a universidadlatino.edu.mx", "advertencia");
      return;
    }
    if (!passwordsMatch) {
      toast("Las contraseñas no coinciden.", "advertencia");
      return;
    }

    setCargando(true);
    try {
      const response = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: fullName.trim(),
          correo: email.trim().toLowerCase(),
          turno,
          password
        })
      });
      const data = await response.json();
      if (response.ok) {
        if (data.requiere_verificacion) {
          toast(data.message || "Código enviado a tu correo.", "exito");
          setPaso('verificacion');
          setCooldown(60);
        } else {
          toast("¡Cuenta creada! Ya puedes iniciar sesión.", "exito");
          setTimeout(() => navigate('/login'), 1500);
        }
      } else {
        toast(data.detail || "No se pudo registrar la cuenta.", "error");
      }
    } catch {
      toast("Error de conexión con el servidor.", "error");
    } finally {
      setCargando(false);
    }
  };

  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    if (!codigoOtp.trim()) {
      toast("Ingresa el código de 6 dígitos.", "advertencia");
      return;
    }

    setCargandoVerificacion(true);
    try {
      const response = await fetch('/api/verificar-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: email.trim().toLowerCase(),
          codigo: codigoOtp.trim()
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast("¡Correo verificado con éxito! Ya puedes iniciar sesión.", "exito");
        setTimeout(() => navigate('/login'), 1800);
      } else {
        toast(data.detail || "El código ingresado es incorrecto.", "error");
      }
    } catch {
      toast("Error de conexión al verificar el código.", "error");
    } finally {
      setCargandoVerificacion(false);
    }
  };

  const handleReenviarCodigo = async () => {
    if (cooldown > 0) return;
    try {
      const response = await fetch('/api/reenviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email.trim().toLowerCase() })
      });
      const data = await response.json();
      if (response.ok) {
        toast("Nuevo código enviado a tu correo.", "exito");
        setCooldown(60);
      } else {
        toast(data.detail || "No se pudo reenviar el código.", "error");
      }
    } catch {
      toast("Error de conexión al reenviar código.", "error");
    }
  };

  const isButtonDisabled = !passwordsMatch || !isValidEmail || emailError.length > 0;

  return (
    <div className="bg-[#f9fafb] min-h-screen flex flex-col items-center justify-center p-6 font-manrope">
      <main className="w-full max-w-md bg-white rounded-2xl shadow-[0_4px_25px_-4px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100">

        {/* LOGO Y ENCABEZADO */}
        <div className="px-8 pt-8 pb-5 text-center flex flex-col items-center">
          <img src={logo} alt="Logo" className="h-20 w-auto object-contain mb-2" />
          <h2 className="text-[13px] font-bold text-[#44464e] tracking-widest uppercase">SIPREF</h2>
          <h1 className="text-[26px] font-black text-[#1c355e] tracking-tight leading-[1.2] mt-1">
            {paso === 'formulario' ? 'REGISTRO DE PERSONAL' : 'VERIFICAR CORREO'}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {paso === 'formulario'
              ? 'Crea tu cuenta institucional SIPREF'
              : 'Paso de seguridad para validar tu cuenta'}
          </p>
        </div>

        {/* PASO 1: FORMULARIO DE REGISTRO */}
        {paso === 'formulario' && (
          <form className="px-8 pb-8 space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Nombre Completo</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">person</span>
                <input
                  className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:ring-2 focus:ring-[#1c355e] outline-none text-sm font-semibold"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Lic. Carlos Gómez"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Correo Institucional</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">mail</span>
                <input
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:outline-none text-sm font-semibold ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-[#c5c6cf] focus:ring-[#1c355e]'}`}
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="ejemplo@universidadlatino.edu.mx"
                  required
                />
              </div>
              {emailError && (
                <p className="text-[12px] font-medium text-red-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">close</span>{emailError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Seleccionar Turno</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">manage_accounts</span>
                <select
                  className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:ring-2 focus:ring-[#1c355e] outline-none appearance-none cursor-pointer bg-white text-sm font-semibold text-slate-700"
                  value={turno}
                  onChange={(e) => setTurno(e.target.value)}
                  required
                >
                  <option value="" disabled>Selecciona un turno</option>
                  <option value="matutino">Turno Matutino</option>
                  <option value="vespertino">Turno Vespertino</option>
                  <option value="ambos">Ambos Turnos</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#75777f] pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Contraseña</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">lock</span>
                <input
                  className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:ring-2 focus:ring-[#1c355e] outline-none text-sm font-semibold"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Confirmar Contraseña</label>
              <div className="relative group">
                <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 ${isTypingConfirm ? (passwordsMatch ? 'text-green-500' : 'text-red-500') : 'text-[#75777f]'}`}>lock_reset</span>
                <input
                  className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none text-sm font-semibold ${isTypingConfirm ? (passwordsMatch ? 'border-green-500 focus:ring-2' : 'border-red-500 focus:ring-2') : 'border-[#c5c6cf] focus:ring-2 focus:ring-[#1c355e]'}`}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {isTypingConfirm && (
                  <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`}>
                    {passwordsMatch ? 'check_circle' : 'cancel'}
                  </span>
                )}
              </div>
              {isTypingConfirm && (
                <p className={`text-[12px] font-medium flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-[16px]">{passwordsMatch ? 'check' : 'close'}</span>
                  {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </p>
              )}
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isButtonDisabled || cargando}
                className={`w-full text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-all shadow-md ${!isButtonDisabled && !cargando ? 'bg-[#1c355e] hover:bg-[#152a4a] cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                {cargando ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    <span>Enviando código...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    <span>Registrar y Recibir Código</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 text-center">
              <Link to="/login" className="text-sm font-semibold text-[#1c355e] hover:underline">
                ¿Ya tienes cuenta? Inicia sesión aquí
              </Link>
            </div>
          </form>
        )}

        {/* PASO 2: VERIFICACIÓN DEL CÓDIGO OTP */}
        {paso === 'verificacion' && (
          <div className="px-8 pb-8 space-y-5">
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-center space-y-1.5">
              <span className="material-symbols-outlined text-3xl text-amber-600">mark_email_unread</span>
              <p className="text-xs font-semibold text-slate-700">
                Hemos enviado un código numérico de 6 dígitos a:
              </p>
              <p className="text-xs font-black text-[#1c355e] break-all">
                {email}
              </p>
              <p className="text-[11px] text-slate-500">
                Revisa tu bandeja de entrada (o carpeta de spam). El código vence en 15 minutos.
              </p>
            </div>

            <form onSubmit={handleVerificarCodigo} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center">
                  Código de Verificación
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-black tracking-[12px] py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-[#1c355e] focus:ring-4 focus:ring-[#1c355e]/10 outline-none text-[#1c355e] transition-all"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={codigoOtp.length !== 6 || cargandoVerificacion}
                className={`w-full py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all shadow-md ${codigoOtp.length === 6 && !cargandoVerificacion ? 'bg-gradient-to-r from-[#1c355e] to-[#2b4c80] hover:brightness-110 cursor-pointer' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                {cargandoVerificacion ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">verified</span>
                    <span>Activar mi Cuenta</span>
                  </>
                )}
              </button>
            </form>

            {/* ACCIONES SECUNDARIAS: REENVIAR Y CORREGIR */}
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={handleReenviarCodigo}
                disabled={cooldown > 0}
                className={`font-bold flex items-center gap-1 ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-[#1c355e] hover:underline cursor-pointer'}`}
              >
                <span className="material-symbols-outlined text-sm">cached</span>
                {cooldown > 0 ? `Reenviar código en ${cooldown}s` : '¿No recibiste el código? Reenviar'}
              </button>

              <button
                type="button"
                onClick={() => setPaso('formulario')}
                className="text-slate-500 hover:text-slate-700 font-semibold"
              >
                ← Corregir correo o datos
              </button>
            </div>
          </div>
        )}

      </main>

      <footer className="mt-8 text-center w-full max-w-md">
        <p className="text-[12px] text-[#75777f] uppercase tracking-widest font-medium">© 2026 Universidad Latino - SIPREF</p>
      </footer>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
