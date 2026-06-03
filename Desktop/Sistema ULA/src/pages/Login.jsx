import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../components/logo.png';
import { useToast } from '../components/useToast';

export default function Login() {
  const navigate = useNavigate();
  const { toast, ToastContainer } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cargandoLogin, setCargandoLogin] = useState(false);

  // Estado del modal de recuperación
  const [mostrarModal, setMostrarModal] = useState(false);
  const [pasoRecuperacion, setPasoRecuperacion] = useState('email');
  const [correoRecuperacion, setCorreoRecuperacion] = useState('');
  const [otpRecuperacion, setOtpRecuperacion] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargandoLogin(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: email, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
        navigate('/dashboard');
      } else {
        toast(data.detail || "Credenciales inválidas.", "error");
      }
    } catch (error) {
      toast("Error de conexión con el servidor.", "error");
      console.error(error);
    } finally {
      setCargandoLogin(false);
    }
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setPasoRecuperacion('email');
    setCorreoRecuperacion('');
    setOtpRecuperacion('');
    setNuevaPassword('');
    setConfirmarPassword('');
  };

  const handleEnviarCodigo = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const response = await fetch('/api/recuperar-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correoRecuperacion.trim().toLowerCase() })
      });
      const data = await response.json();
      if (response.ok) {
        setPasoRecuperacion('otp');
      } else {
        toast(data.detail || "No se pudo enviar el código.", "error");
      }
    } catch {
      toast("Error de conexión con el servidor.", "error");
    } finally {
      setCargando(false);
    }
  };

  const handleVerificarOtp = (e) => {
    e.preventDefault();
    if (otpRecuperacion.length !== 6) { toast("El código debe tener 6 dígitos.", "advertencia"); return; }
    setPasoRecuperacion('password');
  };

  const handleRestablecerPassword = async (e) => {
    e.preventDefault();
    if (nuevaPassword !== confirmarPassword) { toast("Las contraseñas no coinciden.", "advertencia"); return; }
    if (nuevaPassword.length < 6) { toast("La contraseña debe tener al menos 6 caracteres.", "advertencia"); return; }

    setCargando(true);
    try {
      const response = await fetch('/api/restablecer-contrasena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: correoRecuperacion.trim().toLowerCase(),
          codigo: otpRecuperacion,
          nueva_password: nuevaPassword
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast("¡Contraseña actualizada! Ya puedes iniciar sesión.", "exito");
        cerrarModal();
      } else {
        toast(data.detail || "No se pudo restablecer la contraseña.", "error");
      }
    } catch {
      toast("Error de conexión con el servidor.", "error");
    } finally {
      setCargando(false);
    }
  };

  const passwordsCoinciden = nuevaPassword.length > 0 && confirmarPassword.length > 0 && nuevaPassword === confirmarPassword;

  return (
    <div className="bg-[#faf9fc] text-[#1b1c1e] min-h-screen flex flex-col items-center justify-center p-6 font-manrope overflow-hidden relative z-0">
      <main className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-[#c5c6cf]/30 shadow-[0_10px_25px_-5px_rgba(0,9,36,0.1),0_8px_10px_-6px_rgba(0,9,36,0.05)]">

          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="Universidad Latino Logo" className="w-40 h-auto mb-6" />
            <h1 className="text-2xl text-[#1c355e] text-center mb-2 tracking-tight font-bold">SISTEMA DE PREFECTURA</h1>
            <p className="text-sm text-[#75777f] text-center">Inicia sesión con tu cuenta institucional</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#44464e] block">Correo Electrónico</label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#75777f] group-focus-within:text-[#1c355e]">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </span>
                <input
                  className="block w-full pl-10 pr-3 py-3 border border-[#c5c6cf] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all"
                  type="email" placeholder="usuario@universidadlatino.edu.mx" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-[#44464e] block">Contraseña</label>
                <button
                  type="button"
                  onClick={() => setMostrarModal(true)}
                  className="text-xs font-medium text-[#1c355e] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#75777f] group-focus-within:text-[#1c355e]">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </span>
                <input
                  className="block w-full pl-10 pr-12 py-3 border border-[#c5c6cf] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all"
                  type={showPassword ? "text" : "password"} placeholder="••••••••" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#75777f] hover:text-[#1c355e]">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={cargandoLogin} className={`w-full text-white text-sm font-semibold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${cargandoLogin ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1c355e] hover:bg-[#1c355e]/90'}`}>
                <span>{cargandoLogin ? 'Iniciando sesión...' : 'Iniciar Sesión'}</span>
                {!cargandoLogin && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
              </button>
            </div>

            <div className="text-center mt-4">
              <p className="text-sm text-[#75777f]">¿No tienes una cuenta? <Link to="/registro" className="text-sm font-semibold text-[#1c355e] hover:underline">Registrar una nueva cuenta</Link></p>
            </div>
          </form>
        </div>
      </main>

      <footer className="mt-8 py-2 w-full max-w-md text-center">
        <p className="text-xs text-[#75777f] opacity-60">© 2026 Universidad Latino</p>
      </footer>

      <ToastContainer />

      {/* ===== MODAL RECUPERAR CONTRASEÑA ===== */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              onClick={cerrarModal}
              className="absolute top-4 right-4 text-[#75777f] hover:text-[#1b1c1e] transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#f0f4ff] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[#1c355e] text-2xl">lock_reset</span>
              </div>
              <h2 className="text-xl font-bold text-[#1c355e]">Recuperar Contraseña</h2>
              <div className="flex items-center gap-2 mt-3">
                {['email', 'otp', 'password'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${pasoRecuperacion === s ? 'bg-[#1c355e] text-white' : ['email', 'otp', 'password'].indexOf(pasoRecuperacion) > i ? 'bg-green-500 text-white' : 'bg-[#e8e8e8] text-[#75777f]'}`}>
                      {['email', 'otp', 'password'].indexOf(pasoRecuperacion) > i
                        ? <span className="material-symbols-outlined text-[14px]">check</span>
                        : i + 1}
                    </div>
                    {i < 2 && <div className={`w-8 h-0.5 ${['email', 'otp', 'password'].indexOf(pasoRecuperacion) > i ? 'bg-green-500' : 'bg-[#e8e8e8]'}`} />}
                  </div>
                ))}
              </div>
            </div>

            {/* PASO 1: Correo */}
            {pasoRecuperacion === 'email' && (
              <form className="space-y-4" onSubmit={handleEnviarCodigo}>
                <p className="text-sm text-[#75777f] text-center">Ingresa tu correo institucional y te enviaremos un código.</p>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#44464e]">Correo Institucional</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[20px]">mail</span>
                    <input
                      className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all"
                      type="email"
                      placeholder="ejemplo@universidadlatino.edu.mx"
                      value={correoRecuperacion}
                      onChange={(e) => setCorreoRecuperacion(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" disabled={cargando} className={`w-full text-white font-semibold py-3 rounded-xl flex justify-center items-center gap-2 transition-all ${!cargando ? 'bg-[#1c355e] hover:bg-[#1c355e]/90' : 'bg-gray-400 cursor-not-allowed'}`}>
                  {cargando ? 'Enviando...' : 'Enviar Código'}
                </button>
              </form>
            )}

            {/* PASO 2: Código OTP */}
            {pasoRecuperacion === 'otp' && (
              <form className="space-y-4" onSubmit={handleVerificarOtp}>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                  <p className="text-[13px] text-[#44464e]">Código enviado a:</p>
                  <p className="text-[13px] font-bold text-[#1c355e] break-all">{correoRecuperacion}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#44464e]">Código de Verificación</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[20px]">pin</span>
                    <input
                      className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] text-center text-2xl font-bold tracking-[0.4em] text-[#1c355e] transition-all"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="------"
                      value={otpRecuperacion}
                      onChange={(e) => setOtpRecuperacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                  <p className="text-[12px] text-[#75777f] text-center">Revisa también tu carpeta de spam.</p>
                </div>
                <button type="submit" disabled={otpRecuperacion.length !== 6} className={`w-full text-white font-semibold py-3 rounded-xl transition-all ${otpRecuperacion.length === 6 ? 'bg-[#1c355e] hover:bg-[#1c355e]/90' : 'bg-gray-400 cursor-not-allowed'}`}>
                  Continuar
                </button>
              </form>
            )}

            {/* PASO 3: Nueva contraseña */}
            {pasoRecuperacion === 'password' && (
              <form className="space-y-4" onSubmit={handleRestablecerPassword}>
                <p className="text-sm text-[#75777f] text-center">Elige una nueva contraseña para tu cuenta.</p>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#44464e]">Nueva Contraseña</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f] text-[20px]">lock</span>
                    <input
                      className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1c355e]/20 focus:border-[#1c355e] transition-all"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-[#44464e]">Confirmar Contraseña</label>
                  <div className="relative">
                    <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] ${confirmarPassword.length > 0 ? (passwordsCoinciden ? 'text-green-500' : 'text-red-500') : 'text-[#75777f]'}`}>lock_reset</span>
                    <input
                      className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${confirmarPassword.length > 0 ? (passwordsCoinciden ? 'border-green-500 focus:ring-green-500/20' : 'border-red-500 focus:ring-red-500/20') : 'border-[#c5c6cf] focus:ring-[#1c355e]/20 focus:border-[#1c355e]'}`}
                      type="password"
                      placeholder="Repite la contraseña"
                      value={confirmarPassword}
                      onChange={(e) => setConfirmarPassword(e.target.value)}
                      required
                    />
                    {confirmarPassword.length > 0 && (
                      <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[20px] ${passwordsCoinciden ? 'text-green-500' : 'text-red-500'}`}>
                        {passwordsCoinciden ? 'check_circle' : 'cancel'}
                      </span>
                    )}
                  </div>
                  {confirmarPassword.length > 0 && (
                    <p className={`text-[12px] font-medium flex items-center gap-1 ${passwordsCoinciden ? 'text-green-600' : 'text-red-500'}`}>
                      <span className="material-symbols-outlined text-[16px]">{passwordsCoinciden ? 'check' : 'close'}</span>
                      {passwordsCoinciden ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                    </p>
                  )}
                </div>
                <button type="submit" disabled={!passwordsCoinciden || cargando} className={`w-full text-white font-semibold py-3 rounded-xl flex justify-center items-center gap-2 transition-all ${passwordsCoinciden && !cargando ? 'bg-[#1c355e] hover:bg-[#1c355e]/90' : 'bg-gray-400 cursor-not-allowed'}`}>
                  {cargando ? 'Guardando...' : 'Establecer Nueva Contraseña'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
