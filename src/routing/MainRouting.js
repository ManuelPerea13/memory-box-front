import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Home from '../pages/Home';
import ClientData from '../pages/ClientData';
import ImageEditor from '../pages/ImageEditor';
import AdminLogin from '../pages/admin/Login';
import AdminDashboard from '../pages/admin/Dashboard';
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
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Home />} />
      <Route path="/cliente" element={<ClientData />} />
      <Route path="/editor/:pedidoId" element={<ImageEditor />} />
      <Route path="/" element={<Navigate to="/" replace />} />
      <Route path="*" element={<div>Página no encontrada</div>} />
    </Routes>
  );
};

export default MainRouting;
