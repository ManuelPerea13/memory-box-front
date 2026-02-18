import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../restclient/api';

const ImageEditor = () => {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [o, c] = await Promise.all([
          api.getOrder(pedidoId),
          api.getImageCrops(pedidoId),
        ]);
        if (!cancelled) {
          setOrder(o);
          setCrops(Array.isArray(c) ? c : o?.image_crops || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pedidoId]);

  const handleEnviarPedido = async () => {
    try {
      await api.sendOrder(pedidoId);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al enviar');
    }
  };

  if (loading) return <div className="page-message">Cargando...</div>;
  if (error) return <div className="page-message error">{error}</div>;
  if (!order) return null;

  const recortes = crops;

  return (
    <div className="page-container" style={{ maxWidth: 800 }}>
      <div className="card">
        <h2>Editor de imágenes – Pedido #{order.id}</h2>
        <p><strong>Cliente:</strong> {order.client_name}</p>
        <p>Recortes: {recortes.length} / 10</p>
        <p style={{ color: '#666' }}>
          Aquí irá el componente con Cropper.js / react-image-crop (10 slots, guardar en API).
        </p>
        <button type="button" onClick={handleEnviarPedido} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
          Enviar pedido
        </button>
      </div>
    </div>
  );
};

export default ImageEditor;
