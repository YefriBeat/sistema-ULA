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

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const isTypingConfirm = confirmPassword.length > 0;
  
  // Validación a prueba de balas: limpia espacios vacíos y convierte a minúsculas
  const isValidEmail = email.trim().length > 0 && email.trim().toLowerCase().endsWith('.universidadlatino.edu.mx');

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value.trim().length > 0 && !value.trim().toLowerCase().endsWith('.universidadlatino.edu.mx')) {
      setEmailError('El correo debe terminar con .universidadlatino.edu.mx');
    } else {
      setEmailError('');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    console.log("1. ¡Clic detectado! Iniciando registro...");

    if (!isValidEmail) {
      console.log("Error: Correo inválido");
      return alert("El correo debe terminar con .universidadlatino.edu.mx");
    }
    if (!passwordsMatch) {
      console.log("Error: Contraseñas no coinciden");
      return alert("Las contraseñas no coinciden");
    }

    const datosUsuario = {
      nombre: fullName.trim(),
      correo: email.trim().toLowerCase(),
      turno: turno,
      password: password
    };

    console.log("2. JSON estructurado para el servidor:", datosUsuario);

    try {
      console.log("3. Enviando petición fetch a http://localhost:8000/api/registro...");
      const response = await fetch('http://localhost:8000/api/registro', { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datosUsuario) 
      });
      
      console.log("4. Respuesta HTTP recibida. Código:", response.status);
      const data = await response.json();
      console.log("5. Mensaje del backend:", data);
      
      if (response.ok) {
        alert("¡Usuario creado exitosamente!");
        window.location.href = "/login";
      } else {
        alert("Hubo un error al registrar: " + (data.detail || "Datos inválidos"));
      }
    } catch (error) {
      console.error("6. ERROR CRÍTICO de conexión:", error);
      alert("Error de conexión con el servidor MySQL/Python.");
    }
  };

  // Variable clara para controlar el botón (Si falta algo, es TRUE, o sea, deshabilitado)
  const isButtonDisabled = !passwordsMatch || !isValidEmail || emailError.length > 0;

  return (
    <div className="bg-[#f9fafb] min-h-screen flex flex-col items-center justify-center p-6 font-manrope">
      <main className="w-full max-w-md bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden">
        
        <div className="px-8 pt-8 pb-6 text-center flex flex-col items-center">
          <img src={logo} alt="Logo" className="h-20 w-auto object-contain mb-2" />
          <h2 className="text-[14px] font-semibold text-[#44464e] tracking-widest mb-4 uppercase">Sistema de Prefectura</h2>
          <h1 className="text-[32px] font-bold text-[#1c355e] tracking-tight leading-[1.2]">REGISTRO DE PERSONAL</h1>
        </div>

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
            <button type="submit" className={`w-full text-white font-semibold py-4 rounded-lg flex justify-center items-center gap-2 transition-all ${!isButtonDisabled ? 'bg-[#1c355e] hover:bg-[#1c355e]/90 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`} disabled={isButtonDisabled}>
              Crear Usuario
            </button>
          </div>
          <div className="pt-2 text-center">
            <Link to="/login" className="text-[16px] text-[#1c355e] hover:underline">Volver al Inicio de Sesión</Link>
          </div>
        </form>
      </main>

      <footer className="mt-8 text-center w-full max-w-md">
        <p className="text-[12px] text-[#75777f] uppercase tracking-widest font-medium">© 2026 Universidad Latino - Gestión Institucional</p>
      </footer>
    </div>
  );
}