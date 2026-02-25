import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../restclient/api';

// Formatea nombre: primera letra de cada palabra en mayúscula, resto en minúscula.
// Igual que catriel-front formatName: split(' ') sin trim para no borrar espacios al escribir.
const formatNombreCompleto = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
};

// Solo lo que ingresa el usuario: código de área + número (10 dígitos). El back agrega +54 9.
const PHONE_MAX_DIGITS = 10;

// Solo dígitos, espacios y +; no más de PHONE_MAX_DIGITS dígitos. El backend normaliza a E.164.
const sanitizePhoneInput = (value) => {
  if (!value || typeof value !== 'string') return '';
  const cleaned = value.replace(/[^\d\s+]/g, '');
  let digitCount = 0;
  let result = '';
  for (const ch of cleaned) {
    if (ch >= '0' && ch <= '9') {
      if (digitCount >= PHONE_MAX_DIGITS) continue;
      digitCount++;
    }
    result += ch;
  }
  return result;
};

/** Mapeo id/código de variante del API al código que espera el backend (graphite, wood, black, marble, *_light). */
const API_ID_TO_BACKEND = {
  graphite: 'graphite', grafito: 'graphite',
  wood: 'wood', madera: 'wood',
  black: 'black', negro: 'black', negras: 'black',
  marble: 'marble', mármol: 'marble',
  graphite_light: 'graphite_light', grafito_light: 'graphite_light',
  wood_light: 'wood_light', madera_light: 'wood_light',
  black_light: 'black_light', negro_light: 'black_light', negras_light: 'black_light',
  marble_light: 'marble_light', mármol_light: 'marble_light',
};
/** Normaliza id/name de variante del API al código que espera el backend. */
const toBackendVariantCode = (apiId, boxType) => {
  if (!apiId && apiId !== 0) return '';
  const key = String(apiId).trim().toLowerCase();
  const code = API_ID_TO_BACKEND[key];
  if (code) return code;
  if (boxType === 'with_light' && key.endsWith('_light')) return key;
  return key;
};

/** URLs que empiezan con /media/ se sirven desde el backend. */
const getMediaSrc = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/media/')) {
    const base = (api.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
  }
  return url;
};

const ClientData = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editingOrderId = location.state?.orderId;
  const [variantsData, setVariantsData] = useState({ no_light: [], with_light: [] });
  const [loadingOrder, setLoadingOrder] = useState(!!editingOrderId);
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

  useEffect(() => {
    api.getVariantsPublic().then((data) => {
      if (data && typeof data === 'object') {
        setVariantsData({
          no_light: Array.isArray(data.no_light) ? data.no_light : [],
          with_light: Array.isArray(data.with_light) ? data.with_light : [],
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingOrderId) return;
    let cancelled = false;
    api.getOrder(editingOrderId).then((o) => {
      if (cancelled) return;
      const boxType = o.box_type || 'no_light';
      setForm({
        nombre_cliente: formatNombreCompleto((o.client_name || '').trim()),
        telefono: sanitizePhoneInput(o.phone || ''),
        box_type: boxType,
        led_type: o.led_type || 'warm_led',
        variant: toBackendVariantCode(o.variant, boxType) || o.variant || '',
        shipping_option: o.shipping_option || 'pickup_uber',
      });
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingOrder(false);
    });
    return () => { cancelled = true; };
  }, [editingOrderId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev };
      if (name === 'nombre_cliente') {
        next.nombre_cliente = formatNombreCompleto(value);
      } else if (name === 'telefono') {
        next.telefono = sanitizePhoneInput(value);
      } else {
        next[name] = value;
      }
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
      const variantCode = toBackendVariantCode(form.variant, form.box_type) || form.variant;
      const payload = {
        client_name: formatNombreCompleto(form.nombre_cliente.trim()),
        phone: form.telefono,
        box_type: form.box_type,
        variant: variantCode,
        shipping_option: form.shipping_option,
      };
      if (form.box_type === 'with_light') payload.led_type = form.led_type;
      if (editingOrderId) {
        await api.updateOrder(editingOrderId, payload);
        navigate('/editor', { state: { orderId: editingOrderId } });
      } else {
        const order = await api.createOrder(payload);
        navigate('/editor', { state: { orderId: order.id } });
      }
    } catch (err) {
      setError(err.message || 'Error al crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const variants = variantsData[form.box_type] || [];
  const conLuz = form.box_type === 'with_light';

  return (
    <div className="client-data-page">
      <div className="client-data-card">
        <header className="client-data-header">
          <h1>
            <span className="client-data-icon" aria-hidden>📦</span>
            Pedido de Caja de la Memoria
          </h1>
          <p>{editingOrderId ? 'Modifica los datos y vuelve al editor con tus imágenes' : 'Completa los datos del cliente para continuar'}</p>
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
              Número de teléfono *
            </label>
            <input
              id="telefono"
              type="tel"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Ej: 351 339 2082 (sin +54)"
              required
            />
            <span className="client-data-field-hint" aria-hidden>
              El número correcto es importante para avisarte cuando tu pedido esté listo para retirar o enviar.
            </span>
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
              {variants.map((v) => {
                const backendCode = toBackendVariantCode(v.id, form.box_type);
                return (
                <label key={v.id} className={`client-data-variant-option ${form.variant === backendCode ? 'selected' : ''}`}>
                  <input type="radio" name="variant" value={backendCode} checked={form.variant === backendCode} onChange={handleChange} />
                  <div className="variant-image-wrap">
                    <img src={getMediaSrc(v.images && v.images[0])} alt={v.name} />
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
              ); })}
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
            <button type="submit" className="btn btn-primary client-data-btn-submit" disabled={loading || loadingOrder}>
              {loading ? (editingOrderId ? 'Guardando...' : 'Creando...') : loadingOrder ? 'Cargando...' : editingOrderId ? 'Guardar y volver al editor' : 'Selección de Imágenes →'}
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
                <img key={i} src={getMediaSrc(img)} alt={`${modalVariant.name} ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientData;
