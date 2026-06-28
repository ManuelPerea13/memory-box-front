"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, User, Smartphone, Lightbulb, Sun, Palette, Truck } from "lucide-react";
import api from "@/lib/api";

// Formatea nombre: primera letra de cada palabra en mayúscula, resto en minúscula.
const formatNombreCompleto = (str: string): string => {
  if (!str || typeof str !== "string") return "";
  return str
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
};

// Solo lo que ingresa el usuario: código de área + número (10 dígitos). El back agrega +54 9.
const PHONE_MAX_DIGITS = 10;

// Solo dígitos, espacios y +; no más de PHONE_MAX_DIGITS dígitos. El backend normaliza a E.164.
const sanitizePhoneInput = (value: string): string => {
  if (!value || typeof value !== "string") return "";
  const cleaned = value.replace(/[^\d\s+]/g, "");
  let digitCount = 0;
  let result = "";
  for (const ch of cleaned) {
    if (ch >= "0" && ch <= "9") {
      if (digitCount >= PHONE_MAX_DIGITS) continue;
      digitCount++;
    }
    result += ch;
  }
  return result;
};

/** Mapeo id/código de variante del API al código que espera el backend. */
const API_ID_TO_BACKEND: Record<string, string> = {
  graphite: "graphite",
  grafito: "graphite",
  wood: "wood",
  madera: "wood",
  black: "black",
  negro: "black",
  negras: "black",
  marble: "marble",
  mármol: "marble",
  graphite_light: "graphite_light",
  grafito_light: "graphite_light",
  wood_light: "wood_light",
  madera_light: "wood_light",
  black_light: "black_light",
  negro_light: "black_light",
  negras_light: "black_light",
  marble_light: "marble_light",
  mármol_light: "marble_light",
};

/** Normaliza id/name de variante del API al código que espera el backend. */
const toBackendVariantCode = (apiId: unknown, boxType: string): string => {
  if (!apiId && apiId !== 0) return "";
  const key = String(apiId).trim().toLowerCase();
  const code = API_ID_TO_BACKEND[key];
  if (code) return code;
  if (boxType === "with_light" && key.endsWith("_light")) return key;
  return key;
};

/** URLs que empiezan con /media/ se sirven desde el backend. */
const getMediaSrc = (url: string | null | undefined): string => {
  if (!url || typeof url !== "string") return url ?? "";
  if (url.startsWith("/media/")) {
    const base = (api.baseUrl || "").replace(/\/$/, "");
    return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
  }
  return url;
};

interface Variant {
  id: string | number;
  name: string;
  images?: string[];
}

interface VariantsData {
  no_light: Variant[];
  with_light: Variant[];
}

interface FormState {
  nombre_cliente: string;
  telefono: string;
  box_type: string;
  led_type: string;
  variant: string;
  shipping_option: string;
}

function ClientDataInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingOrderId = searchParams.get("orderId");
  const [variantsData, setVariantsData] = useState<VariantsData>({ no_light: [], with_light: [] });
  const [loadingOrder, setLoadingOrder] = useState(!!editingOrderId);
  const [form, setForm] = useState<FormState>({
    nombre_cliente: "",
    telefono: "",
    box_type: "no_light",
    led_type: "warm_led",
    variant: "",
    shipping_option: "pickup_uber",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVariant, setModalVariant] = useState<Variant | null>(null);

  useEffect(() => {
    api
      .getVariantsPublic()
      .then((data) => {
        if (data && typeof data === "object") {
          const d = data as Partial<VariantsData>;
          setVariantsData({
            no_light: Array.isArray(d.no_light) ? d.no_light : [],
            with_light: Array.isArray(d.with_light) ? d.with_light : [],
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingOrderId) return;
    let cancelled = false;
    api
      .getOrder(editingOrderId)
      .then((order) => {
        if (cancelled) return;
        const o = order as Record<string, unknown>;
        const boxType = (o.box_type as string) || "no_light";
        setForm({
          nombre_cliente: formatNombreCompleto(((o.client_name as string) || "").trim()),
          telefono: sanitizePhoneInput((o.phone as string) || ""),
          box_type: boxType,
          led_type: (o.led_type as string) || "warm_led",
          variant: toBackendVariantCode(o.variant, boxType) || (o.variant as string) || "",
          shipping_option: (o.shipping_option as string) || "pickup_uber",
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOrder(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingOrderId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev };
      if (name === "nombre_cliente") {
        next.nombre_cliente = formatNombreCompleto(value);
      } else if (name === "telefono") {
        next.telefono = sanitizePhoneInput(value);
      } else {
        next[name as keyof FormState] = value;
      }
      if (name === "box_type") {
        next.variant = "";
        if (value === "no_light") next.led_type = "";
        else next.led_type = "warm_led";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.variant) {
      setError("Selecciona una variante de caja");
      return;
    }
    if (form.box_type === "with_light" && !form.led_type) {
      setError("Selecciona el tipo de LED");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const variantCode = toBackendVariantCode(form.variant, form.box_type) || form.variant;
      const payload: Record<string, unknown> = {
        client_name: formatNombreCompleto(form.nombre_cliente.trim()),
        phone: form.telefono,
        box_type: form.box_type,
        variant: variantCode,
        shipping_option: form.shipping_option,
      };
      if (form.box_type === "with_light") payload.led_type = form.led_type;
      if (editingOrderId) {
        await api.updateOrder(editingOrderId, payload);
        router.push(`/editor?orderId=${editingOrderId}`);
      } else {
        const order = (await api.createOrder(payload)) as { id: string | number };
        router.push(`/editor?orderId=${order.id}`);
      }
    } catch (err) {
      setError((err as Error).message || "Error al crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  const variants = variantsData[form.box_type as keyof VariantsData] || [];
  const conLuz = form.box_type === "with_light";

  // Tarjeta seleccionable con el estilo refinado del editor (bordes suaves,
  // sombra sutil, hover con leve elevación, seleccionada con anillo azul).
  const optionClass = (active: boolean): string =>
    `relative cursor-pointer rounded-xl border bg-white shadow-sm transition ${
      active
        ? "border-mb-blue bg-mb-blue-light ring-2 ring-mb-blue/20"
        : "border-mb-border hover:-translate-y-px hover:border-mb-blue/40 hover:shadow"
    }`;

  return (
    <div className="mm-page-soft flex justify-center px-4 py-10">
      <div className="mm-card w-full max-w-2xl p-6 sm:p-8 animate-fade-up">
        <header className="mb-6 text-center">
          <h1 className="flex items-center justify-center gap-2 font-heading text-2xl font-bold text-mb-ink">
            <Package className="size-6 text-mb-blue" aria-hidden />
            Pedido de Caja de la Memoria
          </h1>
          <p className="mt-1 text-sm text-mb-gray">
            {editingOrderId
              ? "Modifica los datos y vuelve al editor con tus imágenes"
              : "Completa los datos del cliente para continuar"}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nombre_cliente" className="mm-label flex items-center gap-2">
              <User className="size-4 text-mb-blue" aria-hidden />
              Nombre Completo *
            </label>
            <input
              id="nombre_cliente"
              type="text"
              name="nombre_cliente"
              className="mm-input"
              value={form.nombre_cliente}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div>
            <label htmlFor="telefono" className="mm-label flex items-center gap-2">
              <Smartphone className="size-4 text-mb-blue" aria-hidden />
              Número de teléfono *
            </label>
            <input
              id="telefono"
              type="tel"
              name="telefono"
              className="mm-input"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Ej: 351 339 2082 (sin +54)"
              required
            />
            <span className="mt-1 block text-xs text-mb-gray">
              El número correcto es importante para avisarte cuando tu pedido esté listo para retirar o
              enviar.
            </span>
          </div>

          {/* Tipo de caja */}
          <div>
            <label className="mm-label flex items-center gap-2">
              <Lightbulb className="size-4 text-mb-blue" aria-hidden />
              Tipo de caja:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`${optionClass(form.box_type === "no_light")} flex flex-col items-center gap-1 p-3 text-center`}
              >
                <input
                  type="radio"
                  name="box_type"
                  value="no_light"
                  className="sr-only"
                  checked={form.box_type === "no_light"}
                  onChange={handleChange}
                />
                <Package className="size-5 text-mb-ink" aria-hidden />
                <span className="text-sm font-medium text-mb-ink">Sin Luz</span>
              </label>
              <label
                className={`${optionClass(form.box_type === "with_light")} flex flex-col items-center gap-1 p-3 text-center`}
              >
                <input
                  type="radio"
                  name="box_type"
                  value="with_light"
                  className="sr-only"
                  checked={form.box_type === "with_light"}
                  onChange={handleChange}
                />
                <Lightbulb className="size-5 text-mb-amber" aria-hidden />
                <span className="text-sm font-medium text-mb-ink">Con Luz</span>
              </label>
            </div>
          </div>

          {/* Tipo de LED - solo Con Luz */}
          {conLuz && (
            <div>
              <label className="mm-label flex items-center gap-2">
                <Sun className="size-4 text-mb-blue" aria-hidden />
                Tipo de LED:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`${optionClass(form.led_type === "warm_led")} flex flex-col items-center gap-1 p-3 text-center`}
                >
                  <input
                    type="radio"
                    name="led_type"
                    value="warm_led"
                    className="sr-only"
                    checked={form.led_type === "warm_led"}
                    onChange={handleChange}
                  />
                  <span className="size-4 rounded-full bg-mb-amber" aria-hidden />
                  <span className="text-sm font-medium text-mb-ink">LED Cálido</span>
                </label>
                <label
                  className={`${optionClass(form.led_type === "white_led")} flex flex-col items-center gap-1 p-3 text-center`}
                >
                  <input
                    type="radio"
                    name="led_type"
                    value="white_led"
                    className="sr-only"
                    checked={form.led_type === "white_led"}
                    onChange={handleChange}
                  />
                  <span className="size-4 rounded-full border border-mb-border bg-white" aria-hidden />
                  <span className="text-sm font-medium text-mb-ink">LED Blanco</span>
                </label>
              </div>
            </div>
          )}

          {/* Variante de caja */}
          <div>
            <label className="mm-label flex items-center gap-2">
              <Palette className="size-4 text-mb-blue" aria-hidden />
              Variante de caja:
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {variants.map((v) => {
                const backendCode = toBackendVariantCode(v.id, form.box_type);
                return (
                  <label
                    key={v.id}
                    className={`${optionClass(form.variant === backendCode)} flex flex-col items-center gap-2 p-2`}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={backendCode}
                      className="sr-only"
                      checked={form.variant === backendCode}
                      onChange={handleChange}
                    />
                    <div className="relative w-full">
                      <img
                        src={getMediaSrc(v.images && v.images[0])}
                        alt={v.name}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        className="absolute bottom-1.5 right-1.5 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/80"
                        onClick={(ev) => {
                          ev.preventDefault();
                          setModalVariant(v);
                        }}
                      >
                        + fotos
                      </button>
                    </div>
                    <span className="text-sm font-medium text-mb-ink">{v.name}</span>
                  </label>
                );
              })}
            </div>
            {conLuz && <p className="mt-2 text-sm text-mb-green">🔋 Pilas ya incluidas</p>}
          </div>

          {/* Opción de envío/retiro */}
          <div>
            <label className="mm-label flex items-center gap-2">
              <Truck className="size-4 text-mb-blue" aria-hidden />
              Opción de envío/retiro:
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={`${optionClass(form.shipping_option === "pickup_uber")} flex items-center gap-2 p-3`}
              >
                <input
                  type="radio"
                  name="shipping_option"
                  value="pickup_uber"
                  className="sr-only"
                  checked={form.shipping_option === "pickup_uber"}
                  onChange={handleChange}
                />
                <span className="text-sm font-medium text-mb-ink">Voy a retirar/envío un Uber</span>
              </label>
              <label
                className={`${optionClass(form.shipping_option === "shipping_province")} flex items-center gap-2 p-3`}
              >
                <input
                  type="radio"
                  name="shipping_option"
                  value="shipping_province"
                  className="sr-only"
                  checked={form.shipping_option === "shipping_province"}
                  onChange={handleChange}
                />
                <span className="text-sm font-medium text-mb-ink">
                  Necesito envío a otra provincia
                  <small className="block text-xs text-mb-gray">
                    (con cargo adicional. info por WhatsApp)
                  </small>
                </span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm font-medium text-mb-red">{error}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Link href="/" className="mm-btn mm-btn-outline">
              ← Volver al Inicio
            </Link>
            <button
              type="submit"
              className="mm-btn mm-btn-primary"
              disabled={loading || loadingOrder}
            >
              {loading
                ? editingOrderId
                  ? "Guardando..."
                  : "Creando..."
                : loadingOrder
                  ? "Cargando..."
                  : editingOrderId
                    ? "Guardar y volver al editor"
                    : "Selección de Imágenes →"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal fotos variante */}
      {modalVariant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalVariant(null)}
        >
          <div
            className="mm-card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-mb-ink">{modalVariant.name}</h3>
              <button
                type="button"
                className="text-2xl leading-none text-mb-gray hover:text-mb-ink"
                onClick={() => setModalVariant(null)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(modalVariant.images ?? []).map((img, i) => (
                <img
                  key={i}
                  src={getMediaSrc(img)}
                  alt={`${modalVariant.name} ${i + 1}`}
                  className="w-full rounded object-cover"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientDataPage() {
  return (
    <Suspense fallback={null}>
      <ClientDataInner />
    </Suspense>
  );
}
