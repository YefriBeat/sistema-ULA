import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const UserContext = createContext(null);

function leerDesdeLocalStorage() {
  try {
    const datos = localStorage.getItem('usuarioLogueado');
    if (!datos) return inicial();
    const p = JSON.parse(datos);
    return mapear(p);
  } catch {
    return inicial();
  }
}

function inicial() {
  return { id: null, nombre: 'Usuario', nombre_completo: 'Usuario', correo: '', turno: '', created_at: null, logged_at: null };
}

function mapear(p) {
  return {
    id:              p.id              || null,
    nombre:          p.nombre_completo || p.nombre || 'Usuario',
    nombre_completo: p.nombre_completo || p.nombre || 'Usuario',
    correo:          p.correo          || '',
    turno:           p.turno           || '',
    created_at:      p.created_at      || null,
    logged_at:       p.logged_at       || null,
  };
}

export function UserProvider({ children }) {
  // Se inicializa de forma síncrona desde localStorage; no necesita useEffect.
  const [usuario, setUsuario] = useState(leerDesdeLocalStorage);

  /**
   * Actualiza el contexto y sincroniza localStorage en una sola llamada.
   * Cualquier componente suscrito re-renderiza automáticamente.
   */
  const actualizarUsuario = useCallback((cambios) => {
    setUsuario(prev => {
      const nuevo = { ...prev, ...cambios };
      // Normalizar: nombre y nombre_completo deben coincidir
      if (cambios.nombre_completo) nuevo.nombre = cambios.nombre_completo;
      else if (cambios.nombre)     nuevo.nombre_completo = cambios.nombre;
      // Persistir en localStorage
      try {
        const actual = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
        localStorage.setItem('usuarioLogueado', JSON.stringify({ ...actual, ...cambios }));
      } catch { /* ignore */ }
      return nuevo;
    });
  }, []);

  // ── Sincronización cross-device ───────────────────────────────────────────
  // Relee el perfil desde el servidor cada 60 s y al recuperar el foco de la
  // ventana. Así, si otro dispositivo cambia el turno/nombre, este se actualiza
  // sin necesidad de cerrar sesión.
  useEffect(() => {
    if (!usuario.id) return;

    const sincronizar = async () => {
      try {
        const res = await fetch(`/api/usuarios/${usuario.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setUsuario(prev => {
          // Solo actualiza si algo cambió para evitar re-renders innecesarios
          if (prev.nombre_completo === data.nombre && prev.turno === data.turno) return prev;
          const nuevo = {
            ...prev,
            nombre:          data.nombre,
            nombre_completo: data.nombre,
            turno:           data.turno,
          };
          // Mantener localStorage sincronizado también
          try {
            const actual = JSON.parse(localStorage.getItem('usuarioLogueado') || '{}');
            localStorage.setItem('usuarioLogueado', JSON.stringify({
              ...actual,
              nombre:          data.nombre,
              nombre_completo: data.nombre,
              turno:           data.turno,
            }));
          } catch { /* ignore */ }
          return nuevo;
        });
      } catch { /* sin conexión, ignora */ }
    };

    const intervalo = setInterval(sincronizar, 60000);
    window.addEventListener('focus', sincronizar);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', sincronizar);
    };
  }, [usuario.id]);

  return (
    <UserContext.Provider value={{ usuario, actualizarUsuario }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
