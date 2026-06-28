"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import useStockWebSocket from "@/hooks/useStockWebSocket";

const VARIANT_LABELS: Record<string, string> = {
  graphite: "Grafito",
  wood: "Madera",
  black: "Negro",
  marble: "Mármol",
};

const BOX_TYPE_LABELS: Record<string, string> = {
  no_light: "Sin luz",
  with_light: "Con luz",
};

const BASE_VARIANTS = ["graphite", "wood", "black", "marble"];
const BOX_TYPES = ["no_light", "with_light"];

const STOCK_TABS = [
  { id: 0, label: "Stock de cajitas" },
  { id: 1, label: "Stock de packaging" },
];

interface StockRow {
  id?: number;
  variant: string;
  box_type: string;
  quantity: number;
}

interface OrderRow {
  id: number;
  status: string;
  variant?: string | null;
  box_type?: string | null;
  client_name?: string | null;
}

interface PackagingRow {
  id: number;
  item_type: string;
  item_type_display?: string | null;
  quantity: number;
}

interface FormState {
  variant: string;
  boxType: string;
  quantity: string;
}

interface EnCursoOrder {
  id: number;
  client_name: string;
}

interface DisplayRow {
  variant: string;
  boxType: string;
  key: string;
  label: string;
  enCurso: number;
  stockFisico: number;
  stockDisponible: number;
}

const toBaseVariant = (v: string | null | undefined): string | null =>
  v ? v.replace(/_light$/, "") : null;
const isEnCurso = (s: string): boolean => s === "in_progress" || s === "sent";

const stockKey = (variant: string, boxType?: string | null): string =>
  `${variant}_${boxType || "no_light"}`;

