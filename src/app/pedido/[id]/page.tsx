"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Package } from "lucide-react";
import api from "@/lib/api";

const VARIANT_LABELS: Record<string, string> = {
  graphite: "Grafito",
  wood: "Madera",
  black: "Negro",
  marble: "Mármol",
  graphite_light: "Grafito (Con Luz)",
  wood_light: "Madera (Con Luz)",
  black_light: "Negro (Con Luz)",
  marble_light: "Mármol (Con Luz)",
};

const LED_TYPE_LABELS: Record<string, string> = {
  warm_led: "LED Cálido",
  white_led: "LED Blanco",
};

const SHIPPING_LABELS: Record<string, string> = {
  pickup_uber: "Retiro / Uber",
  shipping_province: "Envío a otra provincia",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "En Proceso",
  in_progress: "En Proceso",
  processing: "Finalizada",
  delivered: "Entregada",
};

interface OrderView {
  id: number | string;
  client_name?: string;
  phone?: string;
  box_type?: string;
  led_type?: string;
  variant?: string;
  shipping_option?: string;
  status?: string;
}

export default function PedidoView() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const o = (await api.getOrder(id)) as OrderView;
        if (!cancelled) setOrder(o);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Pedido no encontrado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const boxTypeLabel = order?.box_type === "with_light" ? "Con Luz" : "Sin Luz";
  const ledTypeLabel = order?.led_type ? LED_TYPE_LABELS[order.led_type] ?? order.led_type : "";
  const variantLabel = order?.variant
    ? VARIANT_LABELS[order.variant] ?? order.variant.replace(/_/g, " ")
    : "";
  const shippingLabel = order?.shipping_option
    ? SHIPPING_LABELS[order.shipping_option] ?? order.shipping_option
    : "";

  if (loading) {
    return (
      <div className="mm-page flex justify-center px-4 py-10">
        <div className="mm-card w-full max-w-2xl p-8">
          <p className="text-center text-mb-gray">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mm-page flex justify-center px-4 py-10">
        <div className="mm-card w-full max-w-2xl p-8">
          <p className="text-center font-medium text-mb-red">{error || "Pedido no encontrado"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-page flex justify-center px-4 py-10">
      <div className="mm-card w-full max-w-2xl p-6 sm:p-8 animate-fade-up">
        <header className="mb-6 text-center">
          <h1 className="flex items-center justify-center gap-2 font-heading text-2xl font-bold text-mb-ink">
            <Package className="size-6 text-mb-blue" aria-hidden />
            Cajita de la Memoria
          </h1>
          <p className="mt-1 text-sm text-mb-gray">Pedido #{order.id}</p>
        </header>

        <div className="mb-6">
          <h2 className="mb-2 font-heading text-lg font-bold text-mb-ink">Datos del cliente</h2>
          <div className="space-y-1 text-sm text-mb-ink">
            <p>
              <strong>Cliente:</strong> {order.client_name}
            </p>
            <p>
              <strong>Teléfono:</strong> {order.phone}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 font-heading text-lg font-bold text-mb-ink">Selección de la cajita</h2>
          <div className="space-y-1 text-sm text-mb-ink">
            <p>
              <strong>Tipo:</strong> {boxTypeLabel}
            </p>
            {order.led_type && (
              <p>
                <strong>Tipo LED:</strong> {ledTypeLabel}
              </p>
            )}
            <p>
              <strong>Variante:</strong> {variantLabel}
            </p>
            {order.shipping_option && (
              <p>
                <strong>Envío:</strong> {shippingLabel}
              </p>
            )}
          </div>
        </div>

        {order.status && (
          <div>
            <p className="text-sm text-mb-ink">
              <strong>Estado:</strong> {STATUS_LABELS[order.status] ?? order.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
