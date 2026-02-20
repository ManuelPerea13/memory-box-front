import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import JSZip from 'jszip';
import api from '../../restclient/api';

const getCroppedBlob = (imageUrl, pixelCrop) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
          0, 0, pixelCrop.width, pixelCrop.height
        );
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });

const getExtension = (pathOrUrl) => {
  if (!pathOrUrl) return '.jpg';
  const match = pathOrUrl.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  return match ? '.' + match[1].toLowerCase() : '.jpg';
};

const sanitizeFileName = (name) => {
  if (!name || typeof name !== 'string') return 'cliente';
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'cliente';
};

const STATUS_LABELS = {
  draft: 'Borrador',
  sent: 'En Proceso',
  in_progress: 'En Proceso',
  processing: 'Finalizada',
  delivered: 'Entregada',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'in_progress', label: 'En Proceso' },
  { value: 'processing', label: 'Finalizada' },
  { value: 'delivered', label: 'Entregada' },
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

/** Path for media: backend serves at /media/; API may return path with or without /media/. */
const toMediaPath = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const raw = path.startsWith('/') ? path.slice(1) : path;
  const withMedia = raw.startsWith('media/') ? `/${raw}` : `/media/${raw}`;
  return withMedia;
};

const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const p = toMediaPath(path);
  return p ? getBaseUrl() + p : null;
};

/** URL for fetch: use full backend URL as-is if provided; otherwise same-origin (proxy). */
const getMediaUrlSameOrigin = (path) => {
  if (!path) return null;
  // API can return full URL (e.g. http://192.168.88.100:8000/media/...) — use as-is
  if (path.startsWith('http')) return path;
  if (typeof window === 'undefined') return getBaseUrl() + toMediaPath(path);
  const p = toMediaPath(path);
  if (!p) return null;
  return `${window.location.origin}${p}`;
};

const isEnCurso = (s) => s === 'in_progress' || s === 'sent';

