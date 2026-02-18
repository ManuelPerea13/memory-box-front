import React, { useState, useEffect, useCallback } from 'react';
import api from '../../restclient/api';

const STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'En Curso',
  in_progress: 'En Curso',
  processing: 'En proceso',
  delivered: 'Entregado',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'in_progress', label: 'En Curso' },
  { value: 'delivered', label: 'Entregado' },
];

const BOX_TYPE_LABELS = {
  no_light: 'Sin Luz',
  with_light: 'Con Luz',
};

const LED_TYPE_LABELS = {
  warm_led: 'LED Cálido',
  white_led: 'LED Blanco',
};

const SHIPPING_LABELS = {
  pickup_uber: 'Retiro/Uber',
  shipping_province: 'Envío a otra provincia',
};

const VARIANT_LABELS = {
  graphite: 'Grafito',
  wood: 'Madera',
  black: 'Negro',
  marble: 'Mármol',
  graphite_light: 'Grafito',
  wood_light: 'Madera',
  black_light: 'Negro',
  marble_light: 'Mármol',
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = getBaseUrl();
  return base + (path.startsWith('/') ? path : `/${path}`);
};

const isEnCurso = (s) => s === 'in_progress' || s === 'sent';

const AdminDashboard = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const loadOrders = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getOrders()
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const handler = () => loadOrders(true);
    window.addEventListener('orders-update', handler);
    return () => window.removeEventListener('orders-update', handler);
  }, [loadOrders]);

  const filtered = pedidos.filter((p) => {
    const matchSearch =
      !search ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search));
    const matchStatus =
      !statusFilter ||
      p.status === statusFilter ||
      (statusFilter === 'in_progress' && p.status === 'sent');
    return matchSearch && matchStatus;
  });

  const enCursoCount = pedidos.filter((p) => isEnCurso(p.status)).length;

  const stats = {
    total: pedidos.length,
    draft: pedidos.filter((p) => p.status === 'draft').length,
    enCurso: enCursoCount,
    delivered: pedidos.filter((p) => p.status === 'delivered').length,
  };

  const openDetail = (id) => {
    setDetailOrder(null);
    setDetailLoading(true);
    api
      .getOrder(id)
      .then(setDetailOrder)
      .catch(() => setDetailOrder(null))
      .finally(() => setDetailLoading(false));
  };

  const boxTypeLabel = (v) => (v ? BOX_TYPE_LABELS[v] ?? v : '');
  const ledTypeLabel = (v) => (v ? LED_TYPE_LABELS[v] ?? v : '');
  const shippingLabel = (v) => (v ? SHIPPING_LABELS[v] ?? v : '');
  const variantLabel = (v) => (v ? VARIANT_LABELS[v] ?? v.replace(/_/g, ' ') : '');
  const statusLabel = (s) => (s ? STATUS_LABELS[s] ?? s : '');

  return (
    <div className="admin-dashboard-page">
      <header className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Pedidos de Cajita de la Memoria</p>
      </header>

      <div className="client-data-card admin-dashboard-card">
        <section className="admin-dashboard-stats">
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.total}</span>
            <span className="admin-stat-label">Total</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.draft}</span>
            <span className="admin-stat-label">Borrador</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.enCurso}</span>
            <span className="admin-stat-label">En Curso</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.delivered}</span>
            <span className="admin-stat-label">Entregado</span>
          </div>
        </section>

        <div className="admin-dashboard-filters">
          <input
            type="text"
            className="admin-filter-input"
            placeholder="Buscar por cliente o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <section className="admin-dashboard-orders">
          <h2 className="admin-orders-title">Pedidos</h2>
          {loading ? (
            <p className="client-data-message">Cargando pedidos...</p>
          ) : filtered.length === 0 ? (
            <p className="client-data-message">No hay pedidos que coincidan.</p>
          ) : (
            <div className="admin-orders-table-wrap">
              <table className="admin-orders-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Tipo</th>
                    <th>LED</th>
                    <th>Variante</th>
                    <th>Envío</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.client_name || '—'}</td>
                      <td>{p.phone || '—'}</td>
                      <td>{boxTypeLabel(p.box_type)}</td>
                      <td>{p.led_type ? ledTypeLabel(p.led_type) : '—'}</td>
                      <td>{variantLabel(p.variant)}</td>
                      <td>{p.shipping_option ? shippingLabel(p.shipping_option) : '—'}</td>
                      <td>
                        <span className={`admin-status admin-status-${p.status === 'sent' ? 'in_progress' : (p.status || 'draft')}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary admin-btn-ver"
                          onClick={() => openDetail(p.id)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {detailLoading && (
        <div className="admin-detail-overlay" onClick={() => setDetailLoading(false)}>
          <div className="client-data-card admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <p className="client-data-message">Cargando detalle...</p>
          </div>
        </div>
      )}

      {previewImageUrl && (
        <div
          className="admin-preview-overlay"
          onClick={() => setPreviewImageUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setPreviewImageUrl(null)}
          aria-label="Cerrar previsualización"
        >
          <img
            src={previewImageUrl}
            alt="Vista previa"
            className="admin-preview-img"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="admin-preview-close"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {detailOrder && !detailLoading && (
        <div className="admin-detail-overlay" onClick={() => { setDetailOrder(null); setPreviewImageUrl(null); }}>
          <div className="client-data-card admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-detail-header">
              <h2>Pedido #{detailOrder.id}</h2>
              <button
                type="button"
                className="admin-detail-close"
                onClick={() => setDetailOrder(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="admin-detail-body">
              <div className="admin-detail-section">
                <h3>Cliente</h3>
                <p><strong>Nombre:</strong> {detailOrder.client_name || '—'}</p>
                <p><strong>Teléfono:</strong> {detailOrder.phone || '—'}</p>
              </div>
              <div className="admin-detail-section">
                <h3>Cajita</h3>
                <p><strong>Tipo:</strong> {boxTypeLabel(detailOrder.box_type)}</p>
                {detailOrder.led_type && <p><strong>Tipo LED:</strong> {ledTypeLabel(detailOrder.led_type)}</p>}
                <p><strong>Variante:</strong> {variantLabel(detailOrder.variant)}</p>
                {detailOrder.shipping_option && <p><strong>Envío:</strong> {shippingLabel(detailOrder.shipping_option)}</p>}
                <p><strong>Estado:</strong> {statusLabel(detailOrder.status)}</p>
              </div>
              {detailOrder.created_at && (
                <p className="admin-detail-date">
                  Creado: {new Date(detailOrder.created_at).toLocaleString('es-AR')}
                </p>
              )}
              {detailOrder.qr_code && (
                <div className="admin-detail-section">
                  <h3>QR del pedido</h3>
                  <p>
                    <a href={getMediaUrl(detailOrder.qr_code)} target="_blank" rel="noopener noreferrer">
                      Ver imagen del QR
                    </a>
                    {' · '}
                    <a href={`/pedido/${detailOrder.id}`} target="_blank" rel="noopener noreferrer">
                      Página del pedido (para escanear)
                    </a>
                  </p>
                </div>
              )}
              {detailOrder.image_crops && detailOrder.image_crops.length > 0 && (
                <div className="admin-detail-section">
                  <h3>Imágenes ({detailOrder.image_crops.length})</h3>
                  <div className="admin-detail-images">
                    {detailOrder.image_crops.slice(0, 10).map((crop) => {
                      const url = crop.image ? getMediaUrl(crop.image) : null;
                      return (
                        <button
                          key={crop.id}
                          type="button"
                          className="admin-detail-thumb"
                          onClick={() => url && setPreviewImageUrl(url)}
                          disabled={!url}
                        >
                          {url ? (
                            <img src={url} alt="" />
                          ) : (
                            <span>—</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
