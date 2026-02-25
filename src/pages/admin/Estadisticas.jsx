import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import api from '../../restclient/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const formatDate = (str) => {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatMonth = (str) => {
  if (!str) return '';
  const d = new Date(str + '-01');
  return d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
};

const formatMoney = (n) => `$${Number(n).toLocaleString('es-AR')}`;

const ESTADISTICAS_TABS = [
  { id: 0, label: 'Resumen' },
  { id: 1, label: 'Últimos movimientos' },
];

const PURCHASE_CATEGORY_LABELS = {
  burbujas: 'Rollo burbujas',
  caja_carton: 'Caja cartón envío',
  bolsa_ecommerce: 'Bolsa ecommerce',
  publicidad_instagram: 'Publicidad Instagram',
  rollo_pla: 'Rollo PLA',
};
/** Categorías que no se muestran en Últimos movimientos (ya están en el costo de producción del pedido). */
const PURCHASE_CATEGORIES_EXCLUIDAS_MOVIMIENTOS = ['imagenes', 'caja_carton', 'bolsa_ecommerce'];

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Prepara datos para el gráfico de línea (suma de ventas por día/mes/año). Igual lógica que TotalVentas. */
function prepareChartData(ventasPorDia, ventasPorMes, detail, viewMode) {
  if (!detail || !Array.isArray(detail)) return { labels: [], datasets: [] };
  const aggByDay = {};
  const aggByMonth = {};
  const aggByYear = {};
  detail.forEach((o) => {
    const dateStr = o.date ? String(o.date).slice(0, 10) : '';
    const amount = Number(o.precio_venta) || 0;
    if (dateStr.length >= 10) {
      aggByDay[dateStr] = (aggByDay[dateStr] || 0) + amount;
      const monthKey = dateStr.slice(0, 7);
      aggByMonth[monthKey] = (aggByMonth[monthKey] || 0) + amount;
      const yearKey = dateStr.slice(0, 4);
      aggByYear[yearKey] = (aggByYear[yearKey] || 0) + amount;
    }
  });

  const colorTotal = { border: 'rgba(54, 162, 235, 1)', background: 'rgba(54, 162, 235, 0.2)' };

  if (viewMode === 'year') {
    const sortedYears = Object.keys(aggByYear).sort();
    if (sortedYears.length === 0) return { labels: [], datasets: [] };
    return {
      labels: sortedYears,
      datasets: [{
        label: 'Total ventas',
        data: sortedYears.map((y) => aggByYear[y]),
        borderColor: colorTotal.border,
        backgroundColor: colorTotal.background,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      }],
    };
  }

  if (viewMode === 'month') {
    const sortedMonths = (ventasPorMes || []).map((d) => d.month).filter(Boolean);
    if (sortedMonths.length === 0) return { labels: [], datasets: [] };
    const labels = sortedMonths.map((month) => {
      const [y, m] = month.split('-');
      const monthIndex = parseInt(m, 10) - 1;
      return `${MONTH_NAMES[monthIndex] || m} ${y}`;
    });
    return {
      labels,
      datasets: [{
        label: 'Total ventas',
        data: sortedMonths.map((month) => aggByMonth[month] || 0),
        borderColor: colorTotal.border,
        backgroundColor: colorTotal.background,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      }],
    };
  }

  // viewMode === 'day': cantidad = pedidos en detail ese día (misma fuente que el total $)
  const sortedDays = (ventasPorDia || []).map((d) => d.date).filter(Boolean);
  if (sortedDays.length === 0) return { labels: [], datasets: [] };
  const norm = (s) => (s || '').toString().slice(0, 10);
  const dayCounts = sortedDays.map((dateStr) =>
    detail.filter((o) => norm(o.date) === norm(dateStr)).length
  );
  const labels = sortedDays.map((dateStr) => {
    const [year, month, dayNum] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, dayNum));
    const dayOfWeek = DAY_NAMES[date.getUTCDay()];
    const dayNumStr = String(dayNum).padStart(2, '0');
    const monthName = MONTH_NAMES[month - 1];
    return `${dayOfWeek} ${dayNumStr} ${monthName}`;
  });
  return {
    labels,
    datasets: [{
      label: 'Total ventas',
      data: sortedDays.map((dateStr) => aggByDay[dateStr] || 0),
      countData: dayCounts,
      borderColor: colorTotal.border,
      backgroundColor: colorTotal.background,
      borderWidth: 2,
      fill: false,
      tension: 0.1,
    }],
  };
}

