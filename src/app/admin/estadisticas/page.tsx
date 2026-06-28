"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartDataset,
  type ChartOptions,
} from "chart.js";
import { Info } from "lucide-react";
import api from "@/lib/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

type ViewMode = "day" | "month" | "year";

interface CostBreakdown {
  cost_caja?: number;
  cost_pla?: number;
  cost_empaque?: number;
  cost_troqueles?: number;
}

interface DetailOrder {
  id: number;
  date: string;
  precio_venta: number;
  costo_prod?: number;
  box_type?: string;
  cost_breakdown?: CostBreakdown | null;
}

interface SalesByDay {
  date: string;
}

interface SalesByMonth {
  month: string;
}

interface Summary {
  cantidad_ventas: number;
  total_ventas: number;
  total_costos: number;
}

interface Stats {
  sales_by_day?: SalesByDay[];
  sales_by_month?: SalesByMonth[];
  summary?: Summary;
  detail?: DetailOrder[];
}

interface PurchaseItem {
  id: number;
  date?: string;
  category?: string;
  category_display?: string;
  total_cost?: number;
}

interface IngresoMovimiento {
  tipo: "ingreso";
  date: string;
  sortKey: string;
  concept: string;
  sub: string;
  amount: number;
  order: DetailOrder;
}

interface GastoMovimiento {
  tipo: "gasto";
  id: number;
  date: string;
  sortKey: string;
  concept: string;
  amount: number;
}

type Movimiento = IngresoMovimiento | GastoMovimiento;

// Dataset de línea con datos auxiliares de cantidad (sólo en modo día).
type VentasDataset = ChartDataset<"line", number[]> & { countData?: number[] };
type VentasChartData = ChartData<"line", number[], string> & {
  datasets: VentasDataset[];
};

const formatDate = (str?: string): string => {
  if (!str) return "";
  const d = new Date(str);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatMoney = (n: number): string => `$${Number(n).toLocaleString("es-AR")}`;

const ESTADISTICAS_TABS = [
  { id: 0, label: "Resumen" },
  { id: 1, label: "Últimos movimientos" },
];

const PURCHASE_CATEGORY_LABELS: Record<string, string> = {
  burbujas: "Rollo burbujas",
  caja_carton: "Caja cartón envío",
  bolsa_ecommerce: "Bolsa ecommerce",
  publicidad_instagram: "Publicidad Instagram",
  rollo_pla: "Rollo PLA",
};
/** Categorías que no se muestran en Últimos movimientos (ya están en el costo de producción del pedido). */
const PURCHASE_CATEGORIES_EXCLUIDAS_MOVIMIENTOS = ["imagenes", "caja_carton", "bolsa_ecommerce"];

const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Prepara datos para el gráfico de línea (suma de ventas por día/mes/año). Igual lógica que TotalVentas. */
function prepareChartData(
  ventasPorDia: SalesByDay[],
  ventasPorMes: SalesByMonth[],
  detail: DetailOrder[],
  viewMode: ViewMode,
): VentasChartData {
  if (!detail || !Array.isArray(detail)) return { labels: [], datasets: [] };
  const aggByDay: Record<string, number> = {};
  const aggByMonth: Record<string, number> = {};
  const aggByYear: Record<string, number> = {};
  detail.forEach((o) => {
    const dateStr = o.date ? String(o.date).slice(0, 10) : "";
    const amount = Number(o.precio_venta) || 0;
    if (dateStr.length >= 10) {
      aggByDay[dateStr] = (aggByDay[dateStr] || 0) + amount;
      const monthKey = dateStr.slice(0, 7);
      aggByMonth[monthKey] = (aggByMonth[monthKey] || 0) + amount;
      const yearKey = dateStr.slice(0, 4);
      aggByYear[yearKey] = (aggByYear[yearKey] || 0) + amount;
    }
  });

  const colorTotal = { border: "rgba(54, 162, 235, 1)", background: "rgba(54, 162, 235, 0.2)" };

  if (viewMode === "year") {
    const sortedYears = Object.keys(aggByYear).sort();
    if (sortedYears.length === 0) return { labels: [], datasets: [] };
    return {
      labels: sortedYears,
      datasets: [
        {
          label: "Total ventas",
          data: sortedYears.map((y) => aggByYear[y]),
          borderColor: colorTotal.border,
          backgroundColor: colorTotal.background,
          borderWidth: 2,
          fill: false,
          tension: 0.1,
        },
      ],
    };
  }

  if (viewMode === "month") {
    const sortedMonths = (ventasPorMes || []).map((d) => d.month).filter(Boolean);
    if (sortedMonths.length === 0) return { labels: [], datasets: [] };
    const labels = sortedMonths.map((month) => {
      const [y, m] = month.split("-");
      const monthIndex = parseInt(m, 10) - 1;
      return `${MONTH_NAMES[monthIndex] || m} ${y}`;
    });
    return {
      labels,
      datasets: [
        {
          label: "Total ventas",
          data: sortedMonths.map((month) => aggByMonth[month] || 0),
          borderColor: colorTotal.border,
          backgroundColor: colorTotal.background,
          borderWidth: 2,
          fill: false,
          tension: 0.1,
        },
      ],
    };
  }

  // viewMode === 'day': cantidad = pedidos en detail ese día (misma fuente que el total $)
  const sortedDays = (ventasPorDia || []).map((d) => d.date).filter(Boolean);
  if (sortedDays.length === 0) return { labels: [], datasets: [] };
  const norm = (s?: string) => (s || "").toString().slice(0, 10);
  const dayCounts = sortedDays.map(
    (dateStr) => detail.filter((o) => norm(o.date) === norm(dateStr)).length,
  );
  const labels = sortedDays.map((dateStr) => {
    const [year, month, dayNum] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, dayNum));
    const dayOfWeek = DAY_NAMES[date.getUTCDay()];
    const dayNumStr = String(dayNum).padStart(2, "0");
    const monthName = MONTH_NAMES[month - 1];
    return `${dayOfWeek} ${dayNumStr} ${monthName}`;
  });
  return {
    labels,
    datasets: [
      {
        label: "Total ventas",
        data: sortedDays.map((dateStr) => aggByDay[dateStr] || 0),
        countData: dayCounts,
        borderColor: colorTotal.border,
        backgroundColor: colorTotal.background,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      },
    ],
  };
}

