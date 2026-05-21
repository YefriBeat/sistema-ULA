import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import GestionHorarios from './pages/GestionHorarios';
import AsignacionAulas from './pages/AsignacionAulas';
import GestionAulas from './pages/GestionAulas';
import VisualBd from './pages/VisualBd'; // Corregida la "d" minúscula para evitar errores

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Rutas Privadas (Envueltas en el Layout para que tengan el menú) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="horarios" element={<GestionHorarios />} />
          <Route path="asignar-aulas" element={<AsignacionAulas />} />
          
          {/* AQUÍ ESTÁN TUS NUEVAS RUTAS CONECTADAS */}
          <Route path="gestion-aulas" element={<GestionAulas />} />
          <Route path="visualbd" element={<VisualBd />} />
        </Route>

        {/* Ruta comodín si escriben una URL que no existe */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}