import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Home from '../pages/Home';
import ClientData from '../pages/ClientData';
import ImageEditor from '../pages/ImageEditor';
import PedidoView from '../pages/PedidoView';
import AdminLogin from '../pages/admin/Login';
import AdminDashboard from '../pages/admin/Dashboard';
import AdminStock from '../pages/admin/Stock';
import AdminPrecios from '../pages/admin/Precios';
import AdminCostos from '../pages/admin/Costos';
import AdminFondo from '../pages/admin/Fondo';
import AdminVariantes from '../pages/admin/Variantes';
import AdminEstadisticas from '../pages/admin/Estadisticas';
import AdminLayout from '../components/admin/AdminLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const MainRouting = () => {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="stock" element={<AdminStock />} />
        <Route path="precios" element={<AdminPrecios />} />
        <Route path="costos" element={<AdminCostos />} />
        <Route path="fondo" element={<AdminFondo />} />
        <Route path="variantes" element={<AdminVariantes />} />
        <Route path="estadisticas" element={<AdminEstadisticas />} />
      </Route>
      <Route path="/" element={<Home />} />
      <Route path="/cliente" element={<ClientData />} />
      <Route path="/editor" element={<ImageEditor />} />
      <Route path="/pedido/:id" element={<PedidoView />} />
      <Route path="/" element={<Navigate to="/" replace />} />
      <Route path="*" element={<div>Página no encontrada</div>} />
    </Routes>
  );
};

export default MainRouting;
