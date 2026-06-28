"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import api from "@/lib/api";
import type { BoxType, BoxVariant, BoxVariantImage } from "@/types";

// Imagen tal como la consume esta pantalla (la API expone `url`).
type VariantImage = BoxVariantImage & { url?: string | null };

// Variante con los campos por tipo de cajita y compatibilidad legacy.
type VariantWithImages = BoxVariant & {
  visible?: boolean;
  images_no_light?: VariantImage[];
  images_with_light?: VariantImage[];
};

interface ModalEditState {
  variant: VariantWithImages;
  boxType: BoxType;
}

interface ModalImage {
  id: number;
  url: string | null;
}

interface NewVariantFile {
  file: File;
  box_type: BoxType;
  previewUrl: string;
}

/** URLs que empiezan con /media/ se sirven desde el backend. */
const getMediaSrc = (url: string | null | undefined): string => {
  if (!url || typeof url !== "string") return url ?? "";
  if (url.startsWith("/media/")) {
    const base = (api.baseUrl || "").replace(/\/$/, "");
    return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
  }
  return url;
};

const BOX_TYPES: { value: BoxType; label: string }[] = [
  { value: "no_light", label: "Sin Luz" },
  { value: "with_light", label: "Con Luz" },
];

const TABS = [
  { id: 0, label: "Variantes para el cliente" },
  { id: 1, label: "Fotos por variante" },
  { id: 2, label: "Cargar nueva variante" },
];

function errMessage(e: unknown): string | undefined {
  if (e && typeof e === "object") {
    const obj = e as { data?: unknown; message?: string };
    const data = obj.data as
      | { detail?: string; name?: string[]; code?: string[] }
      | undefined;
    return (
      data?.detail ||
      data?.name?.[0] ||
      data?.code?.[0] ||
      obj.message ||
      undefined
    );
  }
  return undefined;
}

