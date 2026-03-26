import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../restclient/api';

/** URLs que empiezan con /media/ se sirven desde el backend. */
const getMediaSrc = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/media/')) {
    const base = (api.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
  }
  return url;
};

const BOX_TYPES = [
  { value: 'no_light', label: 'Sin Luz' },
  { value: 'with_light', label: 'Con Luz' },
];

const TABS = [
  { id: 0, label: 'Variantes para el cliente' },
  { id: 1, label: 'Fotos por variante' },
  { id: 2, label: 'Cargar nueva variante' },
];

const AdminVariantes = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [modalEdit, setModalEdit] = useState(null);
  const [modalImages, setModalImages] = useState([]);
  const [replacingId, setReplacingId] = useState(null);
  const [addVariantForm, setAddVariantForm] = useState({ name: '', code: '' });
  const [newVariantFiles, setNewVariantFiles] = useState([]);
  const [addingVariant, setAddingVariant] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadData = useCallback(() => {
    api
      .getVariants()
      .then((data) => setVariants(Array.isArray(data) ? data : []))
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setMessageThenClear = (msg) => {
    setMessage(msg);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  };
  const setErrorThenClear = (err) => {
    setError(err);
    setMessage('');
    setTimeout(() => setError(''), 6000);
  };

  /** boxType: 'no_light' | 'with_light'. Backend debe exponer visible_no_light y visible_with_light. */
  const handleToggleVisibleByType = async (v, boxType) => {
    const key = boxType === 'no_light' ? 'visible_no_light' : 'visible_with_light';
    const current = v[key] ?? v.visible ?? false;
    const next = !current;
    setSaving(true);
    setError('');
    try {
      await api.updateVariant(v.id, { [key]: next });
      setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, [key]: next } : x)));
      setMessageThenClear(next ? 'Visible en página de pedido.' : 'Oculto en página de pedido.');
    } catch (e) {
      setErrorThenClear(e?.data?.detail || e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const startEditName = (v) => {
    setEditingNameId(v.id);
    setEditingName(v.name);
  };
  const saveEditName = async () => {
    if (editingNameId == null) return;
    const name = editingName.trim();
    if (!name) {
      setEditingNameId(null);
      return;
    }
    setSaving(true);
    try {
      await api.updateVariant(editingNameId, { name });
      setVariants((prev) => prev.map((x) => (x.id === editingNameId ? { ...x, name } : x)));
      setMessageThenClear('Nombre actualizado.');
    } catch (e) {
      setErrorThenClear(e?.data?.name?.[0] || e?.message || 'Error');
    } finally {
      setSaving(false);
      setEditingNameId(null);
    }
  };

  const openModal = (variant, boxType) => {
    const list = boxType === 'no_light' ? (variant.images_no_light || []) : (variant.images_with_light || []);
    setModalEdit({ variant, boxType });
    setModalImages(list.map((img) => ({ id: img.id, url: img.url })));
  };

  const closeModal = () => {
    setModalEdit(null);
    setModalImages([]);
    setReplacingId(null);
    loadData();
  };

  const moveImage = (index, delta) => {
    const next = [...modalImages];
    const ni = index + delta;
    if (ni < 0 || ni >= next.length) return;
    [next[index], next[ni]] = [next[ni], next[index]];
    setModalImages(next);
  };

  const saveModalOrder = async () => {
    if (!modalEdit) return;
    setSaving(true);
    setError('');
    try {
      for (let i = 0; i < modalImages.length; i++) {
        await api.updateVariantImage(modalImages[i].id, { order: i });
      }
      setMessageThenClear('Orden guardado.');
      closeModal();
    } catch (e) {
      setErrorThenClear(e?.message || 'Error al guardar orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceImage = async (imageId, file) => {
    if (!file) return;
    setSaving(true);
    setReplacingId(imageId);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.updateVariantImage(imageId, fd);
      setModalImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, url: null } : img)));
      setMessageThenClear('Imagen reemplazada.');
      loadData();
      const fresh = await api.getVariants();
      const v = fresh.find((x) => x.id === modalEdit.variant.id);
      const list = modalEdit.boxType === 'no_light' ? (v?.images_no_light || []) : (v?.images_with_light || []);
      setModalImages(list.map((img) => ({ id: img.id, url: img.url })));
    } catch (e) {
      setErrorThenClear(e?.message || 'Error al reemplazar');
    } finally {
      setSaving(false);
      setReplacingId(null);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('¿Eliminar esta imagen?')) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteVariantImage(imageId);
      setModalImages((prev) => prev.filter((img) => img.id !== imageId));
      setMessageThenClear('Imagen eliminada.');
    } catch (e) {
      setErrorThenClear(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    const name = (addVariantForm.name || '').trim();
    const code = (addVariantForm.code || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!name || !code) {
      setErrorThenClear('Nombre y código son obligatorios.');
      return;
    }
    if (newVariantFiles.length === 0) {
      setErrorThenClear('Agregá al menos una imagen (arrastrá o soltá en la zona).');
      return;
    }
    setAddingVariant(true);
    setError('');
    try {
      const variant = await api.createVariant({ name, code });
      for (let i = 0; i < newVariantFiles.length; i++) {
        const { file, box_type } = newVariantFiles[i];
        const fd = new FormData();
        fd.append('variant', variant.id);
        fd.append('box_type', box_type);
        fd.append('file', file);
        fd.append('order', String(i));
        await api.createVariantImage(fd);
      }
      setMessageThenClear('Variante creada con ' + newVariantFiles.length + ' imagen(es).');
      setAddVariantForm({ name: '', code: '' });
      newVariantFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
          newVariantPreviewUrlsRef.current.delete(item.previewUrl);
        }
      });
      setNewVariantFiles([]);
      loadData();
    } catch (err) {
      setErrorThenClear(err?.data?.detail || err?.data?.code?.[0] || err?.message || 'Error');
    } finally {
      setAddingVariant(false);
    }
  };

  const addFiles = (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    const newItems = list.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      newVariantPreviewUrlsRef.current.add(previewUrl);
      return { file, box_type: 'no_light', previewUrl };
    });
    setNewVariantFiles((prev) => [...prev, ...newItems]);
  };

  const removeNewFile = (index) => {
    setNewVariantFiles((prev) => {
      const item = prev[index];
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        newVariantPreviewUrlsRef.current.delete(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const setNewFileBoxType = (index, box_type) => {
    setNewVariantFiles((prev) => prev.map((item, i) => (i === index ? { ...item, box_type } : item)));
  };

  const newVariantPreviewUrlsRef = useRef(new Set());
  useEffect(() => {
    return () => {
      newVariantPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      newVariantPreviewUrlsRef.current.clear();
    };
  }, []);

  const moveNewFile = (index, delta) => {
    setNewVariantFiles((prev) => {
      const ni = index + delta;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[ni]] = [next[ni], next[index]];
      return next;
    });
  };

  if (loading) {
    return (
      <div className="admin-stock-page">
        <header className="admin-page-header">
          <h1>Variantes</h1>
          <p>Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Variantes</h1>
        <p>Gestioná las variantes que ve el cliente, las fotos por tipo de cajita y cargá nuevas variantes.</p>
      </header>

      <div className="admin-variantes-tabs" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {TABS.map((tab) => (
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="client-data-error">{error}</p>}
      {message && <p className="admin-precios-message">{message}</p>}

      {/* Pestaña 0: Variantes para el cliente */}
      {activeTab === 0 && (
        <div className="client-data-card admin-precios-card">
          <h2 className="admin-precios-section-title">Variantes que se muestran en la página de pedido</h2>
          {variants.length === 0 ? (
            <p style={{ color: 'var(--text-muted, #666)', margin: 0 }}>No hay variantes. Cargá una en la pestaña &quot;Cargar nueva variante&quot;.</p>
          ) : (
            <ul className="admin-variantes-client-list">
              {variants.map((v) => (
                <li key={v.id} className="admin-variantes-client-item">
                  <div className="admin-variantes-client-name-wrap">
                    {editingNameId === v.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveEditName}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditName()}
                        autoFocus
                        className="admin-variantes-client-name-input"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditName(v)}
                        className="admin-variantes-client-name-btn"
                        title="Clic para editar nombre"
                      >
                        {v.name}
                      </button>
                    )}
                  </div>
                  <div className="admin-variantes-client-toggles">
                    <label
                      className={'admin-variantes-client-toggle' + (v.visible_no_light ?? v.visible ? ' checked' : '') + (saving ? ' disabled' : '')}
                    >
                      <input
                        type="checkbox"
                        checked={!!(v.visible_no_light ?? v.visible)}
                        onChange={() => handleToggleVisibleByType(v, 'no_light')}
                        disabled={saving}
                      />
                      Sin Luz
                    </label>
                    <label
                      className={'admin-variantes-client-toggle' + (v.visible_with_light ?? v.visible ? ' checked' : '') + (saving ? ' disabled' : '')}
                    >
                      <input
                        type="checkbox"
                        checked={!!(v.visible_with_light ?? v.visible)}
                        onChange={() => handleToggleVisibleByType(v, 'with_light')}
                        disabled={saving}
                      />
                      Con Luz
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pestaña 1: Fotos por variante */}
      {activeTab === 1 && (
        <div className="client-data-card admin-precios-card">
          <h2 className="admin-precios-section-title">Fotos por variante y tipo de cajita</h2>
          {variants.length === 0 ? (
            <p style={{ color: 'var(--text-muted, #666)' }}>No hay variantes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {variants.map((v) => (
                <div key={v.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{v.name}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#64748b' }}>Sin Luz</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        {(v.images_no_light || []).slice(0, 4).map((img, i) => (
                          <img
                            key={img.id ?? i}
                            src={getMediaSrc(img.url || img)}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openModal(v, 'no_light')}
                          disabled={saving}
                        >
                          Editar fotos
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#64748b' }}>Con Luz</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        {(v.images_with_light || []).slice(0, 4).map((img, i) => (
                          <img
                            key={img.id ?? i}
                            src={getMediaSrc(img.url || img)}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openModal(v, 'with_light')}
                          disabled={saving}
                        >
                          Editar fotos
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 2: Cargar nueva variante */}
      {activeTab === 2 && (
        <div className="client-data-card admin-precios-card">
          <h2 className="admin-precios-section-title">Cargar nueva variante</h2>
          <form onSubmit={handleAddVariant} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="client-data-form-group" style={{ marginBottom: 0 }}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={addVariantForm.name}
                  onChange={(e) => setAddVariantForm((f) => ({ ...f, name: e.target.value }))}
                  className="admin-precios-input"
                  placeholder="ej. Dorado"
                />
              </div>
              <div className="client-data-form-group" style={{ marginBottom: 0 }}>
                <label>Código (slug)</label>
                <input
                  type="text"
                  value={addVariantForm.code}
                  onChange={(e) => setAddVariantForm((f) => ({ ...f, code: e.target.value.replace(/\s/g, '_').toLowerCase() }))}
                  className="admin-precios-input"
                  placeholder="ej. gold"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Imágenes (arrastrá y soltá o hacé clic)</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => document.getElementById('new-variant-file-input')?.click()}
                style={{
                  border: '2px dashed ' + (dragOver ? '#3b82f6' : '#cbd5e1'),
                  borderRadius: 8,
                  padding: '2rem',
                  textAlign: 'center',
                  background: dragOver ? '#eff6ff' : '#f8fafc',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                Arrastrá imágenes aquí o hacé clic para elegir
              </div>
              <input
                id="new-variant-file-input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {newVariantFiles.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Orden y tipo de cada imagen</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {newVariantFiles.map((item, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem',
                        background: '#f1f5f9',
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ width: 24, color: '#64748b' }}>#{i + 1}</span>
                      <img
                        src={item.previewUrl}
                        alt=""
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                      />
                      <select
                        value={item.box_type}
                        onChange={(e) => setNewFileBoxType(i, e.target.value)}
                        className="admin-precios-input"
                        style={{ width: 120 }}
                      >
                        {BOX_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-secondary" onClick={() => moveNewFile(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => moveNewFile(i, 1)} disabled={i === newVariantFiles.length - 1}>
                        ↓
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => removeNewFile(i)}>
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={addingVariant || newVariantFiles.length === 0}>
              {addingVariant ? 'Creando...' : 'Crear variante y subir fotos'}
            </button>
          </form>
        </div>
      )}

      {/* Modal editar fotos */}
      {modalEdit && (
        <div className="client-data-modal-overlay" onClick={closeModal}>
          <div className="client-data-modal admin-variantes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="client-data-modal-header">
              <h3>
                {modalEdit.variant.name} – {modalEdit.boxType === 'no_light' ? 'Sin Luz' : 'Con Luz'}
              </h3>
              <button type="button" className="client-data-modal-close" onClick={closeModal} aria-label="Cerrar">
                &times;
              </button>
            </div>
            <div className="admin-variantes-modal-body">
              {modalImages.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>No hay imágenes. Agregá desde Django Admin o la pestaña de carga.</p>
              ) : (
                <ul className="admin-variantes-modal-list">
                  {modalImages.map((img, i) => (
                    <li key={img.id}>
                      <span className="modal-row-num">#{i + 1}</span>
                      <img
                        src={getMediaSrc(img.url)}
                        alt=""
                        className="modal-row-thumb"
                      />
                      <div className="modal-row-actions">
                        <div className="modal-row-change">
                          <input
                            id={`modal-file-${img.id}`}
                            type="file"
                            accept="image/*"
                            disabled={saving}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleReplaceImage(img.id, f);
                              e.target.value = '';
                            }}
                          />
                          <label
                            htmlFor={saving ? undefined : `modal-file-${img.id}`}
                            className={'btn-file' + (saving ? ' disabled' : '')}
                            style={saving ? { pointerEvents: 'none', opacity: 0.7 } : undefined}
                          >
                            {replacingId === img.id ? 'Subiendo…' : 'Elegir archivo'}
                          </label>
                        </div>
                        <div className="modal-row-reorder">
                          <button
                            type="button"
                            onClick={() => moveImage(i, -1)}
                            disabled={i === 0 || saving}
                            title="Subir"
                            aria-label="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(i, 1)}
                            disabled={i === modalImages.length - 1 || saving}
                            title="Bajar"
                            aria-label="Bajar"
                          >
                            ↓
                          </button>
                        </div>
                        <div className="modal-row-delete">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleDeleteImage(img.id)}
                            disabled={saving}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="admin-variantes-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>
                Cerrar
              </button>
              {modalImages.length > 0 && (
                <button type="button" className="btn btn-primary" onClick={saveModalOrder} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar orden'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVariantes;
