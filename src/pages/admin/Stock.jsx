import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../restclient/api';
import useStockWebSocket from '../../hooks/useStockWebSocket';

const VARIANT_LABELS = {
  graphite: 'Grafito',
  wood: 'Madera',
  black: 'Negro',
  marble: 'Mármol',
};

const BOX_TYPE_LABELS = {
  no_light: 'Sin luz',
  with_light: 'Con luz',
};

const BASE_VARIANTS = ['graphite', 'wood', 'black', 'marble'];
const BOX_TYPES = ['no_light', 'with_light'];

const STOCK_TABS = [
  { id: 0, label: 'Stock de cajitas' },
  { id: 1, label: 'Stock de packaging' },
];

const toBaseVariant = (v) => (v ? v.replace(/_light$/, '') : null);
const isEnCurso = (s) => s === 'in_progress' || s === 'sent';

const stockKey = (variant, boxType) => `${variant}_${boxType || 'no_light'}`;

const AdminStock = () => {
  const [stock, setStock] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [packaging, setPackaging] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ variant: 'graphite', boxType: 'no_light', quantity: '' });
  const [popoverKey, setPopoverKey] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const popoverTriggerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (popoverKey == null) return;
    const closeOnClickOutside = (e) => {
      if (popoverTriggerRef.current && !popoverTriggerRef.current.contains(e.target)) {
        setPopoverKey(null);
      }
    };
    document.addEventListener('click', closeOnClickOutside);
    return () => document.removeEventListener('click', closeOnClickOutside);
  }, [popoverKey]);

  const loadStock = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getStock()
      .then((data) => {
        const sorted = [...(data || [])].sort((a, b) => {
          const v = (a.variant || '').localeCompare(b.variant || '');
          return v !== 0 ? v : (a.box_type || '').localeCompare(b.box_type || '');
        });
        setStock(sorted);
      })
      .catch(() => setStock([]))
      .finally(() => setLoading(false));
  }, []);

  const loadOrders = useCallback(() => {
    api.getOrders().then(setPedidos).catch(() => setPedidos([]));
  }, []);

  const loadPackaging = useCallback(() => {
    api.getPackaging().then(setPackaging).catch(() => setPackaging([]));
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadPackaging();
  }, [loadPackaging]);

  const refreshStockAndOrders = useCallback(() => {
    loadStock(true);
    loadOrders();
  }, [loadStock, loadOrders]);
  useStockWebSocket(refreshStockAndOrders);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const quantity = form.quantity === '' ? 0 : parseInt(form.quantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      setError('Ingresá una cantidad válida (número mayor o igual a 0).');
      return;
    }
    setError('');
    setLoadingAdd(true);
    try {
      await api.setStock(form.variant, form.boxType, quantity);
      setForm((f) => ({ ...f, quantity: '' }));
      loadStock();
    } catch (err) {
      setError(err?.message || 'Error al actualizar. ¿El backend tiene api/stock/set_stock/?');
    } finally {
      setLoadingAdd(false);
    }
  };

  const stockByKey = stock.reduce((acc, s) => {
    acc[stockKey(s.variant, s.box_type)] = s.quantity || 0;
    return acc;
  }, {});

  const enCursoByKey = pedidos
    .filter((p) => isEnCurso(p.status))
    .reduce((acc, p) => {
      const base = toBaseVariant(p.variant);
      const bt = p.box_type || 'no_light';
      if (base && BASE_VARIANTS.includes(base) && BOX_TYPES.includes(bt)) {
        const key = stockKey(base, bt);
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

  const enCursoOrdersByKey = pedidos
    .filter((p) => isEnCurso(p.status))
    .reduce((acc, p) => {
      const base = toBaseVariant(p.variant);
      const bt = p.box_type || 'no_light';
      if (base && BASE_VARIANTS.includes(base) && BOX_TYPES.includes(bt)) {
        const key = stockKey(base, bt);
        if (!acc[key]) acc[key] = [];
        acc[key].push({ id: p.id, client_name: p.client_name || '—' });
      }
      return acc;
    }, {});

  const buildRow = (v, bt) => {
    const key = stockKey(v, bt);
    const fisico = stockByKey[key] ?? 0;
    const enCursoV = enCursoByKey[key] || 0;
    return {
      variant: v,
      boxType: bt,
      key,
      label: VARIANT_LABELS[v],
      enCurso: enCursoV,
      stockFisico: fisico,
      stockDisponible: fisico - enCursoV,
    };
  };
  const sinLuzBreakdown = BASE_VARIANTS.map((v) => buildRow(v, 'no_light'));
  const conLuzBreakdown = BASE_VARIANTS.map((v) => buildRow(v, 'with_light'));

  const currentFisico = stockByKey[stockKey(form.variant, form.boxType)] ?? 0;

  const handleVariantOrBoxTypeChange = (variant, boxType) => {
    const key = stockKey(variant ?? form.variant, boxType ?? form.boxType);
    const fisico = stockByKey[key] ?? 0;
    setForm((f) => ({
      ...f,
      ...(variant != null && { variant }),
      ...(boxType != null && { boxType }),
      quantity: loading ? '' : fisico === 0 ? '' : String(fisico),
    }));
    setError('');
  };

  useEffect(() => {
    if (!loading && form.quantity === '' && stock.length > 0) {
      const key = stockKey(form.variant, form.boxType);
      const v = stockByKey[key] ?? 0;
      setForm((f) => ({ ...f, quantity: v === 0 ? '' : String(v) }));
    }
  }, [loading, stock.length]);

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Stock</h1>
        <p>Stock de cajitas por variante y stock de packaging (cajas de cartón y bolsas).</p>
      </header>

      <div className="admin-variantes-tabs" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {STOCK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.6rem 1.2rem',
                border: '1px solid #e2e8f0',
                borderBottom: 'none',
                marginBottom: '-1px',
                background: activeTab === tab.id ? '#f1f5f9' : 'transparent',
                color: activeTab === tab.id ? '#334155' : '#64748b',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 0 && (
      <>
      <div className="admin-stock-sections">
        <section className="admin-stock-section" aria-label="Stock Sin luz">
          <h2 className="admin-stock-section-title admin-stock-section-title--no-light">Sin luz</h2>
          <div className="admin-stock-grid admin-stock-grid--variants-only">
            {sinLuzBreakdown.map((row) => (
              <div key={row.key} className="admin-stock-card">
                <div className="admin-stock-card-title">{row.label}</div>
                <div className="admin-stock-card-block">
                  <div className="admin-stock-card-label">Stock Disponible</div>
                  <div className={`admin-stock-card-value ${row.stockDisponible > 0 ? 'admin-stock-value-pos' : row.stockDisponible < 0 ? 'admin-stock-value-neg' : ''}`}>
                    {loading ? '—' : row.stockDisponible}
                  </div>
                </div>
                <div className="admin-stock-card-block">
                  <div className="admin-stock-card-label">Stock Físico</div>
                  <div className="admin-stock-card-value admin-stock-card-value--small">
                    {loading ? '—' : row.stockFisico}
                  </div>
                </div>
                <div
                  ref={popoverKey === row.key ? popoverTriggerRef : null}
                  className="admin-stock-card-block admin-stock-card-block--popover-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverKey((prev) => (prev === row.key ? null : row.key));
                  }}
                >
                  <div className="admin-stock-card-label">Pedidos en Curso</div>
                  <div className="admin-stock-card-value admin-stock-card-value--small">
                    {row.enCurso}
                  </div>
                  {popoverKey === row.key && (enCursoOrdersByKey[row.key]?.length > 0) && (
                    <div
                      className="admin-stock-popover"
                      role="tooltip"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(enCursoOrdersByKey[row.key] || []).map((o) => (
                        <div
                          key={o.id}
                          className="admin-stock-popover-row admin-stock-popover-row--clickable"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverKey(null);
                            navigate(`/admin?ver=${o.id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPopoverKey(null);
                              navigate(`/admin?ver=${o.id}`);
                            }
                          }}
                        >
                          <span className="admin-stock-popover-id">#{o.id}</span>
                          <span className="admin-stock-popover-name">{o.client_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-stock-section" aria-label="Stock Con luz">
          <h2 className="admin-stock-section-title admin-stock-section-title--with-light">Con luz</h2>
          <div className="admin-stock-grid admin-stock-grid--variants-only">
            {conLuzBreakdown.map((row) => (
              <div key={row.key} className="admin-stock-card">
                <div className="admin-stock-card-title">{row.label}</div>
                <div className="admin-stock-card-block">
                  <div className="admin-stock-card-label">Stock Disponible</div>
                  <div className={`admin-stock-card-value ${row.stockDisponible > 0 ? 'admin-stock-value-pos' : row.stockDisponible < 0 ? 'admin-stock-value-neg' : ''}`}>
                    {loading ? '—' : row.stockDisponible}
                  </div>
                </div>
                <div className="admin-stock-card-block">
                  <div className="admin-stock-card-label">Stock Físico</div>
                  <div className="admin-stock-card-value admin-stock-card-value--small">
                    {loading ? '—' : row.stockFisico}
                  </div>
                </div>
                <div
                  ref={popoverKey === row.key ? popoverTriggerRef : null}
                  className="admin-stock-card-block admin-stock-card-block--popover-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverKey((prev) => (prev === row.key ? null : row.key));
                  }}
                >
                  <div className="admin-stock-card-label">Pedidos en Curso</div>
                  <div className="admin-stock-card-value admin-stock-card-value--small">
                    {row.enCurso}
                  </div>
                  {popoverKey === row.key && (enCursoOrdersByKey[row.key]?.length > 0) && (
                    <div
                      className="admin-stock-popover"
                      role="tooltip"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(enCursoOrdersByKey[row.key] || []).map((o) => (
                        <div
                          key={o.id}
                          className="admin-stock-popover-row admin-stock-popover-row--clickable"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverKey(null);
                            navigate(`/admin?ver=${o.id}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPopoverKey(null);
                              navigate(`/admin?ver=${o.id}`);
                            }
                          }}
                        >
                          <span className="admin-stock-popover-id">#{o.id}</span>
                          <span className="admin-stock-popover-name">{o.client_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="client-data-card admin-stock-form-card">
        <h2 className="admin-stock-form-title">Editar stock físico</h2>
        <p className="admin-stock-form-desc">Definí la cantidad en estante por variante y tipo (sin/con luz). Actual: {loading ? '—' : currentFisico} unidades.</p>
        <form onSubmit={handleSubmit} className="admin-stock-form">
          <div className="admin-stock-form-row">
            <div className="client-data-form-group admin-stock-form-field">
              <select
                id="stock-variant"
                aria-label="Variante"
                value={form.variant}
                onChange={(e) => handleVariantOrBoxTypeChange(e.target.value, null)}
                className="admin-stock-select"
              >
                {Object.entries(VARIANT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="client-data-form-group admin-stock-form-field">
              <select
                id="stock-box-type"
                aria-label="Tipo (sin/con luz)"
                value={form.boxType}
                onChange={(e) => handleVariantOrBoxTypeChange(null, e.target.value)}
                className="admin-stock-select"
              >
                {Object.entries(BOX_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="client-data-form-group admin-stock-form-field">
              <input
                id="stock-quantity"
                type="number"
                aria-label="Stock físico en estante"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder={loading ? '—' : currentFisico === 0 ? '0' : String(currentFisico)}
                className="admin-stock-input"
              />
            </div>
            <div className="admin-stock-form-submit">
              <button type="submit" className="btn btn-primary" disabled={loadingAdd || loading}>
                {loadingAdd ? 'Guardando...' : 'Actualizar stock'}
              </button>
            </div>
          </div>
          {error && <p className="client-data-error">{error}</p>}
        </form>
      </div>
      </>
      )}

      {activeTab === 1 && (
        <div className="client-data-card admin-costos-card">
          <h2 className="admin-precios-section-title">Stock de packaging</h2>
          <p className="admin-costos-hint">
            Se descuentan automáticamente 1 caja y 1 bolsa por cada pedido que pasa a estado <strong>Finalizada</strong>.
            Las compras de cajas de cartón o bolsas ecommerce se registran en Costos y suman a este stock.
          </p>
          <div className="admin-costos-packaging-grid">
            {packaging.map((p) => (
              <div key={p.id} className="admin-costos-packaging-item">
                <span className="admin-costos-packaging-label">
                  {p.item_type_display || (p.item_type === 'caja_carton' ? 'Caja de cartón (envío)' : 'Bolsa ecommerce')}
                </span>
                <span className="admin-costos-packaging-qty">{p.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStock;
