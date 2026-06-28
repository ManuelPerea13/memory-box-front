"use client";

import { useEffect, useState } from "react";
import { Plus, Minus } from "lucide-react";
import api from "@/lib/api";
import type { BoxVariant, Purchase } from "@/types";

interface Componente {
  nombre: string;
  valor: number | "";
}

interface CostosForm {
  cost_con_luz_componentes: Componente[];
  variant_grams: Record<string, unknown>;
  grams_caja_sin_luz: number | "";
  cost_troqueles_por_cajita: number | "";
}

interface PurchaseForm {
  category: string;
  date: string;
  quantity: number | "";
  unit_cost: string;
  total_cost: string;
  days: string;
}

interface PLAForm {
  variante: string;
  marca: string;
  cost: string;
  quantity: number | "";
}

type ApiErrorLike = { data?: { detail?: string }; message?: string };

const DEFAULT_COMPONENTES_CON_LUZ: Componente[] = [
  { nombre: "Caja base", valor: 0 },
  { nombre: "Tira LED / luz", valor: 0 },
  { nombre: "Pilas", valor: 0 },
  { nombre: "Cable", valor: 0 },
];

const DEFAULT_COSTOS: CostosForm = {
  cost_con_luz_componentes: DEFAULT_COMPONENTES_CON_LUZ,
  variant_grams: {},
  grams_caja_sin_luz: "",
  cost_troqueles_por_cajita: 0,
};

/** Deriva un único valor de gramos desde API (grams_caja_sin_luz o variant_grams si todos son iguales). */
const parseGramsSinLuz = (data: Record<string, unknown> | null | undefined): number | "" => {
  const gsl = data?.grams_caja_sin_luz;
  if (gsl !== undefined && gsl !== null && gsl !== "") return Number(gsl);
  const vg = data?.variant_grams;
  if (vg && typeof vg === "object") {
    const vals = Object.values(vg as Record<string, unknown>).filter(
      (v) => v !== "" && v !== undefined && v !== null,
    );
    if (vals.length > 0 && vals.every((v) => Number(v) === Number(vals[0]))) return Number(vals[0]);
    if (vals.length > 0) return Number(vals[0]);
  }
  return "";
};

const parseCostData = (data: unknown): CostosForm => {
  if (!data || typeof data !== "object") return { ...DEFAULT_COSTOS };
  const d = data as Record<string, unknown>;
  const rawComp = d.cost_con_luz_componentes;
  const componentes: Componente[] = Array.isArray(rawComp)
    ? rawComp.map((raw) => {
        const c = raw as Record<string, unknown>;
        const valor = c.valor ?? c.value;
        return {
          nombre: (c.nombre as string) || (c.name as string) || "",
          valor: typeof valor === "number" ? valor : 0,
        };
      })
    : [...DEFAULT_COMPONENTES_CON_LUZ];
  if (componentes.length === 0) componentes.push({ nombre: "", valor: 0 });
  const variant_grams =
    d.variant_grams && typeof d.variant_grams === "object"
      ? (d.variant_grams as Record<string, unknown>)
      : {};
  return {
    cost_con_luz_componentes: componentes,
    variant_grams,
    grams_caja_sin_luz: parseGramsSinLuz(d),
    cost_troqueles_por_cajita: Number(d.cost_troqueles_por_cajita) || 0,
  };
};

const PURCHASE_CATEGORIES = [
  { value: "burbujas", label: "Rollo burbujas" },
  { value: "caja_carton", label: "Caja cartón envío" },
  { value: "bolsa_ecommerce", label: "Bolsa ecommerce" },
  { value: "publicidad_instagram", label: "Publicidad Instagram" },
  { value: "pla_roll", label: "Rollo PLA" },
];

/** Mapeo category → label para mostrar en tabla de compras cuando no viene category_display. */
const CATEGORY_DISPLAY_LABELS: Record<string, string> = Object.fromEntries(
  PURCHASE_CATEGORIES.map((c) => [c.value, c.label]),
);

const COSTOS_TABS = [
  { id: 0, label: "Compras y gastos" },
  { id: 1, label: "Costos de referencia" },
];

const PLA_MARCAS = [
  { value: "Hellbot", label: "Hellbot" },
  { value: "Bambulab", label: "Bambulab" },
];

const GRAMOS_POR_ROLLO = 1000;

/** Purchase con campos extra que puede traer el backend (category_display, variante/marca legacy). */
type PurchaseRow = Purchase & {
  category_display?: string;
  variante?: string;
  marca?: string;
};

