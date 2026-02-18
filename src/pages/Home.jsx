import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ALIAS = 'manu.perea13';
const TELEFONO = '+54 9 351 392 3790';
const EMAIL = 'copiiworld@gmail.com';

const VIDEO_SIN_LUZ = '/static/videos/video-navidad.mp4';
const VIDEO_CON_LUZ = '/static/videos/background-video-2.mp4';
const AUDIO_SIN_LUZ = '/static/audio/cancion-navidad.mp3';
const AUDIO_CON_LUZ = '/static/audio/background-music-2.mp3';

const Home = () => {
  const [sinLuz, setSinLuz] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

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
      audioRef.current.src = sinLuz ? AUDIO_SIN_LUZ : AUDIO_CON_LUZ;
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = sinLuz ? VIDEO_SIN_LUZ : VIDEO_CON_LUZ;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      audioRef.current.src = sinLuz ? AUDIO_SIN_LUZ : AUDIO_CON_LUZ;
      audioRef.current.load();
      if (wasPlaying || !isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [sinLuz]);

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
    navigator.clipboard?.writeText(ALIAS);
  };

  return (
    <div className="home-landing">
      <audio ref={audioRef} loop preload="auto">
        <source src={sinLuz ? AUDIO_SIN_LUZ : AUDIO_CON_LUZ} type="audio/mpeg" />
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
          src={sinLuz ? VIDEO_SIN_LUZ : VIDEO_CON_LUZ}
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
            <p className="home-pricing-price">$35.000</p>
            <p className="home-pricing-desc">Pago seguro con tarjeta de crédito, débito o efectivo a través de Mercado Libre.</p>
            <a href="https://mercadolibre.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary home-pricing-cta">Comprar en Mercado Libre</a>
          </div>

          <div className="home-pricing-card home-pricing-card-featured">
            <div className="home-pricing-icon" aria-hidden>💰</div>
            <h3>Cajita Sin Luz</h3>
            <p className="home-pricing-price">$24.000</p>
            <span className="home-badge home-badge-green">Precio Directo</span>
            <p className="home-pricing-desc">Cajita tradicional sin iluminación. Pago directo por transferencia bancaria o en efectivo. Sin comisiones adicionales.</p>
            <div className="home-transfer">
              <p className="home-transfer-title">Datos para Transferencia:</p>
              <p><strong>Alias:</strong> {ALIAS}</p>
              <p><strong>Banco:</strong> Mercado Pago</p>
              <p><strong>Titular:</strong> Manuel Perea</p>
              <p className="home-transfer-send">Enviar Comprobante:</p>
              <a href={`tel:${TELEFONO.replace(/\s/g, '')}`} className="btn btn-green home-transfer-btn">{TELEFONO}</a>
              <a href={`mailto:${EMAIL}`} className="btn btn-primary home-transfer-btn">{EMAIL}</a>
              <button type="button" onClick={copiarAlias} className="btn btn-secondary home-copy-alias">Copiar Alias</button>
            </div>
          </div>

          <div className="home-pricing-card">
            <div className="home-pricing-icon home-pricing-icon-bulb" aria-hidden>💡</div>
            <h3>Cajita Con Luz</h3>
            <p className="home-pricing-price">$42.000</p>
            <span className="home-badge home-badge-green">Nueva</span>
            <p className="home-pricing-desc">Cajita con iluminación LED. Incluye opción de pilas por $2.500 adicionales.</p>
            <div className="home-transfer">
              <p className="home-transfer-title">Datos para Transferencia:</p>
              <p><strong>Alias:</strong> {ALIAS}</p>
              <p><strong>Banco:</strong> Mercado Pago</p>
              <p><strong>Titular:</strong> Manuel Perea</p>
              <p className="home-transfer-send">Enviar Comprobante:</p>
              <a href={`tel:${TELEFONO.replace(/\s/g, '')}`} className="btn btn-green home-transfer-btn">{TELEFONO}</a>
              <a href={`mailto:${EMAIL}`} className="btn btn-primary home-transfer-btn">{EMAIL}</a>
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
