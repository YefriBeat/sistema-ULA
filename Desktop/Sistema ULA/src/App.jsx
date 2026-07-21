import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TimeProvider } from './components/TimeContext';
import { UserProvider } from './components/UserContext';
import ErrorBoundary from './components/ErrorBoundary';
import TimeTravelDebugger from './components/TimeTravelDebugger';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';

// Code splitting: cada página se carga solo cuando se navega a ella
const VisualBd          = lazy(() => import('./pages/VisualBd'));
const GestionHorarios   = lazy(() => import('./pages/GestionHorarios'));
const GestionAulas      = lazy(() => import('./pages/GestionAulas'));
const GestionDocentes   = lazy(() => import('./pages/GestionDocentes'));
const Calendarios       = lazy(() => import('./pages/Calendarios'));
const ConfiguracionPerfil = lazy(() => import('./pages/ConfiguracionPerfil'));
const ManualUsuario       = lazy(() => import('./pages/ManualUsuario'));
const SoporteTecnico      = lazy(() => import('./pages/SoporteTecnico'));

// Variable para activar el modo de mantenimiento
const EN_MANTENIMIENTO = false;

function MantenimientoPagina() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <span className="material-symbols-outlined text-6xl text-amber-500 mb-4 block">construction</span>
        <h1 className="text-2xl font-bold text-[#1c355e] mb-2">Sitio en Mantenimiento</h1>
        <p className="text-gray-600 leading-relaxed text-lg">
          🚧 SIPREF se encuentra en mantenimiento. Estaremos de regreso pronto.
        </p>
      </div>
    </div>
  );
}


function RutaProtegida({ children }) {
  return localStorage.getItem('usuarioLogueado')
    ? children
    : <Navigate to="/login" replace />;
}

function CargandoPagina() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <span className="material-symbols-outlined animate-spin text-3xl text-[#1c355e]">sync</span>
    </div>
  );
}

export default function App() {
  if (EN_MANTENIMIENTO) {
    return <MantenimientoPagina />;
  }

  return (
    <ErrorBoundary>
      <TimeProvider>
        <UserProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Rutas Públicas */}
              <Route path="/login"    element={<Login />} />
              <Route path="/registro" element={<Registro />} />

              {/* Rutas Privadas */}
              <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={
                  <Suspense fallback={<CargandoPagina />}><VisualBd /></Suspense>
                } />
                <Route path="horarios" element={
                  <Suspense fallback={<CargandoPagina />}><GestionHorarios /></Suspense>
                } />
                <Route path="gestion-aulas" element={
                  <Suspense fallback={<CargandoPagina />}><GestionAulas /></Suspense>
                } />
                <Route path="gestion-docentes" element={
                  <Suspense fallback={<CargandoPagina />}><GestionDocentes /></Suspense>
                } />
                <Route path="calendarios" element={
                  <Suspense fallback={<CargandoPagina />}><Calendarios /></Suspense>
                } />
                <Route path="configuracion-perfil" element={
                  <Suspense fallback={<CargandoPagina />}><ConfiguracionPerfil /></Suspense>
                } />
                <Route path="manual" element={
                  <Suspense fallback={<CargandoPagina />}><ManualUsuario /></Suspense>
                } />
                <Route path="soporte" element={
                  <Suspense fallback={<CargandoPagina />}><SoporteTecnico /></Suspense>
                } />
              </Route>

              {/* Ruta comodín */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </UserProvider>
        <TimeTravelDebugger />
      </TimeProvider>
    </ErrorBoundary>
  );
}