export default function AdminVariantes() {
  const [activeTab, setActiveTab] = useState(0);
  const [variants, setVariants] = useState<VariantWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [modalEdit, setModalEdit] = useState<ModalEditState | null>(null);
  const [modalImages, setModalImages] = useState<ModalImage[]>([]);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [addVariantForm, setAddVariantForm] = useState({ name: "", code: "" });
  const [newVariantFiles, setNewVariantFiles] = useState<NewVariantFile[]>([]);
  const [addingVariant, setAddingVariant] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const newVariantPreviewUrlsRef = useRef<Set<string>>(new Set());

  const loadData = useCallback(() => {
    api
      .getVariants()
      .then((data) =>
        setVariants(Array.isArray(data) ? (data as VariantWithImages[]) : []),
      )
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const urls = newVariantPreviewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

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

  /** boxType: 'no_light' | 'with_light'. Backend expone visible_no_light y visible_with_light. */
  const handleToggleVisibleByType = async (
    v: VariantWithImages,
    boxType: BoxType,
  ) => {
    const key =
      boxType === "no_light" ? "visible_no_light" : "visible_with_light";
    const current = v[key] ?? v.visible ?? false;
    const next = !current;
    setSaving(true);
    setError("");
    try {
      await api.updateVariant(v.id, { [key]: next });
      setVariants((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, [key]: next } : x)),
      );
      setMessageThenClear(
        next ? "Visible en página de pedido." : "Oculto en página de pedido.",
      );
    } catch (e) {
      setErrorThenClear(errMessage(e) || "Error");
    } finally {
      setSaving(false);
    }
  };

  const startEditName = (v: VariantWithImages) => {
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
      setVariants((prev) =>
        prev.map((x) => (x.id === editingNameId ? { ...x, name } : x)),
      );
      setMessageThenClear("Nombre actualizado.");
    } catch (e) {
      setErrorThenClear(errMessage(e) || "Error");
    } finally {
      setSaving(false);
      setEditingNameId(null);
    }
  };

  const openModal = (variant: VariantWithImages, boxType: BoxType) => {
    const list =
      boxType === "no_light"
        ? variant.images_no_light || []
        : variant.images_with_light || [];
    setModalEdit({ variant, boxType });
    setModalImages(list.map((img) => ({ id: img.id, url: img.url ?? null })));
  };

  const closeModal = () => {
    setModalEdit(null);
    setModalImages([]);
    setReplacingId(null);
    loadData();
  };

  const moveImage = (index: number, delta: number) => {
    const next = [...modalImages];
    const ni = index + delta;
    if (ni < 0 || ni >= next.length) return;
    [next[index], next[ni]] = [next[ni], next[index]];
    setModalImages(next);
  };

  const saveModalOrder = async () => {
    if (!modalEdit) return;
    setSaving(true);
    setError("");
    try {
      for (let i = 0; i < modalImages.length; i++) {
        await api.updateVariantImage(modalImages[i].id, { order: i });
      }
      setMessageThenClear("Orden guardado.");
      closeModal();
    } catch (e) {
      setErrorThenClear(errMessage(e) || "Error al guardar orden");
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceImage = async (imageId: number, file: File) => {
    if (!file) return;
    setSaving(true);
    setReplacingId(imageId);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.updateVariantImage(imageId, fd);
      setModalImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, url: null } : img)),
      );
      setMessageThenClear("Imagen reemplazada.");
      loadData();
      const fresh = (await api.getVariants()) as VariantWithImages[];
      const v = fresh.find((x) => x.id === modalEdit?.variant.id);
      const list =
        modalEdit?.boxType === "no_light"
          ? v?.images_no_light || []
          : v?.images_with_light || [];
      setModalImages(list.map((img) => ({ id: img.id, url: img.url ?? null })));
    } catch (e) {
      setErrorThenClear(errMessage(e) || "Error al reemplazar");
    } finally {
      setSaving(false);
      setReplacingId(null);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteVariantImage(imageId);
      setModalImages((prev) => prev.filter((img) => img.id !== imageId));
      setMessageThenClear("Imagen eliminada.");
    } catch (e) {
      setErrorThenClear(errMessage(e) || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = async (e: FormEvent) => {
    e.preventDefault();
    const name = (addVariantForm.name || "").trim();
    const code = (addVariantForm.code || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!name || !code) {
      setErrorThenClear("Nombre y código son obligatorios.");
      return;
    }
    if (newVariantFiles.length === 0) {
      setErrorThenClear(
        "Agregá al menos una imagen (arrastrá o soltá en la zona).",
      );
      return;
    }
    setAddingVariant(true);
    setError("");
    try {
      const variant = (await api.createVariant({ name, code })) as BoxVariant;
      for (let i = 0; i < newVariantFiles.length; i++) {
        const { file, box_type } = newVariantFiles[i];
        const fd = new FormData();
        fd.append("variant", String(variant.id));
        fd.append("box_type", box_type);
        fd.append("file", file);
        fd.append("order", String(i));
        await api.createVariantImage(fd);
      }
      setMessageThenClear(
        "Variante creada con " + newVariantFiles.length + " imagen(es).",
      );
      setAddVariantForm({ name: "", code: "" });
      newVariantFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
          newVariantPreviewUrlsRef.current.delete(item.previewUrl);
        }
      });
      setNewVariantFiles([]);
      loadData();
    } catch (err) {
      setErrorThenClear(errMessage(err) || "Error");
    } finally {
      setAddingVariant(false);
    }
  };

  const addFiles = (files: FileList | null) => {
    const list = Array.from(files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    const newItems: NewVariantFile[] = list.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      newVariantPreviewUrlsRef.current.add(previewUrl);
      return { file, box_type: "no_light", previewUrl };
    });
    setNewVariantFiles((prev) => [...prev, ...newItems]);
  };

  const removeNewFile = (index: number) => {
    setNewVariantFiles((prev) => {
      const item = prev[index];
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        newVariantPreviewUrlsRef.current.delete(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const setNewFileBoxType = (index: number, box_type: BoxType) => {
    setNewVariantFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, box_type } : item)),
    );
  };

  const moveNewFile = (index: number, delta: number) => {
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
      <div className="animate-fade-up">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-mb-ink">Variantes</h1>
          <p className="text-mb-gray">Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Variantes</h1>
        <p className="text-mb-gray">
          Gestioná las variantes que ve el cliente, las fotos por tipo de
          cajita y cargá nuevas variantes.
        </p>
      </header>

      <div className="mb-6 flex gap-0 border-b border-mb-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px rounded-t-md border border-b-0 px-5 py-2.5 text-sm transition-colors ${
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
        <p className="mb-4 rounded-lg bg-mb-red/10 px-4 py-3 text-sm text-mb-red">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 rounded-lg bg-mb-green/10 px-4 py-3 text-sm text-mb-green">
          {message}
        </p>
      )}

      {/* Pestaña 0: Variantes para el cliente */}
      {activeTab === 0 && (
        <div className="mm-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-mb-ink">
            Variantes que se muestran en la página de pedido
          </h2>
          {variants.length === 0 ? (
            <p className="m-0 text-mb-gray">
              No hay variantes. Cargá una en la pestaña &quot;Cargar nueva
              variante&quot;.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {variants.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mb-border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    {editingNameId === v.id ? (
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
                        onClick={() => startEditName(v)}
                        className="text-left font-medium text-mb-ink hover:text-mb-blue"
                        title="Clic para editar nombre"
                      >
                        {v.name}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label
                      className={`mm-label flex cursor-pointer items-center gap-2 ${
                        saving ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-mb-blue"
                        checked={!!(v.visible_no_light ?? v.visible)}
                        onChange={() =>
                          handleToggleVisibleByType(v, "no_light")
                        }
                        disabled={saving}
                      />
                      Sin Luz
                    </label>
                    <label
                      className={`mm-label flex cursor-pointer items-center gap-2 ${
                        saving ? "opacity-50" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-mb-blue"
                        checked={!!(v.visible_with_light ?? v.visible)}
                        onChange={() =>
                          handleToggleVisibleByType(v, "with_light")
                        }
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
        <div className="mm-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-mb-ink">
            Fotos por variante y tipo de cajita
          </h2>
          {variants.length === 0 ? (
            <p className="text-mb-gray">No hay variantes.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="border-b border-mb-border pb-6 last:border-b-0"
                >
                  <h3 className="mb-3 text-base font-semibold text-mb-ink">
                    {v.name}
                  </h3>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-sm text-mb-gray">Sin Luz</h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {(v.images_no_light || []).slice(0, 4).map((img, i) => (
                          <img
                            key={img.id ?? i}
                            src={getMediaSrc(img.url)}
                            alt=""
                            className="h-12 w-12 rounded object-cover"
                          />
                        ))}
                        <button
                          type="button"
                          className="mm-btn mm-btn-outline"
                          onClick={() => openModal(v, "no_light")}
                          disabled={saving}
                        >
                          Editar fotos
                        </button>
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm text-mb-gray">Con Luz</h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {(v.images_with_light || [])
                          .slice(0, 4)
                          .map((img, i) => (
                            <img
                              key={img.id ?? i}
                              src={getMediaSrc(img.url)}
                              alt=""
                              className="h-12 w-12 rounded object-cover"
                            />
                          ))}
                        <button
                          type="button"
                          className="mm-btn mm-btn-outline"
                          onClick={() => openModal(v, "with_light")}
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
        <div className="mm-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-mb-ink">
            Cargar nueva variante
          </h2>
          <form onSubmit={handleAddVariant} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mm-label">Nombre</label>
                <input
                  type="text"
                  value={addVariantForm.name}
                  onChange={(e) =>
                    setAddVariantForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mm-input"
                  placeholder="ej. Dorado"
                />
              </div>
              <div>
                <label className="mm-label">Código (slug)</label>
                <input
                  type="text"
                  value={addVariantForm.code}
                  onChange={(e) =>
                    setAddVariantForm((f) => ({
                      ...f,
                      code: e.target.value
                        .replace(/\s/g, "_")
                        .toLowerCase(),
                    }))
                  }
                  className="mm-input"
                  placeholder="ej. gold"
                />
              </div>
            </div>

            <div>
              <label className="mm-label mb-2 block">
                Imágenes (arrastrá y soltá o hacé clic)
              </label>
              <div
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() =>
                  document.getElementById("new-variant-file-input")?.click()
                }
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center text-mb-gray transition-colors ${
                  dragOver
                    ? "border-mb-blue bg-mb-blue-light"
                    : "border-mb-border bg-mb-gray-light"
                }`}
              >
                Arrastrá imágenes aquí o hacé clic para elegir
              </div>
              <input
                id="new-variant-file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {newVariantFiles.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-mb-ink">
                  Orden y tipo de cada imagen
                </h4>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {newVariantFiles.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-md bg-mb-gray-light p-2"
                    >
                      <span className="w-6 text-mb-gray">#{i + 1}</span>
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                      <select
                        value={item.box_type}
                        onChange={(e) =>
                          setNewFileBoxType(i, e.target.value as BoxType)
                        }
                        className="mm-input w-32"
                      >
                        {BOX_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="mm-btn mm-btn-outline"
                        onClick={() => moveNewFile(i, -1)}
                        disabled={i === 0}
                        aria-label="Subir"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="mm-btn mm-btn-outline"
                        onClick={() => moveNewFile(i, 1)}
                        disabled={i === newVariantFiles.length - 1}
                        aria-label="Bajar"
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        className="mm-btn mm-btn-outline"
                        onClick={() => removeNewFile(i)}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="submit"
              className="mm-btn mm-btn-primary self-start"
              disabled={addingVariant || newVariantFiles.length === 0}
            >
              {addingVariant ? "Creando..." : "Crear variante y subir fotos"}
            </button>
          </form>
        </div>
      )}

      {/* Modal editar fotos */}
      {modalEdit && (
        <div
          className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="mm-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-mb-border p-5">
              <h3 className="text-lg font-semibold text-mb-ink">
                {modalEdit.variant.name} –{" "}
                {modalEdit.boxType === "no_light" ? "Sin Luz" : "Con Luz"}
              </h3>
              <button
                type="button"
                className="text-mb-gray hover:text-mb-ink"
                onClick={closeModal}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {modalImages.length === 0 ? (
                <p className="m-0 text-mb-gray">
                  No hay imágenes. Agregá desde Django Admin o la pestaña de
                  carga.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {modalImages.map((img, i) => (
                    <li
                      key={img.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-mb-border p-3"
                    >
                      <span className="w-6 text-mb-gray">#{i + 1}</span>
                      <img
                        src={getMediaSrc(img.url)}
                        alt=""
                        className="h-16 w-16 rounded object-cover"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <div>
                          <input
                            id={`modal-file-${img.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={saving}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              const f = e.target.files?.[0];
                              if (f) handleReplaceImage(img.id, f);
                              e.target.value = "";
                            }}
                          />
                          <label
                            htmlFor={saving ? undefined : `modal-file-${img.id}`}
                            className={`mm-btn mm-btn-outline cursor-pointer ${
                              saving ? "pointer-events-none opacity-70" : ""
                            }`}
                          >
                            {replacingId === img.id
                              ? "Subiendo…"
                              : "Elegir archivo"}
                          </label>
                        </div>
                        <button
                          type="button"
                          className="mm-btn mm-btn-outline"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0 || saving}
                          title="Subir"
                          aria-label="Subir"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="mm-btn mm-btn-outline"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === modalImages.length - 1 || saving}
                          title="Bajar"
                          aria-label="Bajar"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          className="mm-btn mm-btn-danger"
                          onClick={() => handleDeleteImage(img.id)}
                          disabled={saving}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-mb-border p-5">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={closeModal}
              >
                Cerrar
              </button>
              {modalImages.length > 0 && (
                <button
                  type="button"
                  className="mm-btn mm-btn-primary"
                  onClick={saveModalOrder}
                  disabled={saving}
                >
                  {saving ? "Guardando..." : "Guardar orden"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
