import React, { useState, useEffect, useCallback } from 'react';
import api from '../../restclient/api';

const DEFAULT_BACKGROUND = {
  video_sin_luz: '',
  video_con_luz: '',
  audio_sin_luz: '',
  audio_con_luz: '',
};

const FONDO_TABS = [
  { id: 0, label: 'Vista previa' },
  { id: 1, label: 'Agregar video o música' },
];

/** URLs que empiezan con /media/ se sirven desde el backend; el resto desde el mismo origen. */
const getMediaSrc = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/media/')) {
    const base = (api.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
  }
  return url;
};

const AdminFondo = () => {
  const [mediaList, setMediaList] = useState([]);
  const [selection, setSelection] = useState(DEFAULT_BACKGROUND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [addForm, setAddForm] = useState({ type: 'video', name: '', file: null });
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(() => {
    Promise.all([
      api.getBackgroundMedia(),
      api.getHomeBackground(true),
    ])
      .then(([list, bg]) => {
        setMediaList(Array.isArray(list) ? list : []);
        setSelection({
          video_sin_luz: bg?.video_sin_luz ?? '',
          video_con_luz: bg?.video_con_luz ?? '',
          audio_sin_luz: bg?.audio_sin_luz ?? '',
          audio_con_luz: bg?.audio_con_luz ?? '',
        });
      })
      .catch(() => setMediaList([]))
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

  const handleUseAs = async (slot, item) => {
    const url = item?.url ?? '';
    const key = slot;
    setSaving(true);
    setError('');
    try {
      await api.updateHomeBackground({ [key]: url });
      setSelection((s) => ({ ...s, [key]: url }));
      const names = { video_sin_luz: 'Video Sin Luz', video_con_luz: 'Video Con Luz', audio_sin_luz: 'Audio Sin Luz', audio_con_luz: 'Audio Con Luz' };
      setMessageThenClear(item?.name ? `${names[key]} actualizado: ${item.name}` : `${names[key]} actualizado.`);
    } catch (e) {
      setErrorThenClear(e?.data?.detail || e?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  /** Cambiar desde el desplegable de Vista previa (url puede ser '' para quitar). */
  const handleSelectSlot = (slot, url) => {
    const item = mediaList.find((m) => (m.url || '').trim() === (url || '').trim());
    handleUseAs(slot, item || { url: '' });
  };

  const startEditName = (item) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };
  const saveEditName = async () => {
    if (editingId == null) return;
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      await api.updateBackgroundMedia(editingId, { name });
      setMediaList((prev) => prev.map((m) => (m.id === editingId ? { ...m, name } : m)));
      setMessageThenClear('Nombre actualizado.');
    } catch (e) {
      setErrorThenClear(e?.data?.name?.[0] || e?.message || 'Error al guardar nombre');
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const name = (addForm.name || '').trim();
    if (!name) {
      setErrorThenClear('El nombre es obligatorio.');
      return;
    }
    if (!addForm.file) {
      setErrorThenClear('Subí un archivo (MP4 o MP3).');
      return;
    }
    const isVideo = addForm.type === 'video';
    const fd = new FormData();
    fd.append('type', addForm.type);
    fd.append('name', name);
    fd.append('file', addForm.file);
    setAdding(true);
    setError('');
    try {
      await api.createBackgroundMedia(fd);
      setMessageThenClear(isVideo ? 'Video agregado.' : 'Música agregada.');
      setAddForm({ type: 'video', name: '', file: null });
      loadData();
    } catch (err) {
      setErrorThenClear(err?.message || 'Error al subir');
    } finally {
      setAdding(false);
    }
  };

  const videos = mediaList.filter((m) => m.type === 'video');
  const audios = mediaList.filter((m) => m.type === 'audio');
  const getItemByUrl = (url) => mediaList.find((m) => (m.url || '').trim() === (url || '').trim());

  if (loading) {
    return (
      <div className="admin-stock-page">
        <header className="admin-page-header">
          <h1>Video y música de fondo</h1>
          <p>Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Video y música de fondo</h1>
        <p>
          Elegí desde la vista previa el video y la música para Sin Luz y Con Luz. Podés cambiarlos por fecha (San Valentín, Navidad, etc.). Agregá más archivos en la pestaña correspondiente.
        </p>
      </header>

      <div className="admin-variantes-tabs" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {FONDO_TABS.map((tab) => (
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

      {/* Pestaña 0: Vista previa (principal) */}
      {activeTab === 0 && (
        <section className="client-data-card admin-precios-card admin-fondo-preview">
          <h2 className="admin-precios-section-title">Elegí video y música para la página principal</h2>
          <p className="admin-fondo-preview-intro">
            Cambiá según la fecha: San Valentín, Día de la madre, Navidad, casamientos, propuestas, etc. Lo que elegís acá es lo que viene del back; si no hay nada elegido, queda vacío.
          </p>
          <div className="admin-fondo-selectors-wrapper">
            <div className="admin-fondo-selectors-group admin-fondo-sin-luz">
              <h3 className="admin-fondo-group-title">Sin Luz</h3>
              <p className="admin-fondo-group-desc">Cajita sin luz encendida</p>
              <div className="admin-fondo-selectors">
                <div className="admin-fondo-selector-block">
                  <label className="admin-fondo-selector-label">Video</label>
                  <select
                    value={(selection.video_sin_luz || '').trim()}
                    onChange={(e) => handleSelectSlot('video_sin_luz', e.target.value)}
                    className="admin-fondo-select"
                    disabled={saving}
                  >
                    <option value="">— Ninguno (por defecto)</option>
                    {videos.map((v) => (
                      <option key={v.id} value={(v.url || '').trim()}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-fondo-selector-block">
                  <label className="admin-fondo-selector-label">Música</label>
                  <select
                    value={(selection.audio_sin_luz || '').trim()}
                    onChange={(e) => handleSelectSlot('audio_sin_luz', e.target.value)}
                    className="admin-fondo-select"
                    disabled={saving}
                  >
                    <option value="">— Ninguno (por defecto)</option>
                    {audios.map((a) => (
                      <option key={a.id} value={(a.url || '').trim()}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="admin-fondo-selectors-group admin-fondo-con-luz">
              <h3 className="admin-fondo-group-title">Con Luz</h3>
              <p className="admin-fondo-group-desc">Cajita con luz encendida</p>
              <div className="admin-fondo-selectors">
                <div className="admin-fondo-selector-block">
                  <label className="admin-fondo-selector-label">Video</label>
                  <select
                    value={(selection.video_con_luz || '').trim()}
                    onChange={(e) => handleSelectSlot('video_con_luz', e.target.value)}
                    className="admin-fondo-select"
                    disabled={saving}
                  >
                    <option value="">— Ninguno (por defecto)</option>
                    {videos.map((v) => (
                      <option key={v.id} value={(v.url || '').trim()}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-fondo-selector-block">
                  <label className="admin-fondo-selector-label">Música</label>
                  <select
                    value={(selection.audio_con_luz || '').trim()}
                    onChange={(e) => handleSelectSlot('audio_con_luz', e.target.value)}
                    className="admin-fondo-select"
                    disabled={saving}
                  >
                    <option value="">— Ninguno (por defecto)</option>
                    {audios.map((a) => (
                      <option key={a.id} value={(a.url || '').trim()}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <h3 className="admin-fondo-preview-subtitle">Vista previa</h3>
          <p className="admin-fondo-preview-desc">Así se verá y sonará en la página principal.</p>
          <div className="admin-fondo-preview-wrapper">
            <div className="admin-fondo-preview-group admin-fondo-sin-luz">
              <h4 className="admin-fondo-preview-group-title">Sin Luz</h4>
              <div className="admin-fondo-preview-grid">
                <div className="admin-fondo-preview-item">
                  <h5 className="admin-fondo-preview-item-title">Video</h5>
                  <video
                    key={selection.video_sin_luz}
                    src={getMediaSrc(selection.video_sin_luz)}
                    controls
                    playsInline
                    className="admin-fondo-preview-video"
                  />
                </div>
                <div className="admin-fondo-preview-item">
                  <h5 className="admin-fondo-preview-item-title">Música</h5>
                  <audio key={selection.audio_sin_luz} src={getMediaSrc(selection.audio_sin_luz)} controls className="admin-fondo-preview-audio" />
                </div>
              </div>
            </div>
            <div className="admin-fondo-preview-group admin-fondo-con-luz">
              <h4 className="admin-fondo-preview-group-title">Con Luz</h4>
              <div className="admin-fondo-preview-grid">
                <div className="admin-fondo-preview-item">
                  <h5 className="admin-fondo-preview-item-title">Video</h5>
                  <video
                    key={selection.video_con_luz}
                    src={getMediaSrc(selection.video_con_luz)}
                    controls
                    playsInline
                    className="admin-fondo-preview-video"
                  />
                </div>
                <div className="admin-fondo-preview-item">
                  <h5 className="admin-fondo-preview-item-title">Música</h5>
                  <audio key={selection.audio_con_luz} src={getMediaSrc(selection.audio_con_luz)} controls className="admin-fondo-preview-audio" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pestaña 1: Agregar video o música (formulario + listas de videos y música) */}
      {activeTab === 1 && (
        <>
          <section className="client-data-card admin-precios-card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="admin-precios-section-title">Agregar video o música</h2>
            <form onSubmit={handleAddSubmit} className="admin-precios-grid admin-precios-grid--short">
              <div className="client-data-form-group">
                <label>Tipo</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                  className="admin-precios-input"
                >
                  <option value="video">Video (MP4)</option>
                  <option value="audio">Audio (MP3)</option>
                </select>
              </div>
              <div className="client-data-form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="admin-precios-input"
                  placeholder="ej. Video Navidad"
                />
              </div>
              <div className="client-data-form-group">
                <label>Subir archivo (MP4 o MP3) *</label>
                <input
                  type="file"
                  accept={addForm.type === 'video' ? 'video/mp4,.mp4' : 'audio/mpeg,.mp3'}
                  onChange={(e) => setAddForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                  className="admin-precios-input"
                />
              </div>
              <div className="client-data-form-group" style={{ alignSelf: 'end' }}>
                <button type="submit" className="btn btn-primary" disabled={adding || !addForm.file}>
                  {adding ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </section>

          <section className="client-data-card admin-precios-card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="admin-precios-section-title">Videos</h2>
            {videos.length === 0 ? (
              <p style={{ color: 'var(--text-muted, #666)', margin: 0 }}>No hay videos. Agregá uno arriba.</p>
            ) : (
              <ul className="admin-fondo-media-list">
                {videos.map((item) => (
                  <li key={item.id} className="admin-variantes-client-item admin-fondo-media-item">
                    <div className="admin-fondo-media-thumb">
                      <video
                        src={getMediaSrc(item.url)}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </div>
                    <div className="admin-variantes-client-name-wrap">
                      {editingId === item.id ? (
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
                          onClick={() => startEditName(item)}
                          className="admin-variantes-client-name-btn"
                          title="Clic para editar nombre"
                        >
                          {item.name}
                        </button>
                      )}
                    </div>
                    <div className="admin-variantes-client-toggles">
                      <button
                        type="button"
                        className={'admin-fondo-use-chip' + ((selection.video_sin_luz || '').trim() === (item.url || '').trim() ? ' checked' : '')}
                        disabled={saving || !item.url}
                        onClick={() => handleUseAs('video_sin_luz', item)}
                      >
                        Sin Luz
                      </button>
                      <button
                        type="button"
                        className={'admin-fondo-use-chip' + ((selection.video_con_luz || '').trim() === (item.url || '').trim() ? ' checked' : '')}
                        disabled={saving || !item.url}
                        onClick={() => handleUseAs('video_con_luz', item)}
                      >
                        Con Luz
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="client-data-card admin-precios-card">
            <h2 className="admin-precios-section-title">Música</h2>
            {audios.length === 0 ? (
              <p style={{ color: 'var(--text-muted, #666)', margin: 0 }}>No hay músicas. Agregá una arriba.</p>
            ) : (
              <ul className="admin-fondo-media-list">
                {audios.map((item) => (
                  <li key={item.id} className="admin-variantes-client-item admin-fondo-media-item">
                    <div className="admin-fondo-media-thumb audio-wrap">
                      <audio src={getMediaSrc(item.url)} controls preload="metadata" />
                    </div>
                    <div className="admin-variantes-client-name-wrap">
                      {editingId === item.id ? (
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
                          onClick={() => startEditName(item)}
                          className="admin-variantes-client-name-btn"
                          title="Clic para editar nombre"
                        >
                          {item.name}
                        </button>
                      )}
                    </div>
                    <div className="admin-variantes-client-toggles">
                      <button
                        type="button"
                        className={'admin-fondo-use-chip' + ((selection.audio_sin_luz || '').trim() === (item.url || '').trim() ? ' checked' : '')}
                        disabled={saving || !item.url}
                        onClick={() => handleUseAs('audio_sin_luz', item)}
                      >
                        Sin Luz
                      </button>
                      <button
                        type="button"
                        className={'admin-fondo-use-chip' + ((selection.audio_con_luz || '').trim() === (item.url || '').trim() ? ' checked' : '')}
                        disabled={saving || !item.url}
                        onClick={() => handleUseAs('audio_con_luz', item)}
                      >
                        Con Luz
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

    </div>
  );
};

export default AdminFondo;
