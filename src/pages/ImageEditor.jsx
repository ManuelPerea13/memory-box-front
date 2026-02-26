import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cropper, { getInitialCropFromCroppedAreaPixels } from 'react-easy-crop';
import api from '../restclient/api';

const REQUIRED_COUNT = 10;
const DEFAULT_ALIAS = 'manu.perea13';
const DEFAULT_TELEFONO = '+54 9 351 392 3790';
const DEFAULT_EMAIL = 'copiiworld@gmail.com';
const DEFAULT_DEPOSIT = '$ 12.000';
const WHATSAPP_COMPROBANTE_MSG = 'Hola, te envío el comprobante de la transferencia de la Cajita de la Memoria.';

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

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Imágenes por defecto con frases (public/default-phrases/), agrupadas por motivo
const PHRASE_GROUPS = [
  { id: 'motivo1', label: 'Motivo 1', prefix: 'Motivo1', count: 6 },
  { id: 'motivo2', label: 'Motivo 2', prefix: 'Motivo2', count: 5 },
  { id: 'motivo3', label: 'Motivo 3', prefix: 'Motivo3', count: 7 },
];

const buildPhraseItems = () => {
  const flat = [];
  PHRASE_GROUPS.forEach((g) => {
    for (let i = 1; i <= g.count; i++) {
      const num = String(i).padStart(2, '0');
      flat.push({
        path: `default-phrases/${g.prefix}-${num}.png`,
        name: `${g.label} - ${num}`,
        groupId: g.id,
      });
    }
  });
  return flat;
};

const DEFAULT_PHRASE_IMAGES = buildPhraseItems();

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

const getDefaultPhraseImageUrl = (path) => {
  const base = process.env.PUBLIC_URL || '';
  return `${base}/${path}`;
};

const getImageDimensions = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });

const getCenteredSquareCrop = (width, height) => {
  const size = Math.min(width, height);
  const x = (width - size) / 2;
  const y = (height - size) / 2;
  return { x, y, w: size, h: size };
};

const THUMB_PREVIEW_SIZE = 200;
/** Tamaño fijo del recuadro de corte (cuadrado). Misma medida para imagen vertical u horizontal. */
const CROP_BOX_SIZE = 420;

