"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { MoreHorizontal, RefreshCw, X } from "lucide-react";
import api from "@/lib/api";

// Mismo tamaño que el backend (orders/views.py submit_images: 685x685)
const CROP_OUTPUT_SIZE = 685;

interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCrop {
  id: number;
  order?: number;
  slot?: number;
  image?: string | null;
}

interface Order {
  id: number;
  client_name?: string;
  phone?: string;
  variant?: string;
  box_type?: string;
  led_type?: string;
  shipping_option?: string;
  status?: string;
  deposit?: boolean;
  active?: boolean;
  created_at?: string;
  qr_code?: string | null;
  image_crops?: ImageCrop[];
}

interface PreviewGallery {
  urls: string[];
  currentIndex: number;
}

interface MenuPosition {
  top: number;
  right: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  crop: ImageCrop;
}

interface CropEditorState {
  crop: ImageCrop;
  step: "select" | "crop";
  file: File | null;
  objectUrl: string | null;
  cropArea: Point;
  zoom: number;
  cropMediaLoading?: boolean;
  saving?: boolean;
}

const getCroppedBlob = (imageUrl: string, pixelCrop: PixelCrop): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = CROP_OUTPUT_SIZE;
        canvas.height = CROP_OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No 2d context"));
          return;
        }
        ctx.drawImage(
          img,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          CROP_OUTPUT_SIZE,
          CROP_OUTPUT_SIZE,
        );
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.9,
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });

const sanitizeFileName = (name?: string): string => {
  if (!name || typeof name !== "string") return "cliente";
  return (
    name
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "cliente"
  );
};

const toZipClientSlug = (name?: string): string => {
  const raw = sanitizeFileName(name);
  return (
    raw
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .trim() || "cliente"
  );
};

const toZipDate = (createdAt?: string): string => {
  const d = createdAt ? new Date(createdAt) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "En Proceso",
  in_progress: "En Proceso",
  processing: "Finalizada",
  delivered: "Entregada",
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "in_progress", label: "En Proceso" },
  { value: "processing", label: "Finalizada" },
  { value: "delivered", label: "Entregada" },
];

const BOX_TYPE_LABELS: Record<string, string> = {
  no_light: "Sin Luz",
  with_light: "Con Luz",
};

const LED_TYPE_LABELS: Record<string, string> = {
  warm_led: "LED Cálido",
  white_led: "LED Blanco",
};

const SHIPPING_LABELS: Record<string, string> = {
  pickup_uber: "Retiro/Uber",
  shipping_province: "Envío a otra provincia",
};

const VARIANT_LABELS: Record<string, string> = {
  graphite: "Grafito",
  wood: "Madera",
  black: "Negro",
  marble: "Mármol",
  graphite_light: "Grafito",
  wood_light: "Madera",
  black_light: "Negro",
  marble_light: "Mármol",
};

// Badge color por estado (draft=gris, in_progress=azul, processing=ámbar, delivered=verde).
const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: "bg-mb-gray-light text-mb-gray",
  in_progress: "bg-mb-blue-light text-mb-blue-dark",
  processing: "bg-mb-amber/15 text-mb-amber",
  delivered: "bg-mb-green/15 text-mb-green",
};

const getBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
};

/** Path for media: backend serves at /media/; API may return path with or without /media/. */
const toMediaPath = (path?: string | null): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const raw = path.startsWith("/") ? path.slice(1) : path;
  const withMedia = raw.startsWith("media/") ? `/${raw}` : `/media/${raw}`;
  return withMedia;
};

const getMediaUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const p = toMediaPath(path);
  return p ? getBaseUrl() + p : null;
};

const isEnCurso = (s?: string): boolean => s === "in_progress" || s === "sent";

