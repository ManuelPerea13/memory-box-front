"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

interface MediaItem {
  id: number;
  type: "video" | "audio";
  name: string;
  url: string;
}

interface HomeBackground {
  video_sin_luz?: string;
  video_con_luz?: string;
  audio_sin_luz?: string;
  audio_con_luz?: string;
}

type SlotKey = "video_sin_luz" | "video_con_luz" | "audio_sin_luz" | "audio_con_luz";

interface AddForm {
  type: "video" | "audio";
  name: string;
  file: File | null;
}

interface ApiErrorLike {
  message?: string;
  data?: { detail?: string; name?: string[] };
}

const DEFAULT_BACKGROUND: Required<HomeBackground> = {
  video_sin_luz: "",
  video_con_luz: "",
  audio_sin_luz: "",
  audio_con_luz: "",
};

const FONDO_TABS = [
  { id: 0, label: "Vista previa" },
  { id: 1, label: "Agregar video o música" },
];

const SLOT_NAMES: Record<SlotKey, string> = {
  video_sin_luz: "Video Sin Luz",
  video_con_luz: "Video Con Luz",
  audio_sin_luz: "Audio Sin Luz",
  audio_con_luz: "Audio Con Luz",
};

/** URLs que empiezan con /media/ se sirven desde el backend; el resto desde el mismo origen. */
const getMediaSrc = (url?: string): string | undefined => {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("/media/")) {
    const base = (api.baseUrl || "").replace(/\/$/, "");
    return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
  }
  return url;
};

