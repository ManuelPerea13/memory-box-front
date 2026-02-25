import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../restclient/api';

const DEFAULT_ALIAS = 'manu.perea13';
const DEFAULT_TELEFONO = '+54 9 351 392 3790';
const DEFAULT_EMAIL = 'copiiworld@gmail.com';
const DEFAULT_PRICES = {
  price_mercadolibre: 35000,
  price_sin_luz: 24000,
  price_con_luz: 42000,
  price_pilas: 2500,
  transfer_alias: DEFAULT_ALIAS,
  transfer_bank: 'Mercado Pago',
  transfer_holder: 'Manuel Perea',
  contact_whatsapp: DEFAULT_TELEFONO,
  contact_email: DEFAULT_EMAIL,
  link_mercadolibre: 'https://mercadolibre.com',
};

const formatPrice = (n) => (n == null || n === '' ? '' : `$${Number(n).toLocaleString('es-AR')}`);

/** URLs que empiezan con /media/ se sirven desde el backend; el resto desde el mismo origen (front). */
const getMediaSrc = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/media/')) {
    const base = (api.baseUrl || '').replace(/\/$/, '');
    return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url;
  }
  return url;
};

const Home = () => {
  const [sinLuz, setSinLuz] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [background, setBackground] = useState({
    video_sin_luz: '',
    video_con_luz: '',
    audio_sin_luz: '',
    audio_con_luz: '',
  });
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    api.getPrices(false).then((data) => {
      if (data && typeof data === 'object') setPrices((prev) => ({ ...DEFAULT_PRICES, ...prev, ...data }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.getHomeBackground(false).then((data) => {
      if (data && typeof data === 'object') {
        setBackground({
          video_sin_luz: data.video_sin_luz ?? '',
          video_con_luz: data.video_con_luz ?? '',
          audio_sin_luz: data.audio_sin_luz ?? '',
          audio_con_luz: data.audio_con_luz ?? '',
        });
      }
    }).catch(() => {});
  }, []);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.play().then(() => setIsMuted(false)).catch(() => {});
    } else {
      audioRef.current.pause();
      setIsMuted(true);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      const raw = sinLuz ? background.audio_sin_luz : background.audio_con_luz;
      audioRef.current.src = getMediaSrc(raw) || raw;
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, [background.audio_sin_luz, background.audio_con_luz]);

  useEffect(() => {
    if (videoRef.current) {
      const rawV = sinLuz ? background.video_sin_luz : background.video_con_luz;
      videoRef.current.src = getMediaSrc(rawV) || rawV;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      const rawA = sinLuz ? background.audio_sin_luz : background.audio_con_luz;
      audioRef.current.src = getMediaSrc(rawA) || rawA;
      audioRef.current.load();
      if (wasPlaying || !isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [sinLuz, background.video_sin_luz, background.video_con_luz, background.audio_sin_luz, background.audio_con_luz]);

  useEffect(() => {
    const playOnInteraction = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsMuted(false)).catch(() => {});
      }
    };
    window.addEventListener('click', playOnInteraction, { once: true });
    return () => window.removeEventListener('click', playOnInteraction);
  }, []);

  const copiarAlias = () => {
    navigator.clipboard?.writeText(prices.transfer_alias || DEFAULT_ALIAS);
  };
  const alias = prices.transfer_alias || DEFAULT_ALIAS;
  const telefono = prices.contact_whatsapp || DEFAULT_TELEFONO;
  const email = prices.contact_email || DEFAULT_EMAIL;

  return (
    <div className="home-landing">
      <audio ref={audioRef} loop preload="auto">
        <source src={getMediaSrc(sinLuz ? background.audio_sin_luz : background.audio_con_luz)} type="audio/mpeg" />
      </audio>
      {/* Barra superior */}
      <header className="home-topbar">
        <div className="home-topbar-left">
          <span className="home-topbar-icon" aria-hidden>{sinLuz ? '📦' : '💡'}</span>
          <span className="home-topbar-label">{sinLuz ? 'Sin Luz' : 'Con Luz'}</span>
          <button
            type="button"
            className={`home-toggle ${!sinLuz ? 'on' : ''}`}
            onClick={() => setSinLuz(!sinLuz)}
            aria-label={sinLuz ? 'Sin luz' : 'Con luz'}
          >
            <span className="home-toggle-slider" />
          </button>
        </div>
      </header>

      {/* Botón mute */}
      <button
        type="button"
        className="home-audio-btn"
        onClick={toggleAudio}
        aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        title={isMuted ? 'Activar música' : 'Silenciar música'}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {/* Hero */}
      <section className="home-hero">
        <video
          ref={videoRef}
          className="home-hero-video"
          autoPlay
          loop
          muted
          playsInline
          src={getMediaSrc(sinLuz ? background.video_sin_luz : background.video_con_luz)}
        />
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <h1 className="home-hero-title">
            <span className="home-hero-title-icon" aria-hidden>{sinLuz ? '📦' : '💡'}</span>
            Cajita de la Memoria
          </h1>
          <p className="home-hero-subtitle">Cajas de fotos personalizadas</p>
          <div className="home-hero-buttons">
            <Link to="/cliente" className="btn btn-primary home-hero-btn-primary">
              <span aria-hidden>📦</span>
              Crear Mi Caja Personalizada
            </Link>
            <a href="#precios" className="btn btn-outline home-hero-btn-secondary">
              <span aria-hidden>💰</span>
              Ver Precios
            </a>
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="home-section home-features">
        <div className="home-features-grid">
          <div className="home-feature-card">
            <div className="home-feature-icon" aria-hidden>🎨</div>
            <h3>Variantes</h3>
            <p>Elige entre Grafito, Madera, Negro y Mármol. Cada variante ofrece un acabado único.</p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon" aria-hidden>✂️</div>
            <h3>Recorte Inteligente</h3>
            <p>Sistema de recorte automático que optimiza tus fotos para el formato perfecto de la caja.</p>
          </div>
          <div className="home-feature-card">
            <div className="home-feature-icon" aria-hidden>🖨️</div>
            <h3>Alta Calidad</h3>
            <p>Imágenes procesadas en la mejor calidad, listas para impresión profesional.</p>
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="home-section home-pricing">
        <h2 className="home-pricing-title">
          <span className="home-pricing-title-icon" aria-hidden>💰</span>
          Precios y Formas de Pago
        </h2>
        <div className="home-pricing-grid">
          <div className="home-pricing-card">
            <div className="home-pricing-icon" aria-hidden>💳</div>
            <h3>Mercado Libre</h3>
            <p className="home-pricing-price">{formatPrice(prices.price_mercadolibre)}</p>
            <p className="home-pricing-desc">Pago seguro con tarjeta de crédito, débito o efectivo a través de Mercado Libre.</p>
            <a href={prices.link_mercadolibre || 'https://mercadolibre.com'} target="_blank" rel="noopener noreferrer" className="btn btn-primary home-pricing-cta">Comprar en Mercado Libre</a>
          </div>

          <div className="home-pricing-card home-pricing-card-featured">
            <div className="home-pricing-icon" aria-hidden>💰</div>
            <h3>Cajita Sin Luz</h3>
            <p className="home-pricing-price">{formatPrice(prices.price_sin_luz)}</p>
            <span className="home-badge home-badge-green">Precio Directo</span>
            <p className="home-pricing-desc">Cajita tradicional sin iluminación. Pago directo por transferencia bancaria o en efectivo. Sin comisiones adicionales.</p>
            <div className="home-transfer">
              <p className="home-transfer-title">Datos para Transferencia:</p>
              <p><strong>Alias:</strong> {alias}</p>
              <p><strong>Banco:</strong> {prices.transfer_bank || 'Mercado Pago'}</p>
              <p><strong>Titular:</strong> {prices.transfer_holder || 'Manuel Perea'}</p>
              <p className="home-transfer-send">Enviar Comprobante:</p>
              <a href={`tel:${telefono.replace(/\s/g, '')}`} className="btn btn-green home-transfer-btn">{telefono}</a>
              <a href={`mailto:${email}`} className="btn btn-primary home-transfer-btn">{email}</a>
              <button type="button" onClick={copiarAlias} className="btn btn-secondary home-copy-alias">Copiar Alias</button>
            </div>
          </div>

          <div className="home-pricing-card">
            <div className="home-pricing-icon home-pricing-icon-bulb" aria-hidden>💡</div>
            <h3>Cajita Con Luz</h3>
            <p className="home-pricing-price">{formatPrice(prices.price_con_luz)}</p>
            <span className="home-badge home-badge-green">Nueva</span>
            <p className="home-pricing-desc">Cajita con iluminación LED. Incluye opción de pilas por {formatPrice(prices.price_pilas)} adicionales.</p>
            <div className="home-transfer">
              <p className="home-transfer-title">Datos para Transferencia:</p>
              <p><strong>Alias:</strong> {alias}</p>
              <p><strong>Banco:</strong> {prices.transfer_bank || 'Mercado Pago'}</p>
              <p><strong>Titular:</strong> {prices.transfer_holder || 'Manuel Perea'}</p>
              <p className="home-transfer-send">Enviar Comprobante:</p>
              <a href={`tel:${telefono.replace(/\s/g, '')}`} className="btn btn-green home-transfer-btn">{telefono}</a>
              <a href={`mailto:${email}`} className="btn btn-primary home-transfer-btn">{email}</a>
              <button type="button" onClick={copiarAlias} className="btn btn-secondary home-copy-alias">Copiar Alias</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <p>© 2025 Cajita de la Memoria - Cajas de fotos personalizadas</p>
        <a href="https://www.youtube.com/results?search_query=android+kiosk+mode" target="_blank" rel="noopener noreferrer">Android Kiosk Mode - YouTube</a>
      </footer>
    </div>
  );
};

export default Home;
