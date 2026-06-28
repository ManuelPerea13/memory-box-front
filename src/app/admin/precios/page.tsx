"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

interface PricesForm {
  price_mercadolibre: number | "";
  price_sin_luz: number | "";
  price_con_luz: number | "";
  price_pilas: number | "";
  transfer_alias: string;
  transfer_bank: string;
  transfer_holder: string;
  contact_whatsapp: string;
  contact_email: string;
  link_mercadolibre: string;
}

const DEFAULT_PRICES: PricesForm = {
  price_mercadolibre: 35000,
  price_sin_luz: 24000,
  price_con_luz: 42000,
  price_pilas: 2500,
  transfer_alias: "manu.perea13",
  transfer_bank: "Mercado Pago",
  transfer_holder: "Manuel Perea",
  contact_whatsapp: "+54 9 351 392 3790",
  contact_email: "copiiworld@gmail.com",
  link_mercadolibre: "https://mercadolibre.com",
};

const NUM_FIELDS: (keyof PricesForm)[] = [
  "price_mercadolibre",
  "price_sin_luz",
  "price_con_luz",
  "price_pilas",
];

export default function AdminPreciosPage() {
  const [form, setForm] = useState<PricesForm>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .getPrices(true)
      .then((data) => {
        if (data && typeof data === "object") {
          setForm((prev) => ({
            ...DEFAULT_PRICES,
            ...prev,
            ...(data as Partial<PricesForm>),
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof PricesForm, value: string) => {
    const isNum = NUM_FIELDS.includes(field);
    const v: number | "" | string = isNum
      ? value === ""
        ? ""
        : parseInt(value, 10)
      : value;
    setForm((f) => ({ ...f, [field]: v }));
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      price_mercadolibre: form.price_mercadolibre,
      price_sin_luz: form.price_sin_luz,
      price_con_luz: form.price_con_luz,
      price_pilas: form.price_pilas,
      transfer_alias: form.transfer_alias,
      transfer_bank: form.transfer_bank,
      transfer_holder: form.transfer_holder,
      contact_whatsapp: form.contact_whatsapp,
      contact_email: form.contact_email,
      link_mercadolibre: form.link_mercadolibre || "",
    };
    setSaving(true);
    try {
      await api.updatePrices(payload);
      setMessage("Precios y datos guardados correctamente.");
    } catch (err) {
      const e = err as { data?: { detail?: string }; message?: string };
      setError(
        e?.data?.detail ||
          e?.message ||
          "Error al guardar. ¿El backend tiene el endpoint api/settings/prices/?",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-up">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-mb-ink">Precios</h1>
          <p className="text-mb-gray">Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-mb-ink">Precios y datos de pago</h1>
        <p className="text-mb-gray">
          Precios de productos, datos para transferencia y contacto. La seña se
          calcula: con luz (Cajita Con Luz + Pilas) / 2, sin luz la mitad del
          precio Sin Luz.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mm-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-mb-ink">
          Precios de productos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price_mercadolibre" className="mm-label">
              Mercado Libre ($)
            </label>
            <input
              id="price_mercadolibre"
              type="number"
              min="0"
              value={form.price_mercadolibre}
              onChange={(e) => handleChange("price_mercadolibre", e.target.value)}
              className="mm-input"
            />
          </div>
          <div>
            <label htmlFor="price_sin_luz" className="mm-label">
              Cajita Sin Luz ($)
            </label>
            <input
              id="price_sin_luz"
              type="number"
              min="0"
              value={form.price_sin_luz}
              onChange={(e) => handleChange("price_sin_luz", e.target.value)}
              className="mm-input"
            />
          </div>
          <div>
            <label htmlFor="price_con_luz" className="mm-label">
              Cajita Con Luz ($)
            </label>
            <input
              id="price_con_luz"
              type="number"
              min="0"
              value={form.price_con_luz}
              onChange={(e) => handleChange("price_con_luz", e.target.value)}
              className="mm-input"
            />
          </div>
          <div>
            <label htmlFor="price_pilas" className="mm-label">
              Pilas adicionales ($)
            </label>
            <input
              id="price_pilas"
              type="number"
              min="0"
              value={form.price_pilas}
              onChange={(e) => handleChange("price_pilas", e.target.value)}
              className="mm-input"
            />
          </div>
        </div>

        <h2 className="mb-4 mt-8 text-lg font-semibold text-mb-ink">
          Datos para transferencia
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="transfer_alias" className="mm-label">
              Alias
            </label>
            <input
              id="transfer_alias"
              type="text"
              value={form.transfer_alias}
              onChange={(e) => handleChange("transfer_alias", e.target.value)}
              className="mm-input"
              placeholder="ej: manu.perea13"
            />
          </div>
          <div>
            <label htmlFor="transfer_bank" className="mm-label">
              Banco
            </label>
            <input
              id="transfer_bank"
              type="text"
              value={form.transfer_bank}
              onChange={(e) => handleChange("transfer_bank", e.target.value)}
              className="mm-input"
              placeholder="ej: Mercado Pago"
            />
          </div>
          <div>
            <label htmlFor="transfer_holder" className="mm-label">
              Titular
            </label>
            <input
              id="transfer_holder"
              type="text"
              value={form.transfer_holder}
              onChange={(e) => handleChange("transfer_holder", e.target.value)}
              className="mm-input"
              placeholder="Nombre del titular"
            />
          </div>
        </div>

        <h2 className="mb-4 mt-8 text-lg font-semibold text-mb-ink">
          Contacto (comprobantes)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contact_whatsapp" className="mm-label">
              WhatsApp
            </label>
            <input
              id="contact_whatsapp"
              type="text"
              value={form.contact_whatsapp}
              onChange={(e) => handleChange("contact_whatsapp", e.target.value)}
              className="mm-input"
              placeholder="+54 9 351 392 3790"
            />
          </div>
          <div>
            <label htmlFor="contact_email" className="mm-label">
              Email
            </label>
            <input
              id="contact_email"
              type="email"
              value={form.contact_email}
              onChange={(e) => handleChange("contact_email", e.target.value)}
              className="mm-input"
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        <h2 className="mb-4 mt-8 text-lg font-semibold text-mb-ink">Enlaces</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="link_mercadolibre" className="mm-label">
              URL Mercado Libre
            </label>
            <input
              id="link_mercadolibre"
              type="url"
              value={form.link_mercadolibre}
              onChange={(e) => handleChange("link_mercadolibre", e.target.value)}
              className="mm-input"
              placeholder="https://mercadolibre.com"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-mb-red">{error}</p>}
        {message && <p className="mt-4 text-sm text-mb-green">{message}</p>}
        <div className="mt-6">
          <button
            type="submit"
            className="mm-btn mm-btn-primary"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar precios y datos"}
          </button>
        </div>
      </form>
    </div>
  );
}
