"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Cropper, { getInitialCropFromCroppedAreaPixels } from "react-easy-crop";
import type { Area, Point, Size, MediaSize } from "react-easy-crop";
import {
  Package,
  Scissors,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  PartyPopper,
  Wallet,
  Send,
  MessageCircle,
  Mail,
  ImagePlus,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import type { Order, Prices } from "@/types";
import {
  saveEditorImages,
  loadEditorImages,
  clearEditorImages,
  type StoredEditorImage,
} from "@/lib/editorStore";
import "./editor.css";

const REQUIRED_COUNT = 10;
// Lado máximo (px) al que se redimensiona cada imagen antes de subirla. El recorte
// final es 685px, así que no hace falta mandar la foto original full-res: reduce
// muchísimo el tamaño de subida (clave en conexiones móviles) sin perder calidad.
const MAX_UPLOAD_DIM = 2048;

interface DownscaleResult {
  blob: Blob;
  scaleX: number;
  scaleY: number;
}

/**
 * Decodifica el archivo respetando la orientación EXIF y devuelve el bitmap ya
 * orientado. Es clave que coincida con lo que muestra el <img> del cropper: si
 * las dimensiones quedan invertidas (caso EXIF), el crop_data no coincide con la
 * imagen subida y el recorte sale desplazado.
 */
const decodeOriented = async (
  file: File,
): Promise<{ src: CanvasImageSource; w: number; h: number; close: () => void }> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        src: bitmap,
        w: bitmap.width,
        h: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* fallback a <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode error"));
    el.src = url;
  });
  return {
    src: image,
    w: image.naturalWidth,
    h: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
};

/**
 * Redimensiona una imagen para subir y devuelve el blob + los factores de escala
 * por eje (para escalar el crop_data, que está en px del espacio que vio el
 * cropper). `mediaW/mediaH` son las dimensiones que reportó el cropper: se usan
 * como referencia para que el crop siga alineado aunque la decodificación
 * difiera. Si la imagen ya es chica, devuelve el File original con escala 1.
 */
const downscaleForUpload = async (
  file: File,
  maxDim: number,
  mediaW?: number,
  mediaH?: number,
): Promise<DownscaleResult> => {
  let decoded: Awaited<ReturnType<typeof decodeOriented>> | null = null;
  try {
    decoded = await decodeOriented(file);
    const { src, w, h } = decoded;
    // Espacio de referencia del crop: lo que vio el cropper (si se conoce).
    const refW = mediaW && mediaW > 0 ? mediaW : w;
    const refH = mediaH && mediaH > 0 ? mediaH : h;
    if (refW !== w || refH !== h) {
      console.warn(
        `[editor] dims del cropper (${refW}x${refH}) != dims decodificadas (${w}x${h}) — posible EXIF`,
      );
    }
    const longest = Math.max(w, h);
    if (longest <= maxDim) {
      return { blob: file, scaleX: w / refW, scaleY: h / refH };
    }
    const scale = maxDim / longest;
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, scaleX: w / refW, scaleY: h / refH };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, cw, ch);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
    );
    // Escala respecto al espacio del crop, no al de la imagen decodificada.
    return blob
      ? { blob, scaleX: cw / refW, scaleY: ch / refH }
      : { blob: file, scaleX: w / refW, scaleY: h / refH };
  } catch {
    return { blob: file, scaleX: 1, scaleY: 1 };
  } finally {
    decoded?.close();
  }
};

const DEFAULT_ALIAS = "manu.perea13";
const DEFAULT_TELEFONO = "+54 9 351 392 3790";
const DEFAULT_EMAIL = "copiiworld@gmail.com";
const WHATSAPP_COMPROBANTE_MSG =
  "Hola, te envío el comprobante de la transferencia de la Cajita de la Memoria.";

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

const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

// Imágenes por defecto con frases (public/default-phrases/), agrupadas por motivo
interface PhraseGroup {
  id: string;
  label: string;
  prefix: string;
  count: number;
}

const PHRASE_GROUPS: PhraseGroup[] = [
  { id: "motivo1", label: "Motivo 1", prefix: "Motivo1", count: 6 },
  { id: "motivo2", label: "Motivo 2", prefix: "Motivo2", count: 5 },
  { id: "motivo3", label: "Motivo 3", prefix: "Motivo3", count: 7 },
];

interface PhraseItem {
  path: string;
  name: string;
  groupId: string;
}