const errMsg = (err: unknown, fallback: string): string => {
  const e = err as ApiErrorLike;
  return e?.data?.detail || e?.message || fallback;
};

export default function AdminCostos() {
  const [form, setForm] = useState<CostosForm>(() => ({ ...DEFAULT_COSTOS }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [plaRolls, setPLARolls] = useState<PurchaseRow[]>([]);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
    category: "burbujas",
    date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    unit_cost: "",
    total_cost: "",
    days: "",
  });
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [savingPLA, setSavingPLA] = useState(false);
  const [plaForm, setPLAForm] = useState<PLAForm>({ variante: "", marca: "", cost: "", quantity: 1 });
  const [variants, setVariants] = useState<BoxVariant[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  const loadPLARolls = () =>
    api
      .getPurchases()
      .then((data) => {
        const list = (Array.isArray(data) ? data : []) as PurchaseRow[];
        setPLARolls(list.filter((p) => p.category === "pla_roll"));
      })
      .catch(() => setPLARolls([]));
  const loadVariants = () =>
    api
      .getVariants()
      .then((data) => setVariants((Array.isArray(data) ? data : []) as BoxVariant[]))
      .catch(() => setVariants([]));
  const loadPurchases = () =>
    api
      .getPurchases()
      .then((data) => setPurchases((Array.isArray(data) ? data : []) as PurchaseRow[]))
      .catch(() => setPurchases([]));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getCosts().then((data) => (cancelled ? null : setForm(parseCostData(data)))),
      loadPLARolls().then(() => {}),
      loadVariants(),
      loadPurchases(),
    ])
      .catch(() => {
        if (!cancelled) setForm((f) => ({ ...f, ...DEFAULT_COSTOS }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field: "grams_caja_sin_luz" | "cost_troqueles_por_cajita", value: string) => {
    const v: number | "" =
      value === ""
        ? ""
        : field === "grams_caja_sin_luz"
          ? Math.max(0, Number(value))
          : Number(value);
    setForm((f) => ({ ...f, [field]: v }));
    setError("");
    setMessage("");
  };

  const setComponente = (index: number, field: "nombre" | "valor", value: string) => {
    setForm((f) => {
      const comp = [...(f.cost_con_luz_componentes || [])];
      if (!comp[index]) comp[index] = { nombre: "", valor: 0 };
      comp[index] = {
        ...comp[index],
        [field]: field === "valor" ? (value === "" ? "" : Number(value)) : value,
      };
      return { ...f, cost_con_luz_componentes: comp };
    });
    setError("");
    setMessage("");
  };

  const addComponente = () => {
    setForm((f) => ({
      ...f,
      cost_con_luz_componentes: [...(f.cost_con_luz_componentes || []), { nombre: "", valor: 0 }],
    }));
  };

  const removeComponente = (index: number) => {
    setForm((f) => {
      const comp = [...(f.cost_con_luz_componentes || [])];
      if (comp.length <= 1) return f;
      comp.splice(index, 1);
      return { ...f, cost_con_luz_componentes: comp };
    });
  };

  const totalConLuz = (form.cost_con_luz_componentes || []).reduce(
    (acc, c) => acc + (typeof c.valor === "number" ? c.valor : Number(c.valor) || 0),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const grams = 63;
    const variant_grams: Record<string, number> =
      variants.length > 0
        ? Object.fromEntries(
            variants.map((v) => [v.name || v.code || `Variante ${v.id}`, grams]),
          )
        : {};
    const payload = {
      cost_con_luz_componentes: (form.cost_con_luz_componentes || []).map((c) => ({
        nombre: c.nombre || "Componente",
        valor: c.valor === "" ? 0 : Number(c.valor),
      })),
      variant_grams,
      grams_caja_sin_luz: grams,
      cost_troqueles_por_cajita:
        form.cost_troqueles_por_cajita === "" ? 0 : Number(form.cost_troqueles_por_cajita),
    };
    setSaving(true);
    try {
      await api.updateCosts(payload);
      setMessage("Costos guardados correctamente.");
    } catch (err) {
      setError(
        errMsg(err, "Error al guardar. ¿El backend tiene el endpoint api/settings/costs/?"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePLAAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plaForm.variante.trim() || !plaForm.marca.trim()) return;
    const qty = Math.max(1, Number(plaForm.quantity) || 1);
    const costPerRoll = plaForm.cost === "" ? 0 : Number(plaForm.cost);
    const totalCost = costPerRoll * qty;
    const gramsPerRoll = GRAMOS_POR_ROLLO;
    setError("");
    setSavingPLA(true);
    try {
      await api.createPurchase({
        category: "pla_roll",
        date: new Date().toISOString().slice(0, 10),
        quantity: qty,
        total_cost: totalCost,
        variant: plaForm.variante.trim(),
        brand: plaForm.marca.trim(),
        grams_per_roll: gramsPerRoll,
      });
      setPLAForm({ variante: "", marca: "", cost: "", quantity: 1 });
      loadPLARolls();
      loadPurchases();
    } catch (err) {
      setError(errMsg(err, "Error al guardar rollo PLA."));
    } finally {
      setSavingPLA(false);
    }
  };

  const handlePurchaseOrPLASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.category === "pla_roll") {
      handlePLAAdd(e);
      return;
    }
    setError("");
    setMessage("");
    const qty = Number(purchaseForm.quantity) || 1;
    const total =
      purchaseForm.total_cost !== ""
        ? Number(purchaseForm.total_cost)
        : purchaseForm.unit_cost !== ""
          ? Number(purchaseForm.unit_cost) * qty
          : 0;
    const payload = {
      category: purchaseForm.category,
      date: purchaseForm.date,
      quantity: qty,
      unit_cost: purchaseForm.unit_cost === "" ? null : Number(purchaseForm.unit_cost),
      total_cost: total,
      days: purchaseForm.days === "" ? null : Number(purchaseForm.days),
    };
    setSavingPurchase(true);
    try {
      await api.createPurchase(payload);
      setMessage(
        "Compra registrada. Si era caja o bolsa, se sumó al stock (ver Stock → Stock de packaging).",
      );
      setPurchaseForm((f) => ({ ...f, quantity: 1, unit_cost: "", total_cost: "", days: "" }));
      loadPurchases();
    } catch (err) {
      setError(errMsg(err, "Error al registrar compra."));
    } finally {
      setSavingPurchase(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-mb-ink">Costos</h1>
          <p className="mt-1 text-sm text-mb-gray">Cargando...</p>
        </header>
      </div>
    );
  }

  const num = (v: number | "") => (v === "" ? "" : v);

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-mb-ink">Costos</h1>
        <p className="mt-1 text-sm text-mb-gray">
          Registro de compras y gastos, costos PLA por variante y marca, y costos de referencia. El
          stock de packaging se gestiona en Stock.
        </p>
      </header>

      <div className="mb-6 flex gap-2 border-b border-mb-border">
        {COSTOS_TABS.map((tab) => (
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

      {error && <p className="mb-4 text-sm font-medium text-mb-red">{error}</p>}
      {message && <p className="mb-4 text-sm font-medium text-mb-green">{message}</p>}

      {/* Pestaña 0: Compras y gastos */}
      {activeTab === 0 && (
        <>
          <form onSubmit={handlePurchaseOrPLASubmit} className="mm-card mb-6 p-6">
            <h2 className="mb-2 font-heading text-lg font-bold text-mb-ink">
              Registrar compra o gasto
            </h2>
            <p className="mb-4 text-sm text-mb-gray">
              Los gastos varían por compra. Si registrás cajas de cartón o bolsas ecommerce, la
              cantidad se suma al stock de packaging. El <strong>costo unitario</strong> (total de la
              compra ÷ cantidad) se usa en el costo de producción de cada pedido: por ejemplo 100
              cajas a $67.000 → $670 por caja, incluido en &quot;Empaque&quot; al finalizar.
            </p>
            <div className="mb-4">
              <label className="mm-label">Categoría</label>
              <select
                value={purchaseForm.category}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, category: e.target.value }))}
                className="mm-input"
              >
                {PURCHASE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {purchaseForm.category === "pla_roll" ? (
              <div>
                <p className="mb-3 text-sm text-mb-gray">
                  Costo por gramo = (costo total ÷ cantidad de rollos) ÷ gramos por rollo. Se usa el
                  registro más reciente por variante para el costo de producción.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mm-label">Variante</label>
                    <select
                      value={plaForm.variante}
                      onChange={(e) => setPLAForm((f) => ({ ...f, variante: e.target.value }))}
                      className="mm-input"
                    >
                      <option value="">Elegir variante</option>
                      {variants.map((v) => (
                        <option key={v.id} value={v.name || v.code || ""}>
                          {v.name || v.code || `Variante ${v.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mm-label">Marca</label>
                    <select
                      value={plaForm.marca}
                      onChange={(e) => setPLAForm((f) => ({ ...f, marca: e.target.value }))}
                      className="mm-input"
                    >
                      <option value="">Elegir marca</option>
                      {PLA_MARCAS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mm-label">Cant. rollos</label>
                    <input
                      type="number"
                      min="1"
                      value={plaForm.quantity === "" ? "" : plaForm.quantity}
                      onChange={(e) =>
                        setPLAForm((f) => ({
                          ...f,
                          quantity:
                            e.target.value === ""
                              ? ""
                              : Math.max(1, parseInt(e.target.value, 10) || 1),
                        }))
                      }
                      className="mm-input"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="mm-label">Costo por rollo ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Precio unitario del rollo"
                      value={plaForm.cost}
                      onChange={(e) => setPLAForm((f) => ({ ...f, cost: e.target.value }))}
                      className="mm-input"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="submit"
                    className="mm-btn mm-btn-primary"
                    disabled={savingPLA || !plaForm.variante.trim() || !plaForm.marca.trim()}
                  >
                    {savingPLA ? "Agregando..." : "Agregar rollo PLA"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mm-label">Fecha</label>
                    <input
                      type="date"
                      value={purchaseForm.date}
                      onChange={(e) => setPurchaseForm((f) => ({ ...f, date: e.target.value }))}
                      className="mm-input"
                    />
                  </div>
                  <div>
                    <label className="mm-label">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={purchaseForm.quantity}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({
                          ...f,
                          quantity: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                      className="mm-input"
                    />
                  </div>
                  {purchaseForm.category !== "caja_carton" &&
                    purchaseForm.category !== "bolsa_ecommerce" && (
                      <div>
                        <label className="mm-label">Costo unitario ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseForm.unit_cost}
                          onChange={(e) =>
                            setPurchaseForm((f) => ({ ...f, unit_cost: e.target.value }))
                          }
                          className="mm-input"
                          placeholder="opcional"
                        />
                      </div>
                    )}
                  <div>
                    <label className="mm-label">Costo total ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchaseForm.total_cost}
                      onChange={(e) =>
                        setPurchaseForm((f) => ({ ...f, total_cost: e.target.value }))
                      }
                      className="mm-input"
                      placeholder={
                        purchaseForm.category === "caja_carton" ||
                        purchaseForm.category === "bolsa_ecommerce"
                          ? "obligatorio"
                          : "obligatorio si no hay unitario"
                      }
                    />
                  </div>
                  {purchaseForm.category === "publicidad_instagram" && (
                    <div>
                      <label className="mm-label">Días (ej. período publicidad)</label>
                      <input
                        type="number"
                        min="0"
                        value={purchaseForm.days}
                        onChange={(e) =>
                          setPurchaseForm((f) => ({ ...f, days: e.target.value }))
                        }
                        className="mm-input"
                        placeholder="opcional"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <button type="submit" className="mm-btn mm-btn-primary" disabled={savingPurchase}>
                    {savingPurchase ? "Registrando..." : "Registrar compra"}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="mm-card p-6">
            <h2 className="mb-4 font-heading text-lg font-bold text-mb-ink">
              Últimos gastos registrados
            </h2>
            {purchases.length === 0 ? (
              <p className="text-sm text-mb-gray">Aún no hay gastos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="mm-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th className="text-right">Cantidad</th>
                      <th className="text-right">Costo total</th>
                      <th className="text-right">Costo unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.slice(0, 25).map((p) => {
                      const total = Number(p.total_cost) || 0;
                      const qty = Number(p.quantity) || 1;
                      const unit =
                        p.unit_cost != null && (p.unit_cost as unknown) !== ""
                          ? Number(p.unit_cost)
                          : qty > 0
                            ? total / qty
                            : 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            {p.date
                              ? new Date(p.date + "T12:00:00").toLocaleDateString("es-AR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td>
                            {p.category_display ||
                              CATEGORY_DISPLAY_LABELS[p.category] ||
                              p.category ||
                              "—"}
                          </td>
                          <td className="text-right">{qty}</td>
                          <td className="text-right">
                            ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="text-right">
                            ${unit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Pestaña 1: Costos de referencia */}
      {activeTab === 1 && (
        <form onSubmit={handleSubmit} className="mm-card p-6">
          <h2 className="font-heading text-xl font-bold text-mb-ink">Costos de referencia</h2>
          <p className="mb-6 mt-1 text-sm text-mb-gray">
            Valores de referencia (cajita sin luz y componentes con luz). No se descuentan solos;
            usalos para cálculos.
          </p>

          <section className="mb-6 rounded-lg border border-mb-border p-4" aria-labelledby="costos-sin-luz-title">
            <h3 id="costos-sin-luz-title" className="flex items-center gap-2 font-semibold text-mb-ink">
              <span className="mm-badge bg-mb-gray-light text-mb-gray" aria-hidden>
                Sin luz
              </span>
              Cajita sin luz
            </h3>
            <h4 className="mt-3 font-medium text-mb-ink">Caja base</h4>
            <p className="mt-1 text-sm text-mb-gray">
              Se calcula con <strong>63 g</strong> × (precio del rollo PLA ÷ 1000) según el color de
              la variante. El precio sale de los rollos PLA cargados en{" "}
              <strong>Compras y gastos → Rollo PLA</strong>.
            </p>
            {plaRolls.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm text-mb-gray">
                  Costos de referencia (Caja base) según rollos PLA cargados (costo por gramo × 63
                  g):
                </p>
                <ul className="flex flex-col gap-2">
                  {plaRolls.map((r) => {
                    const total = Number(r.total_cost) || 0;
                    const qty = Math.max(1, Number(r.quantity) || 1);
                    const grams = Math.max(1, Number(r.grams_per_roll) || 1000);
                    const costPerGram = total / qty / grams;
                    const costoCajaBase = Math.ceil(costPerGram * 63);
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-md border border-mb-border bg-mb-gray-light px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-mb-ink">
                          {r.variant || r.variante || "—"}
                        </span>
                        <span className="text-mb-gray">{r.brand || r.marca || "—"}</span>
                        <strong className="ml-auto text-mb-ink">
                          ${costoCajaBase.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-mb-gray">
                Cargá rollos PLA en Compras y gastos para ver los costos de referencia.
              </p>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-mb-border p-4" aria-labelledby="costos-con-luz-title">
            <h3 id="costos-con-luz-title" className="flex items-center gap-2 font-semibold text-mb-ink">
              <span className="mm-badge bg-mb-amber/15 text-mb-amber" aria-hidden>
                Con luz
              </span>
              Cajita con luz — componentes
            </h3>
            <p className="mt-1 text-sm text-mb-gray">
              Desglose de costos de los componentes que llevan las cajitas con luz.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {(form.cost_con_luz_componentes || []).map((c, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del componente"
                    value={c.nombre}
                    onChange={(e) => setComponente(index, "nombre", e.target.value)}
                    className="mm-input flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={c.valor === "" ? "" : c.valor}
                    onChange={(e) => setComponente(index, "valor", e.target.value)}
                    className="mm-input w-32"
                  />
                  <button
                    type="button"
                    className="mm-btn mm-btn-outline px-3"
                    onClick={() => removeComponente(index)}
                    disabled={(form.cost_con_luz_componentes || []).length <= 1}
                    aria-label="Quitar componente"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mm-btn mm-btn-outline self-start"
                onClick={addComponente}
              >
                <Plus className="size-4" aria-hidden /> Agregar componente
              </button>
              <p className="text-sm text-mb-ink">
                Total caja con luz (suma componentes): <strong>${totalConLuz.toFixed(2)}</strong>
              </p>
            </div>
          </section>

          <section className="mb-6 rounded-lg border border-mb-border p-4" aria-labelledby="costos-troqueles-title">
            <h3 id="costos-troqueles-title" className="flex items-center gap-2 font-semibold text-mb-ink">
              <span className="mm-badge bg-mb-blue-light text-mb-blue-dark" aria-hidden>
                Troqueles
              </span>
              Troqueles (imágenes)
            </h3>
            <p className="mt-1 text-sm text-mb-gray">
              Costo fijo por cajita. Se aplica a cada unidad producida.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cost_troqueles_por_cajita" className="mm-label">
                  Costo fijo por cajita ($)
                </label>
                <input
                  id="cost_troqueles_por_cajita"
                  type="number"
                  min="0"
                  step="0.01"
                  value={num(form.cost_troqueles_por_cajita)}
                  onChange={(e) => handleChange("cost_troqueles_por_cajita", e.target.value)}
                  className="mm-input"
                />
              </div>
            </div>
          </section>

          {error && <p className="mb-4 text-sm font-medium text-mb-red">{error}</p>}
          {message && <p className="mb-4 text-sm font-medium text-mb-green">{message}</p>}
          <div>
            <button type="submit" className="mm-btn mm-btn-primary" disabled={saving}>
              {saving ? "Guardando..." : "Guardar costos"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
