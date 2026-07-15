import { createContext, useContext, useState, useEffect } from 'react';

const TimeContext = createContext(new Date());

export function TimeProvider({ children }) {
  // 🕒 CENTRAL DE TIEMPO (FECHA DE PRUEBA)
  // Cambia "2026-07-20T12:00:00" por "new Date()" para volver al tiempo real
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setAhora(new Date());
    }, 5000); // 🔧 Cada 5s es suficiente (la UI solo necesita precisión al minuto)
    return () => clearInterval(timer);
  }, []);

  return (
    <TimeContext.Provider value={ahora}>
      {children}
    </TimeContext.Provider>
  );
}

export function useTime() {
  return useContext(TimeContext);
}
