import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import api from '../restclient/api';

const REQUIRED_COUNT = 10;
const ALIAS = 'manu.perea13';

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
const TELEFONO = '+54 9 351 392 3790';
const EMAIL = 'copiiworld@gmail.com';
const DEPOSIT_AMOUNT = '$ 12.000';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const EDITOR_ORDER_KEY = 'editorOrderId';
const getEditorStateKey = (id) => `editorState_${id}`;

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const dataUrlToFile = (dataUrl, name) =>
  fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => new File([blob], name, { type: blob.type }));

const ImageEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = location.state?.orderId ?? sessionStorage.getItem(EDITOR_ORDER_KEY);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedData, setConfirmedData] = useState(null);
  const cropPixelsRef = useRef(null);

  useEffect(() => {
    if (!orderId) {
      navigate('/cliente', { replace: true });
      return;
    }
    sessionStorage.setItem(EDITOR_ORDER_KEY, String(orderId));
  }, [orderId, navigate]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const o = await api.getOrder(orderId);
        if (cancelled) return;
        setOrder(o);

        const savedKey = getEditorStateKey(orderId);
        const saved = sessionStorage.getItem(savedKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const restored = [];
            for (const item of parsed) {
              const file = await dataUrlToFile(item.dataUrl, item.name);
              restored.push({
                file,
                url: URL.createObjectURL(file),
                name: item.name,
                crop: item.crop || null,
                id: item.id || generateId(),
              });
            }
            if (!cancelled && restored.length > 0) {
              setImages(restored);
              setSelectedIndex(0);
              sessionStorage.removeItem(savedKey);
            }
          } catch {
            sessionStorage.removeItem(savedKey);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [orderId]);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    cropPixelsRef.current = croppedAreaPixels;
  }, []);

  const onCropAreaChange = useCallback((_croppedArea, croppedAreaPixels) => {
    cropPixelsRef.current = croppedAreaPixels;
  }, []);

  const onMediaLoaded = useCallback((mediaSize) => {
    const img = images[selectedIndex];
    if (!img?.crop || img.crop.w <= 0 || img.crop.h <= 0) {
      const { naturalWidth: w, naturalHeight: h } = mediaSize;
      const size = Math.min(w, h);
      const x = (w - size) / 2;
      const y = (h - size) / 2;
      cropPixelsRef.current = { x, y, width: size, height: size };
    }
  }, [selectedIndex, images]);

  const saveCurrentCrop = useCallback(() => {
    const pixels = cropPixelsRef.current;
    if (pixels && selectedIndex >= 0 && selectedIndex < images.length) {
      setImages((prev) => {
        const next = [...prev];
        if (next[selectedIndex]) {
          next[selectedIndex] = {
            ...next[selectedIndex],
            crop: { x: pixels.x, y: pixels.y, w: pixels.width, h: pixels.height },
          };
        }
        return next;
      });
    }
  }, [selectedIndex, images.length]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type?.startsWith('image/'));
    if (files.length === 0) return;
    const remaining = REQUIRED_COUNT - images.length;
    const toAdd = files.slice(0, remaining).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      crop: null,
      id: generateId(),
    }));
    setImages((prev) => [...prev, ...toAdd]);
    if (selectedIndex < 0 && toAdd.length > 0) setSelectedIndex(images.length);
    setFileInputKey((k) => k + 1);
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
  };

  const clearAll = () => {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setImages([]);
    setSelectedIndex(-1);
    setFileInputKey((k) => k + 1);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    cropPixelsRef.current = null;
  };

  const removeAt = (idx) => {
    const next = images.filter((_, i) => i !== idx);
    URL.revokeObjectURL(images[idx].url);
    setImages(next);
    if (selectedIndex === idx) {
      setSelectedIndex(next.length ? Math.min(idx, next.length - 1) : -1);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } else if (selectedIndex > idx) setSelectedIndex(selectedIndex - 1);
  };

  const moveItem = (from, to) => {
    if (from === to) return;
    setImages((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    if (selectedIndex === from) setSelectedIndex(to);
    else if (from < selectedIndex && to >= selectedIndex) setSelectedIndex(selectedIndex - 1);
    else if (from > selectedIndex && to <= selectedIndex) setSelectedIndex(selectedIndex + 1);
  };

  const selectIndex = (idx) => {
    saveCurrentCrop();
    const img = images[idx];
    if (img?.crop && img.crop.w > 0 && img.crop.h > 0) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      cropPixelsRef.current = { x: img.crop.x, y: img.crop.y, width: img.crop.w, height: img.crop.h };
    } else {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      cropPixelsRef.current = null;
    }
    setSelectedIndex(idx);
  };

  const handleGoToCliente = async () => {
    saveCurrentCrop();
    if (images.length > 0 && orderId) {
      try {
        const items = await Promise.all(
          images.map(async (img) => ({
            id: img.id,
            name: img.name,
            dataUrl: await fileToDataUrl(img.file),
            crop: img.crop,
          }))
        );
        sessionStorage.setItem(getEditorStateKey(orderId), JSON.stringify(items));
      } catch {
        /* ignore */
      }
    }
    navigate('/cliente', { state: { orderId } });
  };

  const getCropForIndex = (idx) => {
    if (idx === selectedIndex && cropPixelsRef.current) {
      const d = cropPixelsRef.current;
      return { x: d.x, y: d.y, w: d.width, h: d.height };
    }
    return images[idx]?.crop;
  };

  const allHaveCrops = images.length === REQUIRED_COUNT && images.every((_, i) => {
    const c = getCropForIndex(i);
    return c && c.w > 0 && c.h > 0;
  });

  const handleSubmit = async () => {
    saveCurrentCrop();
    if (!allHaveCrops || images.length !== REQUIRED_COUNT) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      images.forEach((img, i) => {
        formData.append(`image_${i}`, img.file);
        const c = getCropForIndex(i) || img.crop || {};
        formData.append(`crop_data_${i}`, JSON.stringify({
          x: c.x ?? 0,
          y: c.y ?? 0,
          width: c.w ?? 1000,
          height: c.h ?? 1000,
        }));
      });
      await api.submitOrderImages(orderId, formData);
      const res = await api.sendOrder(orderId);
      setConfirmedData(res);
      setOrderConfirmed(true);
    } catch (err) {
      setError(err.message || 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const boxTypeLabel = order?.box_type === 'with_light' ? 'Con Luz' : 'Sin Luz';
  const variantLabel = order?.variant ? (VARIANT_LABELS[order.variant] ?? order.variant.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : '';
  const remaining = REQUIRED_COUNT - images.length;
  const currentImg = selectedIndex >= 0 && selectedIndex < images.length ? images[selectedIndex] : null;
  const savedCrop = currentImg?.crop;

  if (!orderId) return null;
  if (loading) return <div className="client-data-page"><div className="client-data-card image-editor-card"><p className="page-message">Cargando...</p></div></div>;
  if (error && !submitting) return <div className="client-data-page"><div className="client-data-card image-editor-card"><p className="client-data-error">{error}</p></div></div>;
  if (!order) return null;

  return (
    <div className="client-data-page">
      <div className="client-data-card image-editor-card">
        <header className="client-data-header">
          <h1>
            <span className="client-data-icon" aria-hidden>📦</span>
            Pedido de Caja de la Memoria
          </h1>
          <p>Recorta las imágenes para tu cajita personalizada</p>
        </header>

        <div className="image-editor-summary">
          <div className="image-editor-summary-row">
            <span><strong>Cliente:</strong> {order.client_name}</span>
            <span><strong>Teléfono:</strong> {order.phone}</span>
            <span><strong>Tipo:</strong> {boxTypeLabel}</span>
            <span><strong>Variante:</strong> {variantLabel}</span>
          </div>
        </div>

        <div className="client-data-form-group">
          <label>
            <span className="label-icon" aria-hidden>✂️</span>
            Recortar Imágenes
          </label>
        </div>

        <div className="image-editor-controls">
          <div className="image-editor-controls-left">
            <input
              key={fileInputKey}
              type="file"
              id="image-editor-file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="image-editor-file-input"
            />
            <span className="image-editor-file-status">
              {images.length === 0 ? 'Sin archivos seleccionados' : `${images.length} archivo(s)`}
            </span>
            <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={images.length === 0}>
              Limpiar todas
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary image-editor-submit-btn"
            onClick={handleSubmit}
            disabled={!allHaveCrops || submitting}
          >
            {submitting ? 'Enviando...' : remaining > 0 ? `Enviar (necesitas ${remaining} más)` : 'Enviar'}
          </button>
        </div>

        <div className="image-editor-warning">
          <span className="image-editor-warning-icon" aria-hidden>⚠️</span>
          <div className="image-editor-warning-text">
            <strong>Importante:</strong> El orden de las fotos se puede modificar arrastrándolas (PC) o con los botones ◀▶ (móvil). El orden aquí será el orden final en la cajita.
          </div>
        </div>

        <div className="image-editor-thumbs">
        {images.map((img, i) => (
          <div
            key={img.id}
            className={`image-editor-thumb ${i === selectedIndex ? 'selected' : ''}`}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('index', String(i))}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseInt(e.dataTransfer.getData('index'), 10);
              if (!isNaN(from)) moveItem(from, i);
            }}
            onClick={() => selectIndex(i)}
          >
            <span className="image-editor-thumb-badge">{i + 1}</span>
            <img src={img.url} alt={`${i + 1}`} draggable={false} />
            <button
              type="button"
              className="image-editor-thumb-delete"
              onClick={(ev) => { ev.stopPropagation(); removeAt(i); }}
              title="Eliminar"
              aria-label="Eliminar"
            >
              ×
            </button>
            <div className="image-editor-thumb-reorder">
              <button type="button" disabled={i === 0} onClick={(ev) => { ev.stopPropagation(); moveItem(i, i - 1); }}>◀</button>
              <button type="button" disabled={i === images.length - 1} onClick={(ev) => { ev.stopPropagation(); moveItem(i, i + 1); }}>▶</button>
            </div>
          </div>
        ))}
      </div>

        <div
          className={`image-editor-main image-editor-drop-zone ${images.length === 0 ? 'image-editor-drop-zone--empty' : 'image-editor-main--filled'} ${isDragging ? 'is-dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => images.length === 0 && document.getElementById('image-editor-file')?.click()}
      >
        {images.length > 0 && currentImg ? (
          <div className="image-editor-crop-wrap">
            {images.length < REQUIRED_COUNT && (
              <label htmlFor="image-editor-file" className="image-editor-add-overlay">
                <span className="image-editor-add-overlay-icon">+</span>
                <span className="image-editor-add-overlay-text">Imágenes</span>
              </label>
            )}
            <Cropper
              image={currentImg.url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onCropAreaChange={onCropAreaChange}
              onMediaLoaded={onMediaLoaded}
              initialCroppedAreaPixels={savedCrop && savedCrop.w > 0 && savedCrop.h > 0
                ? { x: savedCrop.x, y: savedCrop.y, width: savedCrop.w, height: savedCrop.h }
                : undefined}
              cropShape="rect"
              showGrid
            />
          </div>
        ) : images.length === 0 ? (
          <div className="image-editor-empty">
            <div className="image-editor-drop-content">
              <span className="image-editor-drop-icon" aria-hidden>☁️</span>
              <p className="image-editor-drop-primary">Arrastra tus imágenes aquí</p>
              <p className="image-editor-drop-secondary">O haz clic para seleccionar archivos</p>
              <label htmlFor="image-editor-file" className="image-editor-drop-btn">
                Seleccionar archivos
              </label>
            </div>
            <p className="image-editor-drop-note">
              <strong>Formato:</strong> Imágenes JPG, PNG o similares. Máximo 10 imágenes.
            </p>
          </div>
        ) : null}
        </div>

        {error && submitting && <p className="client-data-error">{error}</p>}

        <div className="client-data-buttons image-editor-buttons">
          <button
            type="button"
            className="btn btn-secondary client-data-btn-back"
            onClick={handleGoToCliente}
          >
            ← Cambiar datos del cliente
          </button>
        </div>
      </div>

      {orderConfirmed && order && (
        <div className="order-confirmed-overlay" onClick={() => { sessionStorage.removeItem(EDITOR_ORDER_KEY); navigate('/'); }}>
          <div className="client-data-card order-confirmed-modal" onClick={(e) => e.stopPropagation()}>
            <header className="client-data-header">
              <h1>
                <span className="client-data-icon" aria-hidden>🎉</span>
                ¡Pedido Confirmado!
              </h1>
              <p>Tu pedido ha sido enviado exitosamente. Nos comunicaremos contigo a la brevedad por WhatsApp para informarte el estado de tu cajita personalizada y su correspondiente fecha de envío.</p>
            </header>
            <div className="order-confirmed-summary">
              <p><strong>Cliente:</strong> {order.client_name}</p>
              <p><strong>Variante:</strong> {variantLabel}</p>
              <p><strong>Fecha:</strong> {new Date().toLocaleString('es-AR')}</p>
            </div>
            <div className="order-confirmed-deposit">
              <span>Monto de la Seña:</span>
              <span className="order-confirmed-amount">{confirmedData?.deposit_amount ?? DEPOSIT_AMOUNT}</span>
            </div>
            <div className="client-data-form-group">
              <label>
                <span className="label-icon" aria-hidden>💰</span>
                Datos para Transferencia
              </label>
              <div className="order-confirmed-transfer">
                <p><strong>Alias:</strong> {ALIAS} <button type="button" className="btn btn-secondary order-confirmed-copy" onClick={() => navigator.clipboard?.writeText(ALIAS)}>Copiar</button></p>
                <p><strong>Banco:</strong> Mercado Pago</p>
                <p><strong>Titular:</strong> Manuel Perea</p>
              </div>
            </div>
            <div className="client-data-form-group">
              <label>
                <span className="label-icon" aria-hidden>📤</span>
                Enviar Comprobante
              </label>
              <p className="order-confirmed-send-hint">Envía tu comprobante de pago por WhatsApp o correo electrónico para confirmar tu pedido.</p>
              <div className="order-confirmed-send-buttons">
                <a
                  href={`https://wa.me/${TELEFONO.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, adjunto el comprobante de pago de mi pedido.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="order-confirmed-send-btn order-confirmed-whatsapp"
                >
                  <span className="order-confirmed-send-icon" aria-hidden>💬</span>
                  Enviar por WhatsApp
                </a>
                <a
                  href={`mailto:${EMAIL}?subject=${encodeURIComponent('Comprobante de pago - Pedido')}`}
                  className="order-confirmed-send-btn order-confirmed-email"
                >
                  <span className="order-confirmed-send-icon" aria-hidden>✉️</span>
                  Enviar por Email
                </a>
              </div>
            </div>
            <div className="client-data-buttons">
              <button type="button" className="btn client-data-btn-back order-confirmed-home" onClick={() => { sessionStorage.removeItem(EDITOR_ORDER_KEY); navigate('/'); }}>
                ← Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