export default function AdminStock() {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [pedidos, setPedidos] = useState<OrderRow[]>([]);
  const [packaging, setPackaging] = useState<PackagingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>({ variant: "graphite", boxType: "no_light", quantity: "" });
  const [popoverKey, setPopoverKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const popoverTriggerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (popoverKey == null) return;
    const closeOnClickOutside = (e: MouseEvent) => {
      if (popoverTriggerRef.current && !popoverTriggerRef.current.contains(e.target as Node)) {
        setPopoverKey(null);
      }
    };
    document.addEventListener("click", closeOnClickOutside);
    return () => document.removeEventListener("click", closeOnClickOutside);
  }, [popoverKey]);

  const loadStock = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api
      .getStock()
      .then((data) => {
        const sorted = [...((data as StockRow[]) || [])].sort((a, b) => {
          const v = (a.variant || "").localeCompare(b.variant || "");
          return v !== 0 ? v : (a.box_type || "").localeCompare(b.box_type || "");
        });
        setStock(sorted);
      })
      .catch(() => setStock([]))
      .finally(() => setLoading(false));
  }, []);

  const loadOrders = useCallback(() => {
    api
      .getOrders()
      .then((data) => setPedidos((data as OrderRow[]) || []))
      .catch(() => setPedidos([]));
  }, []);

  const loadPackaging = useCallback(() => {
    api
      .getPackaging()
      .then((data) => setPackaging((data as PackagingRow[]) || []))
      .catch(() => setPackaging([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadPackaging();
  }, [loadPackaging]);

  const refreshStockAndOrders = useCallback(() => {
    loadStock(true);
    loadOrders();
  }, [loadStock, loadOrders]);
  useStockWebSocket(refreshStockAndOrders);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const quantity = form.quantity === "" ? 0 : parseInt(form.quantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      setError("Ingresá una cantidad válida (número mayor o igual a 0).");
      return;
    }
    setError("");
    setLoadingAdd(true);
    try {
      await api.setStock(form.variant, form.boxType, quantity);
      setForm((f) => ({ ...f, quantity: "" }));
      loadStock();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message || "Error al actualizar. ¿El backend tiene api/stock/set_stock/?");
    } finally {
      setLoadingAdd(false);
    }
  };

  const stockByKey = stock.reduce<Record<string, number>>((acc, s) => {
    acc[stockKey(s.variant, s.box_type)] = s.quantity || 0;
    return acc;
  }, {});

  const enCursoByKey = pedidos
    .filter((p) => isEnCurso(p.status))
    .reduce<Record<string, number>>((acc, p) => {
      const base = toBaseVariant(p.variant);
      const bt = p.box_type || "no_light";
      if (base && BASE_VARIANTS.includes(base) && BOX_TYPES.includes(bt)) {
        const key = stockKey(base, bt);
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

  const enCursoOrdersByKey = pedidos
    .filter((p) => isEnCurso(p.status))
    .reduce<Record<string, EnCursoOrder[]>>((acc, p) => {
      const base = toBaseVariant(p.variant);
      const bt = p.box_type || "no_light";
      if (base && BASE_VARIANTS.includes(base) && BOX_TYPES.includes(bt)) {
        const key = stockKey(base, bt);
        if (!acc[key]) acc[key] = [];
        acc[key].push({ id: p.id, client_name: p.client_name || "—" });
      }
      return acc;
    }, {});

  const buildRow = (v: string, bt: string): DisplayRow => {
    const key = stockKey(v, bt);
    const fisico = stockByKey[key] ?? 0;
    const enCursoV = enCursoByKey[key] || 0;
    return {
      variant: v,
      boxType: bt,
      key,
      label: VARIANT_LABELS[v],
      enCurso: enCursoV,
      stockFisico: fisico,
      stockDisponible: fisico - enCursoV,
    };
  };
  const sinLuzBreakdown = BASE_VARIANTS.map((v) => buildRow(v, "no_light"));
  const conLuzBreakdown = BASE_VARIANTS.map((v) => buildRow(v, "with_light"));

  const currentFisico = stockByKey[stockKey(form.variant, form.boxType)] ?? 0;

  const handleVariantOrBoxTypeChange = (variant: string | null, boxType: string | null) => {
    const key = stockKey(variant ?? form.variant, boxType ?? form.boxType);
    const fisico = stockByKey[key] ?? 0;
    setForm((f) => ({
      ...f,
      ...(variant != null && { variant }),
      ...(boxType != null && { boxType }),
      quantity: loading ? "" : fisico === 0 ? "" : String(fisico),
    }));
    setError("");
  };

  useEffect(() => {
    if (!loading && form.quantity === "" && stock.length > 0) {
      const key = stockKey(form.variant, form.boxType);
      const v = stockByKey[key] ?? 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, quantity: v === 0 ? "" : String(v) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stock.length]);

  const renderBreakdown = (rows: DisplayRow[]) =>
    rows.map((row) => (
      <div key={row.key} className="mm-card flex flex-col gap-3 p-4">
        <div className="text-sm font-semibold text-mb-ink">{row.label}</div>
        <div>
          <div className="text-xs text-mb-gray">Stock Disponible</div>
          <div
            className={`text-2xl font-bold ${
              row.stockDisponible > 0
                ? "text-mb-green"
                : row.stockDisponible < 0
                  ? "text-mb-red"
                  : "text-mb-ink"
            }`}
          >
            {loading ? "—" : row.stockDisponible}
          </div>
        </div>
        <div>
          <div className="text-xs text-mb-gray">Stock Físico</div>
          <div className="text-lg font-semibold text-mb-ink">{loading ? "—" : row.stockFisico}</div>
        </div>
        <div
          ref={popoverKey === row.key ? popoverTriggerRef : null}
          className="relative cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setPopoverKey((prev) => (prev === row.key ? null : row.key));
          }}
        >
          <div className="text-xs text-mb-gray">Pedidos en Curso</div>
          <div className="text-lg font-semibold text-mb-ink">{row.enCurso}</div>
          {popoverKey === row.key && (enCursoOrdersByKey[row.key]?.length ?? 0) > 0 && (
            <div
              className="mm-card absolute z-10 mt-1 flex w-56 flex-col gap-1 p-2 shadow-lg"
              role="tooltip"
              onClick={(e) => e.stopPropagation()}
            >
              {(enCursoOrdersByKey[row.key] || []).map((o) => (
                <div
                  key={o.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-mb-gray-light"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverKey(null);
                    router.push(`/admin?ver=${o.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPopoverKey(null);
                      router.push(`/admin?ver=${o.id}`);
                    }
                  }}
                >
                  <span className="font-semibold text-mb-blue">#{o.id}</span>
                  <span className="text-mb-ink">{o.client_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ));

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Stock</h1>
        <p className="text-sm text-mb-gray">
          Stock de cajitas por variante y stock de packaging (cajas de cartón y bolsas).
        </p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-mb-border">
        {STOCK_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px rounded-t-md border border-b-0 border-mb-border px-5 py-2 text-sm ${
              activeTab === tab.id
                ? "bg-mb-gray-light font-semibold text-mb-ink"
                : "bg-transparent text-mb-gray"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-label="Stock Sin luz">
              <h2 className="mb-3 text-lg font-semibold text-mb-ink">Sin luz</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{renderBreakdown(sinLuzBreakdown)}</div>
            </section>
            <section aria-label="Stock Con luz">
              <h2 className="mb-3 text-lg font-semibold text-mb-amber">Con luz</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{renderBreakdown(conLuzBreakdown)}</div>
            </section>
          </div>

          <div className="mm-card mt-6 p-5">
            <h2 className="text-lg font-semibold text-mb-ink">Editar stock físico</h2>
            <p className="mb-4 text-sm text-mb-gray">
              Definí la cantidad en estante por variante y tipo (sin/con luz). Actual:{" "}
              {loading ? "—" : currentFisico} unidades.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="mm-label" htmlFor="stock-variant">
                    Variante
                  </label>
                  <select
                    id="stock-variant"
                    aria-label="Variante"
                    value={form.variant}
                    onChange={(e) => handleVariantOrBoxTypeChange(e.target.value, null)}
                    className="mm-input"
                  >
                    {Object.entries(VARIANT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="mm-label" htmlFor="stock-box-type">
                    Tipo (sin/con luz)
                  </label>
                  <select
                    id="stock-box-type"
                    aria-label="Tipo (sin/con luz)"
                    value={form.boxType}
                    onChange={(e) => handleVariantOrBoxTypeChange(null, e.target.value)}
                    className="mm-input"
                  >
                    {Object.entries(BOX_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="mm-label" htmlFor="stock-quantity">
                    Stock físico en estante
                  </label>
                  <input
                    id="stock-quantity"
                    type="number"
                    aria-label="Stock físico en estante"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder={loading ? "—" : currentFisico === 0 ? "0" : String(currentFisico)}
                    className="mm-input"
                  />
                </div>
                <div>
                  <button type="submit" className="mm-btn mm-btn-primary" disabled={loadingAdd || loading}>
                    {loadingAdd ? "Guardando..." : "Actualizar stock"}
                  </button>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-mb-red">{error}</p>}
            </form>
          </div>
        </>
      )}

      {activeTab === 1 && (
        <div className="mm-card p-5">
          <h2 className="text-lg font-semibold text-mb-ink">Stock de packaging</h2>
          <p className="mb-4 text-sm text-mb-gray">
            Se descuentan automáticamente 1 caja y 1 bolsa por cada pedido que pasa a estado{" "}
            <strong>Finalizada</strong>. Las compras de cajas de cartón o bolsas ecommerce se registran en
            Costos y suman a este stock.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {packaging.map((p) => (
              <div key={p.id} className="mm-card flex items-center justify-between p-4">
                <span className="text-sm text-mb-ink">
                  {p.item_type_display ||
                    (p.item_type === "caja_carton" ? "Caja de cartón (envío)" : "Bolsa ecommerce")}
                </span>
                <span className="text-xl font-bold text-mb-ink">{p.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
