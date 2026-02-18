import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../restclient/api';

const VARIANT_LABELS = {
  graphite: 'Grafito',
  wood: 'Madera',
  black: 'Negro',
  marble: 'Mármol',
  graphite_light: 'Grafito (Con Luz)',
  wood_light: 'Madera (Con Luz)',
  black_light: 'Negro (Con Luz)',
  marble_light: 'Mármol (Con Luz)',
};

const LED_TYPE_LABELS = {
  warm_led: 'LED Cálido',
  white_led: 'LED Blanco',
};

const SHIPPING_LABELS = {
  pickup_uber: 'Retiro / Uber',
  shipping_province: 'Envío a otra provincia',
};

const PedidoView = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const o = await api.getOrder(id);
        if (!cancelled) setOrder(o);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Pedido no encontrado');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const boxTypeLabel = order?.box_type === 'with_light' ? 'Con Luz' : 'Sin Luz';
  const ledTypeLabel = order?.led_type ? (LED_TYPE_LABELS[order.led_type] ?? order.led_type) : '';
  const variantLabel = order?.variant ? (VARIANT_LABELS[order.variant] ?? order.variant.replace(/_/g, ' ')) : '';
  const shippingLabel = order?.shipping_option ? (SHIPPING_LABELS[order.shipping_option] ?? order.shipping_option) : '';

  if (loading) {
    return (
      <div className="client-data-page">
        <div className="client-data-card">
          <p className="client-data-message">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="client-data-page">
        <div className="client-data-card">
          <p className="client-data-error">{error || 'Pedido no encontrado'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-data-page">
      <div className="client-data-card pedido-view-card">
        <header className="client-data-header">
          <h1>
            <span className="client-data-icon" aria-hidden>📦</span>
            Cajita de la Memoria
          </h1>
          <p>Pedido #{order.id}</p>
        </header>

        <div className="pedido-view-section">
          <h2>Datos del cliente</h2>
          <div className="pedido-view-grid">
            <p><strong>Cliente:</strong> {order.client_name}</p>
            <p><strong>Teléfono:</strong> {order.phone}</p>
          </div>
        </div>

        <div className="pedido-view-section">
          <h2>Selección de la cajita</h2>
          <div className="pedido-view-grid">
            <p><strong>Tipo:</strong> {boxTypeLabel}</p>
            {order.led_type && (
              <p><strong>Tipo LED:</strong> {ledTypeLabel}</p>
            )}
            <p><strong>Variante:</strong> {variantLabel}</p>
            {order.shipping_option && (
              <p><strong>Envío:</strong> {shippingLabel}</p>
            )}
          </div>
        </div>

        {order.status && (
          <div className="pedido-view-section">
            <p><strong>Estado:</strong> {(order.status === 'sent' || order.status === 'in_progress') ? 'En Curso' : order.status}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PedidoView;