type PopoverTarget = number | "total" | null;

/** Popover que muestra el desglose del costo de producción. placeAbove: en tabla, abre hacia arriba para no tapar Margen.
 * boxType: 'no_light' → no mostrar Caja (cajita), sí PLA si > 0. 'with_light' → mostrar Caja si > 0, no mostrar PLA. */
function CostoPopover({
  breakdown,
  totalLabel,
  onClose,
  anchorRef,
  placeAbove,
  boxType,
}: {
  breakdown?: CostBreakdown | null;
  totalLabel?: string;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  placeAbove?: boolean;
  boxType?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !ref.current?.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      )
        onClose();
    };
    document.addEventListener("click", handle, true);
    return () => document.removeEventListener("click", handle, true);
  }, [onClose, anchorRef]);

  const positionClass = placeAbove ? "bottom-full mb-2" : "top-full mt-2";
  const popoverClass = `absolute left-0 z-[1050] w-64 rounded-xl border border-mb-border bg-white p-4 text-left text-sm shadow-lg ${positionClass}`;

  if (!breakdown) {
    const text = totalLabel ?? "Sin desglose. Valor registrado al finalizar el pedido.";
    return (
      <div className={popoverClass} ref={ref} role="dialog" aria-label="Desglose costo">
        <p className="mb-1 font-semibold text-mb-ink">Costo de producción</p>
        <p className="text-mb-gray">{text}</p>
      </div>
    );
  }
  const { cost_caja, cost_pla, cost_empaque, cost_troqueles } = breakdown;
  const costCaja = Number(cost_caja) || 0;
  const costPla = Number(cost_pla) || 0;
  const costEmpaque = Number(cost_empaque) || 0;
  const troqueles = Number(cost_troqueles) || 0;
  const total = costCaja + costPla + costEmpaque + troqueles;
  const isConLuz = boxType === "with_light";
  const showCaja = isConLuz && costCaja > 0;
  const showPla = !isConLuz && costPla > 0;
  return (
    <div className={popoverClass} ref={ref} role="dialog" aria-label="Cálculo del costo">
      <p className="mb-1 font-semibold text-mb-ink">Cálculo del costo de producción</p>
      <ul className="space-y-1 text-mb-ink">
        {showCaja && <li>Caja (cajita): {formatMoney(costCaja)}</li>}
        {showPla && <li>PLA (material): {formatMoney(costPla)}</li>}
        <li>
          Empaque: {formatMoney(costEmpaque)}{" "}
          <span className="text-xs text-mb-gray">(1 caja de cartón + 1 bolsa)</span>
        </li>
        <li>
          Troqueles: {formatMoney(troqueles)}{" "}
          <span className="text-xs text-mb-gray">(costo fijo por cajita, con y sin luz)</span>
        </li>
      </ul>
      <p className="mt-2 border-t border-mb-border pt-2 font-semibold text-mb-ink">
        {formatMoney(total)}
      </p>
    </div>
  );
}