const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showHiddenOrders, setShowHiddenOrders] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewGallery, setPreviewGallery] = useState(null); // { urls: string[], currentIndex: number }
  const [updatingSenaId, setUpdatingSenaId] = useState(null);
  const [hidingOrderId, setHidingOrderId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [downloadingZipId, setDownloadingZipId] = useState(null);
  const [zipError, setZipError] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [cropEditor, setCropEditor] = useState(null);
  const adminCropPixelsRef = useRef(null);
  const previewOverlayRef = useRef(null);

  const loadOrders = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getOrders(true)
      .then(setPedidos)
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, []);

  const loadOrdersWithCurrentFilter = useCallback((silent = false) => loadOrders(silent), [loadOrders]);

  useEffect(() => {
    loadOrdersWithCurrentFilter();
  }, [loadOrdersWithCurrentFilter]);

  useEffect(() => {
    const handler = () => loadOrdersWithCurrentFilter(true);
    window.addEventListener('orders-update', handler);
    return () => window.removeEventListener('orders-update', handler);
  }, [loadOrdersWithCurrentFilter]);

  useEffect(() => {
    if (openMenuId == null) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    if (cropEditor && !cropEditor.crop) setCropEditor(null);
  }, [cropEditor]);

  useEffect(() => {
    if (previewGallery && previewOverlayRef.current) {
      previewOverlayRef.current.focus();
    }
  }, [previewGallery]);

  const onToggleShowHidden = () => {
    setShowHiddenOrders((prev) => !prev);
  };

  const filtered = pedidos.filter((p) => {
    const visible = showHiddenOrders || p.active !== false;
    const matchSearch =
      !search ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search));
    const matchStatus =
      !statusFilter ||
      p.status === statusFilter ||
      (statusFilter === 'in_progress' && p.status === 'sent');
    return visible && matchSearch && matchStatus;
  });

  const enCursoCount = pedidos.filter((p) => isEnCurso(p.status)).length;

  const stats = {
    total: pedidos.length,
    draft: pedidos.filter((p) => p.status === 'draft').length,
    enCurso: enCursoCount,
    processing: pedidos.filter((p) => p.status === 'processing').length,
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

  useEffect(() => {
    const verId = searchParams.get('ver');
    if (!verId) return;
    openDetail(Number(verId));
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const hideDraft = (e, orderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (hidingOrderId != null) return;
    setHidingOrderId(orderId);
    api
      .patchOrder(orderId, { active: false })
      .then(() => {
        setPedidos((prev) => prev.filter((p) => p.id !== orderId));
        if (detailOrder?.id === orderId) setDetailOrder(null);
      })
      .catch(() => {})
      .finally(() => setHidingOrderId(null));
  };

  const showOrder = (e, orderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (hidingOrderId != null) return;
    setHidingOrderId(orderId);
    api
      .patchOrder(orderId, { active: true })
      .then(() => loadOrdersWithCurrentFilter(true))
      .catch(() => {})
      .finally(() => setHidingOrderId(null));
  };

  const changeOrderStatus = (orderId, newStatus) => {
    if (updatingStatusId != null) return;
    setOpenMenuId(null);
    setUpdatingStatusId(orderId);
    api
      .patchOrder(orderId, { status: newStatus })
      .then(() => {
        setPedidos((prev) =>
          prev.map((p) => (p.id === orderId ? { ...p, status: newStatus } : p))
        );
        if (detailOrder?.id === orderId) {
          setDetailOrder((d) => (d ? { ...d, status: newStatus } : d));
        }
      })
      .catch(() => {})
      .finally(() => setUpdatingStatusId(null));
  };

  const toggleSena = (e, orderId, currentDeposit) => {
    e.preventDefault();
    e.stopPropagation();
    if (updatingSenaId != null) return;
    setUpdatingSenaId(orderId);
    const clearUpdating = () => setUpdatingSenaId(null);
    const fallback = setTimeout(clearUpdating, 8000);
    const newValue = !currentDeposit;
    api
      .patchOrder(orderId, { deposit: newValue })
      .then(() => {
        setPedidos((prev) =>
          prev.map((p) => (p.id === orderId ? { ...p, deposit: newValue } : p))
        );
        if (detailOrder?.id === orderId) {
          setDetailOrder((d) => (d ? { ...d, deposit: newValue } : d));
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        clearUpdating();
      });
  };

  const downloadOrderZip = useCallback(async (order) => {
    if (downloadingZipId != null) return;
    setOpenMenuId(null);
    setZipError(null);
    setDownloadingZipId(order.id);
    try {
      const orderDetail = await api.getOrder(order.id);
      const crops = (orderDetail.image_crops || []).slice(0, 10);
      const qrPath = orderDetail.qr_code;
      const ext = crops.length > 0 && crops[0].image
        ? getExtension(crops[0].image)
        : '.jpg';

      const zip = new JSZip();
      const opts = { credentials: 'include' };

      for (let i = 0; i < crops.length; i++) {
        const path = crops[i].image;
        if (!path) continue;
        const url = getMediaUrlSameOrigin(path);
        if (!url) continue;
        const res = await fetch(url, opts);
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(`${i + 1}${ext}`, blob);
      }

      if (qrPath) {
        const qrUrl = getMediaUrlSameOrigin(qrPath);
        let qrBlob = null;
        if (crops.length > 0 && crops[0].image) {
          try {
            const firstUrl = getMediaUrlSameOrigin(crops[0].image);
            const size = await new Promise((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
              img.onerror = reject;
              img.src = firstUrl;
            });
            qrBlob = await new Promise((resolve, reject) => {
              const qrImg = new Image();
              qrImg.crossOrigin = 'anonymous';
              qrImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size.w;
                canvas.height = size.h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(qrImg, 0, 0, size.w, size.h);
                canvas.toBlob(
                  (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
                  'image/jpeg',
                  0.92
                );
              };
              qrImg.onerror = reject;
              qrImg.src = qrUrl;
            });
          } catch {
            const res = await fetch(qrUrl, opts);
            if (res.ok) qrBlob = await res.blob();
          }
        } else {
          const res = await fetch(qrUrl, opts);
          if (res.ok) qrBlob = await res.blob();
        }
        if (qrBlob) zip.file(`11${ext}`, qrBlob);
      }

      const date = orderDetail.created_at ? new Date(orderDetail.created_at) : new Date();
      const yyyymmdd =
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
      const name = sanitizeFileName(orderDetail.client_name);
      const filename = `${yyyymmdd}-${name}.zip`;

      const count = Object.keys(zip.files).length;
      if (count === 0) {
        setZipError('No se pudo obtener ninguna imagen. ¿El pedido tiene imágenes subidas?');
        return;
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Error al generar zip:', err);
      setZipError(err?.message || 'Error al generar el zip. Revisa la consola.');
    } finally {
      setDownloadingZipId(null);
    }
  }, [downloadingZipId]);

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
        {zipError && (
          <div className="admin-zip-error" role="alert">
            <span>{zipError}</span>
            <button type="button" onClick={() => setZipError(null)} aria-label="Cerrar">×</button>
          </div>
        )}
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
            <span className="admin-stat-label">En Proceso</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.processing}</span>
            <span className="admin-stat-label">Finalizada</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-value">{stats.delivered}</span>
            <span className="admin-stat-label">Entregada</span>
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
          <label className="admin-filter-checkbox">
            <input
              type="checkbox"
              checked={showHiddenOrders}
              onChange={onToggleShowHidden}
            />
            <span>Ver pedidos ocultos</span>
          </label>
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
                    <th>Variante</th>
                    <th>Tipo</th>
                    <th>LED</th>
                    <th>Envío</th>
                    <th>Estado</th>
                    <th>Seña</th>
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
                      <td>{variantLabel(p.variant)}</td>
                      <td>{boxTypeLabel(p.box_type)}</td>
                      <td>{p.led_type ? ledTypeLabel(p.led_type) : '—'}</td>
                      <td>{p.shipping_option ? shippingLabel(p.shipping_option) : '—'}</td>
                      <td>
                        <span className={`admin-status admin-status-${p.status === 'sent' ? 'in_progress' : (p.status || 'draft')}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.deposit === true}
                          aria-label={p.deposit ? 'Seña recibida' : 'Seña pendiente'}
                          className={`admin-toggle ${p.deposit ? 'admin-toggle-on' : ''}`}
                          disabled={updatingSenaId === p.id}
                          onClick={(ev) => toggleSena(ev, p.id, !!p.deposit)}
                        >
                          <span className="admin-toggle-thumb" />
                        </button>
                      </td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '—'}</td>
                      <td className="admin-orders-actions">
                        <div
                          className="admin-orders-menu-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-btn-menu-trigger"
                            onClick={() => setOpenMenuId((id) => (id === p.id ? null : p.id))}
                            aria-expanded={openMenuId === p.id}
                            aria-haspopup="true"
                            aria-label="Abrir menú de acciones"
                          >
                            <span className="admin-btn-menu-dots" aria-hidden>⋯</span>
                          </button>
                          {openMenuId === p.id && (
                            <div className="admin-orders-dropdown" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-orders-dropdown-item admin-orders-dropdown-ver"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  openDetail(p.id);
                                }}
                              >
                                Ver
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-orders-dropdown-item admin-orders-dropdown-zip"
                                disabled={downloadingZipId === p.id}
                                onClick={() => downloadOrderZip(p)}
                              >
                                {downloadingZipId === p.id ? '...' : 'Descargar zip'}
                              </button>
                              {(p.status === 'draft' || p.status === 'delivered') && p.active !== false && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-orders-dropdown-item admin-orders-dropdown-ocultar"
                                  disabled={hidingOrderId === p.id}
                                  onClick={(ev) => {
                                    setOpenMenuId(null);
                                    hideDraft(ev, p.id);
                                  }}
                                >
                                  {hidingOrderId === p.id ? '...' : 'Ocultar'}
                                </button>
                              )}
                              {showHiddenOrders && p.active === false && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-orders-dropdown-item admin-orders-dropdown-mostrar"
                                  disabled={hidingOrderId === p.id}
                                  onClick={(ev) => {
                                    setOpenMenuId(null);
                                    showOrder(ev, p.id);
                                  }}
                                >
                                  {hidingOrderId === p.id ? '...' : 'Mostrar'}
                                </button>
                              )}
                              {(p.status === 'in_progress' || p.status === 'sent') && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-orders-dropdown-item admin-orders-dropdown-status"
                                  disabled={updatingStatusId === p.id}
                                  onClick={() => changeOrderStatus(p.id, 'processing')}
                                >
                                  {updatingStatusId === p.id ? '...' : 'Pasar a Finalizado'}
                                </button>
                              )}
                              {p.status === 'processing' && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-orders-dropdown-item admin-orders-dropdown-status"
                                  disabled={updatingStatusId === p.id}
                                  onClick={() => changeOrderStatus(p.id, 'delivered')}
                                >
                                  {updatingStatusId === p.id ? '...' : 'Pasar a Entregado'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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

      {previewGallery && previewGallery.urls.length > 0 && (
        <div
          ref={previewOverlayRef}
          className="admin-preview-overlay"
          onClick={() => setPreviewGallery(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPreviewGallery(null);
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setPreviewGallery((g) => ({
                ...g,
                currentIndex: (g.currentIndex - 1 + g.urls.length) % g.urls.length,
              }));
            }
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setPreviewGallery((g) => ({
                ...g,
                currentIndex: (g.currentIndex + 1) % g.urls.length,
              }));
            }
          }}
          aria-label="Vista previa de imagen"
        >
          <button
            type="button"
            className="admin-preview-nav admin-preview-nav-left"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewGallery((g) => ({
                ...g,
                currentIndex: (g.currentIndex - 1 + g.urls.length) % g.urls.length,
              }));
            }}
            aria-label="Foto anterior"
          />
          <div className="admin-preview-img-wrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewGallery.urls[previewGallery.currentIndex]}
              alt={`Vista previa ${previewGallery.currentIndex + 1} de ${previewGallery.urls.length}`}
              className="admin-preview-img"
            />
          </div>
          <button
            type="button"
            className="admin-preview-nav admin-preview-nav-right"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewGallery((g) => ({
                ...g,
                currentIndex: (g.currentIndex + 1) % g.urls.length,
              }));
            }}
            aria-label="Foto siguiente"
          />
          <button
            type="button"
            className="admin-preview-close"
            onClick={() => setPreviewGallery(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {detailOrder && !detailLoading && (
        <div className="admin-detail-overlay" onClick={() => { setDetailOrder(null); setPreviewGallery(null); }}>
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
                <p className="admin-detail-row-with-toggle">
                  <strong>Seña:</strong>{' '}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={detailOrder.deposit === true}
                    aria-label={detailOrder.deposit ? 'Seña recibida' : 'Seña pendiente'}
                    className={`admin-toggle ${detailOrder.deposit ? 'admin-toggle-on' : ''}`}
                    disabled={updatingSenaId === detailOrder.id}
                    onClick={(ev) => toggleSena(ev, detailOrder.id, !!detailOrder.deposit)}
                  >
                    <span className="admin-toggle-thumb" />
                  </button>
                </p>
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
              {detailOrder.image_crops && detailOrder.image_crops.length > 0 && (() => {
                const previewUrls = (detailOrder.image_crops || [])
                  .filter((c) => c.image)
                  .map((c) => getMediaUrl(c.image));
                return (
                <div className="admin-detail-section">
                  <h3>Imágenes ({detailOrder.image_crops.length})</h3>
                  <p className="admin-detail-images-hint">Clic derecho sobre una imagen para reemplazarla.</p>
                  <div className="admin-detail-images">
                    {detailOrder.image_crops.slice(0, 10).map((crop) => {
                      const url = crop.image ? getMediaUrl(crop.image) : null;
                      return (
                        <div
                          key={crop.id}
                          role="button"
                          tabIndex={0}
                          className="admin-detail-thumb"
                          onClick={() => url && setPreviewGallery({ urls: previewUrls, currentIndex: previewUrls.indexOf(url) })}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({ x: e.clientX, y: e.clientY, crop });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (url) setPreviewGallery({ urls: previewUrls, currentIndex: previewUrls.indexOf(url) });
                            }
                          }}
                        >
                          {url ? (
                            <img src={url} alt="" />
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="admin-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="admin-context-menu-item"
            onClick={() => {
              setCropEditor({
                crop: contextMenu.crop,
                step: 'select',
                file: null,
                objectUrl: null,
                cropArea: { x: 0, y: 0 },
                zoom: 1,
              });
              setContextMenu(null);
            }}
          >
            Reemplazar imagen
          </button>
        </div>
      )}

      {cropEditor?.crop && (
        <div className="admin-detail-overlay admin-crop-editor-overlay">
          <div className="admin-crop-editor-modal">
            <div className="admin-crop-editor-header">
              <h3>Reemplazar imagen (slot {(cropEditor.crop.slot ?? 0) + 1})</h3>
              <button
                type="button"
                className="admin-detail-close"
                onClick={() => !cropEditor.saving && setCropEditor(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {cropEditor.step === 'select' && (
              <div className="admin-crop-editor-select">
                <p>Elegí una imagen nueva para este slot.</p>
                <input
                  id="admin-crop-editor-file"
                  type="file"
                  accept="image/*"
                  className="admin-crop-editor-file-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    setCropEditor((prev) => ({
                      ...prev,
                      step: 'crop',
                      file,
                      objectUrl,
                    }));
                  }}
                />
                <label htmlFor="admin-crop-editor-file" className="btn btn-primary">
                  Seleccionar archivo
                </label>
              </div>
            )}
            {cropEditor.step === 'crop' && cropEditor.objectUrl && (
              <div className="admin-crop-editor-crop">
                <div className="admin-crop-editor-crop-wrap">
                  <Cropper
                    image={cropEditor.objectUrl}
                    crop={cropEditor.cropArea}
                    zoom={cropEditor.zoom}
                    aspect={1}
                    onCropChange={(area) => setCropEditor((prev) => ({ ...prev, cropArea: area }))}
                    onZoomChange={(z) => setCropEditor((prev) => ({ ...prev, zoom: z }))}
                    onCropComplete={(_, croppedAreaPixels) => {
                      adminCropPixelsRef.current = croppedAreaPixels;
                    }}
                    cropShape="rect"
                    showGrid
                  />
                </div>
                <div className="admin-crop-editor-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (cropEditor.objectUrl) URL.revokeObjectURL(cropEditor.objectUrl);
                      setCropEditor((prev) => ({ ...prev, step: 'select', file: null, objectUrl: null }));
                    }}
                  >
                    Elegir otra
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={cropEditor.saving}
                    onClick={async () => {
                      const pixels = adminCropPixelsRef.current;
                      if (!pixels || !cropEditor.objectUrl) return;
                      setCropEditor((prev) => ({ ...prev, saving: true }));
                      try {
                        const blob = await getCroppedBlob(cropEditor.objectUrl, pixels);
                        const file = new File([blob], `crop_${cropEditor.crop?.slot ?? 0}.jpg`, { type: 'image/jpeg' });
                        const orderId = detailOrder?.id ?? cropEditor.crop?.order;
                        if (!orderId) throw new Error('Falta el pedido');
                        if (!cropEditor.crop?.id) throw new Error('Falta el crop');
                        await api.replaceImageCrop(cropEditor.crop.id, orderId, file);
                        if (cropEditor.objectUrl) URL.revokeObjectURL(cropEditor.objectUrl);
                        setCropEditor(null);
                        if (detailOrder?.id) {
                          const updated = await api.getOrder(detailOrder.id);
                          setDetailOrder(updated);
                        }
                      } catch (err) {
                        console.error(err);
                        setCropEditor((prev) => ({ ...prev, saving: false }));
                      }
                    }}
                  >
                    {cropEditor.saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
