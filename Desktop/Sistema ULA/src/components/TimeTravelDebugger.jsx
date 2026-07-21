import { useState } from 'react';
import { useTime, useTimeControls } from './TimeContext';

export default function TimeTravelDebugger() {
  const ahora = useTime();
  const controls = useTimeControls();
  const [abierto, setAbierto] = useState(false);
  const [minimizado, setMinimizado] = useState(false);

  // Solo mostrar en desarrollo
  if (!import.meta.env.DEV) return null;
  if (!controls) return null;

  const { modo, fechaPrueba, setModo, setFechaPrueba, resetToReal } = controls;

  const isTest = modo === 'test';

  // Atajos rápidos de fechas
  const atajos = [
    { label: 'Hoy (Real)', action: () => resetToReal() },
    { label: '+1 Día', action: () => { const d = new Date(ahora); d.setDate(d.getDate() + 1); setModo('test'); setFechaPrueba(d.toISOString().slice(0, 16)); }},
    { label: '+1 Semana', action: () => { const d = new Date(ahora); d.setDate(d.getDate() + 7); setModo('test'); setFechaPrueba(d.toISOString().slice(0, 16)); }},
    { label: '+1 Mes', action: () => { const d = new Date(ahora); d.setMonth(d.getMonth() + 1); setModo('test'); setFechaPrueba(d.toISOString().slice(0, 16)); }},
    { label: '-1 Mes', action: () => { const d = new Date(ahora); d.setMonth(d.getMonth() - 1); setModo('test'); setFechaPrueba(d.toISOString().slice(0, 16)); }},
  ];

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        title="Time Travel Debugger"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: isTest
            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
            : 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: isTest
            ? '0 4px 20px rgba(245,158,11,0.4)'
            : '0 4px 15px rgba(99,102,241,0.3)',
          transition: 'all 0.3s ease',
          animation: isTest ? 'pulse-glow 2s infinite' : 'none',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
          {isTest ? 'science' : 'schedule'}
        </span>
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 4px 20px rgba(245,158,11,0.4); }
            50% { box-shadow: 0 4px 30px rgba(239,68,68,0.6); }
          }
        `}</style>
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        width: minimizado ? '280px' : '340px',
        background: '#0f172a',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: isTest
          ? '0 8px 40px rgba(245,158,11,0.3), 0 0 0 1px rgba(245,158,11,0.2)'
          : '0 8px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(99,102,241,0.2)',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: isTest
            ? 'linear-gradient(135deg, #92400e, #991b1b)'
            : 'linear-gradient(135deg, #1e3a5f, #312e81)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '18px' }}>
            {isTest ? 'science' : 'schedule'}
          </span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '13px', letterSpacing: '0.5px' }}>
            {isTest ? 'MODO PRUEBA' : 'TIEMPO REAL'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setMinimizado(!minimizado)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: '2px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {minimizado ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          <button
            onClick={() => setAbierto(false)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, padding: '2px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>
      </div>

      {/* Reloj actual */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
          Fecha/Hora del Sistema
        </div>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
          {ahora.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <div style={{ color: isTest ? '#fbbf24' : '#818cf8', fontSize: '14px', fontWeight: 600 }}>
          {ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {!minimizado && (
        <>
          {/* Toggle modo */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => resetToReal()}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: !isTest ? '#6366f1' : 'rgba(255,255,255,0.05)',
                  color: !isTest ? '#fff' : '#64748b',
                }}
              >
                Real
              </button>
              <button
                onClick={() => setModo('test')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: isTest ? '#f59e0b' : 'rgba(255,255,255,0.05)',
                  color: isTest ? '#000' : '#64748b',
                }}
              >
                Prueba
              </button>
            </div>
          </div>

          {/* Date/Time picker */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
              Fecha y Hora de Prueba
            </label>
            <input
              type="datetime-local"
              value={fechaPrueba}
              onChange={(e) => { setModo('test'); setFechaPrueba(e.target.value); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#e2e8f0',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: "'Inter', monospace",
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Atajos rápidos */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Atajos Rápidos
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {atajos.map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.color = '#cbd5e1'; }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
