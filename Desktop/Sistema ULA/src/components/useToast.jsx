import { useState, useCallback, useRef, useEffect } from 'react';

// ── Mapa de estilos por tipo ────────────────────────────────────────────────
const TIPOS = {
  exito:       { cls: 'bg-green-600',  icon: 'check_circle' },
  error:       { cls: 'bg-red-600',    icon: 'error'        },
  advertencia: { cls: 'bg-orange-500', icon: 'warning'      },
};

/**
 * Componente estable definido en el módulo (fuera del hook).
 * React mantiene su identidad entre renders porque la referencia nunca cambia.
 * Uso: <ToastContainer toasts={toasts} />
 */
export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { cls, icon } = TIPOS[t.tipo] ?? { cls: 'bg-[#1c355e]', icon: 'info' };
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${cls}`}
          >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            {t.mensaje}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook de notificaciones.
 * Retorna { toast, toasts }.
 * Uso:
 *   const { toast, toasts } = useToast();
 *   <ToastContainer toasts={toasts} />
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  // Limpia todos los timers pendientes al desmontar el componente
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const toast = useCallback((mensaje, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensaje, tipo }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timersRef.current.delete(id);
    }, 3500);
    timersRef.current.set(id, timer);
  }, []);

  return { toast, toasts };
}
