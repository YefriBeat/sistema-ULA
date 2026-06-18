import { createContext, useContext, useState, useEffect } from 'react';

const TimeContext = createContext(new Date());

export function TimeProvider({ children }) {
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
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
