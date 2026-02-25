import React, { useState, useEffect } from 'react';
import api from '../../restclient/api';

const DEFAULT_COMPONENTES_CON_LUZ = [
  { nombre: 'Caja base', valor: 0 },
  { nombre: 'Tira LED / luz', valor: 0 },
  { nombre: 'Pilas', valor: 0 },
  { nombre: 'Cable', valor: 0 },
];

const DEFAULT_COSTOS = {
  cost_con_luz_componentes: DEFAULT_COMPONENTES_CON_LUZ,
  variant_grams: {},
  grams_caja_sin_luz: '',
  cost_troqueles_por_cajita: 0,
};

/** Deriva un único valor de gramos desde API (grams_caja_sin_luz o variant_grams si todos son iguales). */
const parseGramsSinLuz = (data) => {
  if (data?.grams_caja_sin_luz !== undefined && data.grams_caja_sin_luz !== null && data.grams_caja_sin_luz !== '') return data.grams_caja_sin_luz;
  const vg = data?.variant_grams;
  if (vg && typeof vg === 'object') {
    const vals = Object.values(vg).filter((v) => v !== '' && v !== undefined && v !== null);
    if (vals.length > 0 && vals.every((v) => Number(v) === Number(vals[0]))) return vals[0];
    if (vals.length > 0) return vals[0];
  }
  return '';
};

const parseCostData = (data) => {
  if (!data || typeof data !== 'object') return { ...DEFAULT_COSTOS };
  const componentes = Array.isArray(data.cost_con_luz_componentes)
    ? data.cost_con_luz_componentes.map((c) => ({
        nombre: c.nombre || c.name || '',
        valor: typeof (c.valor ?? c.value) === 'number' ? c.valor ?? c.value : 0,
      }))
    : DEFAULT_COMPONENTES_CON_LUZ;
  if (componentes.length === 0) componentes.push({ nombre: '', valor: 0 });
  const variant_grams = data.variant_grams && typeof data.variant_grams === 'object' ? data.variant_grams : {};
  return {
    cost_con_luz_componentes: componentes,
    variant_grams,
    grams_caja_sin_luz: parseGramsSinLuz(data),
    cost_troqueles_por_cajita: Number(data.cost_troqueles_por_cajita) || 0,
  };
};

const PURCHASE_CATEGORIES = [
  { value: 'burbujas', label: 'Rollo burbujas' },
  { value: 'caja_carton', label: 'Caja cartón envío' },
  { value: 'bolsa_ecommerce', label: 'Bolsa ecommerce' },
  { value: 'publicidad_instagram', label: 'Publicidad Instagram' },
  { value: 'pla_roll', label: 'Rollo PLA' },
];

const COSTOS_TABS = [
  { id: 0, label: 'Compras y gastos' },
  { id: 1, label: 'Costos de referencia' },
];

const PLA_MARCAS = [
  { value: 'Hellbot', label: 'Hellbot' },
  { value: 'Bambulab', label: 'Bambulab' },
];

