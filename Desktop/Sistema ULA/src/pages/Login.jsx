import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../components/logo.png'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('correo', email);
    formData.append('password', password);

    try {
      const response = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('usuarioLogueado', JSON.stringify(data.usuario));
        window.location.href = "/dashboard";
      } else {
        alert("Error: " + (data.detail || "Credenciales inválidas."));
      }
    } catch (error) {
      alert("Error de conexión con el servidor.");
      console.error(error);
    }
  };

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
                  type="email" placeholder=".universidadlatino.edu.mx" required 
                  value={email} onChange={(e) => setEmail(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-[#44464e] block">Contraseña</label>
                <a className="text-xs font-medium text-[#1c355e] hover:underline" href="#">¿Olvidaste tu contraseña?</a>
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
              <button type="submit" className="w-full bg-[#1c355e] text-white text-sm font-semibold py-4 rounded-xl shadow-md hover:bg-[#1c355e]/90 flex items-center justify-center gap-2 transition-all">
                <span>Iniciar Sesión</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
            
            <div className="text-center mt-4">
              <p className="text-sm text-[#75777f]">¿No tienes una cuenta? <Link to="/registro" className="text-sm font-semibold text-[#1c355e] hover:underline">Registrar una nueva cuenta</Link></p>
            </div>
          </form>
        </div>
      </main>

      <footer className="mt-8 py-2 w-full max-w-md text-center">
        <p className="text-xs text-[#75777f] opacity-60">© 2026 Universidad Latino - Gestión Institucional</p>
      </footer>
    </div>
  );
}