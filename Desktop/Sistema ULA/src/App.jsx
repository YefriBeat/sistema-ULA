import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import GestionHorarios from './pages/GestionHorarios';
import AsignacionAulas from './pages/AsignacionAulas';
import GestionAulas from './pages/GestionAulas';
import VisualBd from './pages/VisualBd';

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
          <Route path="dashboard" element={<VisualBd />} />
          <Route path="horarios" element={<GestionHorarios />} />
          <Route path="asignar-aulas" element={<AsignacionAulas />} />
          <Route path="gestion-aulas" element={<GestionAulas />} />
        </Route>

        {/* Ruta comodín si escriben una URL que no existe */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}