const createCroppedPreviewDataUrl = (imageUrl, crop) =>
  new Promise((resolve, reject) => {
    if (!crop || crop.w <= 0 || crop.h <= 0) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_PREVIEW_SIZE;
        canvas.height = THUMB_PREVIEW_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          crop.x, crop.y, crop.w, crop.h,
          0, 0, THUMB_PREVIEW_SIZE, THUMB_PREVIEW_SIZE
        );
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for preview'));
    img.src = imageUrl;
  });

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
  const [pricesSettings, setPricesSettings] = useState(null);
  const [addingDefaultPhrases, setAddingDefaultPhrases] = useState(false);
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [selectedPhraseIndexes, setSelectedPhraseIndexes] = useState([]);
  const [thumbPreviews, setThumbPreviews] = useState({});
  const cropPixelsRef = useRef(null);
  const mainContainerRef = useRef(null);
  const cropPositionRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const cropRAFRef = useRef(null);
  const zoomRAFRef = useRef(null);
  const [cropWrapSize, setCropWrapSize] = useState({ width: CROP_BOX_SIZE, height: CROP_BOX_SIZE });
  const [cropMediaLoading, setCropMediaLoading] = useState(false);
  const selectedImageId = selectedIndex >= 0 && selectedIndex < images.length ? images[selectedIndex]?.id : null;

  // Mostrar carga cuando cambia la imagen a recortar
  useEffect(() => {
    if (selectedImageId) setCropMediaLoading(true);
  }, [selectedImageId]);

  // Recuadro de corte con medida fija (cuadrado) independiente de la orientación de la imagen
  useEffect(() => {
    const el = mainContainerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth || CROP_BOX_SIZE;
      const size = Math.min(CROP_BOX_SIZE, w);
      setCropWrapSize({ width: size, height: size });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [images.length > 0]);

  useEffect(() => {
    let cancelled = false;
    images.forEach((img) => {
      if (!img?.crop || img.crop.w <= 0 || img.crop.h <= 0) return;
      createCroppedPreviewDataUrl(img.url, img.crop).then((dataUrl) => {
        if (!cancelled && dataUrl) {
          setThumbPreviews((prev) => ({ ...prev, [img.id]: dataUrl }));
        }
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [images]);

  useEffect(() => {
    api.getPrices(false).then((data) => {
      if (data && typeof data === 'object') setPricesSettings(data);
    }).catch(() => {});
  }, []);

  // Evitar que el scroll del modal propague al fondo
  useEffect(() => {
    if (!showPhraseModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showPhraseModal]);

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

  const onCropChangeThrottled = useCallback((newCrop) => {
    cropPositionRef.current = newCrop;
    if (cropRAFRef.current == null) {
      cropRAFRef.current = requestAnimationFrame(() => {
        setCrop(cropPositionRef.current);
        cropRAFRef.current = null;
      });
    }
  }, []);

  const onZoomChangeThrottled = useCallback((newZoom) => {
    zoomRef.current = newZoom;
    if (zoomRAFRef.current == null) {
      zoomRAFRef.current = requestAnimationFrame(() => {
        const z = zoomRef.current;
        setZoom(z);
        if (z <= 1) {
          cropPositionRef.current = { x: 0, y: 0 };
          setCrop({ x: 0, y: 0 });
        }
        zoomRAFRef.current = null;
      });
    }
  }, []);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    cropPixelsRef.current = croppedAreaPixels;
    setCrop(cropPositionRef.current);
    setZoom(zoomRef.current);
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
      const croppedAreaPixels = { x, y, width: size, height: size };
      cropPixelsRef.current = croppedAreaPixels;
      const cropSize = { width: cropWrapSize.width, height: cropWrapSize.height };
      const { crop: initialCrop, zoom: initialZoom } = getInitialCropFromCroppedAreaPixels(
        croppedAreaPixels,
        mediaSize,
        0,
        cropSize,
        1,
        3
      );
      cropPositionRef.current = initialCrop;
      zoomRef.current = initialZoom;
      setCrop(initialCrop);
      setZoom(initialZoom);
      setImages((prev) => {
        const next = [...prev];
        if (next[selectedIndex]) {
          next[selectedIndex] = {
            ...next[selectedIndex],
            crop: { x, y, w: size, h: size },
          };
        }
        return next;
      });
    }
    setCropMediaLoading(false);
  }, [selectedIndex, images, cropWrapSize.width, cropWrapSize.height]);

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

  /* Acepta por tipo MIME o por extensión (iOS a veces no envía type en fotos de galería). Igual criterio en desktop, Android e iOS. */
  const isImageFile = (f) => {
    if (!f) return false;
    if (f.type?.startsWith('image/')) return true;
    if (!f.type && f.name) return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
    return false;
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(isImageFile);
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
    setThumbPreviews({});
    setImages([]);
    setSelectedIndex(-1);
    setFileInputKey((k) => k + 1);
    if (cropRAFRef.current != null) cancelAnimationFrame(cropRAFRef.current);
    if (zoomRAFRef.current != null) cancelAnimationFrame(zoomRAFRef.current);
    cropRAFRef.current = zoomRAFRef.current = null;
    cropPositionRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    cropPixelsRef.current = null;
  };

  const openPhraseModal = () => {
    setSelectedPhraseIndexes([]);
    setShowPhraseModal(true);
  };

  const togglePhraseSelection = (idx) => {
    const remaining = REQUIRED_COUNT - images.length;
    setSelectedPhraseIndexes((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= remaining) return prev;
      return [...prev, idx];
    });
  };

  const addSelectedPhraseImages = async () => {
    const remaining = REQUIRED_COUNT - images.length;
    if (remaining <= 0 || selectedPhraseIndexes.length === 0) {
      setShowPhraseModal(false);
      return;
    }
    const toLoad = selectedPhraseIndexes
      .slice(0, remaining)
      .map((i) => DEFAULT_PHRASE_IMAGES[i])
      .filter(Boolean);
    setAddingDefaultPhrases(true);
    setShowPhraseModal(false);
    setSelectedPhraseIndexes([]);
    try {
      const loaded = [];
      for (const item of toLoad) {
        try {
          const url = getDefaultPhraseImageUrl(item.path);
          const res = await fetch(url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = blob.type === 'image/png' ? '.png' : '.jpg';
          const fileName = `${item.name.replace(/\s+/g, '-').toLowerCase()}${ext}`;
          const file = new File([blob], fileName, { type: blob.type });
          const objectUrl = URL.createObjectURL(file);
          let crop = null;
          try {
            const { width, height } = await getImageDimensions(objectUrl);
            crop = getCenteredSquareCrop(width, height);
          } catch {
            /* si falla, queda null y el usuario puede recortar */
          }
          loaded.push({
            file,
            url: objectUrl,
            name: fileName,
            crop,
            id: generateId(),
          });
        } catch {
          /* skip si falla la carga */
        }
      }
      if (loaded.length > 0) {
        const firstNewIndex = images.length;
        setImages((prev) => [...prev, ...loaded]);
        if (selectedIndex < 0) setSelectedIndex(firstNewIndex);
      }
    } finally {
      setAddingDefaultPhrases(false);
    }
  };

  const removeAt = (idx) => {
    const removedId = images[idx]?.id;
    const next = images.filter((_, i) => i !== idx);
    URL.revokeObjectURL(images[idx].url);
    if (removedId) setThumbPreviews((p) => { const n = { ...p }; delete n[removedId]; return n; });
    setImages(next);
    if (selectedIndex === idx) {
      setSelectedIndex(next.length ? Math.min(idx, next.length - 1) : -1);
      cropPositionRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;
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
    if (cropRAFRef.current != null) cancelAnimationFrame(cropRAFRef.current);
    if (zoomRAFRef.current != null) cancelAnimationFrame(zoomRAFRef.current);
    cropRAFRef.current = zoomRAFRef.current = null;
    const img = images[idx];
    cropPositionRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
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

        <section className="image-editor-actions-section" aria-label="Acciones de imágenes">
          <div className="image-editor-actions-header">
            <h2 className="image-editor-actions-title">
              <span className="label-icon" aria-hidden>✂️</span>
              Recortar Imágenes
            </h2>
          </div>
          <div className="image-editor-controls">
            <div className="image-editor-controls-left">
              <input
                key={fileInputKey}
                type="file"
                id="image-editor-file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={handleFileChange}
                className="image-editor-file-input"
              />
              <button type="button" className="btn btn-secondary image-editor-clear-btn" onClick={clearAll} disabled={images.length === 0}>
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
        </section>

        <div className="image-editor-warning" role="alert">
          <span className="image-editor-warning-icon" aria-hidden>⚠️</span>
          <p className="image-editor-warning-text">
            <strong>Importante:</strong> El orden de las fotos se puede modificar arrastrándolas (PC) o con los botones ◀▶ (móvil). El orden aquí será el orden final en la cajita.
          </p>
        </div>

        <section className="image-editor-canva-section" aria-label="Imágenes con frases">
          <p className="image-editor-canva-note image-editor-canva-note--global">
            ¿Querés una imagen personalizada con tu frase? Te recomendamos diseñarla en{' '}
            <a href="https://www.canva.com/" target="_blank" rel="noopener noreferrer">Canva</a>.
          </p>
          <button
            type="button"
            className="btn image-editor-phrase-btn"
            onClick={openPhraseModal}
            disabled={images.length >= REQUIRED_COUNT || addingDefaultPhrases}
            title={images.length >= REQUIRED_COUNT ? 'Ya tenés 10 imágenes' : 'Elegir imágenes con frases'}
          >
            {addingDefaultPhrases ? 'Cargando...' : 'Imágenes con frases'}
          </button>
        </section>

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
            <img
              src={img.crop && img.crop.w > 0 && thumbPreviews[img.id] ? thumbPreviews[img.id] : img.url}
              alt={`${i + 1}`}
              draggable={false}
            />
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
          ref={mainContainerRef}
          className={`image-editor-main image-editor-drop-zone ${images.length === 0 ? 'image-editor-drop-zone--empty' : 'image-editor-main--filled'} ${isDragging ? 'is-dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => images.length === 0 && document.getElementById('image-editor-file')?.click()}
      >
        {images.length > 0 && currentImg ? (
          <div className="image-editor-crop-wrap" style={{ width: cropWrapSize.width, height: cropWrapSize.height }}>
            {cropMediaLoading && (
              <div className="image-editor-crop-loading" aria-live="polite" aria-busy="true">
                <span className="image-editor-crop-loading-spinner" aria-hidden="true" />
                <span className="image-editor-crop-loading-text">Cargando imagen…</span>
              </div>
            )}
            {images.length < REQUIRED_COUNT && (
              <label htmlFor="image-editor-file" className="image-editor-add-overlay">
                <span className="image-editor-add-overlay-icon">+</span>
                <span className="image-editor-add-overlay-text">Imágenes</span>
              </label>
            )}
            <Cropper
              key={currentImg.id}
              image={currentImg.url}
              crop={crop}
              zoom={zoom}
              aspect={1}
              objectFit="contain"
              style={{ containerStyle: { backgroundColor: '#fff' } }}
              cropSize={{ width: cropWrapSize.width, height: cropWrapSize.height }}
              onCropChange={onCropChangeThrottled}
              onZoomChange={onZoomChangeThrottled}
              onCropComplete={onCropComplete}
              onCropAreaChange={onCropAreaChange}
              onMediaLoaded={onMediaLoaded}
              initialCroppedAreaPixels={savedCrop && savedCrop.w > 0 && savedCrop.h > 0
                ? { x: savedCrop.x, y: savedCrop.y, width: savedCrop.w, height: savedCrop.h }
                : undefined}
              cropShape="rect"
              showGrid={false}
              classes={{ cropAreaClassName: 'image-editor-crop-area' }}
            />
            <div className="image-editor-crop-line-guide" aria-hidden="true" />
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

      {showPhraseModal && (
        <div className="image-editor-modal-overlay" onClick={() => setShowPhraseModal(false)}>
          <div className="image-editor-phrase-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="image-editor-phrase-modal-title">Elegí imágenes con frases</h3>
            <p className="image-editor-phrase-modal-hint">
              Clic para seleccionar.
            </p>
            <div className="image-editor-phrase-modal-body">
              {PHRASE_GROUPS.map((group, groupIndex) => {
                const startIdx = PHRASE_GROUPS.slice(0, groupIndex).reduce((acc, g) => acc + g.count, 0);
                const items = DEFAULT_PHRASE_IMAGES.slice(startIdx, startIdx + group.count);
                return (
                  <div key={group.id} className="image-editor-phrase-group">
                    <h4 className="image-editor-phrase-group-title">{group.label}</h4>
                    <div className="image-editor-phrase-grid">
                      {items.map((item, i) => {
                        const globalIdx = startIdx + i;
                        return (
                          <button
                            key={item.path}
                            type="button"
                            className={`image-editor-phrase-option ${selectedPhraseIndexes.includes(globalIdx) ? 'selected' : ''}`}
                            onClick={() => togglePhraseSelection(globalIdx)}
                          >
                            <img src={getDefaultPhraseImageUrl(item.path)} alt={item.name} />
                            <span className="image-editor-phrase-option-label">{item.name}</span>
                            {selectedPhraseIndexes.includes(globalIdx) && <span className="image-editor-phrase-check" aria-hidden>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="image-editor-phrase-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPhraseModal(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addSelectedPhraseImages}
                disabled={selectedPhraseIndexes.length === 0}
              >
                Agregar {selectedPhraseIndexes.length ? `(${selectedPhraseIndexes.length})` : ''} seleccionadas
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className="order-confirmed-amount">
                {(() => {
                  const withLight = order?.box_type === 'with_light';
                  const conLuz = Number(pricesSettings?.price_con_luz) || 42000;
                  const pilas = Number(pricesSettings?.price_pilas) || 2500;
                  const sinLuz = Number(pricesSettings?.price_sin_luz) || 24000;
                  const amount = withLight
                    ? Math.round((conLuz + pilas) / 2)
                    : Math.round(sinLuz / 2);
                  return `$ ${amount.toLocaleString('es-AR')}`;
                })()}
              </span>
            </div>
            <div className="client-data-form-group">
              <label>
                <span className="label-icon" aria-hidden>💰</span>
                Datos para Transferencia
              </label>
              <div className="order-confirmed-transfer">
                {(() => {
                  const alias = pricesSettings?.transfer_alias ?? DEFAULT_ALIAS;
                  return (
                    <>
                      <p><strong>Alias:</strong> {alias} <button type="button" className="btn btn-secondary order-confirmed-copy" onClick={() => navigator.clipboard?.writeText(alias)}>Copiar</button></p>
                      <p><strong>Banco:</strong> {pricesSettings?.transfer_bank ?? 'Mercado Pago'}</p>
                      <p><strong>Titular:</strong> {pricesSettings?.transfer_holder ?? 'Manuel Perea'}</p>
                    </>
                  );
                })()}
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
                  href={`https://wa.me/${(pricesSettings?.contact_whatsapp ?? DEFAULT_TELEFONO).replace(/\D/g, '')}?text=${encodeURIComponent(WHATSAPP_COMPROBANTE_MSG)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="order-confirmed-send-btn order-confirmed-whatsapp"
                >
                  <span className="order-confirmed-send-icon" aria-hidden>💬</span>
                  Enviar por WhatsApp
                </a>
                <a
                  href={`mailto:${pricesSettings?.contact_email ?? DEFAULT_EMAIL}?subject=${encodeURIComponent('Comprobante de pago - Pedido')}`}
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
