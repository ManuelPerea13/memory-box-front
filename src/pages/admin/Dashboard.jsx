import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../restclient/api';

const AdminDashboard = () => {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOrders()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Panel Admin</h1>
        <div>
          <span style={{ marginRight: '1rem' }}>{userEmail}</span>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>
      <nav>
        <Link to="/">Ir al inicio</Link>
      </nav>
      <h2>Pedidos</h2>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {pedidos.length === 0 ? (
            <li>No hay pedidos</li>
          ) : (
            pedidos.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                #{p.id} – {p.client_name} – {p.status} – {new Date(p.created_at).toLocaleString()}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default AdminDashboard;
