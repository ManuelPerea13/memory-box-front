import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (token) {
      const from = location.state?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [token, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const ok = await login(email, password);
    if (!ok) setError('Credenciales inválidas');
  };

  return (
    <div className="client-data-page">
      <div className="client-data-card admin-login-card">
        <header className="client-data-header">
          <h1>
            <span className="client-data-icon" aria-hidden>🔐</span>
            Admin – Cajita de la Memoria
          </h1>
          <p>Iniciar sesión para gestionar pedidos</p>
        </header>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="client-data-form-group">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="client-data-error">{error}</p>}
          <div className="client-data-buttons">
            <button type="submit" className="btn btn-primary client-data-btn-submit">
              Entrar
            </button>
          </div>
        </form>
        <p className="admin-login-footer">
          <Link to="/">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
