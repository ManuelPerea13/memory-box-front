import React, { useState, useEffect, useCallback } from 'react';
import api from '../../restclient/api';
import useStockWebSocket from '../../hooks/useStockWebSocket';

const VARIANT_LABELS = {
  graphite: 'Grafito',
  wood: 'Madera',
  black: 'Negro',
  marble: 'Mármol',
};

const BASE_VARIANTS = ['graphite', 'wood', 'black', 'marble'];
const toBaseVariant = (v) => (v ? v.replace(/_light$/, '') : null);
const isEnCurso = (s) => s === 'in_progress' || s === 'sent';

const AdminStock = () => {
  const [stock, setStock] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ variant: 'graphite', quantity: '' });

  const loadStock = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getStock()
      .then((data) => {
        const sorted = [...(data || [])].sort((a, b) =>
          (a.variant || '').localeCompare(b.variant || '')
        );
        setStock(sorted);
      })
      .catch(() => setStock([]))
      .finally(() => setLoading(false));
  }, []);

  const loadOrders = useCallback(() => {
    api.getOrders().then(setPedidos).catch(() => setPedidos([]));
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
      await api.setStock(form.variant, quantity);
      setForm((f) => ({ ...f, quantity: '' }));
      loadStock();
    } catch (err) {
      setError(err?.message || 'Error al actualizar. ¿El backend tiene api/stock/set_stock/?');
    } finally {
      setLoadingAdd(false);
    }
  };

  const stockByVariant = stock.reduce((acc, s) => {
    acc[s.variant] = s.quantity || 0;
    return acc;
  }, {});

  const enCursoByVariant = pedidos
    .filter((p) => isEnCurso(p.status))
    .reduce((acc, p) => {
      const base = toBaseVariant(p.variant);
      if (base && BASE_VARIANTS.includes(base)) {
        acc[base] = (acc[base] || 0) + 1;
      }
      return acc;
    }, {});

  const variantBreakdown = BASE_VARIANTS.map((v) => {
    const fisico = stockByVariant[v] ?? 0;
    const enCursoV = enCursoByVariant[v] || 0;
    return {
      variant: v,
      label: VARIANT_LABELS[v],
      enCurso: enCursoV,
      stockFisico: fisico,
      stockDisponible: fisico - enCursoV,
    };
  });

  const currentFisico = stockByVariant[form.variant] ?? 0;

  const handleVariantChange = (variant) => {
    const fisico = stockByVariant[variant] ?? 0;
    setForm((f) => ({ ...f, variant, quantity: loading ? '' : fisico === 0 ? '' : String(fisico) }));
    setError('');
  };

  useEffect(() => {
    if (!loading && form.quantity === '' && stock.length > 0) {
      const v = stockByVariant[form.variant] ?? 0;
      setForm((f) => ({ ...f, quantity: v === 0 ? '' : String(v) }));
    }
  }, [loading, stock.length]);

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Stock de cajitas</h1>
        <p>Editá el stock físico disponible por variante.</p>
      </header>

      <div className="admin-stock-grid admin-stock-grid--variants-only">
        {variantBreakdown.map((row) => (
          <div key={row.variant} className="admin-stock-card">
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
            <div className="admin-stock-card-block">
              <div className="admin-stock-card-label">Pedidos en Curso</div>
              <div className="admin-stock-card-value admin-stock-card-value--small">
                {row.enCurso}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="client-data-card admin-stock-form-card">
        <h2 className="admin-stock-form-title">Editar stock físico</h2>
        <p className="admin-stock-form-desc">Definí la cantidad en estante para cada variante. Actual: {loading ? '—' : currentFisico} unidades.</p>
        <form onSubmit={handleSubmit} className="admin-stock-form">
          <div className="admin-stock-form-row">
            <div className="client-data-form-group admin-stock-form-field">
              <select
                id="stock-variant"
                aria-label="Variante"
                value={form.variant}
                onChange={(e) => handleVariantChange(e.target.value)}
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
    </div>
  );
};

export default AdminStock;
