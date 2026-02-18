import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../restclient/api';

// API uses English keys/values; labels shown in Spanish
const VARIANTS = {
  no_light: [
    { id: 'graphite', name: 'Grafito', images: ['Grafito1.jpg', 'Grafito2.jpg', 'Grafito3.jpg', 'Grafito4.jpg'] },
    { id: 'wood', name: 'Madera', images: ['Madera1.jpg', 'Madera2.jpg', 'Madera3.jpg', 'Madera4.jpg'] },
    { id: 'black', name: 'Negro', images: ['Negro1.jpg', 'Negro2.jpg', 'Negro3.jpg'] },
    { id: 'marble', name: 'Mármol', images: ['Marmol1.jpg', 'Marmol2.jpg', 'Marmol3.jpg', 'Marmol4.jpg'] },
  ],
  with_light: [
    { id: 'graphite_light', name: 'Grafito', images: ['Grafito1.jpg', 'Grafito2.jpg', 'Grafito3.jpg', 'Grafito4.jpg'] },
    { id: 'wood_light', name: 'Madera', images: ['Madera-luz-1.jpg', 'Madera-luz-2.jpg', 'Madera-luz-3.jpg', 'Madera-luz-4.jpg'] },
    { id: 'black_light', name: 'Negro', images: ['Negro-luz-1.jpg', 'Negro-luz-2.jpg', 'Negro-luz-3.jpg', 'Negro-luz-4.jpg'] },
    { id: 'marble_light', name: 'Mármol', images: ['Marmol-luz-1.jpg', 'Marmol-luz-2.jpg', 'Marmol-luz-3.jpg', 'Marmol-luz-4.jpg'] },
  ],
};

