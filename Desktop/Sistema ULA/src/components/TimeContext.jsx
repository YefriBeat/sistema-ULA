import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TimeContext = createContext(new Date());
const TimeControlContext = createContext(null);

export function TimeProvider({ children }) {
  // 🕒 CENTRAL DE TIEMPO — Modo: real o prueba
  const [modo, setModo] = useState(() => {
    const saved = localStorage.getItem('sipref_time_mode');
    return saved || 'real'; // 'real' | 'test'
  });

  const [fechaPrueba, setFechaPrueba] = useState(() => {
    const saved = localStorage.getItem('sipref_test_date');
    return saved || new Date().toISOString().slice(0, 16);
  });

  const getDate = useCallback(() => {
    if (modo === 'test' && fechaPrueba) {
      const d = new Date(fechaPrueba);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }, [modo, fechaPrueba]);

  const [ahora, setAhora] = useState(getDate);

  useEffect(() => {
    setAhora(getDate());
    const timer = setInterval(() => {
      setAhora(getDate());
    }, modo === 'real' ? 5000 : 60000);
    return () => clearInterval(timer);
  }, [getDate, modo]);

  // Persistir configuración
  useEffect(() => {
    localStorage.setItem('sipref_time_mode', modo);
    localStorage.setItem('sipref_test_date', fechaPrueba);
  }, [modo, fechaPrueba]);

  const controls = {
    modo,
    fechaPrueba,
    setModo: (m) => setModo(m),
    setFechaPrueba: (f) => setFechaPrueba(f),
    resetToReal: () => {
      setModo('real');
      setFechaPrueba(new Date().toISOString().slice(0, 16));
    }
  };

  return (
    <TimeContext.Provider value={ahora}>
      <TimeControlContext.Provider value={controls}>
        {children}
      </TimeControlContext.Provider>
    </TimeContext.Provider>
  );
}

export function useTime() {
  return useContext(TimeContext);
}

export function useTimeControls() {
  return useContext(TimeControlContext);
}