const buildPhraseItems = (): PhraseItem[] => {
  const flat: PhraseItem[] = [];
  PHRASE_GROUPS.forEach((g) => {
    for (let i = 1; i <= g.count; i++) {
      const num = String(i).padStart(2, "0");
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

const EDITOR_ORDER_KEY = "editorOrderId";

// Rectángulo de recorte en píxeles de la imagen original.
interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EditorImage {
  file: File;
  url: string;
  name: string;
  crop: CropRect | null;
  cropPosition?: Point;
  zoom?: number;
  id: string;
}

interface SavedCropData {
  crop: CropRect;
  cropPosition?: Point;
  zoom?: number;
}


const getDefaultPhraseImageUrl = (path: string): string => `/${path}`;

const getImageDimensions = (
  url: string,
): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });

const getCenteredSquareCrop = (width: number, height: number): CropRect => {
  const size = Math.min(width, height);
  const x = (width - size) / 2;
  const y = (height - size) / 2;
  return { x, y, w: size, h: size };
};

const THUMB_PREVIEW_SIZE = 200;
/** Tamaño fijo del recuadro de corte (cuadrado). Misma medida para imagen vertical u horizontal. */
const CROP_BOX_SIZE = 420;

const createCroppedPreviewDataUrl = (
  imageUrl: string,
  crop: CropRect,
): Promise<string | null> =>
  new Promise((resolve, reject) => {
    if (!crop || crop.w <= 0 || crop.h <= 0) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = THUMB_PREVIEW_SIZE;
        canvas.height = THUMB_PREVIEW_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.w,
          crop.h,
          0,
          0,
          THUMB_PREVIEW_SIZE,
          THUMB_PREVIEW_SIZE,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for preview"));
    img.src = imageUrl;
  });

function EditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId =
    searchParams.get("orderId") ??
    (typeof window !== "undefined"
      ? sessionStorage.getItem(EDITOR_ORDER_KEY)
      : null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<EditorImage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [pricesSettings, setPricesSettings] = useState<Prices | null>(null);
  const [addingDefaultPhrases, setAddingDefaultPhrases] = useState(false);
  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [selectedPhraseIndexes, setSelectedPhraseIndexes] = useState<number[]>(
    [],
  );
  const [thumbPreviews, setThumbPreviews] = useState<Record<string, string>>(
    {},
  );

  const cropPixelsRef = useRef<Area | null>(null);
  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbsStripRef = useRef<HTMLDivElement | null>(null);
  const cropPositionRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const prevZoomRef = useRef(1);
  const cropRAFRef = useRef<number | null>(null);
  const zoomRAFRef = useRef<number | null>(null);
  /** Evita que el Cropper que se desmonta pise cropPixelsRef; callbacks ignorados durante el cambio */
  const isSwitchingImageRef = useRef(false);
  /** Último rectángulo en píxeles guardado por id (sincrónicamente al salir de una imagen) */
  const lastSavedCropByIdRef = useRef<Record<string, SavedCropData>>({});
  /** Dimensiones que reportó el cropper por imagen: espacio en el que están las
   *  coordenadas de crop_data. Se usa al subir para escalar el crop sin desfasaje. */
  const mediaSizeByIdRef = useRef<Record<string, { w: number; h: number }>>({});

  const [cropWrapSize, setCropWrapSize] = useState<Size>({
    width: CROP_BOX_SIZE,
    height: CROP_BOX_SIZE,
  });
  const [cropMediaLoading, setCropMediaLoading] = useState(false);

  // Al cambiar la imagen seleccionada (al elegirla o moverla con ◀▶), centrarla en
  // la tira para que "acompañe" su nueva posición y se vean las anteriores/siguientes.
  useEffect(() => {
    if (selectedIndex < 0) return;
    const container = thumbsStripRef.current;
    if (!container) return;
    const el = container.children[selectedIndex] as HTMLElement | undefined;
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.left + eRect.width / 2 - (cRect.left + cRect.width / 2);
    if (Math.abs(delta) < 1) return;
    container.scrollBy({ left: delta, behavior: "smooth" });
  }, [selectedIndex, images.length]);

  const selectedImageId =
    selectedIndex >= 0 && selectedIndex < images.length
      ? (images[selectedIndex]?.id ?? null)
      : null;
  const selectedImageIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);

  // Mostrar carga cuando cambia la imagen a recortar
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedImageId) setCropMediaLoading(true);
  }, [selectedImageId]);

  const hasImages = images.length > 0;

  // Recuadro de corte con medida fija (cuadrado) independiente de la orientación
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
  }, [hasImages]);

  useEffect(() => {
    let cancelled = false;
    images.forEach((img) => {
      if (!img?.crop || img.crop.w <= 0 || img.crop.h <= 0) return;
      createCroppedPreviewDataUrl(img.url, img.crop)
        .then((dataUrl) => {
          if (!cancelled && dataUrl) {
            setThumbPreviews((prev) => ({ ...prev, [img.id]: dataUrl }));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    api
      .getPrices(false)
      .then((data) => {
        if (data && typeof data === "object") setPricesSettings(data as Prices);
      })
      .catch(() => {});
  }, []);

  // Evitar que el scroll del modal propague al fondo
  useEffect(() => {
    if (!showPhraseModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showPhraseModal]);

  useEffect(() => {
    if (!orderId) {
      router.replace("/cliente");
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem(EDITOR_ORDER_KEY, String(orderId));
    }
  }, [orderId, router]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const o = await api.getOrder(orderId);
        if (cancelled) return;
        setOrder(o as Order);

        if (typeof window === "undefined") return;
        // Restaurar imágenes ya cargadas (persistidas en IndexedDB) al volver
        // del flujo "Cambiar datos del cliente".
        const stored = await loadEditorImages(orderId);
        if (stored && stored.length > 0) {
          const restored: EditorImage[] = stored.map((item) => {
            const file =
              item.blob instanceof File
                ? item.blob
                : new File([item.blob], item.name, { type: item.blob.type });
            return {
              file,
              url: URL.createObjectURL(item.blob),
              name: item.name,
              crop: item.crop || null,
              cropPosition: item.cropPosition,
              zoom: typeof item.zoom === "number" ? item.zoom : undefined,
              id: item.id || generateId(),
            };
          });
          if (!cancelled && restored.length > 0) {
            setImages(restored);
            setSelectedIndex(0);
            await clearEditorImages(orderId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const isCropPixelsValid = (p: Area | null): p is Area =>
    !!p &&
    typeof p.width === "number" &&
    typeof p.height === "number" &&
    p.width > 0 &&
    p.height > 0 &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y);

  const onCropChangeThrottled = useCallback((newCrop: Point) => {
    cropPositionRef.current = newCrop;
    if (cropRAFRef.current == null) {
      cropRAFRef.current = requestAnimationFrame(() => {
        setCrop(cropPositionRef.current);
        cropRAFRef.current = null;
      });
    }
  }, []);

  const onZoomChangeThrottled = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    if (zoomRAFRef.current == null) {
      zoomRAFRef.current = requestAnimationFrame(() => {
        const z = zoomRef.current;
        const wasZoomingOut = z < prevZoomRef.current;
        prevZoomRef.current = z;
        setZoom(z);
        if (wasZoomingOut) {
          cropPositionRef.current = { x: 0, y: 0 };
          setCrop({ x: 0, y: 0 });
        }
        zoomRAFRef.current = null;
      });
    }
  }, []);

  const onCropComplete = useCallback(
    (imageId: string, _croppedArea: Area, croppedAreaPixels: Area) => {
      if (imageId !== selectedImageIdRef.current) return;
      if (isSwitchingImageRef.current) return;
      if (isCropPixelsValid(croppedAreaPixels)) {
        cropPixelsRef.current = croppedAreaPixels;
      }
      setCrop(cropPositionRef.current);
      setZoom(zoomRef.current);
    },
    [],
  );

  const onCropAreaChange = useCallback(
    (imageId: string, _croppedArea: Area, croppedAreaPixels: Area) => {
      if (imageId !== selectedImageIdRef.current) return;
      if (isSwitchingImageRef.current) return;
      if (isCropPixelsValid(croppedAreaPixels)) {
        cropPixelsRef.current = croppedAreaPixels;
      }
    },
    [],
  );

  const onMediaLoaded = useCallback(
    (mediaSize: MediaSize) => {
      const img = images[selectedIndex];
      if (img?.id) {
        mediaSizeByIdRef.current[img.id] = {
          w: mediaSize.naturalWidth,
          h: mediaSize.naturalHeight,
        };
      }
      const cropSize: Size = {
        width: cropWrapSize.width,
        height: cropWrapSize.height,
      };
      const mem = img?.id ? lastSavedCropByIdRef.current[img.id] : null;
      const savedRect: CropRect | null =
        mem?.crop && mem.crop.w > 0 && mem.crop.h > 0
          ? mem.crop
          : img?.crop && img.crop.w > 0 && img.crop.h > 0
            ? img.crop
            : null;

      if (!savedRect) {
        const { naturalWidth: w, naturalHeight: h } = mediaSize;
        const size = Math.min(w, h);
        const x = (w - size) / 2;
        const y = (h - size) / 2;
        const croppedAreaPixels: Area = { x, y, width: size, height: size };
        cropPixelsRef.current = croppedAreaPixels;
        const { crop: initialCrop, zoom: initialZoom } =
          getInitialCropFromCroppedAreaPixels(
            croppedAreaPixels,
            mediaSize,
            0,
            cropSize,
            1,
            3,
          );
        cropPositionRef.current = initialCrop;
        zoomRef.current = initialZoom;
        prevZoomRef.current = initialZoom;
        setCrop(initialCrop);
        setZoom(initialZoom);
        setImages((prev) => {
          const next = [...prev];
          if (next[selectedIndex]) {
            next[selectedIndex] = {
              ...next[selectedIndex],
              crop: { x, y, w: size, h: size },
              cropPosition: initialCrop,
              zoom: initialZoom,
            };
          }
          return next;
        });
      } else {
        const croppedAreaPixels: Area = {
          x: savedRect.x,
          y: savedRect.y,
          width: savedRect.w,
          height: savedRect.h,
        };
        cropPixelsRef.current = croppedAreaPixels;
        const { crop: initialCrop, zoom: initialZoom } =
          getInitialCropFromCroppedAreaPixels(
            croppedAreaPixels,
            mediaSize,
            0,
            cropSize,
            1,
            3,
          );
        cropPositionRef.current = initialCrop;
        zoomRef.current = initialZoom;
        prevZoomRef.current = initialZoom;
        setCrop(initialCrop);
        setZoom(initialZoom);
        setImages((prev) => {
          const next = [...prev];
          if (next[selectedIndex]) {
            next[selectedIndex] = {
              ...next[selectedIndex],
              crop: {
                x: savedRect.x,
                y: savedRect.y,
                w: savedRect.w,
                h: savedRect.h,
              },
              cropPosition: initialCrop,
              zoom: initialZoom,
            };
          }
          return next;
        });
      }
      setCropMediaLoading(false);
    },
    [selectedIndex, images, cropWrapSize.width, cropWrapSize.height],
  );

  const saveCurrentCrop = useCallback(() => {
    const pixels = cropPixelsRef.current;
    if (
      !pixels ||
      !isCropPixelsValid(pixels) ||
      selectedIndex < 0 ||
      selectedIndex >= images.length
    ) {
      return;
    }
    const position = cropPositionRef.current;
    const zoomVal = zoomRef.current;
    const cropData: SavedCropData = {
      crop: { x: pixels.x, y: pixels.y, w: pixels.width, h: pixels.height },
      cropPosition: position ? { x: position.x, y: position.y } : undefined,
      zoom: typeof zoomVal === "number" ? zoomVal : undefined,
    };
    const currentId = images[selectedIndex]?.id;
    if (currentId) {
      lastSavedCropByIdRef.current[currentId] = { ...cropData };
    }
    setImages((prev) => {
      const next = [...prev];
      if (next[selectedIndex]) {
        next[selectedIndex] = { ...next[selectedIndex], ...cropData };
      }
      return next;
    });
  }, [selectedIndex, images]);

  /* Acepta por tipo MIME o por extensión (iOS a veces no envía type en fotos de galería). */
  const isImageFile = (f: File): boolean => {
    if (!f) return false;
    if (f.type?.startsWith("image/")) return true;
    if (!f.type && f.name)
      return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
    return false;
  };

  const addFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList || []).filter(isImageFile);
    if (files.length === 0) return;
    const remaining = REQUIRED_COUNT - images.length;
    const toAdd: EditorImage[] = files.slice(0, remaining).map((file) => ({
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node))
      setIsDragging(false);
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
    prevZoomRef.current = 1;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    cropPixelsRef.current = null;
    lastSavedCropByIdRef.current = {};
  };

  const openPhraseModal = () => {
    setSelectedPhraseIndexes([]);
    setShowPhraseModal(true);
  };

  const togglePhraseSelection = (idx: number) => {
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
      const loaded: EditorImage[] = [];
      for (const item of toLoad) {
        try {
          const url = getDefaultPhraseImageUrl(item.path);
          const res = await fetch(url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const ext = blob.type === "image/png" ? ".png" : ".jpg";
          const fileName = `${item.name.replace(/\s+/g, "-").toLowerCase()}${ext}`;
          const file = new File([blob], fileName, { type: blob.type });
          const objectUrl = URL.createObjectURL(file);
          let crop: CropRect | null = null;
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

  const removeAt = (idx: number) => {
    const removedId = images[idx]?.id;
    const next = images.filter((_, i) => i !== idx);
    URL.revokeObjectURL(images[idx].url);
    if (removedId) {
      delete lastSavedCropByIdRef.current[removedId];
      setThumbPreviews((p) => {
        const n = { ...p };
        delete n[removedId];
        return n;
      });
    }
    setImages(next);
    if (selectedIndex === idx) {
      setSelectedIndex(next.length ? Math.min(idx, next.length - 1) : -1);
      cropPositionRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;
      prevZoomRef.current = 1;
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } else if (selectedIndex > idx) setSelectedIndex(selectedIndex - 1);
  };

  const moveItem = (from: number, to: number) => {
    if (from === to) return;
    setImages((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    if (selectedIndex === from) setSelectedIndex(to);
    else if (from < selectedIndex && to >= selectedIndex)
      setSelectedIndex(selectedIndex - 1);
    else if (from > selectedIndex && to <= selectedIndex)
      setSelectedIndex(selectedIndex + 1);
  };

  const selectIndex = (idx: number) => {
    isSwitchingImageRef.current = true;
    saveCurrentCrop();
    if (cropRAFRef.current != null) cancelAnimationFrame(cropRAFRef.current);
    if (zoomRAFRef.current != null) cancelAnimationFrame(zoomRAFRef.current);
    cropRAFRef.current = zoomRAFRef.current = null;
    const img = images[idx];
    const mem = img?.id ? lastSavedCropByIdRef.current[img.id] : null;
    const rect: CropRect | null =
      mem?.crop && mem.crop.w > 0 && mem.crop.h > 0
        ? mem.crop
        : img?.crop && img.crop.w > 0 && img.crop.h > 0
          ? img.crop
          : null;
    if (rect) {
      cropPixelsRef.current = {
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
      };
      const pos = mem?.cropPosition ?? img?.cropPosition;
      const z = mem?.zoom ?? img?.zoom;
      if (pos && typeof z === "number") {
        cropPositionRef.current = { x: pos.x, y: pos.y };
        zoomRef.current = z;
        prevZoomRef.current = z;
        setCrop({ x: pos.x, y: pos.y });
        setZoom(z);
      } else {
        cropPositionRef.current = { x: 0, y: 0 };
        zoomRef.current = 1;
        prevZoomRef.current = 1;
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    } else {
      cropPositionRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;
      prevZoomRef.current = 1;
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      cropPixelsRef.current = null;
    }
    setSelectedIndex(idx);
    setTimeout(() => {
      isSwitchingImageRef.current = false;
    }, 150);
  };

  const handleGoToCliente = async () => {
    saveCurrentCrop();
    // Persistir las imágenes ya cargadas (Blobs en IndexedDB) para no perderlas
    // al ir a editar los datos del cliente y volver.
    if (images.length > 0 && orderId) {
      const items: StoredEditorImage[] = images.map((img, i) => ({
        id: img.id,
        name: img.name,
        blob: img.file,
        crop: getCropForIndex(i) ?? img.crop,
        cropPosition: img.cropPosition,
        zoom: img.zoom,
      }));
      await saveEditorImages(orderId, items);
    }
    router.push("/cliente?orderId=" + orderId);
  };

  const getCropForIndex = (idx: number): CropRect | null | undefined => {
    if (idx === selectedIndex && isCropPixelsValid(cropPixelsRef.current)) {
      const d = cropPixelsRef.current;
      return { x: d.x, y: d.y, w: d.width, h: d.height };
    }
    return images[idx]?.crop;
  };

  // ¿La imagen del slot i ya tiene su recorte final?
  const isCroppedAt = (i: number): boolean => {
    const c = getCropForIndex(i);
    return !!(c && c.w > 0 && c.h > 0);
  };

  const allHaveCrops =
    images.length === REQUIRED_COUNT &&
    // eslint-disable-next-line react-hooks/refs
    images.every((_, i) => isCroppedAt(i));

  const handleSubmit = async () => {
    const currentIdx = selectedIndex;
    const refPixels = cropPixelsRef.current;
    const capturedPixels: CropRect | null =
      refPixels && isCropPixelsValid(refPixels)
        ? {
            x: refPixels.x,
            y: refPixels.y,
            w: refPixels.width,
            h: refPixels.height,
          }
        : null;
    saveCurrentCrop();
    if (!allHaveCrops || images.length !== REQUIRED_COUNT) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const c =
          i === currentIdx && capturedPixels
            ? capturedPixels
            : getCropForIndex(i) || img.crop || ({} as Partial<CropRect>);
        // Redimensiona la imagen y escala el crop en el mismo factor.
        const media = mediaSizeByIdRef.current[img.id];
        const { blob, scaleX, scaleY } = await downscaleForUpload(
          img.file,
          MAX_UPLOAD_DIM,
          media?.w,
          media?.h,
        );
        const baseName =
          (img.file.name || `img_${i}`).replace(/\.[^.]+$/, "") || `img_${i}`;
        formData.append(`image_${i}`, blob, `${baseName}.jpg`);
        formData.append(
          `crop_data_${i}`,
          JSON.stringify({
            x: Math.round((c.x ?? 0) * scaleX),
            y: Math.round((c.y ?? 0) * scaleY),
            width: Math.round((c.w ?? 1000) * scaleX),
            height: Math.round((c.h ?? 1000) * scaleY),
          }),
        );
      }
      // Encola el procesamiento async y hace polling hasta que el worker termina.
      setUploadPct(0);
      const { task_id, total } = await api.submitOrderImages(
        orderId as string,
        formData,
        (pct) => setUploadPct(pct),
      );
      setUploadPct(null);
      setSubmitProgress({ done: 0, total: total || REQUIRED_COUNT });
      let finished = false;
      for (let attempt = 0; attempt < 180; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        const st = await api.getSubmitStatus(orderId as string, task_id);
        setSubmitProgress({ done: st.done, total: st.total });
        if (st.state === "SUCCESS") {
          finished = true;
          break;
        }
        if (st.state === "FAILURE") {
          throw new Error(st.error || "Error procesando las imágenes");
        }
      }
      if (!finished) throw new Error("El procesamiento tardó demasiado, reintentá");
      await api.sendOrder(orderId as string);
      if (orderId) await clearEditorImages(String(orderId));
      setOrderConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
      setUploadPct(null);
    }
  };

  const boxTypeLabel = order?.box_type === "with_light" ? "Con Luz" : "Sin Luz";
  const variantLabel = order?.variant
    ? (VARIANT_LABELS[order.variant] ??
      order.variant
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()))
    : "";
  const remaining = REQUIRED_COUNT - images.length;
  const currentImg =
    selectedIndex >= 0 && selectedIndex < images.length
      ? images[selectedIndex]
      : null;
  const savedCrop = currentImg?.crop;

  // CTA inferior:
  //  - faltan imágenes por subir → abre el selector de archivos
  //  - están las 10 pero alguna sin recortar → salta a la primera pendiente (no envía)
  //  - todas subidas y recortadas → envía
  const handleActionBar = () => {
    if (submitting) return;
    if (remaining > 0) {
      document.getElementById("image-editor-file")?.click();
      return;
    }
    if (!allHaveCrops) {
      const idx = images.findIndex((_, i) => !isCroppedAt(i));
      if (idx >= 0) selectIndex(idx);
      return;
    }
    // Antes de enviar, recordar que el orden actual es el orden final.
    saveCurrentCrop();
    setShowSendConfirm(true);
  };

  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  if (!orderId) return null;
  if (loading)
    return (
      <div className="mm-page flex min-h-screen items-center justify-center px-4">
        <div className="mm-card p-8">
          <p className="text-mb-gray">Cargando...</p>
        </div>
      </div>
    );
  if (error && !submitting)
    return (
      <div className="mm-page flex min-h-screen items-center justify-center px-4">
        <div className="mm-card p-8">
          <p className="font-semibold text-mb-red">{error}</p>
        </div>
      </div>
    );
  if (!order) return null;

  const croppedCount =
    // eslint-disable-next-line react-hooks/refs
    images.reduce((acc, _img, i) => {
      const c = getCropForIndex(i);
      return c && c.w > 0 && c.h > 0 ? acc + 1 : acc;
    }, 0);

  return (
    <div className="mm-page image-editor-screen">
      <div className="mm-container">
        <div className="image-editor-shell animate-fade-up">
          {/* Header compacto */}
          <header className="image-editor-head">
            <h1 className="image-editor-head-title">
              <Package className="size-5 text-mb-blue" aria-hidden />
              Pedido de Caja de la Memoria
            </h1>
          </header>

          {/* Resumen del cliente como chips delgados */}
          <div className="image-editor-summary" aria-label="Datos del pedido">
            <span className="image-editor-chip">
              <span className="image-editor-chip-key">Cliente</span>
              <span className="image-editor-chip-val">{order.client_name}</span>
            </span>
            <span className="image-editor-chip">
              <span className="image-editor-chip-key">Tel</span>
              <span className="image-editor-chip-val">{order.phone}</span>
            </span>
            <span className="image-editor-chip">
              <span className="image-editor-chip-key">Tipo</span>
              <span className="image-editor-chip-val">{boxTypeLabel}</span>
            </span>
            <span className="image-editor-chip">
              <span className="image-editor-chip-key">Variante</span>
              <span className="image-editor-chip-val">{variantLabel}</span>
            </span>
          </div>

          {/* Cambiar datos del cliente: junto a los datos del cliente */}
          <div className="image-editor-secondary-actions">
            <button
              type="button"
              className="image-editor-link-btn"
              onClick={handleGoToCliente}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Cambiar datos del cliente
            </button>
          </div>

          {/* Input de archivos (oculto, presente en el DOM para iOS) */}
          <input
            key={fileInputKey}
            type="file"
            id="image-editor-file"
            accept="image/*,image/heic,image/heif"
            multiple
            onChange={handleFileChange}
            className="image-editor-file-input"
          />

          {/* Cropper: el protagonista */}
          <div
            ref={mainContainerRef}
            className={`image-editor-main image-editor-drop-zone ${
              images.length === 0
                ? "image-editor-drop-zone--empty"
                : "image-editor-main--filled"
            } ${isDragging ? "is-dragging" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() =>
              images.length === 0 &&
              document.getElementById("image-editor-file")?.click()
            }
          >
            {images.length > 0 && currentImg ? (
              <div
                className="image-editor-crop-wrap"
                style={{
                  width: cropWrapSize.width,
                  height: cropWrapSize.height,
                }}
              >
                {cropMediaLoading && (
                  <div
                    className="image-editor-crop-loading"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <span
                      className="image-editor-crop-loading-spinner"
                      aria-hidden="true"
                    />
                    <span className="image-editor-crop-loading-text">
                      Cargando imagen…
                    </span>
                  </div>
                )}
                <Cropper
                  key={currentImg.id}
                  image={currentImg.url}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  minZoom={1}
                  objectFit="cover"
                  restrictPosition
                  style={{ containerStyle: { backgroundColor: "#0f172a" } }}
                  cropSize={{
                    width: cropWrapSize.width,
                    height: cropWrapSize.height,
                  }}
                  onCropChange={onCropChangeThrottled}
                  onZoomChange={onZoomChangeThrottled}
                  onCropComplete={(a, b) =>
                    onCropComplete(currentImg.id, a, b)
                  }
                  onCropAreaChange={(a, b) =>
                    onCropAreaChange(currentImg.id, a, b)
                  }
                  onMediaLoaded={onMediaLoaded}
                  initialCroppedAreaPixels={
                    savedCrop && savedCrop.w > 0 && savedCrop.h > 0
                      ? {
                          x: savedCrop.x,
                          y: savedCrop.y,
                          width: savedCrop.w,
                          height: savedCrop.h,
                        }
                      : undefined
                  }
                  cropShape="rect"
                  showGrid={false}
                  classes={{ cropAreaClassName: "image-editor-crop-area" }}
                />
                <div
                  className="image-editor-crop-line-guide"
                  aria-hidden="true"
                />
              </div>
            ) : images.length === 0 ? (
              <div className="image-editor-empty">
                <div className="image-editor-drop-content">
                  <span className="image-editor-drop-icon" aria-hidden>
                    ☁️
                  </span>
                  <p className="image-editor-drop-primary">
                    Agregá tus imágenes
                  </p>
                  <p className="image-editor-drop-secondary">
                    Tocá para seleccionar (o arrastrá en PC)
                  </p>
                  {/* stopPropagation: el label ya abre el picker de forma nativa.
                      Sin esto el click burbujea al div drop-zone, que dispara un
                      segundo .click() sobre el mismo input (doble apertura). */}
                  <label
                    htmlFor="image-editor-file"
                    className="image-editor-drop-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Seleccionar archivos
                  </label>
                </div>
                <p className="image-editor-drop-note">
                  <strong>Formato:</strong> JPG, PNG o similares. Máximo 10.
                </p>
              </div>
            ) : null}
          </div>

          {/* Tira de miniaturas + barra de control de la imagen seleccionada */}
          {images.length > 0 && (
            <div className="image-editor-gallery">
              <div className="image-editor-thumbs" ref={thumbsStripRef}>
                {/* eslint-disable-next-line react-hooks/refs */}
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.id}
                    className={`image-editor-thumb ${i === selectedIndex ? "selected" : ""} ${
                      isCroppedAt(i) ? "" : "image-editor-thumb--pending"
                    }`}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("index", String(i))
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("index"), 10);
                      if (!isNaN(from)) moveItem(from, i);
                    }}
                    onClick={() => selectIndex(i)}
                    aria-label={`Ver imagen ${i + 1}`}
                    aria-pressed={i === selectedIndex}
                  >
                    <span className="image-editor-thumb-badge">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        img.crop && img.crop.w > 0 && thumbPreviews[img.id]
                          ? thumbPreviews[img.id]
                          : img.url
                      }
                      alt={`Imagen ${i + 1}`}
                      draggable={false}
                    />
                    {!isCroppedAt(i) && (
                      <span className="image-editor-thumb-pending">
                        <Scissors className="size-3" aria-hidden />
                        Sin recortar
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Barra de acciones sobre la imagen seleccionada */}
              {selectedIndex >= 0 && selectedIndex < images.length && (
                <div className="image-editor-selbar">
                  <span className="image-editor-selbar-pos">
                    Imagen <b>{selectedIndex + 1}</b> de {images.length}
                  </span>
                  <div className="image-editor-selbar-actions">
                    <button
                      type="button"
                      className="image-editor-selbar-move"
                      onClick={() => moveItem(selectedIndex, selectedIndex - 1)}
                      disabled={selectedIndex === 0}
                      aria-label="Mover hacia la izquierda"
                      title="Mover hacia la izquierda"
                    >
                      <ChevronLeft className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="image-editor-selbar-move"
                      onClick={() => moveItem(selectedIndex, selectedIndex + 1)}
                      disabled={selectedIndex === images.length - 1}
                      aria-label="Mover hacia la derecha"
                      title="Mover hacia la derecha"
                    >
                      <ChevronRight className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="image-editor-selbar-delete"
                      onClick={() => setConfirmDeleteIdx(selectedIndex)}
                      aria-label="Eliminar imagen"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Controles secundarios: frases / limpiar */}
          <div className="image-editor-tools">
            <button
              type="button"
              className="image-editor-tool-btn image-editor-tool-btn--phrases"
              onClick={openPhraseModal}
              disabled={images.length >= REQUIRED_COUNT || addingDefaultPhrases}
              title={
                images.length >= REQUIRED_COUNT
                  ? "Ya tenés 10 imágenes"
                  : "Elegir imágenes con frases"
              }
            >
              <Sparkles className="size-4" aria-hidden />
              {addingDefaultPhrases ? "Cargando..." : "Frases Predeterminadas"}
            </button>
            <button
              type="button"
              className="image-editor-tool-btn image-editor-tool-btn--danger"
              onClick={() => setShowClearConfirm(true)}
              disabled={images.length === 0}
              title="Borra todas las imágenes cargadas"
            >
              <Trash2 className="size-4" aria-hidden />
              Limpiar todo
            </button>
          </div>

          {/* Nota Canva discreta */}
          <p className="image-editor-canva-note">
            ¿Querés una imagen con tu frase? Diseñala en{" "}
            <a
              href="https://www.canva.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Canva
            </a>{" "}
            y subila como una más.
          </p>

          {error && submitting && (
            <p className="image-editor-error">{error}</p>
          )}
        </div>
      </div>

      {/* Barra de acción inferior sticky */}
      <div className="image-editor-actionbar">
        <div className="image-editor-actionbar-inner">
          <div
            className="image-editor-progress"
            aria-label="Imágenes recortadas"
          >
            <span className="image-editor-progress-count">
              <b>{croppedCount}</b>/{REQUIRED_COUNT}
            </span>
            <span className="image-editor-progress-label">Listas</span>
          </div>
          <button
            type="button"
            className={`mm-btn image-editor-submit-btn ${
              submitting
                ? "mm-btn-primary"
                : remaining > 0
                  ? "image-editor-submit-btn--add"
                  : !allHaveCrops
                    ? "image-editor-submit-btn--pending"
                    : "mm-btn-primary"
            }`}
            onClick={handleActionBar}
            disabled={submitting}
          >
            {submitting && (
              <span
                className="image-editor-submit-progress"
                style={{
                  width: `${
                    uploadPct != null
                      ? uploadPct
                      : submitProgress
                        ? Math.round(
                            (submitProgress.done / submitProgress.total) * 100,
                          )
                        : 0
                  }%`,
                }}
                aria-hidden
              />
            )}
            <span className="image-editor-submit-label">
              {submitting ? (
                <Send className="size-4" aria-hidden />
              ) : remaining > 0 ? (
                <ImagePlus className="size-4" aria-hidden />
              ) : !allHaveCrops ? (
                <Scissors className="size-4" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {submitting
                ? uploadPct != null
                  ? `Subiendo ${uploadPct}%`
                  : submitProgress
                    ? `Procesando ${submitProgress.done}/${submitProgress.total}...`
                    : "Preparando..."
                : remaining > 0
                  ? "Tocá para cargar fotos"
                  : !allHaveCrops
                    ? "Recortá tus fotos para enviar"
                    : "Enviar"}
            </span>
          </button>
        </div>
      </div>

      {/* Confirmación de eliminación */}
      {confirmDeleteIdx !== null && (
        <div
          className="image-editor-modal-overlay"
          onClick={() => setConfirmDeleteIdx(null)}
        >
          <div
            className="image-editor-confirm"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="image-editor-confirm-icon">
              <Trash2 className="size-6" aria-hidden />
            </div>
            <h3 className="image-editor-confirm-title">
              ¿Eliminar esta imagen?
            </h3>
            <p className="image-editor-confirm-text">
              Se quitará la imagen {confirmDeleteIdx + 1} de tu cajita. Podés
              volver a agregarla más tarde si querés.
            </p>
            <div className="image-editor-confirm-actions">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={() => setConfirmDeleteIdx(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mm-btn mm-btn-danger"
                onClick={() => {
                  removeAt(confirmDeleteIdx);
                  setConfirmDeleteIdx(null);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de "Limpiar todo": borra todas las imágenes cargadas */}
      {showClearConfirm && (
        <div
          className="image-editor-modal-overlay"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="image-editor-confirm"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="image-editor-confirm-icon">
              <Trash2 className="size-6" aria-hidden />
            </div>
            <h3 className="image-editor-confirm-title">
              ¿Borrar todas las imágenes?
            </h3>
            <p className="image-editor-confirm-text">
              Se eliminarán las <b>{images.length}</b>{" "}
              {images.length === 1 ? "imagen cargada" : "imágenes cargadas"} y
              tendrás que subirlas de nuevo. Esta acción no se puede deshacer.
            </p>
            <div className="image-editor-confirm-actions">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mm-btn mm-btn-danger"
                onClick={() => {
                  clearAll();
                  setShowClearConfirm(false);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de envío: recuerda que el orden es el orden final */}
      {showSendConfirm && (
        <div
          className="image-editor-modal-overlay"
          onClick={() => setShowSendConfirm(false)}
        >
          <div
            className="image-editor-confirm"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="image-editor-confirm-icon image-editor-confirm-icon--info">
              <ListOrdered className="size-6" aria-hidden />
            </div>
            <h3 className="image-editor-confirm-title">
              Revisá el orden de las fotos
            </h3>
            <p className="image-editor-confirm-text">
              El orden en el que ves las fotos será el{" "}
              <b>orden final en tu cajita</b>. Si está todo bien, confirmá el
              envío.
            </p>
            <div className="image-editor-confirm-actions">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={() => setShowSendConfirm(false)}
              >
                Revisar
              </button>
              <button
                type="button"
                className="mm-btn mm-btn-primary"
                onClick={() => {
                  setShowSendConfirm(false);
                  handleSubmit();
                }}
              >
                <Send className="size-4" aria-hidden />
                Sí, enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de frases */}
      {showPhraseModal && (
        <div
          className="image-editor-modal-overlay"
          onClick={() => setShowPhraseModal(false)}
        >
          <div
            className="image-editor-phrase-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="image-editor-sheet-handle" aria-hidden />
            <div className="image-editor-phrase-modal-head">
              <span className="image-editor-phrase-modal-icon">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="image-editor-phrase-modal-title">
                  Frases predeterminadas
                </h3>
                <p className="image-editor-phrase-modal-hint">
                  Tocá las que quieras sumar a tu cajita.
                </p>
              </div>
            </div>
            <div className="image-editor-phrase-modal-body">
              {PHRASE_GROUPS.map((group, groupIndex) => {
                const startIdx = PHRASE_GROUPS.slice(0, groupIndex).reduce(
                  (acc, g) => acc + g.count,
                  0,
                );
                const items = DEFAULT_PHRASE_IMAGES.slice(
                  startIdx,
                  startIdx + group.count,
                );
                return (
                  <div key={group.id} className="image-editor-phrase-group">
                    <h4 className="image-editor-phrase-group-title">
                      {group.label}
                    </h4>
                    <div className="image-editor-phrase-grid">
                      {items.map((item, i) => {
                        const globalIdx = startIdx + i;
                        const selected =
                          selectedPhraseIndexes.includes(globalIdx);
                        return (
                          <button
                            key={item.path}
                            type="button"
                            className={`image-editor-phrase-option ${selected ? "selected" : ""}`}
                            onClick={() => togglePhraseSelection(globalIdx)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getDefaultPhraseImageUrl(item.path)}
                              alt={item.name}
                            />
                            <span className="image-editor-phrase-option-label">
                              {item.name}
                            </span>
                            {selected && (
                              <span
                                className="image-editor-phrase-check"
                                aria-hidden
                              >
                                <Check className="size-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="image-editor-phrase-modal-actions">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={() => setShowPhraseModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mm-btn mm-btn-primary"
                onClick={addSelectedPhraseImages}
                disabled={selectedPhraseIndexes.length === 0}
              >
                Agregar{" "}
                {selectedPhraseIndexes.length
                  ? `(${selectedPhraseIndexes.length})`
                  : ""}{" "}
                seleccionadas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de confirmación */}
      {orderConfirmed && order && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => {
            if (typeof window !== "undefined")
              sessionStorage.removeItem(EDITOR_ORDER_KEY);
            router.push("/");
          }}
        >
          <div
            className="mm-card my-8 w-full max-w-lg p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-5 text-center">
              <h1 className="flex items-center justify-center gap-2 text-xl font-bold text-mb-ink sm:text-2xl">
                <PartyPopper className="size-6 text-mb-green" aria-hidden />
                ¡Pedido Confirmado!
              </h1>
              <p className="mt-2 text-sm text-mb-gray">
                Tu pedido ha sido enviado exitosamente. Nos comunicaremos
                contigo a la brevedad por WhatsApp para informarte el estado de
                tu cajita personalizada y su correspondiente fecha de envío.
              </p>
            </header>
            <div className="mb-4 space-y-1 rounded-lg border border-mb-border bg-mb-gray-light p-4 text-sm text-mb-ink">
              <p>
                <strong>Cliente:</strong> {order.client_name}
              </p>
              <p>
                <strong>Variante:</strong> {variantLabel}
              </p>
              <p>
                <strong>Fecha:</strong>{" "}
                {new Date().toLocaleString("es-AR")}
              </p>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-mb-blue-light p-4">
              <span className="text-sm font-semibold text-mb-ink">
                Monto de la Seña:
              </span>
              <span className="text-lg font-bold text-mb-blue-dark">
                {(() => {
                  const withLight = order?.box_type === "with_light";
                  const conLuz = num(pricesSettings?.price_con_luz) || 42000;
                  const pilas = num(pricesSettings?.price_pilas) || 2500;
                  const sinLuz = num(pricesSettings?.price_sin_luz) || 24000;
                  const amount = withLight
                    ? Math.round((conLuz + pilas) / 2)
                    : Math.round(sinLuz / 2);
                  return `$ ${amount.toLocaleString("es-AR")}`;
                })()}
              </span>
            </div>
            <div className="mb-4">
              <label className="mm-label flex items-center gap-1">
                <Wallet className="size-4 text-mb-blue" aria-hidden />
                Datos para Transferencia
              </label>
              <div className="space-y-1 text-sm text-mb-ink">
                {(() => {
                  const alias =
                    (pricesSettings?.transfer_alias as string) ??
                    DEFAULT_ALIAS;
                  return (
                    <>
                      <p className="flex items-center gap-2">
                        <span>
                          <strong>Alias:</strong> {alias}
                        </span>
                        <button
                          type="button"
                          className="mm-btn mm-btn-outline px-2 py-1 text-xs"
                          onClick={() =>
                            navigator.clipboard?.writeText(alias)
                          }
                        >
                          Copiar
                        </button>
                      </p>
                      <p>
                        <strong>Banco:</strong>{" "}
                        {(pricesSettings?.transfer_bank as string) ??
                          "Mercado Pago"}
                      </p>
                      <p>
                        <strong>Titular:</strong>{" "}
                        {(pricesSettings?.transfer_holder as string) ??
                          "Manuel Perea"}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="mb-4">
              <label className="mm-label flex items-center gap-1">
                <Send className="size-4 text-mb-blue" aria-hidden />
                Enviar Comprobante
              </label>
              <p className="mb-2 text-sm text-mb-gray">
                Envía tu comprobante de pago por WhatsApp o correo electrónico
                para confirmar tu pedido.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={`https://wa.me/${(
                    (pricesSettings?.contact_whatsapp as string) ??
                    DEFAULT_TELEFONO
                  ).replace(/\D/g, "")}?text=${encodeURIComponent(
                    WHATSAPP_COMPROBANTE_MSG,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mm-btn mm-btn-green flex-1"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Enviar por WhatsApp
                </a>
                <a
                  href={`mailto:${
                    (pricesSettings?.contact_email as string) ?? DEFAULT_EMAIL
                  }?subject=${encodeURIComponent(
                    "Comprobante de pago - Pedido",
                  )}`}
                  className="mm-btn mm-btn-primary flex-1"
                >
                  <Mail className="size-4" aria-hidden />
                  Enviar por Email
                </a>
              </div>
            </div>
            <div className="flex justify-start">
              <button
                type="button"
                className="mm-btn mm-btn-outline"
                onClick={() => {
                  if (typeof window !== "undefined")
                    sessionStorage.removeItem(EDITOR_ORDER_KEY);
                  router.push("/");
                }}
              >
                <ChevronLeft className="size-4" />
                Volver al Inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditorInner />
    </Suspense>
  );
}