export default function AdminFondoPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [selection, setSelection] = useState<Required<HomeBackground>>(DEFAULT_BACKGROUND);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addForm, setAddForm] = useState<AddForm>({ type: "video", name: "", file: null });
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const loadData = useCallback(() => {
    Promise.all([api.getBackgroundMedia(), api.getHomeBackground(true)])
      .then(([list, bg]) => {
        const items = Array.isArray(list) ? (list as MediaItem[]) : [];
        const background = (bg ?? {}) as HomeBackground;
        setMediaList(items);
        setSelection({
          video_sin_luz: background.video_sin_luz ?? "",
          video_con_luz: background.video_con_luz ?? "",
          audio_sin_luz: background.audio_sin_luz ?? "",
          audio_con_luz: background.audio_con_luz ?? "",
        });
      })
      .catch(() => setMediaList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setMessageThenClear = (msg: string) => {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 4000);
  };
  const setErrorThenClear = (err: string) => {
    setError(err);
    setMessage("");
    setTimeout(() => setError(""), 6000);
  };

  const handleUseAs = async (slot: SlotKey, item: { url?: string; name?: string }) => {
    const url = item?.url ?? "";
    setSaving(true);
    setError("");
    try {
      await api.updateHomeBackground({ [slot]: url });
      setSelection((s) => ({ ...s, [slot]: url }));
      setMessageThenClear(
        item?.name ? `${SLOT_NAMES[slot]} actualizado: ${item.name}` : `${SLOT_NAMES[slot]} actualizado.`,
      );
    } catch (e) {
      const err = e as ApiErrorLike;
      setErrorThenClear(err?.data?.detail || err?.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  /** Cambiar desde el desplegable de Vista previa (url puede ser '' para quitar). */
  const handleSelectSlot = (slot: SlotKey, url: string) => {
    const item = mediaList.find((m) => (m.url || "").trim() === (url || "").trim());
    handleUseAs(slot, item || { url: "" });
  };

  const startEditName = (item: MediaItem) => {
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
      setMessageThenClear("Nombre actualizado.");
    } catch (e) {
      const err = e as ApiErrorLike;
      setErrorThenClear(err?.data?.name?.[0] || err?.message || "Error al guardar nombre");
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (addForm.name || "").trim();
    if (!name) {
      setErrorThenClear("El nombre es obligatorio.");
      return;
    }
    if (!addForm.file) {
      setErrorThenClear("Subí un archivo (MP4 o MP3).");
      return;
    }
    const isVideo = addForm.type === "video";
    const fd = new FormData();
    fd.append("type", addForm.type);
    fd.append("name", name);
    fd.append("file", addForm.file);
    setAdding(true);
    setError("");
    try {
      await api.createBackgroundMedia(fd);
      setMessageThenClear(isVideo ? "Video agregado." : "Música agregada.");
      setAddForm({ type: "video", name: "", file: null });
      loadData();
    } catch (err) {
      setErrorThenClear((err as ApiErrorLike)?.message || "Error al subir");
    } finally {
      setAdding(false);
    }
  };

  const videos = mediaList.filter((m) => m.type === "video");
  const audios = mediaList.filter((m) => m.type === "audio");

  const renderMediaItem = (item: MediaItem, isVideo: boolean) => {
    const sinSlot: SlotKey = isVideo ? "video_sin_luz" : "audio_sin_luz";
    const conSlot: SlotKey = isVideo ? "video_con_luz" : "audio_con_luz";
    const itemUrl = (item.url || "").trim();
    const sinChecked = (selection[sinSlot] || "").trim() === itemUrl;
    const conChecked = (selection[conSlot] || "").trim() === itemUrl;
    return (
      <li
        key={item.id}
        className="flex items-center gap-4 rounded-xl border border-mb-border bg-white p-3"
      >
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-mb-gray-light">
          {isVideo ? (
            <video
              src={getMediaSrc(item.url)}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-1">
              <audio src={getMediaSrc(item.url)} controls preload="metadata" className="w-full" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {editingId === item.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={saveEditName}
              onKeyDown={(e) => e.key === "Enter" && saveEditName()}
              autoFocus
              className="mm-input"
            />
          ) : (
            <button
              type="button"
              onClick={() => startEditName(item)}
              className="truncate text-left font-medium text-mb-ink hover:text-mb-blue"
              title="Clic para editar nombre"
            >
              {item.name}
            </button>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={`mm-btn ${sinChecked ? "mm-btn-green" : "mm-btn-outline"}`}
            disabled={saving || !item.url}
            onClick={() => handleUseAs(sinSlot, item)}
          >
            Sin Luz
          </button>
          <button
            type="button"
            className={`mm-btn ${conChecked ? "mm-btn-green" : "mm-btn-outline"}`}
            disabled={saving || !item.url}
            onClick={() => handleUseAs(conSlot, item)}
          >
            Con Luz
          </button>
        </div>
      </li>
    );
  };

  const renderSelector = (slot: SlotKey, label: string, options: MediaItem[]) => (
    <div className="flex flex-col gap-1">
      <label className="mm-label">{label}</label>
      <select
        value={(selection[slot] || "").trim()}
        onChange={(e) => handleSelectSlot(slot, e.target.value)}
        className="mm-input"
        disabled={saving}
      >
        <option value="">— Ninguno (por defecto)</option>
        {options.map((o) => (
          <option key={o.id} value={(o.url || "").trim()}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-mb-ink">Video y música de fondo</h1>
          <p className="text-mb-gray">Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Video y música de fondo</h1>
        <p className="text-mb-gray">
          Elegí desde la vista previa el video y la música para Sin Luz y Con Luz. Podés cambiarlos
          por fecha (San Valentín, Navidad, etc.). Agregá más archivos en la pestaña
          correspondiente.
        </p>
      </header>

      <div className="mb-6 flex gap-1 border-b border-mb-border">
        {FONDO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px rounded-t-lg border border-b-0 px-5 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? "border-mb-border bg-mb-gray-light font-semibold text-mb-ink"
                : "border-transparent text-mb-gray hover:text-mb-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-mb-red/10 px-4 py-3 text-sm text-mb-red">{error}</p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-mb-green/10 px-4 py-3 text-sm text-mb-green">{message}</p>
      )}

      {/* Pestaña 0: Vista previa (principal) */}
      {activeTab === 0 && (
        <section className="mm-card p-5">
          <h2 className="mb-1 text-lg font-semibold text-mb-ink">
            Elegí video y música para la página principal
          </h2>
          <p className="mb-5 text-sm text-mb-gray">
            Cambiá según la fecha: San Valentín, Día de la madre, Navidad, casamientos, propuestas,
            etc. Lo que elegís acá es lo que viene del back; si no hay nada elegido, queda vacío.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-mb-border p-4">
              <h3 className="font-semibold text-mb-ink">Sin Luz</h3>
              <p className="mb-3 text-xs text-mb-gray">Cajita sin luz encendida</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {renderSelector("video_sin_luz", "Video", videos)}
                {renderSelector("audio_sin_luz", "Música", audios)}
              </div>
            </div>
            <div className="rounded-xl border border-mb-border p-4">
              <h3 className="font-semibold text-mb-ink">Con Luz</h3>
              <p className="mb-3 text-xs text-mb-gray">Cajita con luz encendida</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {renderSelector("video_con_luz", "Video", videos)}
                {renderSelector("audio_con_luz", "Música", audios)}
              </div>
            </div>
          </div>

          <h3 className="mb-1 mt-6 text-base font-semibold text-mb-ink">Vista previa</h3>
          <p className="mb-4 text-sm text-mb-gray">Así se verá y sonará en la página principal.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-mb-border p-4">
              <h4 className="mb-3 font-semibold text-mb-ink">Sin Luz</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h5 className="mb-2 text-sm font-medium text-mb-gray">Video</h5>
                  <video
                    key={selection.video_sin_luz}
                    src={getMediaSrc(selection.video_sin_luz)}
                    controls
                    playsInline
                    className="w-full rounded-lg bg-mb-gray-light"
                  />
                </div>
                <div>
                  <h5 className="mb-2 text-sm font-medium text-mb-gray">Música</h5>
                  <audio
                    key={selection.audio_sin_luz}
                    src={getMediaSrc(selection.audio_sin_luz)}
                    controls
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-mb-border p-4">
              <h4 className="mb-3 font-semibold text-mb-ink">Con Luz</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h5 className="mb-2 text-sm font-medium text-mb-gray">Video</h5>
                  <video
                    key={selection.video_con_luz}
                    src={getMediaSrc(selection.video_con_luz)}
                    controls
                    playsInline
                    className="w-full rounded-lg bg-mb-gray-light"
                  />
                </div>
                <div>
                  <h5 className="mb-2 text-sm font-medium text-mb-gray">Música</h5>
                  <audio
                    key={selection.audio_con_luz}
                    src={getMediaSrc(selection.audio_con_luz)}
                    controls
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pestaña 1: Agregar video o música (formulario + listas) */}
      {activeTab === 1 && (
        <>
          <section className="mm-card mb-6 p-5">
            <h2 className="mb-4 text-lg font-semibold text-mb-ink">Agregar video o música</h2>
            <form
              onSubmit={handleAddSubmit}
              className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="flex flex-col gap-1">
                <label className="mm-label">Tipo</label>
                <select
                  value={addForm.type}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, type: e.target.value as "video" | "audio" }))
                  }
                  className="mm-input"
                >
                  <option value="video">Video (MP4)</option>
                  <option value="audio">Audio (MP3)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="mm-label">Nombre</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="mm-input"
                  placeholder="ej. Video Navidad"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="mm-label">Subir archivo (MP4 o MP3) *</label>
                <input
                  type="file"
                  accept={addForm.type === "video" ? "video/mp4,.mp4" : "audio/mpeg,.mp3"}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
                  }
                  className="mm-input"
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="mm-btn mm-btn-primary w-full"
                  disabled={adding || !addForm.file}
                >
                  {adding ? "Agregando..." : "Agregar"}
                </button>
              </div>
            </form>
          </section>

          <section className="mm-card mb-6 p-5">
            <h2 className="mb-4 text-lg font-semibold text-mb-ink">Videos</h2>
            {videos.length === 0 ? (
              <p className="text-mb-gray">No hay videos. Agregá uno arriba.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {videos.map((item) => renderMediaItem(item, true))}
              </ul>
            )}
          </section>

          <section className="mm-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-mb-ink">Música</h2>
            {audios.length === 0 ? (
              <p className="text-mb-gray">No hay músicas. Agregá una arriba.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {audios.map((item) => renderMediaItem(item, false))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