function Toggle({
  on,
  disabled,
  label,
  onClick,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-mb-green" : "bg-mb-border"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showHiddenOrders, setShowHiddenOrders] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<PreviewGallery | null>(null);
  const [updatingSenaId, setUpdatingSenaId] = useState<number | null>(null);
  const [hidingOrderId, setHidingOrderId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [downloadingZipId, setDownloadingZipId] = useState<number | null>(null);
  const [regeneratingQrId, setRegeneratingQrId] = useState<number | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cropEditor, setCropEditor] = useState<CropEditorState | null>(null);
  const adminCropPixelsRef = useRef<PixelCrop | null>(null);
  const adminCropAreaRef = useRef<Point>({ x: 0, y: 0 });
  const adminZoomRef = useRef(1);
  const adminPrevZoomRef = useRef(1);
  const previewOverlayRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);

  const adminCropAreaRAFRef = useRef<number | null>(null);
  const adminZoomRAFRef = useRef<number | null>(null);

  const adminOnCropChangeThrottled = useCallback((area: Point) => {
    adminCropAreaRef.current = area;
    if (adminCropAreaRAFRef.current == null) {
      adminCropAreaRAFRef.current = requestAnimationFrame(() => {
        setCropEditor((prev) => (prev ? { ...prev, cropArea: adminCropAreaRef.current } : prev));
        adminCropAreaRAFRef.current = null;
      });
    }
  }, []);

  const adminOnZoomChangeThrottled = useCallback((z: number) => {
    adminZoomRef.current = z;
    if (adminZoomRAFRef.current == null) {
      adminZoomRAFRef.current = requestAnimationFrame(() => {
        const newZoom = adminZoomRef.current;
        const wasZoomingOut = newZoom < adminPrevZoomRef.current;
        adminPrevZoomRef.current = newZoom;
        if (wasZoomingOut) {
          adminCropAreaRef.current = { x: 0, y: 0 };
          setCropEditor((prev) =>
            prev ? { ...prev, zoom: newZoom, cropArea: { x: 0, y: 0 } } : prev,
          );
        } else {
          setCropEditor((prev) => (prev ? { ...prev, zoom: newZoom } : prev));
        }
        adminZoomRAFRef.current = null;
      });
    }
  }, []);

  const loadOrders = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getOrders(true)
      .then((data) => setPedidos((data as Order[]) || []))
      .catch(() => setPedidos([]))
      .finally(() => setLoading(false));
  }, []);

  const loadOrdersWithCurrentFilter = useCallback(
    (silent = false) => loadOrders(silent),
    [loadOrders],
  );

  useEffect(() => {
    // Carga inicial de pedidos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrdersWithCurrentFilter();
  }, [loadOrdersWithCurrentFilter]);

  useEffect(() => {
    const handler = () => loadOrdersWithCurrentFilter(true);
    window.addEventListener("orders-update", handler);
    return () => window.removeEventListener("orders-update", handler);
  }, [loadOrdersWithCurrentFilter]);

  useLayoutEffect(() => {
    if (!openMenuId || !menuTriggerRef.current) {
      setMenuPosition(null);
      return;
    }
    const rect = menuTriggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [openMenuId]);

  useEffect(() => {
    if (openMenuId == null) return;
    const close = () => setOpenMenuId(null);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuTriggerRef.current?.contains(target) || menuDropdownRef.current?.contains(target))
        return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("click", handler);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", handler);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMenu]);

  useEffect(() => {
    if (previewGallery && previewOverlayRef.current) {
      previewOverlayRef.current.focus();
    }
  }, [previewGallery]);

  const onToggleShowHidden = () => {
    setShowHiddenOrders((prev) => !prev);
  };

  const filtered = pedidos.filter((p) => {
    const visible = showHiddenOrders || p.active !== false;
    const matchSearch =
      !search ||
      (p.client_name && p.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.phone && p.phone.includes(search));
    const matchStatus =
      !statusFilter ||
      p.status === statusFilter ||
      (statusFilter === "in_progress" && p.status === "sent");
    return visible && matchSearch && matchStatus;
  });

  const enCursoCount = pedidos.filter((p) => isEnCurso(p.status)).length;

  const stats = {
    total: pedidos.length,
    draft: pedidos.filter((p) => p.status === "draft").length,
    enCurso: enCursoCount,
    processing: pedidos.filter((p) => p.status === "processing").length,
    delivered: pedidos.filter((p) => p.status === "delivered").length,
  };

  const openDetail = useCallback((id: number) => {
    setDetailOrder(null);
    setDetailLoading(true);
    api
      .getOrder(id)
      .then((data) => setDetailOrder(data as Order))
      .catch(() => setDetailOrder(null))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    const verId = searchParams.get("ver");
    if (!verId) return;
    // Abre el detalle leyendo ?ver=ID y limpia el query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openDetail(Number(verId));
    router.replace("/admin");
  }, [searchParams, router, openDetail]);

  const hideDraft = (e: React.MouseEvent, orderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (hidingOrderId != null) return;
    setHidingOrderId(orderId);
    api
      .patchOrder(orderId, { active: false })
      .then(() => {
        setPedidos((prev) => prev.filter((p) => p.id !== orderId));
        if (detailOrder?.id === orderId) setDetailOrder(null);
      })
      .catch(() => {})
      .finally(() => setHidingOrderId(null));
  };

  const showOrder = (e: React.MouseEvent, orderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (hidingOrderId != null) return;
    setHidingOrderId(orderId);
    api
      .patchOrder(orderId, { active: true })
      .then(() => loadOrdersWithCurrentFilter(true))
      .catch(() => {})
      .finally(() => setHidingOrderId(null));
  };

  const changeOrderStatus = (orderId: number, newStatus: string) => {
    if (updatingStatusId != null) return;
    setOpenMenuId(null);
    setUpdatingStatusId(orderId);
    api
      .patchOrder(orderId, { status: newStatus })
      .then(() => {
        setPedidos((prev) =>
          prev.map((p) => (p.id === orderId ? { ...p, status: newStatus } : p)),
        );
        if (detailOrder?.id === orderId) {
          setDetailOrder((d) => (d ? { ...d, status: newStatus } : d));
        }
      })
      .catch(() => {})
      .finally(() => setUpdatingStatusId(null));
  };

  const toggleSena = (e: React.MouseEvent, orderId: number, currentDeposit: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (updatingSenaId != null) return;
    setUpdatingSenaId(orderId);
    const clearUpdating = () => setUpdatingSenaId(null);
    const fallback = setTimeout(clearUpdating, 8000);
    const newValue = !currentDeposit;
    api
      .patchOrder(orderId, { deposit: newValue })
      .then(() => {
        setPedidos((prev) =>
          prev.map((p) => (p.id === orderId ? { ...p, deposit: newValue } : p)),
        );
        if (detailOrder?.id === orderId) {
          setDetailOrder((d) => (d ? { ...d, deposit: newValue } : d));
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallback);
        clearUpdating();
      });
  };

  const regenerateOrderQr = useCallback(async () => {
    if (!detailOrder?.id || regeneratingQrId != null) return;
    setRegeneratingQrId(detailOrder.id);
    try {
      const updated = await api.regenerateOrderQr(detailOrder.id);
      setDetailOrder(updated as Order);
    } catch (err) {
      console.error(err);
      setZipError((err as Error)?.message || "No se pudo regenerar el QR.");
    } finally {
      setRegeneratingQrId(null);
    }
  }, [detailOrder, regeneratingQrId]);

  const downloadOrderZip = useCallback(
    async (order: Order) => {
      if (downloadingZipId != null) return;
      setOpenMenuId(null);
      setZipError(null);
      setDownloadingZipId(order.id);
      try {
        const fallbackFilename = `${toZipDate(order.created_at)}-${toZipClientSlug(order.client_name)}.zip`;
        const { blob, filename } = await api.getOrderZip(order.id, fallbackFilename);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        console.error("Error al descargar zip:", err);
        setZipError((err as Error)?.message || "Error al descargar el zip. Revisa la consola.");
      } finally {
        setDownloadingZipId(null);
      }
    },
    [downloadingZipId],
  );

  const boxTypeLabel = (v?: string) => (v ? BOX_TYPE_LABELS[v] ?? v : "");
  const ledTypeLabel = (v?: string) => (v ? LED_TYPE_LABELS[v] ?? v : "");
  const shippingLabel = (v?: string) => (v ? SHIPPING_LABELS[v] ?? v : "");
  const variantLabel = (v?: string) => (v ? VARIANT_LABELS[v] ?? v.replace(/_/g, " ") : "");
  const statusLabel = (s?: string) => (s ? STATUS_LABELS[s] ?? s : "");
  const statusBadgeClass = (s?: string) => {
    const key = s === "sent" ? "in_progress" : s || "draft";
    return STATUS_BADGE_CLASS[key] ?? STATUS_BADGE_CLASS.draft;
  };

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Dashboard</h1>
        <p className="text-mb-gray">Pedidos de Cajita de la Memoria</p>
      </header>

      <div className="mm-card p-5">
        {zipError && (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-mb-red/10 px-4 py-3 text-sm text-mb-red"
            role="alert"
          >
            <span>{zipError}</span>
            <button
              type="button"
              onClick={() => setZipError(null)}
              aria-label="Cerrar"
              className="text-mb-red"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { value: stats.total, label: "Total" },
            { value: stats.draft, label: "Borrador" },
            { value: stats.enCurso, label: "En Proceso" },
            { value: stats.processing, label: "Finalizada" },
            { value: stats.delivered, label: "Entregada" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-mb-border bg-mb-gray-light px-4 py-3 text-center"
            >
              <span className="block text-2xl font-bold text-mb-blue">{s.value}</span>
              <span className="text-xs font-medium text-mb-gray">{s.label}</span>
            </div>
          ))}
        </section>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            className="mm-input sm:flex-1"
            placeholder="Buscar por cliente o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="mm-input sm:w-56"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mb-ink">
            <input
              type="checkbox"
              checked={showHiddenOrders}
              onChange={onToggleShowHidden}
              className="h-4 w-4 accent-mb-blue"
            />
            <span>Ver pedidos ocultos</span>
          </label>
        </div>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-mb-ink">Pedidos</h2>
          {loading ? (
            <p className="py-8 text-center text-mb-gray">Cargando pedidos...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-mb-gray">No hay pedidos que coincidan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="mm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Variante</th>
                    <th>Tipo</th>
                    <th>LED</th>
                    <th>Envío</th>
                    <th>Estado</th>
                    <th>Seña</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.client_name || "—"}</td>
                      <td>{p.phone || "—"}</td>
                      <td>{variantLabel(p.variant)}</td>
                      <td>{boxTypeLabel(p.box_type)}</td>
                      <td>{p.led_type ? ledTypeLabel(p.led_type) : "—"}</td>
                      <td>{p.shipping_option ? shippingLabel(p.shipping_option) : "—"}</td>
                      <td>
                        <span className={`mm-badge ${statusBadgeClass(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td>
                        <Toggle
                          on={p.deposit === true}
                          disabled={updatingSenaId === p.id}
                          label={p.deposit ? "Seña recibida" : "Seña pendiente"}
                          onClick={(ev) => toggleSena(ev, p.id, !!p.deposit)}
                        />
                      </td>
                      <td>
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                      <td>
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-mb-gray hover:bg-mb-gray-light hover:text-mb-ink"
                            ref={openMenuId === p.id ? menuTriggerRef : null}
                            onClick={(ev) => {
                              if (openMenuId === p.id) {
                                setOpenMenuId(null);
                              } else {
                                menuTriggerRef.current = ev.currentTarget;
                                setOpenMenuId(p.id);
                              }
                            }}
                            aria-expanded={openMenuId === p.id}
                            aria-haspopup="true"
                            aria-label="Abrir menú de acciones"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {openMenuId != null &&
        menuPosition != null &&
        (() => {
          const p = pedidos.find((o) => o.id === openMenuId);
          if (!p) return null;
          return createPortal(
            <div
              ref={menuDropdownRef}
              className="mm-card fixed z-[1050] flex w-max min-w-[8.5rem] flex-col py-1"
              role="menu"
              style={{ top: menuPosition.top, right: menuPosition.right }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="px-4 py-2 text-left text-sm text-mb-ink hover:bg-mb-gray-light"
                onClick={() => {
                  setOpenMenuId(null);
                  openDetail(p.id);
                }}
              >
                Ver
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={downloadingZipId === p.id}
                className="px-4 py-2 text-left text-sm text-mb-ink hover:bg-mb-gray-light disabled:opacity-50"
                onClick={() => downloadOrderZip(p)}
              >
                {downloadingZipId === p.id ? "..." : "Descargar zip"}
              </button>
              {(p.status === "draft" || p.status === "delivered") && p.active !== false && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={hidingOrderId === p.id}
                  className="px-4 py-2 text-left text-sm text-mb-ink hover:bg-mb-gray-light disabled:opacity-50"
                  onClick={(ev) => {
                    setOpenMenuId(null);
                    hideDraft(ev, p.id);
                  }}
                >
                  {hidingOrderId === p.id ? "..." : "Ocultar"}
                </button>
              )}
              {showHiddenOrders && p.active === false && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={hidingOrderId === p.id}
                  className="px-4 py-2 text-left text-sm text-mb-ink hover:bg-mb-gray-light disabled:opacity-50"
                  onClick={(ev) => {
                    setOpenMenuId(null);
                    showOrder(ev, p.id);
                  }}
                >
                  {hidingOrderId === p.id ? "..." : "Mostrar"}
                </button>
              )}
              {(p.status === "in_progress" || p.status === "sent") && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={updatingStatusId === p.id}
                  className="px-4 py-2 text-left text-sm text-mb-blue-dark hover:bg-mb-gray-light disabled:opacity-50"
                  onClick={() => changeOrderStatus(p.id, "processing")}
                >
                  {updatingStatusId === p.id ? "..." : "Pasar a Finalizado"}
                </button>
              )}
              {p.status === "processing" && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={updatingStatusId === p.id}
                  className="px-4 py-2 text-left text-sm text-mb-green hover:bg-mb-gray-light disabled:opacity-50"
                  onClick={() => changeOrderStatus(p.id, "delivered")}
                >
                  {updatingStatusId === p.id ? "..." : "Pasar a Entregado"}
                </button>
              )}
            </div>,
            document.body,
          );
        })()}

      {detailLoading && (
        <div
          className="fixed inset-0 z-[1040] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailLoading(false)}
        >
          <div className="mm-card p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-mb-gray">Cargando detalle...</p>
          </div>
        </div>
      )}

      {previewGallery && previewGallery.urls.length > 0 && (
        <div
          ref={previewOverlayRef}
          className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/80 p-4 outline-none"
          onClick={() => setPreviewGallery(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreviewGallery(null);
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setPreviewGallery((g) =>
                g
                  ? { ...g, currentIndex: (g.currentIndex - 1 + g.urls.length) % g.urls.length }
                  : g,
              );
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              setPreviewGallery((g) =>
                g ? { ...g, currentIndex: (g.currentIndex + 1) % g.urls.length } : g,
              );
            }
          }}
          aria-label="Vista previa de imagen"
        >
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-3xl text-white hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewGallery((g) =>
                g
                  ? { ...g, currentIndex: (g.currentIndex - 1 + g.urls.length) % g.urls.length }
                  : g,
              );
            }}
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <div className="max-h-[85vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewGallery.urls[previewGallery.currentIndex]}
              alt={`Vista previa ${previewGallery.currentIndex + 1} de ${previewGallery.urls.length}`}
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
          </div>
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/20 p-3 text-3xl text-white hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewGallery((g) =>
                g ? { ...g, currentIndex: (g.currentIndex + 1) % g.urls.length } : g,
              );
            }}
            aria-label="Foto siguiente"
          >
            ›
          </button>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={() => setPreviewGallery(null)}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {detailOrder && !detailLoading && (
        <div
          className="fixed inset-0 z-[1040] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setDetailOrder(null);
            setPreviewGallery(null);
          }}
        >
          <div
            className="mm-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-mb-ink">Pedido #{detailOrder.id}</h2>
              <button
                type="button"
                className="rounded-full p-1 text-mb-gray hover:bg-mb-gray-light"
                onClick={() => setDetailOrder(null)}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5 text-sm text-mb-ink">
              <div>
                <h3 className="mb-2 font-semibold text-mb-ink">Cliente</h3>
                <p>
                  <strong>Nombre:</strong> {detailOrder.client_name || "—"}
                </p>
                <p>
                  <strong>Teléfono:</strong> {detailOrder.phone || "—"}
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-mb-ink">Cajita</h3>
                <p>
                  <strong>Tipo:</strong> {boxTypeLabel(detailOrder.box_type)}
                </p>
                {detailOrder.led_type && (
                  <p>
                    <strong>Tipo LED:</strong> {ledTypeLabel(detailOrder.led_type)}
                  </p>
                )}
                <p>
                  <strong>Variante:</strong> {variantLabel(detailOrder.variant)}
                </p>
                {detailOrder.shipping_option && (
                  <p>
                    <strong>Envío:</strong> {shippingLabel(detailOrder.shipping_option)}
                  </p>
                )}
                <p>
                  <strong>Estado:</strong> {statusLabel(detailOrder.status)}
                </p>
                <p className="mt-1 flex items-center gap-2">
                  <strong>Seña:</strong>{" "}
                  <Toggle
                    on={detailOrder.deposit === true}
                    disabled={updatingSenaId === detailOrder.id}
                    label={detailOrder.deposit ? "Seña recibida" : "Seña pendiente"}
                    onClick={(ev) => toggleSena(ev, detailOrder.id, !!detailOrder.deposit)}
                  />
                </p>
              </div>
              {detailOrder.created_at && (
                <p className="text-xs text-mb-gray">
                  Creado: {new Date(detailOrder.created_at).toLocaleString("es-AR")}
                </p>
              )}
              <div>
                <h3 className="mb-2 font-semibold text-mb-ink">QR del pedido</h3>
                <p className="mb-2 text-xs text-mb-gray">
                  El enlace del QR lo define el servidor (<code>FRONTEND_URL</code>). Si al escanear
                  abre una IP local (p. ej. <code>192.168…</code>), configurá la URL pública del
                  sitio en producción y regenerá el QR.
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  {detailOrder.qr_code && (
                    <a
                      href={getMediaUrl(detailOrder.qr_code) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mb-blue hover:underline"
                    >
                      Ver imagen del QR
                    </a>
                  )}
                  <a
                    href={`/pedido/${detailOrder.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mb-blue hover:underline"
                  >
                    Página del pedido (mismo origen que el admin)
                  </a>
                  <button
                    type="button"
                    className="mm-btn mm-btn-outline"
                    disabled={regeneratingQrId === detailOrder.id}
                    onClick={() => regenerateOrderQr()}
                  >
                    <RefreshCw size={14} />
                    {regeneratingQrId === detailOrder.id ? "Regenerando…" : "Regenerar QR"}
                  </button>
                </p>
              </div>
              {detailOrder.image_crops &&
                detailOrder.image_crops.length > 0 &&
                (() => {
                  const crops = detailOrder.image_crops || [];
                  const previewUrls = crops
                    .filter((c) => c.image)
                    .map((c) => getMediaUrl(c.image))
                    .filter((u): u is string => !!u);
                  return (
                    <div>
                      <h3 className="mb-2 font-semibold text-mb-ink">
                        Imágenes ({crops.length})
                      </h3>
                      <p className="mb-2 text-xs text-mb-gray">
                        Clic derecho sobre una imagen para reemplazarla.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {crops.slice(0, 10).map((crop) => {
                          const url = crop.image ? getMediaUrl(crop.image) : null;
                          return (
                            <div
                              key={crop.id}
                              role="button"
                              tabIndex={0}
                              className="h-20 w-20 cursor-pointer overflow-hidden rounded-lg border border-mb-border bg-mb-gray-light"
                              onClick={() =>
                                url &&
                                setPreviewGallery({
                                  urls: previewUrls,
                                  currentIndex: previewUrls.indexOf(url),
                                })
                              }
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenu({ x: e.clientX, y: e.clientY, crop });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (url)
                                    setPreviewGallery({
                                      urls: previewUrls,
                                      currentIndex: previewUrls.indexOf(url),
                                    });
                                }
                              }}
                            >
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-mb-gray">
                                  —
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="mm-card fixed z-[1070] py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="px-4 py-2 text-left text-sm text-mb-ink hover:bg-mb-gray-light"
            onClick={() => {
              adminPrevZoomRef.current = 1;
              setCropEditor({
                crop: contextMenu.crop,
                step: "select",
                file: null,
                objectUrl: null,
                cropArea: { x: 0, y: 0 },
                zoom: 1,
              });
              setContextMenu(null);
            }}
          >
            Reemplazar imagen
          </button>
        </div>
      )}

      {cropEditor?.crop && (
        <div className="fixed inset-0 z-[1080] flex items-center justify-center bg-black/70 p-4">
          <div className="mm-card w-full max-w-lg p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-mb-ink">
                Reemplazar imagen {(cropEditor.crop.slot ?? 0) + 1}
              </h3>
              <button
                type="button"
                className="rounded-full p-1 text-mb-gray hover:bg-mb-gray-light"
                onClick={() => !cropEditor.saving && setCropEditor(null)}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            {cropEditor.step === "select" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-sm text-mb-gray">Elegí una imagen nueva para este slot.</p>
                <input
                  id="admin-crop-editor-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const objectUrl = URL.createObjectURL(file);
                    setCropEditor((prev) =>
                      prev
                        ? { ...prev, step: "crop", file, objectUrl, cropMediaLoading: true }
                        : prev,
                    );
                  }}
                />
                <label
                  htmlFor="admin-crop-editor-file"
                  className="mm-btn mm-btn-primary cursor-pointer"
                >
                  Seleccionar archivo
                </label>
              </div>
            )}
            {cropEditor.step === "crop" && cropEditor.objectUrl && (
              <div>
                <div className="relative mx-auto h-[420px] w-[420px] max-w-full overflow-hidden rounded-lg bg-slate-900">
                  {cropEditor.cropMediaLoading && (
                    <div
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-white"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      <span className="text-sm">Cargando imagen…</span>
                    </div>
                  )}
                  <Cropper
                    image={cropEditor.objectUrl}
                    crop={cropEditor.cropArea}
                    zoom={cropEditor.zoom}
                    aspect={1}
                    minZoom={1}
                    objectFit="cover"
                    restrictPosition
                    style={{ containerStyle: { backgroundColor: "#0f172a" } }}
                    cropSize={{ width: 420, height: 420 }}
                    onCropChange={adminOnCropChangeThrottled}
                    onZoomChange={adminOnZoomChangeThrottled}
                    onCropComplete={(_: Area, croppedAreaPixels: Area) => {
                      adminCropPixelsRef.current = croppedAreaPixels;
                      setCropEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              cropArea: adminCropAreaRef.current,
                              zoom: adminZoomRef.current,
                            }
                          : prev,
                      );
                    }}
                    onMediaLoaded={() =>
                      setCropEditor((prev) => (prev ? { ...prev, cropMediaLoading: false } : prev))
                    }
                    cropShape="rect"
                    showGrid={false}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="mm-btn mm-btn-outline"
                    onClick={() => {
                      if (cropEditor.objectUrl) URL.revokeObjectURL(cropEditor.objectUrl);
                      setCropEditor((prev) =>
                        prev ? { ...prev, step: "select", file: null, objectUrl: null } : prev,
                      );
                    }}
                  >
                    Elegir otra
                  </button>
                  <button
                    type="button"
                    className="mm-btn mm-btn-primary"
                    disabled={cropEditor.saving}
                    onClick={async () => {
                      const pixels = adminCropPixelsRef.current;
                      if (!pixels || !cropEditor.objectUrl) return;
                      setCropEditor((prev) => (prev ? { ...prev, saving: true } : prev));
                      try {
                        const blob = await getCroppedBlob(cropEditor.objectUrl, pixels);
                        const file = new File([blob], `crop_${cropEditor.crop?.slot ?? 0}.jpg`, {
                          type: "image/jpeg",
                        });
                        const orderId = detailOrder?.id ?? cropEditor.crop?.order;
                        if (!orderId) throw new Error("Falta el pedido");
                        if (!cropEditor.crop?.id) throw new Error("Falta el crop");
                        await api.replaceImageCrop(cropEditor.crop.id, orderId, file);
                        if (cropEditor.objectUrl) URL.revokeObjectURL(cropEditor.objectUrl);
                        setCropEditor(null);
                        if (detailOrder?.id) {
                          const updated = await api.getOrder(detailOrder.id);
                          setDetailOrder(updated as Order);
                        }
                      } catch (err) {
                        console.error(err);
                        setCropEditor((prev) => (prev ? { ...prev, saving: false } : prev));
                      }
                    }}
                  >
                    {cropEditor.saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
