import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((mensaje, tipo = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
          t.tipo === 'exito'       ? 'bg-green-600'  :
          t.tipo === 'error'       ? 'bg-red-600'    :
          t.tipo === 'advertencia' ? 'bg-orange-500' :
                                     'bg-[#1c355e]'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {t.tipo === 'exito' ? 'check_circle' : t.tipo === 'error' ? 'error' : t.tipo === 'advertencia' ? 'warning' : 'info'}
          </span>
          {t.mensaje}
        </div>
      ))}
    </div>
  );

  return { toast, ToastContainer };
}