/** Popover que muestra el desglose del costo de producción. placeAbove: en tabla, abre hacia arriba para no tapar Margen.
 * boxType: 'no_light' → no mostrar Caja (cajita), sí PLA si > 0. 'with_light' → mostrar Caja si > 0, no mostrar PLA. */
const CostoPopover = ({ breakdown, totalLabel, onClose, anchorRef, placeAbove, boxType }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handle = (e) => {
      if (!ref.current?.contains(e.target) && (!anchorRef?.current || !anchorRef.current.contains(e.target))) onClose();
    };
    document.addEventListener('click', handle, true);
    return () => document.removeEventListener('click', handle, true);
  }, [onClose, anchorRef]);

  const popoverClass = placeAbove
    ? 'admin-estadisticas-popover admin-estadisticas-popover--above'
    : 'admin-estadisticas-popover';

  if (!breakdown) {
    const text = totalLabel ?? 'Sin desglose. Valor registrado al finalizar el pedido.';
    return (
      <div className={popoverClass} ref={ref} role="dialog" aria-label="Desglose costo">
        <p className="admin-estadisticas-popover-title">Costo de producción</p>
        <p className="admin-estadisticas-popover-text">{text}</p>
      </div>
    );
  }
  const { cost_caja, cost_pla, cost_empaque, cost_troqueles } = breakdown;
  const costCaja = Number(cost_caja) || 0;
  const troqueles = Number(cost_troqueles) || 0;
  const total = costCaja + cost_pla + cost_empaque + troqueles;
  const isConLuz = boxType === 'with_light';
  const showCaja = isConLuz && costCaja > 0;
  const showPla = !isConLuz && Number(cost_pla) > 0;
  return (
    <div className={popoverClass} ref={ref} role="dialog" aria-label="Cálculo del costo">
      <p className="admin-estadisticas-popover-title">Cálculo del costo de producción</p>
      <ul className="admin-estadisticas-popover-list">
        {showCaja && <li>Caja (cajita): {formatMoney(costCaja)}</li>}
        {showPla && <li>PLA (material): {formatMoney(cost_pla)}</li>}
        <li>
          Empaque: {formatMoney(cost_empaque)}{' '}
          <span className="admin-estadisticas-popover-hint">(1 caja de cartón + 1 bolsa)</span>
        </li>
        <li>Troqueles: {formatMoney(troqueles)} <span className="admin-estadisticas-popover-hint">(costo fijo por cajita, con y sin luz)</span></li>
      </ul>
      <p className="admin-estadisticas-popover-total">{formatMoney(total)}</p>
    </div>
  );
};

