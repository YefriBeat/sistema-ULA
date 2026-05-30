import { createContext, useContext, useState, useEffect } from 'react';

const TimeContext = createContext(new Date());

export function TimeProvider({ children }) {
  const [ahora, setAhora] = useState(new Date()); // Prueba:2026, 5, 1,10, 10 viernes 29 mayo 2026, 10:00 a.m.

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 60000);
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
