import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
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
    <div className="page-container" style={{ maxWidth: 400, marginTop: '4rem' }}>
      <div className="card">
        <h2>Admin – Cajita de la Memoria</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password">Contraseña</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary">Entrar</button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