const ClientData = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre_cliente: '',
    telefono: '',
    box_type: 'no_light',
    led_type: 'warm_led',
    variant: '',
    shipping_option: 'pickup_uber',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalVariant, setModalVariant] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'box_type') {
        next.variant = '';
        if (value === 'no_light') next.led_type = '';
        else next.led_type = 'warm_led';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.variant) {
      setError('Selecciona una variante de caja');
      return;
    }
    if (form.box_type === 'with_light' && !form.led_type) {
      setError('Selecciona el tipo de LED');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        client_name: form.nombre_cliente,
        phone: form.telefono,
        box_type: form.box_type,
        variant: form.variant,
        shipping_option: form.shipping_option,
      };
      if (form.box_type === 'with_light') payload.led_type = form.led_type;
      const order = await api.createOrder(payload);
      navigate(`/editor/${order.id}`);
    } catch (err) {
      setError(err.message || 'Error al crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const variants = VARIANTS[form.box_type] || [];
  const conLuz = form.box_type === 'with_light';

  return (
    <div className="client-data-page">
      <div className="client-data-card">
        <header className="client-data-header">
          <h1>
            <span className="client-data-icon" aria-hidden>📦</span>
            Pedido de Caja de la Memoria
          </h1>
          <p>Completa los datos del cliente para continuar</p>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="client-data-form-group">
            <label htmlFor="nombre_cliente">
              <span className="label-icon" aria-hidden>👤</span>
              Nombre Completo *
            </label>
            <input
              id="nombre_cliente"
              type="text"
              name="nombre_cliente"
              value={form.nombre_cliente}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div className="client-data-form-group">
            <label htmlFor="telefono">
              <span className="label-icon" aria-hidden>📱</span>
              Número de teléfono: *
            </label>
            <input
              id="telefono"
              type="tel"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="+54 9 11 1234 5678"
              required
            />
          </div>

          {/* Tipo de caja */}
          <div className="client-data-form-group">
            <label>
              <span className="label-icon" aria-hidden>💡</span>
              Tipo de caja:
            </label>
            <div className="client-data-light-options">
              <label className={`client-data-light-option ${form.box_type === 'no_light' ? 'selected' : ''}`}>
                <input type="radio" name="box_type" value="no_light" checked={form.box_type === 'no_light'} onChange={handleChange} />
                <span className="light-icon">🔲</span>
                <span className="light-name">Sin Luz</span>
              </label>
              <label className={`client-data-light-option con-luz ${form.box_type === 'with_light' ? 'selected' : ''}`}>
                <input type="radio" name="box_type" value="with_light" checked={form.box_type === 'with_light'} onChange={handleChange} />
                <span className="light-icon">💡</span>
                <span className="light-name">Con Luz</span>
              </label>
            </div>
          </div>

          {/* Tipo de LED - solo Con Luz */}
          {conLuz && (
            <div className="client-data-form-group">
              <label>
                <span className="label-icon" aria-hidden>🔆</span>
                Tipo de LED:
              </label>
              <div className="client-data-light-options">
                <label className={`client-data-light-option ${form.led_type === 'warm_led' ? 'selected' : ''}`}>
                  <input type="radio" name="led_type" value="warm_led" checked={form.led_type === 'warm_led'} onChange={handleChange} />
                  <span className="light-icon">🟠</span>
                  <span className="light-name">LED Cálido</span>
                </label>
                <label className={`client-data-light-option ${form.led_type === 'white_led' ? 'selected' : ''}`}>
                  <input type="radio" name="led_type" value="white_led" checked={form.led_type === 'white_led'} onChange={handleChange} />
                  <span className="light-icon">⚪</span>
                  <span className="light-name">LED Blanco</span>
                </label>
              </div>
            </div>
          )}

          {/* Variante de caja */}
          <div className="client-data-form-group">
            <label>
              <span className="label-icon" aria-hidden>🎨</span>
              Variante de caja:
            </label>
            <div className="client-data-variants-grid">
              {variants.map((v) => (
                <label key={v.id} className={`client-data-variant-option ${form.variant === v.id ? 'selected' : ''}`}>
                  <input type="radio" name="variant" value={v.id} checked={form.variant === v.id} onChange={handleChange} />
                  <div className="variant-image-wrap">
                    <img src={`/static/variants/${v.images[0]}`} alt={v.name} />
                    <button
                      type="button"
                      className="variant-plus-fotos"
                      onClick={(ev) => { ev.preventDefault(); setModalVariant(v); }}
                    >
                      + fotos
                    </button>
                  </div>
                  <span className="variant-name">{v.name}</span>
                </label>
              ))}
            </div>
            {conLuz && (
              <p className="client-data-pilas">🔋 Pilas ya incluidas</p>
            )}
          </div>

          {/* Opción de envío/retiro */}
          <div className="client-data-form-group">
            <label>
              <span className="label-icon" aria-hidden>🚚</span>
              Opción de envío/retiro:
            </label>
            <div className="client-data-shipping-options">
              <label className={`client-data-shipping-option ${form.shipping_option === 'pickup_uber' ? 'selected' : ''}`}>
                <input type="radio" name="shipping_option" value="pickup_uber" checked={form.shipping_option === 'pickup_uber'} onChange={handleChange} />
                <span className="shipping-icon">🚗</span>
                <span className="shipping-name">Voy a retirar/envío un Uber</span>
              </label>
              <label className={`client-data-shipping-option ${form.shipping_option === 'shipping_province' ? 'selected' : ''}`}>
                <input type="radio" name="shipping_option" value="shipping_province" checked={form.shipping_option === 'shipping_province'} onChange={handleChange} />
                <span className="shipping-icon">📦</span>
                <span className="shipping-name">
                  Necesito envío a otra provincia
                  <small>(con cargo adicional. info por WhatsApp)</small>
                </span>
              </label>
            </div>
          </div>

          {error && <p className="client-data-error">{error}</p>}

          <div className="client-data-buttons">
            <Link to="/" className="btn btn-secondary client-data-btn-back">
              ← Volver al Inicio
            </Link>
            <button type="submit" className="btn btn-primary client-data-btn-submit" disabled={loading}>
              {loading ? 'Creando...' : 'Selección de Imágenes →'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal fotos variante */}
      {modalVariant && (
        <div className="client-data-modal-overlay" onClick={() => setModalVariant(null)}>
          <div className="client-data-modal" onClick={(e) => e.stopPropagation()}>
            <div className="client-data-modal-header">
              <h3>{modalVariant.name}</h3>
              <button type="button" className="client-data-modal-close" onClick={() => setModalVariant(null)} aria-label="Cerrar">&times;</button>
            </div>
            <div className="client-data-modal-images">
              {modalVariant.images.map((img, i) => (
                <img key={i} src={`/static/variants/${img}`} alt={`${modalVariant.name} ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientData;