export default function Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartDays] = useState(30);
  const [chartMonths] = useState(12);
  const [popoverFor, setPopoverFor] = useState<PopoverTarget>(null);
  const popoverAnchorRef = useRef<HTMLElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ bottom: number; left: number } | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState(0);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [chartViewMode, setChartViewMode] = useState<ViewMode>("day");

  useEffect(() => {
    // Carga de estadísticas al cambiar el rango.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    api
      .getEstadisticas(chartDays, chartMonths)
      .then((data) => setStats(data as Stats))
      .catch(() => {
        setStats(null);
        setError("No se pudieron cargar las estadísticas.");
      })
      .finally(() => setLoading(false));
  }, [chartDays, chartMonths]);

  useEffect(() => {
    api
      .getPurchases()
      .then((data) => setPurchases(Array.isArray(data) ? (data as PurchaseItem[]) : []))
      .catch(() => setPurchases([]));
  }, []);

  const isTablePopover = typeof popoverFor === "number";
  useLayoutEffect(() => {
    if (isTablePopover && popoverAnchorRef.current) {
      const rect = popoverAnchorRef.current.getBoundingClientRect();
      setPopoverPosition({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    } else {
      setPopoverPosition(null);
    }
  }, [popoverFor, isTablePopover]);

  const ventasPorDia = useMemo(() => stats?.sales_by_day ?? [], [stats]);
  const ventasPorMes = useMemo(() => stats?.sales_by_month ?? [], [stats]);
  const summary = stats?.summary ?? { cantidad_ventas: 0, total_ventas: 0, total_costos: 0 };
  const detail = useMemo(() => stats?.detail ?? [], [stats]);

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - chartDays);
  const sinceStr = sinceDate.toISOString().slice(0, 10);
  const purchasesInPeriod = purchases.filter(
    (p) =>
      p.date &&
      p.date >= sinceStr &&
      !PURCHASE_CATEGORIES_EXCLUIDAS_MOVIMIENTOS.includes((p.category || "").toLowerCase()),
  );
  const movimientos: Movimiento[] = [
    ...detail.map<IngresoMovimiento>((o) => ({
      tipo: "ingreso",
      date: o.date,
      sortKey: o.date + "-i-" + (o.id || 0),
      concept: `Pedido #${o.id}`,
      sub: o.box_type === "with_light" ? "Con luz" : "Sin luz",
      amount: o.precio_venta,
      order: o,
    })),
    ...purchasesInPeriod.map<GastoMovimiento>((p) => ({
      tipo: "gasto",
      id: p.id,
      date: p.date as string,
      sortKey: p.date + "-g-" + (p.id || 0),
      concept: p.category_display || PURCHASE_CATEGORY_LABELS[p.category || ""] || p.category || "Gasto",
      amount: Number(p.total_cost) || 0,
    })),
  ].sort((a, b) => (b.sortKey > a.sortKey ? 1 : -1));

  const totalIngresosMov = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((s, m) => s + (m.amount || 0), 0);
  const totalGastosMov = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce((s, m) => s + (m.amount || 0), 0);
  const balanceMovimientos = totalIngresosMov - totalGastosMov;

  const totalVentas = summary.total_ventas;
  const totalCostos = summary.total_costos;
  const cantidadVentas = summary.cantidad_ventas;

  const chartData = useMemo(
    () => prepareChartData(ventasPorDia, ventasPorMes, detail, chartViewMode),
    [ventasPorDia, ventasPorMes, detail, chartViewMode],
  );

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const v = context.parsed?.y ?? (context.raw as number);
            const lines = [`${context.dataset.label}: ${formatMoney(v)}`];
            const ds = context.dataset as VentasDataset;
            if (chartViewMode === "day" && ds.countData) {
              const count = ds.countData[context.dataIndex] ?? 0;
              lines.push(`Cantidad vendida: ${count}`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => {
            const num = Number(value);
            if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
            return formatMoney(num);
          },
        },
      },
      x: {
        ticks: {
          maxRotation: chartViewMode === "day" ? 90 : 45,
          minRotation: chartViewMode === "day" ? 90 : 45,
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-mb-ink">Estadísticas</h1>
          <p className="text-mb-gray">Cargando...</p>
        </header>
      </div>
    );
  }

  const orderForPopover = isTablePopover
    ? (detail || []).find((o) => o.id === popoverFor)
    : null;

  const viewModeLabel = (long: boolean) =>
    chartViewMode === "year"
      ? long
        ? "año"
        : "por año"
      : chartViewMode === "month"
        ? long
          ? "mes"
          : "por mes"
        : long
          ? "día"
          : "por día";

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Estadísticas</h1>
        <p className="text-mb-gray">
          Ventas por día y por mes, y resumen de ingresos vs costos de producción.
        </p>
      </header>

      <div className="mb-6 flex border-b border-mb-border">
        {ESTADISTICAS_TABS.map((tab) => (
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

      {/* Pestaña 0: Resumen (gráficos, ventas y costos) */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="mm-card flex min-h-[400px] flex-col p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-semibold text-mb-blue">
                Suma de ventas {viewModeLabel(false)}
              </h2>
              <div className="inline-flex overflow-hidden rounded-lg border border-mb-border">
                {(["day", "month", "year"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={chartViewMode === mode}
                    onClick={() => setChartViewMode(mode)}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      chartViewMode === mode
                        ? "bg-mb-blue text-white"
                        : "bg-white text-mb-gray hover:bg-mb-gray-light"
                    }`}
                  >
                    {mode === "day" ? "Día" : mode === "month" ? "Mes" : "Año"}
                  </button>
                ))}
              </div>
            </div>
            {chartData.datasets.length > 0 && (chartData.labels?.length ?? 0) > 0 ? (
              <div className="relative min-h-[280px] flex-1">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <p className="text-sm text-mb-gray">
                No hay datos de ventas para el período seleccionado.
              </p>
            )}
            <p className="mb-0 mt-3 text-sm text-mb-gray">
              Pedidos finalizados o entregados. Total en $ por {viewModeLabel(true)}.
            </p>
          </section>

          <section className="mm-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-mb-blue">Ventas totales y costos</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-mb-border bg-mb-gray-light px-4 py-3">
                <span className="block text-xs font-medium text-mb-gray">Total</span>
                <span className="block text-xl font-bold text-mb-blue">
                  {formatMoney(totalVentas)}
                </span>
              </div>
              <div className="rounded-xl border border-mb-border bg-mb-gray-light px-4 py-3">
                <span className="block text-xs font-medium text-mb-gray">Cantidad</span>
                <span className="block text-xl font-bold text-mb-ink">#{cantidadVentas}</span>
              </div>
              <div
                className="relative rounded-xl border border-mb-border bg-mb-gray-light px-4 py-3"
                ref={(el) => {
                  if (popoverFor === "total") popoverAnchorRef.current = el;
                }}
              >
                <span className="block text-xs font-medium text-mb-gray">
                  Total costos producción
                </span>
                <span className="block text-xl font-bold text-mb-ink">
                  {formatMoney(totalCostos)}
                </span>
                <button
                  type="button"
                  className="absolute right-2 top-2 text-mb-gray hover:text-mb-blue"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverFor((p) => (p === "total" ? null : "total"));
                  }}
                  aria-label="Ver desglose del costo"
                  title="Ver cálculo"
                >
                  <Info size={16} />
                </button>
                {popoverFor === "total" && (
                  <CostoPopover
                    breakdown={null}
                    totalLabel="Suma del costo de producción de cada pedido. Cada pedido: Caja + PLA + Empaque (valores al finalizar)."
                    onClose={() => setPopoverFor(null)}
                    anchorRef={popoverAnchorRef}
                  />
                )}
              </div>
              <div className="rounded-xl border border-mb-border bg-mb-gray-light px-4 py-3">
                <span className="block text-xs font-medium text-mb-gray">
                  Balance (ingresos − gastos)
                </span>
                <span
                  className={`block text-xl font-bold ${
                    balanceMovimientos >= 0 ? "text-mb-amber" : "text-mb-red"
                  }`}
                >
                  {formatMoney(balanceMovimientos)}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Pestaña 1: Últimos movimientos (tabla) */}
      {activeTab === 1 && (
        <section className="mm-card p-5">
          <h2 className="mb-2 text-lg font-semibold text-mb-ink">Últimos movimientos</h2>
          <p className="mb-3 text-sm text-mb-gray">
            Ingresos (ventas) y gastos registrados en el período seleccionado. El ícono ℹ junto al
            costo muestra el desglose del pedido (caja, empaque, troqueles).
          </p>
          <p className="mb-4 text-sm text-mb-ink">
            Balance (ingresos − gastos):{" "}
            <span
              className={
                balanceMovimientos >= 0 ? "font-semibold text-mb-green" : "font-semibold text-mb-red"
              }
            >
              {formatMoney(balanceMovimientos)}
            </span>
            <span className="mt-1 block text-xs text-mb-gray">
              Incluye ventas y todos los gastos del período (Compras y gastos).
            </span>
          </p>
          <div className="overflow-x-auto">
            <table className="mm-table">
              <thead>
                <tr>
                  <th className="text-left">Fecha</th>
                  <th className="text-left">Concepto</th>
                  <th className="text-center">Tipo</th>
                  <th className="text-right">Monto</th>
                  <th className="text-right">Costo prod.</th>
                  <th className="text-right">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) =>
                  m.tipo === "ingreso" ? (
                    <tr key={"i-" + m.order.id}>
                      <td>{formatDate(m.date)}</td>
                      <td>
                        <span>{m.concept}</span>
                        {m.sub && <span className="text-mb-gray"> — {m.sub}</span>}
                      </td>
                      <td className="text-center">
                        <span className="mm-badge bg-mb-green/15 text-mb-green">Ingreso</span>
                      </td>
                      <td className="text-right">{formatMoney(m.amount)}</td>
                      <td
                        className="relative whitespace-nowrap text-right"
                        ref={(el) => {
                          if (popoverFor === m.order.id) popoverAnchorRef.current = el;
                        }}
                      >
                        {formatMoney(m.order.costo_prod ?? 0)}
                        <button
                          type="button"
                          className="ml-1 inline-flex align-middle text-mb-gray hover:text-mb-blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPopoverFor((p) => (p === m.order.id ? null : m.order.id));
                          }}
                          aria-label="Ver desglose del costo"
                          title="Ver cálculo"
                        >
                          <Info size={14} />
                        </button>
                      </td>
                      <td
                        className={`text-right ${
                          m.amount - (m.order.costo_prod || 0) >= 0
                            ? "text-mb-green"
                            : "text-mb-red"
                        }`}
                      >
                        {formatMoney((m.amount || 0) - (m.order.costo_prod || 0))}
                      </td>
                    </tr>
                  ) : (
                    <tr key={"g-" + (m.id ?? m.sortKey)}>
                      <td>{formatDate(m.date)}</td>
                      <td>{m.concept}</td>
                      <td className="text-center">
                        <span className="mm-badge bg-mb-red/15 text-mb-red">Gasto</span>
                      </td>
                      <td className="text-right text-mb-red">{formatMoney(m.amount)}</td>
                      <td className="text-right">—</td>
                      <td className="text-right">—</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {error && <p className="mt-3 text-sm text-mb-red">{error}</p>}
          {!error && movimientos.length === 0 && !loading && (
            <p className="py-8 text-center text-mb-gray">
              No hay movimientos en el período seleccionado.
            </p>
          )}
        </section>
      )}

      {/* Popover de costo en tabla: renderizado en portal para que no lo recorte el overflow */}
      {activeTab === 1 &&
        isTablePopover &&
        popoverPosition &&
        orderForPopover &&
        createPortal(
          <div
            className="fixed z-[1050]"
            style={{
              bottom: popoverPosition.bottom,
              left: popoverPosition.left,
            }}
          >
            <CostoPopover
              breakdown={orderForPopover.cost_breakdown}
              boxType={orderForPopover.box_type}
              onClose={() => setPopoverFor(null)}
              anchorRef={popoverAnchorRef}
              placeAbove
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
