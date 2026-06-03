import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TimeProvider } from './components/TimeContext';
import { UserProvider } from './components/UserContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import GestionHorarios from './pages/GestionHorarios';
import GestionAulas from './pages/GestionAulas';
import VisualBd from './pages/VisualBd';
import GestionDocentes from './pages/GestionDocentes';
import ConfiguracionPerfil from './pages/ConfiguracionPerfil';

function RutaProtegida({ children }) {
  return localStorage.getItem('usuarioLogueado')
    ? children
    : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <TimeProvider>
    <UserProvider>
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Rutas Privadas (Envueltas en el Layout para que tengan el menú) */}
        <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<VisualBd />} />
          <Route path="horarios" element={<GestionHorarios />} />
          <Route path="gestion-aulas" element={<GestionAulas />} />
          <Route path="gestion-docentes" element={<GestionDocentes />} />
          <Route path="configuracion-perfil" element={<ConfiguracionPerfil />} />
        </Route>

        {/* Ruta comodín si escriben una URL que no existe */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </UserProvider>
    </TimeProvider>
  );
}