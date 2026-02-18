import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOrdersWebSocket from '../../hooks/useOrdersWebSocket';

const formatNotificationTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffMin >= 60) return `Hace ${Math.floor(diffMin / 60)} h`;
  if (diffMin > 0) return `Hace ${diffMin} min`;
  if (diffSec > 5) return `Hace ${diffSec} s`;
  return 'Ahora mismo';
};

const VARIANT_LABELS = {
  graphite: 'Grafito',
  wood: 'Madera',
  black: 'Negro',
  marble: 'Mármol',
  graphite_light: 'Grafito (con luz)',
  wood_light: 'Madera (con luz)',
  black_light: 'Negro (con luz)',
  marble_light: 'Mármol (con luz)',
  Graphite: 'Grafito',
  Wood: 'Madera',
  Black: 'Negro',
  Marble: 'Mármol',
  'Graphite (with light)': 'Grafito (con luz)',
  'Wood (with light)': 'Madera (con luz)',
  'Black (with light)': 'Negro (con luz)',
  'Marble (with light)': 'Mármol (con luz)',
};

const getVariantLabel = (variant) => {
  if (!variant) return '';
  return VARIANT_LABELS[variant] || VARIANT_LABELS[(variant || '').toLowerCase()] || variant;
};

const AdminLayout = () => {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const addNotification = useCallback((payload) => {
    if (payload.order_id == null) return;
    setNotifications((prev) => [
      {
        id: `${payload.order_id}-${Date.now()}`,
        orderId: payload.order_id,
        clientName: payload.client_name || 'Cliente',
        variant: payload.variant || '',
        withLight: payload.with_light === true,
        createdAt: new Date(),
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const handleOrdersUpdate = useCallback((data) => {
    if (data && data.order_id != null && data.status === 'in_progress') addNotification(data);
    window.dispatchEvent(new CustomEvent('orders-update'));
  }, [addNotification]);

  useOrdersWebSocket(handleOrdersUpdate);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const unreadCount = notifications.length;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-icon" aria-hidden>📦</span>
          <span>Cajita de la Memoria</span>
        </div>
        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-section">PRINCIPAL</div>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
          >
            Dashboard
          </NavLink>
          <div className="admin-sidebar-section">GESTIÓN</div>
          <NavLink
            to="/admin/stock"
            className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
          >
            Stock
          </NavLink>
          <NavLink
            to="/admin/precios"
            className={({ isActive }) => `admin-sidebar-link ${isActive ? 'active' : ''}`}
          >
            Precios
          </NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-sidebar-email">{userEmail}</span>
          <button type="button" className="admin-sidebar-btn" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="admin-main-wrap">
        <header className="admin-topbar">
          <div className="admin-topbar-right" ref={dropdownRef}>
            <button
              type="button"
              className="admin-notification-bell"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-label={unreadCount ? `${unreadCount} notificaciones` : 'Notificaciones'}
              aria-expanded={dropdownOpen}
            >
              <span className="admin-notification-bell-icon" aria-hidden>🔔</span>
              {unreadCount > 0 && (
                <span className="admin-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            {dropdownOpen && (
              <div className="admin-notification-dropdown">
                <div className="admin-notification-dropdown-header">
                  <span>Notificaciones</span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="admin-notification-clear"
                      onClick={() => setNotifications([])}
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                <div className="admin-notification-dropdown-list">
                  {notifications.length === 0 ? (
                    <p className="admin-notification-empty">No hay notificaciones nuevas</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="admin-notification-item"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/admin');
                        }}
                      >
                        <span className="admin-notification-item-title">Nuevo pedido #{n.orderId}</span>
                        {n.clientName && <span className="admin-notification-item-sub">{n.clientName}</span>}
                        {(n.variant || n.withLight !== undefined) && (
                          <span className="admin-notification-item-sub">
                            {[getVariantLabel(n.variant), n.withLight === true ? 'Con luz' : n.withLight === false ? 'Sin luz' : ''].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <span className="admin-notification-item-time">{formatNotificationTime(n.createdAt)}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="admin-notification-dropdown-footer">
                  <NavLink to="/admin" className="admin-notification-ver-todos" onClick={() => setDropdownOpen(false)}>
                    Ver todos los pedidos
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="admin-main">
          <div className="admin-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
