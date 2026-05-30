import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../components/logo.png';

export default function Registro() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [turno, setTurno] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [paso, setPaso] = useState('registro');
  const [correoRegistrado, setCorreoRegistrado] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [cargando, setCargando] = useState(false);

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
    if (!isValidEmail) return alert("El correo debe terminar con universidadlatino.edu.mx");
    if (!passwordsMatch) return alert("Las contraseñas no coinciden");

    setCargando(true);
    try {
      const response = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: fullName.trim(), correo: email.trim().toLowerCase(), turno, password })
      });
      const data = await response.json();
      if (response.ok) {
        setCorreoRegistrado(email.trim().toLowerCase());
        setPaso('verificacion');
      } else {
        alert("Error: " + (data.detail || "No se pudo crear el usuario."));
      }
    } catch {
      alert("Error de conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const handleVerificar = async (e) => {
    e.preventDefault();
    if (codigoOtp.length !== 6) return alert("El código debe tener 6 dígitos.");

    setCargando(true);
    try {
      const response = await fetch('/api/verificar-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: correoRegistrado, codigo: codigoOtp })
      });
      const data = await response.json();
      if (response.ok) {
        alert("¡Correo verificado! Ya puedes iniciar sesión.");
        window.location.href = "/login";
      } else {
        alert("Error: " + (data.detail || "Código incorrecto."));
      }
    } catch {
      alert("Error de conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const isButtonDisabled = !passwordsMatch || !isValidEmail || emailError.length > 0;

  return (
    <div className="bg-[#f9fafb] min-h-screen flex flex-col items-center justify-center p-6 font-manrope">
      <main className="w-full max-w-md bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden">

        <div className="px-8 pt-8 pb-6 text-center flex flex-col items-center">
          <img src={logo} alt="Logo" className="h-20 w-auto object-contain mb-2" />
          <h2 className="text-[14px] font-semibold text-[#44464e] tracking-widest mb-4 uppercase">Sistema de Prefectura</h2>
          <h1 className="text-[32px] font-bold text-[#1c355e] tracking-tight leading-[1.2]">
            {paso === 'registro' ? 'REGISTRO DE PERSONAL' : 'VERIFICAR CORREO'}
          </h1>
        </div>

        {/* ===== PASO 1: FORMULARIO DE REGISTRO ===== */}
        {paso === 'registro' && (
          <form className="px-8 pb-8 space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Nombre Completo</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">person</span>
                <input className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-lg focus:ring-2 focus:ring-[#1c355e] outline-none" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Correo Institucional</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">mail</span>
                <input className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:outline-none ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-[#c5c6cf] focus:ring-[#1c355e]'}`} type="email" value={email} onChange={handleEmailChange} placeholder="ejemplo@universidadlatino.edu.mx" required />
              </div>
              {emailError && <p className="text-[12px] font-medium text-red-500 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">close</span>{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Seleccionar Turno</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">manage_accounts</span>
                <select className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-lg focus:ring-2 focus:ring-[#1c355e] outline-none appearance-none cursor-pointer bg-white" value={turno} onChange={(e) => setTurno(e.target.value)} required>
                  <option value="" disabled>Selecciona un turno</option>
                  <option value="matutino">Turno Matutino</option>
                  <option value="vespertino">Turno Vespertino</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#75777f] pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Contraseña</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">lock</span>
                <input className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-lg focus:ring-2 focus:ring-[#1c355e] outline-none" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Confirmar Contraseña</label>
              <div className="relative group">
                <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 ${isTypingConfirm ? (passwordsMatch ? 'text-green-500' : 'text-red-500') : 'text-[#75777f]'}`}>lock_reset</span>
                <input className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:outline-none ${isTypingConfirm ? (passwordsMatch ? 'border-green-500 focus:ring-2' : 'border-red-500 focus:ring-2') : 'border-[#c5c6cf] focus:ring-2 focus:ring-[#1c355e]'}`} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                {isTypingConfirm && <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`}>{passwordsMatch ? 'check_circle' : 'cancel'}</span>}
              </div>
              {isTypingConfirm && (
                <p className={`text-[12px] font-medium flex items-center gap-1 ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-[16px]">{passwordsMatch ? 'check' : 'close'}</span>
                  {passwordsMatch ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                </p>
              )}
            </div>

            <div className="pt-4">
              <button type="submit" disabled={isButtonDisabled || cargando} className={`w-full text-white font-semibold py-4 rounded-lg flex justify-center items-center gap-2 transition-all ${!isButtonDisabled && !cargando ? 'bg-[#1c355e] hover:bg-[#1c355e]/90 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
                {cargando ? 'Enviando...' : 'Crear Usuario'}
              </button>
            </div>
            <div className="pt-2 text-center">
              <Link to="/login" className="text-[16px] text-[#1c355e] hover:underline">Volver al Inicio de Sesión</Link>
            </div>
          </form>
        )}

        {/* ===== PASO 2: VERIFICACIÓN OTP ===== */}
        {paso === 'verificacion' && (
          <form className="px-8 pb-8 space-y-4" onSubmit={handleVerificar}>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
              <p className="text-[13px] text-[#44464e]">Enviamos un código de 6 dígitos a:</p>
              <p className="text-[13px] font-bold text-[#1c355e] mt-1 break-all">{correoRegistrado}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#1b1c1e]">Código de Verificación</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">pin</span>
                <input
                  className="w-full pl-10 pr-4 py-3 border border-[#c5c6cf] rounded-lg focus:ring-2 focus:ring-[#1c355e] outline-none text-center text-2xl font-bold tracking-[0.4em] text-[#1c355e]"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="------"
                  value={codigoOtp}
                  onChange={(e) => setCodigoOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <p className="text-[12px] text-[#75777f] text-center">Revisa también tu carpeta de spam.</p>
            </div>

            <div className="pt-4">
              <button type="submit" disabled={codigoOtp.length !== 6 || cargando} className={`w-full text-white font-semibold py-4 rounded-lg flex justify-center items-center gap-2 transition-all ${codigoOtp.length === 6 && !cargando ? 'bg-[#1c355e] hover:bg-[#1c355e]/90 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
                {cargando ? 'Verificando...' : 'Verificar y Activar Cuenta'}
              </button>
            </div>
            <div className="pt-2 text-center">
              <button type="button" onClick={() => setPaso('registro')} className="text-[14px] text-[#75777f] hover:text-[#1c355e] hover:underline">
                Volver al formulario
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="mt-8 text-center w-full max-w-md">
        <p className="text-[12px] text-[#75777f] uppercase tracking-widest font-medium">© 2026 Universidad Latino - Gestión Institucional</p>
      </footer>
    </div>
  );
}