const AdminCostos = () => {
  const [form, setForm] = useState(() => ({ ...DEFAULT_COSTOS }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [plaRolls, setPLARolls] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState({
    category: 'burbujas',
    date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    unit_cost: '',
    total_cost: '',
    days: '',
  });
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPLA, setSavingPLA] = useState(false);
  const [plaForm, setPLAForm] = useState({ variante: '', marca: '', cost: '', quantity: 1 });
  const GRAMOS_POR_ROLLO = 1000;
  const [editingPLAId, setEditingPLAId] = useState(null);
  const [variants, setVariants] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [activeTab, setActiveTab] = useState(0);

  const loadPLARolls = () =>
    api.getPurchases().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setPLARolls(list.filter((p) => p.category === 'pla_roll'));
    }).catch(() => setPLARolls([]));
  const loadVariants = () => api.getVariants().then((data) => setVariants(Array.isArray(data) ? data : [])).catch(() => setVariants([]));
  const loadPurchases = () => api.getPurchases().then((data) => setPurchases(Array.isArray(data) ? data : [])).catch(() => setPurchases([]));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getCosts().then((data) => (cancelled ? null : setForm(parseCostData(data)))),
      loadPLARolls().then(() => {}),
      loadVariants(),
      loadPurchases(),
    ]).catch(() => {
      if (!cancelled) setForm((f) => ({ ...f, ...DEFAULT_COSTOS }));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleChange = (field, value) => {
    const numFields = ['grams_caja_sin_luz', 'cost_troqueles_por_cajita'];
    const v = numFields.includes(field) ? (value === '' ? '' : (field === 'grams_caja_sin_luz' ? Math.max(0, Number(value)) : Number(value))) : value;
    setForm((f) => ({ ...f, [field]: v }));
    setError('');
    setMessage('');
  };

  const setComponente = (index, field, value) => {
    setForm((f) => {
      const comp = [...(f.cost_con_luz_componentes || [])];
      if (!comp[index]) comp[index] = { nombre: '', valor: 0 };
      comp[index] = { ...comp[index], [field]: field === 'valor' ? (value === '' ? '' : Number(value)) : value };
      return { ...f, cost_con_luz_componentes: comp };
    });
    setError('');
    setMessage('');
  };

  const addComponente = () => {
    setForm((f) => ({
      ...f,
      cost_con_luz_componentes: [...(f.cost_con_luz_componentes || []), { nombre: '', valor: 0 }],
    }));
  };

  const removeComponente = (index) => {
    setForm((f) => {
      const comp = [...(f.cost_con_luz_componentes || [])];
      if (comp.length <= 1) return f;
      comp.splice(index, 1);
      return { ...f, cost_con_luz_componentes: comp };
    });
  };

  const totalConLuz = (form.cost_con_luz_componentes || []).reduce(
    (acc, c) => acc + (typeof c.valor === 'number' ? c.valor : Number(c.valor) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const grams = 63;
    const variant_grams = variants.length > 0
      ? Object.fromEntries(variants.map((v) => [v.name || v.code || `Variante ${v.id}`, grams]))
      : {};
    const payload = {
      cost_con_luz_componentes: (form.cost_con_luz_componentes || []).map((c) => ({
        nombre: c.nombre || 'Componente',
        valor: c.valor === '' ? 0 : Number(c.valor),
      })),
      variant_grams,
      grams_caja_sin_luz: grams,
      cost_troqueles_por_cajita: form.cost_troqueles_por_cajita === '' ? 0 : Number(form.cost_troqueles_por_cajita),
    };
    setSaving(true);
    try {
      await api.updateCosts(payload);
      setMessage('Costos guardados correctamente.');
    } catch (err) {
      setError(
        err?.data?.detail || err?.message || 'Error al guardar. ¿El backend tiene el endpoint api/settings/costs/?'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseOrPLASubmit = async (e) => {
    e.preventDefault();
    if (purchaseForm.category === 'pla_roll') {
      handlePLAAdd(e);
      return;
    }
    setError('');
    setMessage('');
    const total = purchaseForm.total_cost !== '' ? Number(purchaseForm.total_cost) : (purchaseForm.unit_cost !== '' ? Number(purchaseForm.unit_cost) * purchaseForm.quantity : 0);
    const payload = {
      category: purchaseForm.category,
      date: purchaseForm.date,
      quantity: purchaseForm.quantity || 1,
      unit_cost: purchaseForm.unit_cost === '' ? null : Number(purchaseForm.unit_cost),
      total_cost: total,
      days: purchaseForm.days === '' ? null : Number(purchaseForm.days),
    };
    setSavingPurchase(true);
    try {
      await api.createPurchase(payload);
      setMessage('Compra registrada. Si era caja o bolsa, se sumó al stock (ver Stock → Stock de packaging).');
      setPurchaseForm((f) => ({ ...f, quantity: 1, unit_cost: '', total_cost: '', days: '' }));
      loadPurchases();
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Error al registrar compra.');
    } finally {
      setSavingPurchase(false);
    }
  };

  const handlePLAAdd = async (e) => {
    e.preventDefault();
    if (!plaForm.variante.trim() || !plaForm.marca.trim()) return;
    const qty = Math.max(1, Number(plaForm.quantity) || 1);
    const costPerRoll = plaForm.cost === '' ? 0 : Number(plaForm.cost);
    const totalCost = costPerRoll * qty;
    const gramsPerRoll = GRAMOS_POR_ROLLO;
    setError('');
    setSavingPLA(true);
    try {
      await api.createPurchase({
        category: 'pla_roll',
        date: new Date().toISOString().slice(0, 10),
        quantity: qty,
        total_cost: totalCost,
        variant: plaForm.variante.trim(),
        brand: plaForm.marca.trim(),
        grams_per_roll: gramsPerRoll,
      });
      setPLAForm({ variante: '', marca: '', cost: '', quantity: 1 });
      loadPLARolls();
      loadPurchases();
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Error al guardar rollo PLA.');
    } finally {
      setSavingPLA(false);
    }
  };

  const handlePLAUpdate = async (id, payload) => {
    setError('');
    setSavingPLA(true);
    try {
      await api.updatePurchase(id, payload);
      setEditingPLAId(null);
      loadPLARolls();
      loadPurchases();
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Error al actualizar.');
    } finally {
      setSavingPLA(false);
    }
  };

  const handlePLADelete = async (id) => {
    if (!window.confirm('¿Eliminar este costo de rollo PLA?')) return;
    setError('');
    setSavingPLA(true);
    try {
      await api.deletePurchase(id);
      loadPLARolls();
      loadPurchases();
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Error al eliminar.');
    } finally {
      setSavingPLA(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-stock-page">
        <header className="admin-page-header">
          <h1>Costos</h1>
          <p>Cargando...</p>
        </header>
      </div>
    );
  }

  const num = (v) => (v === '' ? '' : v);

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Costos</h1>
        <p>
          Registro de compras y gastos, costos PLA por variante y marca, y costos de referencia. El stock de packaging se gestiona en Stock.
        </p>
      </header>

      <div className="admin-variantes-tabs" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {COSTOS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="admin-costos-tab-btn"
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="client-data-error">{error}</p>}
      {message && <p className="admin-precios-message">{message}</p>}

      {/* Pestaña 0: Compras y gastos */}
      {activeTab === 0 && (
        <>
          <form onSubmit={handlePurchaseOrPLASubmit} className="client-data-card admin-costos-card">
            <h2 className="admin-precios-section-title">Registrar compra o gasto</h2>
            <p className="admin-costos-hint">
              Los gastos varían por compra. Si registrás cajas de cartón o bolsas ecommerce, la cantidad se suma al stock
              de packaging. El <strong>costo unitario</strong> (total de la compra ÷ cantidad) se usa en el costo de producción
              de cada pedido: por ejemplo 100 cajas a $67.000 → $670 por caja, incluido en &quot;Empaque&quot; al finalizar.
            </p>
            <div className="client-data-form-group admin-costos-categoria-wrap" style={{ marginBottom: '1rem' }}>
              <label>Categoría</label>
              <select
                value={purchaseForm.category}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, category: e.target.value }))}
                className="admin-precios-input"
              >
                {PURCHASE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {purchaseForm.category === 'pla_roll' ? (
              <div className="admin-costos-pla-inline">
                <p className="admin-costos-hint" style={{ marginBottom: '0.75rem' }}>
                  Costo por gramo = (costo total ÷ cantidad de rollos) ÷ gramos por rollo. Se usa el registro más reciente por variante para el costo de producción.
                </p>
                <div className="admin-precios-grid">
                  <div className="client-data-form-group">
                    <label>Variante</label>
                    <select
                      value={plaForm.variante}
                      onChange={(e) => setPLAForm((f) => ({ ...f, variante: e.target.value }))}
                      className="admin-precios-input"
                    >
                      <option value="">Elegir variante</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.name || v.code || ''}>{v.name || v.code || `Variante ${v.id}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="client-data-form-group">
                    <label>Marca</label>
                    <select
                      value={plaForm.marca}
                      onChange={(e) => setPLAForm((f) => ({ ...f, marca: e.target.value }))}
                      className="admin-precios-input"
                    >
                      <option value="">Elegir marca</option>
                      {PLA_MARCAS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="client-data-form-group">
                    <label>Cant. rollos</label>
                    <input
                      type="number"
                      min="1"
                      value={plaForm.quantity === '' ? '' : plaForm.quantity}
                      onChange={(e) => setPLAForm((f) => ({ ...f, quantity: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="admin-precios-input"
                      placeholder="1"
                    />
                  </div>
                  <div className="client-data-form-group">
                    <label>Costo por rollo ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Precio unitario del rollo"
                      value={plaForm.cost}
                      onChange={(e) => setPLAForm((f) => ({ ...f, cost: e.target.value }))}
                      className="admin-precios-input"
                    />
                  </div>
                </div>
                <div className="admin-precios-submit" style={{ marginTop: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingPLA || !plaForm.variante.trim() || !plaForm.marca.trim()}>
                    {savingPLA ? 'Agregando...' : 'Agregar rollo PLA'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="admin-precios-grid">
                  <div className="client-data-form-group">
                    <label>Fecha</label>
                    <input
                      type="date"
                      value={purchaseForm.date}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, date: e.target.value }))}
                      className="admin-precios-input"
                    />
                  </div>
                  <div className="client-data-form-group">
                    <label>Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={purchaseForm.quantity}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 1 }))}
                      className="admin-precios-input"
                    />
                  </div>
                  {purchaseForm.category !== 'caja_carton' && purchaseForm.category !== 'bolsa_ecommerce' && (
                    <div className="client-data-form-group">
                      <label>Costo unitario ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={purchaseForm.unit_cost}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, unit_cost: e.target.value }))}
                        className="admin-precios-input"
                        placeholder="opcional"
                      />
                    </div>
                  )}
                  <div className="client-data-form-group">
                    <label>Costo total ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.total_cost}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, total_cost: e.target.value }))}
                      className="admin-precios-input"
                      placeholder={(purchaseForm.category === 'caja_carton' || purchaseForm.category === 'bolsa_ecommerce') ? 'obligatorio' : 'obligatorio si no hay unitario'}
                    />
                  </div>
                  {purchaseForm.category === 'publicidad_instagram' && (
                    <div className="client-data-form-group">
                      <label>Días (ej. período publicidad)</label>
                      <input
                        type="number"
                        min="0"
                        value={purchaseForm.days}
                        onChange={(e) => setPurchaseForm((f) => ({ ...f, days: e.target.value }))}
                        className="admin-precios-input"
                        placeholder="opcional"
                      />
                    </div>
                  )}
                </div>
                <div className="admin-precios-submit">
                  <button type="submit" className="btn btn-primary" disabled={savingPurchase}>
                    {savingPurchase ? 'Registrando...' : 'Registrar compra'}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="client-data-card admin-costos-card">
            <h2 className="admin-precios-section-title">Últimos gastos registrados</h2>
            {purchases.length === 0 ? (
              <p className="admin-costos-hint">Aún no hay gastos registrados.</p>
            ) : (
              <div className="admin-costos-purchases-wrap">
                <table className="admin-costos-purchases-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th className="admin-costos-th-num">Cantidad</th>
                      <th className="admin-costos-th-num">Costo total</th>
                      <th className="admin-costos-th-num">Costo unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.slice(0, 25).map((p) => {
                      const total = Number(p.total_cost) || 0;
                      const qty = Number(p.quantity) || 1;
                      const unit = p.unit_cost != null && p.unit_cost !== '' ? Number(p.unit_cost) : (qty > 0 ? total / qty : 0);
                      return (
                        <tr key={p.id}>
                          <td>{p.date ? new Date(p.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td>{p.category_display || p.category || '—'}</td>
                          <td className="admin-costos-num">{qty}</td>
                          <td className="admin-costos-num">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td className="admin-costos-num">${unit.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pestaña 1: Costos de referencia */}
      {activeTab === 1 && (
      <form onSubmit={handleSubmit} className="client-data-card admin-precios-card admin-costos-card">
        <h2 className="admin-costos-main-title">Costos de referencia</h2>
        <p className="admin-costos-hint admin-costos-hint--main">
          Valores de referencia (cajita sin luz y componentes con luz). No se descuentan solos; usalos para cálculos.
        </p>

        <section className="admin-costos-block admin-costos-block--sin-luz" aria-labelledby="costos-sin-luz-title">
          <h3 id="costos-sin-luz-title" className="admin-costos-block-title">
            <span className="admin-costos-block-badge" aria-hidden>Sin luz</span>
            Cajita sin luz
          </h3>
          <h4 className="admin-costos-gramos-title">Caja base</h4>
          <p className="admin-costos-block-hint">
            Se calcula con <strong>63 g</strong> × (precio del rollo PLA ÷ 1000) según el color de la variante.
            El precio sale de los rollos PLA cargados en <strong>Compras y gastos → Rollo PLA</strong>.
          </p>
          {plaRolls.length > 0 ? (
            <div className="admin-costos-referencia-pla" style={{ marginTop: '1rem' }}>
              <p className="admin-costos-block-hint" style={{ marginBottom: '0.5rem' }}>
                Costos de referencia (Caja base) según rollos PLA cargados (costo por gramo × 63 g):
              </p>
              <ul className="admin-costos-pla-referencia-list">
                {plaRolls.map((r) => {
                  const total = Number(r.total_cost) || 0;
                  const qty = Math.max(1, Number(r.quantity) || 1);
                  const grams = Math.max(1, Number(r.grams_per_roll) || 1000);
                  const costPerGram = total / qty / grams;
                  const costoCajaBase = Math.ceil(costPerGram * 63);
                  return (
                    <li key={r.id} className="admin-costos-pla-referencia-item">
                      <span className="admin-costos-pla-referencia-variante">{r.variant || r.variante || '—'}</span>
                      <span className="admin-costos-pla-referencia-marca">{r.brand || r.marca || '—'}</span>
                      <strong className="admin-costos-pla-referencia-costo">
                        ${costoCajaBase.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="admin-costos-gramos-calculated admin-costos-gramos-calculated--muted" style={{ marginTop: '0.5rem' }}>
              Cargá rollos PLA en Compras y gastos para ver los costos de referencia.
            </p>
          )}
        </section>

        <section className="admin-costos-block admin-costos-block--con-luz" aria-labelledby="costos-con-luz-title">
          <h3 id="costos-con-luz-title" className="admin-costos-block-title">
            <span className="admin-costos-block-badge admin-costos-block-badge--con-luz" aria-hidden>Con luz</span>
            Cajita con luz — componentes
          </h3>
          <p className="admin-costos-block-hint">Desglose de costos de los componentes que llevan las cajitas con luz.</p>
          <div className="admin-costos-componentes">
          {(form.cost_con_luz_componentes || []).map((c, index) => (
            <div key={index} className="admin-costos-componente-row">
              <input
                type="text"
                placeholder="Nombre del componente"
                value={c.nombre}
                onChange={(e) => setComponente(index, 'nombre', e.target.value)}
                className="admin-precios-input admin-costos-componente-nombre"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={c.valor === '' ? '' : c.valor}
                onChange={(e) => setComponente(index, 'valor', e.target.value)}
                className="admin-precios-input admin-costos-componente-valor"
              />
              <button
                type="button"
                className="admin-costos-btn-remove"
                onClick={() => removeComponente(index)}
                disabled={(form.cost_con_luz_componentes || []).length <= 1}
                aria-label="Quitar componente"
              >
                −
              </button>
            </div>
          ))}
          <button type="button" className="admin-costos-btn-add" onClick={addComponente}>
            + Agregar componente
          </button>
          <p className="admin-costos-total">
            Total caja con luz (suma componentes): <strong>${totalConLuz.toFixed(2)}</strong>
          </p>
          </div>
        </section>

        <section className="admin-costos-block admin-costos-block--troqueles" aria-labelledby="costos-troqueles-title">
          <h3 id="costos-troqueles-title" className="admin-costos-block-title">
            <span className="admin-costos-block-badge admin-costos-block-badge--troqueles" aria-hidden>Troqueles</span>
            Troqueles (imágenes)
          </h3>
          <p className="admin-costos-block-hint">
            Costo fijo por cajita. Se aplica a cada unidad producida.
          </p>
          <div className="admin-precios-grid">
            <div className="client-data-form-group">
              <label htmlFor="cost_troqueles_por_cajita">Costo fijo por cajita ($)</label>
              <input
                id="cost_troqueles_por_cajita"
                type="number"
                min="0"
                step="0.01"
                value={num(form.cost_troqueles_por_cajita)}
                onChange={(e) => handleChange('cost_troqueles_por_cajita', e.target.value)}
                className="admin-precios-input"
              />
            </div>
          </div>
        </section>

        {error && <p className="client-data-error">{error}</p>}
        {message && <p className="admin-precios-message">{message}</p>}
        <div className="admin-precios-submit">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar costos'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

export default AdminCostos;
