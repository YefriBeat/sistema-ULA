import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Monkey-patch fetch para inyectar automáticamente el usuario logueado en la bitácora
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  let [resource, config] = args;
  if (typeof resource === 'string' && resource.startsWith('/api/')) {
    let userName = 'Sistema';
    try {
      const stored = localStorage.getItem('usuarioLogueado');
      if (stored) {
        const user = JSON.parse(stored);
        userName = user.nombre_completo || user.nombre || 'Sistema';
      }
    } catch (e) {}
    
    config = config || {};
    config.headers = {
      ...config.headers,
      'X-Usuario': encodeURIComponent(userName)
    };
    args[1] = config;
  }
  return originalFetch.apply(this, args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);