const AdminEstadisticas = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartDays, setChartDays] = useState(30);
  const [chartMonths, setChartMonths] = useState(12);
  const [popoverFor, setPopoverFor] = useState(null);
  const popoverAnchorRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [chartViewMode, setChartViewMode] = useState('day'); // 'day' | 'month' | 'year'

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getEstadisticas(chartDays, chartMonths)
      .then(setStats)
      .catch(() => {
        setStats(null);
        setError('No se pudieron cargar las estadísticas.');
      })
      .finally(() => setLoading(false));
  }, [chartDays, chartMonths]);

  useEffect(() => {
    api.getPurchases().then((data) => setPurchases(Array.isArray(data) ? data : [])).catch(() => setPurchases([]));
  }, []);

  const isTablePopover = typeof popoverFor === 'number';
  useLayoutEffect(() => {
    if (isTablePopover && popoverAnchorRef.current) {
      const rect = popoverAnchorRef.current.getBoundingClientRect();
      setPopoverPosition({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    } else {
      setPopoverPosition(null);
    }
  }, [popoverFor, isTablePopover]);

  const ventasPorDia = stats?.sales_by_day ?? [];
  const ventasPorMes = stats?.sales_by_month ?? [];
  const summary = stats?.summary ?? { cantidad_ventas: 0, total_ventas: 0, total_costos: 0 };
  const detail = stats?.detail ?? [];

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - chartDays);
  const sinceStr = sinceDate.toISOString().slice(0, 10);
  const purchasesInPeriod = purchases.filter(
    (p) => p.date && p.date >= sinceStr && !PURCHASE_CATEGORIES_EXCLUIDAS_MOVIMIENTOS.includes((p.category || '').toLowerCase())
  );
  const movimientos = [
    ...detail.map((o) => ({
      tipo: 'ingreso',
      date: o.date,
      sortKey: o.date + '-i-' + (o.id || 0),
      concept: `Pedido #${o.id}`,
      sub: o.box_type === 'with_light' ? 'Con luz' : 'Sin luz',
      amount: o.precio_venta,
      order: o,
    })),
    ...purchasesInPeriod.map((p) => ({
      tipo: 'gasto',
      id: p.id,
      date: p.date,
      sortKey: p.date + '-g-' + (p.id || 0),
      concept: p.category_display || PURCHASE_CATEGORY_LABELS[p.category] || p.category || 'Gasto',
      amount: Number(p.total_cost) || 0,
    })),
  ].sort((a, b) => (b.sortKey > a.sortKey ? 1 : -1));

  const totalIngresosMov = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + (m.amount || 0), 0);
  const totalGastosMov = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + (m.amount || 0), 0);
  const balanceMovimientos = totalIngresosMov - totalGastosMov;

  const totalVentas = summary.total_ventas;
  const totalCostos = summary.total_costos;
  const cantidadVentas = summary.cantidad_ventas;

  const chartData = useMemo(
    () => prepareChartData(ventasPorDia, ventasPorMes, detail, chartViewMode),
    [ventasPorDia, ventasPorMes, detail, chartViewMode]
  );

  if (loading) {
    return (
      <div className="admin-stock-page">
        <header className="admin-page-header">
          <h1>Estadísticas</h1>
          <p>Cargando...</p>
        </header>
      </div>
    );
  }

  const orderForPopover = isTablePopover ? (detail || []).find((o) => o.id === popoverFor) : null;

  return (
    <div className="admin-stock-page admin-estadisticas-page">
      <header className="admin-page-header">
        <h1>Estadísticas</h1>
        <p>Ventas por día y por mes, y resumen de ingresos vs costos de producción.</p>
      </header>

      <div className="admin-variantes-tabs" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e2e8f0' }}>
          {ESTADISTICAS_TABS.map((tab) => (
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

      {/* Pestaña 0: Resumen (gráficos, ventas y costos) */}
      {activeTab === 0 && (
      <>
      <div className="admin-estadisticas-charts admin-estadisticas-charts--resumen-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'stretch', marginBottom: '1.5rem' }}>
        <section className="admin-estadisticas-card admin-estadisticas-card--chart" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 className="admin-estadisticas-card-title admin-estadisticas-card-title--accent" style={{ margin: 0 }}>
              Suma de ventas {chartViewMode === 'year' ? 'por año' : chartViewMode === 'month' ? 'por mes' : 'por día'}
            </h2>
            <div className="admin-estadisticas-tabs" style={{ margin: 0 }}>
              <button
                type="button"
                className={`admin-estadisticas-tab ${chartViewMode === 'day' ? 'admin-estadisticas-tab--active' : ''}`}
                aria-pressed={chartViewMode === 'day'}
                onClick={() => setChartViewMode('day')}
              >
                Día
              </button>
              <button
                type="button"
                className={`admin-estadisticas-tab ${chartViewMode === 'month' ? 'admin-estadisticas-tab--active' : ''}`}
                aria-pressed={chartViewMode === 'month'}
                onClick={() => setChartViewMode('month')}
              >
                Mes
              </button>
              <button
                type="button"
                className={`admin-estadisticas-tab ${chartViewMode === 'year' ? 'admin-estadisticas-tab--active' : ''}`}
                aria-pressed={chartViewMode === 'year'}
                onClick={() => setChartViewMode('year')}
              >
                Año
              </button>
            </div>
          </div>
          {chartData.datasets.length > 0 && chartData.labels.length > 0 ? (
            <div style={{ position: 'relative', flex: 1, minHeight: '280px' }}>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true } },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const v = context.parsed?.y ?? context.raw;
                          const lines = [`${context.dataset.label}: ${formatMoney(v)}`];
                          if (chartViewMode === 'day' && context.dataset.countData) {
                            const count = context.dataset.countData[context.dataIndex] ?? 0;
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
                          if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                          if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                          return formatMoney(value);
                        },
                      },
                    },
                    x: {
                      ticks: {
                        maxRotation: chartViewMode === 'day' ? 90 : 45,
                        minRotation: chartViewMode === 'day' ? 90 : 45,
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <p className="admin-estadisticas-hint">No hay datos de ventas para el período seleccionado.</p>
          )}
          <p className="admin-estadisticas-hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Pedidos finalizados o entregados. Total en $ por {chartViewMode === 'year' ? 'año' : chartViewMode === 'month' ? 'mes' : 'día'}.
          </p>
        </section>

        <section className="admin-estadisticas-card admin-estadisticas-card--resumen admin-estadisticas-card--resumen-side">
          <h2 className="admin-estadisticas-card-title admin-estadisticas-card-title--accent">Ventas totales y costos</h2>
          <div className="admin-estadisticas-resumen-grid admin-estadisticas-resumen-grid--four">
            <div className="admin-estadisticas-kpi admin-estadisticas-kpi--block">
              <span className="admin-estadisticas-kpi-label">Total</span>
              <span className="admin-estadisticas-kpi-value admin-estadisticas-kpi-value--blue">{formatMoney(totalVentas)}</span>
            </div>
            <div className="admin-estadisticas-kpi admin-estadisticas-kpi--block">
              <span className="admin-estadisticas-kpi-label">Cantidad</span>
              <span className="admin-estadisticas-kpi-value">#{cantidadVentas}</span>
            </div>
            <div className="admin-estadisticas-kpi admin-estadisticas-kpi--block admin-estadisticas-kpi--with-popover" ref={popoverFor === 'total' ? popoverAnchorRef : null}>
              <span className="admin-estadisticas-kpi-label">Total costos producción</span>
              <span className="admin-estadisticas-kpi-value">{formatMoney(totalCostos)}</span>
              <button
                type="button"
                className="admin-estadisticas-popover-trigger"
                onClick={(e) => { e.stopPropagation(); setPopoverFor((p) => (p === 'total' ? null : 'total')); }}
                aria-label="Ver desglose del costo"
                title="Ver cálculo"
              >
                ℹ
              </button>
              {popoverFor === 'total' && (
                <CostoPopover
                  breakdown={null}
                  totalLabel="Suma del costo de producción de cada pedido. Cada pedido: Caja + PLA + Empaque (valores al finalizar)."
                  onClose={() => setPopoverFor(null)}
                  anchorRef={popoverAnchorRef}
                />
              )}
            </div>
            <div className="admin-estadisticas-kpi admin-estadisticas-kpi--block">
              <span className="admin-estadisticas-kpi-label">Balance (ingresos − gastos)</span>
              <span className={`admin-estadisticas-kpi-value ${balanceMovimientos >= 0 ? 'admin-estadisticas-kpi-value--orange' : 'admin-estadisticas-negativo'}`}>
                {formatMoney(balanceMovimientos)}
              </span>
            </div>
          </div>
        </section>
      </div>
      </>
      )}

      {/* Pestaña 1: Últimos movimientos (tabla) */}
      {activeTab === 1 && (
      <section className="admin-estadisticas-card admin-estadisticas-card--detalle">
        <h2 className="admin-estadisticas-card-title">Últimos movimientos</h2>
        <p className="admin-estadisticas-hint admin-estadisticas-hint--block">
          Ingresos (ventas) y gastos registrados en el período seleccionado. El ícono ℹ junto al costo muestra el desglose del pedido (caja, empaque, troqueles).
        </p>
        <p className="admin-estadisticas-balance-mov">
          Balance (ingresos − gastos):{' '}
          <span className={balanceMovimientos >= 0 ? 'admin-estadisticas-ganancia-positiva' : 'admin-estadisticas-negativo'}>
            {formatMoney(balanceMovimientos)}
          </span>
          <span className="admin-estadisticas-hint" style={{ display: 'block', marginTop: '0.25rem' }}>Incluye ventas y todos los gastos del período (Compras y gastos).</span>
        </p>
        <div className="admin-estadisticas-table-wrap">
          <table className="admin-estadisticas-tabla admin-estadisticas-tabla-movimientos">
            <thead>
              <tr>
                <th className="admin-estadisticas-th-left">Fecha</th>
                <th className="admin-estadisticas-th-left">Concepto</th>
                <th className="admin-estadisticas-th-center">Tipo</th>
                <th className="admin-estadisticas-th-num">Monto</th>
                <th className="admin-estadisticas-th-num">Costo prod.</th>
                <th className="admin-estadisticas-th-num">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) =>
                m.tipo === 'ingreso' ? (
                  <tr key={'i-' + m.order.id} className="admin-estadisticas-row-ingreso">
                    <td>{formatDate(m.date)}</td>
                    <td>
                      <span>{m.concept}</span>
                      {m.sub && <span className="admin-estadisticas-concept-sub"> — {m.sub}</span>}
                    </td>
                    <td className="admin-estadisticas-td-center"><span className="admin-estadisticas-tipo-badge admin-estadisticas-tipo-badge--ingreso">Ingreso</span></td>
                    <td className="admin-estadisticas-num">{formatMoney(m.amount)}</td>
                    <td className="admin-estadisticas-num admin-estadisticas-cell-costo" ref={popoverFor === m.order.id ? popoverAnchorRef : null}>
                      {formatMoney(m.order.costo_prod)}
                      <button
                        type="button"
                        className="admin-estadisticas-popover-trigger admin-estadisticas-popover-trigger--inline"
                        onClick={(e) => { e.stopPropagation(); setPopoverFor((p) => (p === m.order.id ? null : m.order.id)); }}
                        aria-label="Ver desglose del costo"
                        title="Ver cálculo"
                      >
                        ℹ
                      </button>
                    </td>
                    <td className={`admin-estadisticas-num ${(m.amount - (m.order.costo_prod || 0)) >= 0 ? 'admin-estadisticas-ganancia-positiva' : 'admin-estadisticas-negativo'}`}>
                      {formatMoney((m.amount || 0) - (m.order.costo_prod || 0))}
                    </td>
                  </tr>
                ) : (
                  <tr key={'g-' + (m.id ?? m.sortKey)} className="admin-estadisticas-row-gasto">
                    <td>{formatDate(m.date)}</td>
                    <td>{m.concept}</td>
                    <td className="admin-estadisticas-td-center"><span className="admin-estadisticas-tipo-badge admin-estadisticas-tipo-badge--gasto">Gasto</span></td>
                    <td className="admin-estadisticas-num admin-estadisticas-monto-gasto">{formatMoney(m.amount)}</td>
                    <td className="admin-estadisticas-num">—</td>
                    <td className="admin-estadisticas-num">—</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
        {error && <p className="client-data-error">{error}</p>}
        {!error && movimientos.length === 0 && !loading && (
          <p className="admin-estadisticas-empty">No hay movimientos en el período seleccionado.</p>
        )}
      </section>
      )}

      {/* Popover de costo en tabla: renderizado en portal para que no lo recorte el overflow */}
      {activeTab === 1 && isTablePopover && popoverPosition && orderForPopover &&
        createPortal(
          <div
            className="admin-estadisticas-popover-portal"
            style={{
              position: 'fixed',
              bottom: popoverPosition.bottom,
              left: popoverPosition.left,
              zIndex: 1050,
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
          document.body
        )}
    </div>
  );
};

export default AdminEstadisticas;
