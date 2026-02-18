import React, { useState, useEffect } from 'react';
import api from '../../restclient/api';

const DEFAULT_PRICES = {
  price_mercadolibre: 35000,
  price_sin_luz: 24000,
  price_con_luz: 42000,
  price_pilas: 2500,
  deposit_amount: 12000,
  transfer_alias: 'manu.perea13',
  transfer_bank: 'Mercado Pago',
  transfer_holder: 'Manuel Perea',
  contact_whatsapp: '+54 9 351 392 3790',
  contact_email: 'copiiworld@gmail.com',
  link_mercadolibre: 'https://mercadolibre.com',
};

const AdminPrecios = () => {
  const [form, setForm] = useState(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .getPrices(true)
      .then((data) => {
        if (data && typeof data === 'object') {
          setForm((prev) => ({ ...DEFAULT_PRICES, ...prev, ...data }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    const numFields = [
      'price_mercadolibre',
      'price_sin_luz',
      'price_con_luz',
      'price_pilas',
      'deposit_amount',
    ];
    const v = numFields.includes(field) ? (value === '' ? '' : parseInt(value, 10)) : value;
    setForm((f) => ({ ...f, [field]: v }));
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      price_mercadolibre: form.price_mercadolibre,
      price_sin_luz: form.price_sin_luz,
      price_con_luz: form.price_con_luz,
      price_pilas: form.price_pilas,
      deposit_amount: form.deposit_amount,
      transfer_alias: form.transfer_alias,
      transfer_bank: form.transfer_bank,
      transfer_holder: form.transfer_holder,
      contact_whatsapp: form.contact_whatsapp,
      contact_email: form.contact_email,
      link_mercadolibre: form.link_mercadolibre || '',
    };
    setSaving(true);
    try {
      await api.updatePrices(payload);
      setMessage('Precios y datos guardados correctamente.');
    } catch (err) {
      setError(err?.data?.detail || err?.message || 'Error al guardar. ¿El backend tiene el endpoint api/settings/prices/?');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-stock-page">
        <header className="admin-page-header">
          <h1>Precios</h1>
          <p>Cargando...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-stock-page">
      <header className="admin-page-header">
        <h1>Precios y datos de pago</h1>
        <p>Precios de productos, monto de la seña, datos para transferencia y contacto. Se muestran en la home y en el modal de pedido confirmado.</p>
      </header>

      <form onSubmit={handleSubmit} className="client-data-card admin-precios-card">
        <h2 className="admin-precios-section-title">Precios de productos</h2>
        <div className="admin-precios-grid">
          <div className="client-data-form-group">
            <label htmlFor="price_mercadolibre">Mercado Libre ($)</label>
            <input
              id="price_mercadolibre"
              type="number"
              min="0"
              value={form.price_mercadolibre === '' ? '' : form.price_mercadolibre}
              onChange={(e) => handleChange('price_mercadolibre', e.target.value)}
              className="admin-precios-input"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="price_sin_luz">Cajita Sin Luz ($)</label>
            <input
              id="price_sin_luz"
              type="number"
              min="0"
              value={form.price_sin_luz === '' ? '' : form.price_sin_luz}
              onChange={(e) => handleChange('price_sin_luz', e.target.value)}
              className="admin-precios-input"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="price_con_luz">Cajita Con Luz ($)</label>
            <input
              id="price_con_luz"
              type="number"
              min="0"
              value={form.price_con_luz === '' ? '' : form.price_con_luz}
              onChange={(e) => handleChange('price_con_luz', e.target.value)}
              className="admin-precios-input"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="price_pilas">Pilas adicionales ($)</label>
            <input
              id="price_pilas"
              type="number"
              min="0"
              value={form.price_pilas === '' ? '' : form.price_pilas}
              onChange={(e) => handleChange('price_pilas', e.target.value)}
              className="admin-precios-input"
            />
          </div>
        </div>

        <h2 className="admin-precios-section-title">Seña (depósito)</h2>
        <div className="admin-precios-grid admin-precios-grid--short">
          <div className="client-data-form-group">
            <label htmlFor="deposit_amount">Monto de la seña ($)</label>
            <input
              id="deposit_amount"
              type="number"
              min="0"
              value={form.deposit_amount === '' ? '' : form.deposit_amount}
              onChange={(e) => handleChange('deposit_amount', e.target.value)}
              className="admin-precios-input"
            />
          </div>
        </div>

        <h2 className="admin-precios-section-title">Datos para transferencia</h2>
        <div className="admin-precios-grid">
          <div className="client-data-form-group">
            <label htmlFor="transfer_alias">Alias</label>
            <input
              id="transfer_alias"
              type="text"
              value={form.transfer_alias}
              onChange={(e) => handleChange('transfer_alias', e.target.value)}
              className="admin-precios-input"
              placeholder="ej: manu.perea13"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="transfer_bank">Banco</label>
            <input
              id="transfer_bank"
              type="text"
              value={form.transfer_bank}
              onChange={(e) => handleChange('transfer_bank', e.target.value)}
              className="admin-precios-input"
              placeholder="ej: Mercado Pago"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="transfer_holder">Titular</label>
            <input
              id="transfer_holder"
              type="text"
              value={form.transfer_holder}
              onChange={(e) => handleChange('transfer_holder', e.target.value)}
              className="admin-precios-input"
              placeholder="Nombre del titular"
            />
          </div>
        </div>

        <h2 className="admin-precios-section-title">Contacto (comprobantes)</h2>
        <div className="admin-precios-grid">
          <div className="client-data-form-group">
            <label htmlFor="contact_whatsapp">WhatsApp</label>
            <input
              id="contact_whatsapp"
              type="text"
              value={form.contact_whatsapp}
              onChange={(e) => handleChange('contact_whatsapp', e.target.value)}
              className="admin-precios-input"
              placeholder="+54 9 351 392 3790"
            />
          </div>
          <div className="client-data-form-group">
            <label htmlFor="contact_email">Email</label>
            <input
              id="contact_email"
              type="email"
              value={form.contact_email}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              className="admin-precios-input"
              placeholder="correo@ejemplo.com"
            />
          </div>
        </div>

        <h2 className="admin-precios-section-title">Enlaces</h2>
        <div className="admin-precios-grid admin-precios-grid--short">
          <div className="client-data-form-group">
            <label htmlFor="link_mercadolibre">URL Mercado Libre</label>
            <input
              id="link_mercadolibre"
              type="url"
              value={form.link_mercadolibre}
              onChange={(e) => handleChange('link_mercadolibre', e.target.value)}
              className="admin-precios-input"
              placeholder="https://mercadolibre.com"
            />
          </div>
        </div>

        {error && <p className="client-data-error">{error}</p>}
        {message && <p className="admin-precios-message">{message}</p>}
        <div className="admin-precios-submit">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar precios y datos'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminPrecios;
