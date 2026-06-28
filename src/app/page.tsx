"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Lightbulb,
  Volume2,
  VolumeX,
  Wallet,
  CreditCard,
  Palette,
  Scissors,
  Printer,
} from "lucide-react";
import api from "@/lib/api";

const DEFAULT_ALIAS = "manu.perea13";
const DEFAULT_TELEFONO = "+54 9 351 392 3790";
const DEFAULT_EMAIL = "copiiworld@gmail.com";

interface Prices {
  price_mercadolibre: number;
  price_sin_luz: number;
  price_con_luz: number;
  price_pilas: number;
  transfer_alias: string;
  transfer_bank: string;
  transfer_holder: string;
  contact_whatsapp: string;
  contact_email: string;
  link_mercadolibre: string;
}

const DEFAULT_PRICES: Prices = {
  price_mercadolibre: 35000,
  price_sin_luz: 24000,
  price_con_luz: 42000,
  price_pilas: 2500,
  transfer_alias: DEFAULT_ALIAS,
  transfer_bank: "Mercado Pago",
  transfer_holder: "Manuel Perea",
  contact_whatsapp: DEFAULT_TELEFONO,
  contact_email: DEFAULT_EMAIL,
  link_mercadolibre: "https://mercadolibre.com",
};

interface HomeBackground {
  video_sin_luz: string;
  video_con_luz: string;
  audio_sin_luz: string;
  audio_con_luz: string;
}

const formatPrice = (n: number | string | null | undefined): string =>
  n == null || n === "" ? "" : `$${Number(n).toLocaleString("es-AR")}`;

const WHATSAPP_COMPROBANTE_MSG =
  "Hola, te envío el comprobante de la transferencia de la Cajita de la Memoria.";

/** URLs que empiezan con /media/ se sirven desde el backend; el resto desde el mismo origen (front). */
const getMediaSrc = (url: string | null | undefined): string | undefined => {
  if (!url || typeof url !== "string") return undefined;
  if (url.startsWith("/media/")) {
    const base = (api.baseUrl || "").replace(/\/$/, "");
    return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
  }
  return url;
};

export default function Home() {
  const [sinLuz, setSinLuz] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [prices, setPrices] = useState<Prices>(DEFAULT_PRICES);
  const [background, setBackground] = useState<HomeBackground>({
    video_sin_luz: "",
    video_con_luz: "",
    audio_sin_luz: "",
    audio_con_luz: "",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    api
      .getPrices(false)
      .then((data) => {
        if (data && typeof data === "object")
          setPrices((prev) => ({ ...DEFAULT_PRICES, ...prev, ...(data as Partial<Prices>) }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getHomeBackground(false)
      .then((data) => {
        if (data && typeof data === "object") {
          const d = data as Partial<HomeBackground>;
          setBackground({
            video_sin_luz: d.video_sin_luz ?? "",
            video_con_luz: d.video_con_luz ?? "",
            audio_sin_luz: d.audio_sin_luz ?? "",
            audio_con_luz: d.audio_con_luz ?? "",
          });
        }
      })
      .catch(() => {});
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
      const src = getMediaSrc(sinLuz ? background.audio_sin_luz : background.audio_con_luz);
      if (src) {
        audioRef.current.src = src;
        audioRef.current.load();
        audioRef.current.play().catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background.audio_sin_luz, background.audio_con_luz]);

  useEffect(() => {
    if (videoRef.current) {
      const srcV = getMediaSrc(sinLuz ? background.video_sin_luz : background.video_con_luz);
      if (srcV) {
        videoRef.current.src = srcV;
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
    }
    if (audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      const srcA = getMediaSrc(sinLuz ? background.audio_sin_luz : background.audio_con_luz);
      if (srcA) {
        audioRef.current.src = srcA;
        audioRef.current.load();
        if (wasPlaying || !isMuted) {
          audioRef.current.play().catch(() => {});
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sinLuz,
    background.video_sin_luz,
    background.video_con_luz,
    background.audio_sin_luz,
    background.audio_con_luz,
  ]);

  useEffect(() => {
    const playOnInteraction = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => setIsMuted(false)).catch(() => {});
      }
    };
    window.addEventListener("click", playOnInteraction, { once: true });
    return () => window.removeEventListener("click", playOnInteraction);
  }, []);

  const copiarAlias = () => {
    navigator.clipboard?.writeText(prices.transfer_alias || DEFAULT_ALIAS);
  };
  const alias = prices.transfer_alias || DEFAULT_ALIAS;
  const telefono = prices.contact_whatsapp || DEFAULT_TELEFONO;
  const email = prices.contact_email || DEFAULT_EMAIL;
  const audioSrc = getMediaSrc(sinLuz ? background.audio_sin_luz : background.audio_con_luz);
  const videoSrc = getMediaSrc(sinLuz ? background.video_sin_luz : background.video_con_luz);

  return (
    <div className="mm-page relative">
      <audio ref={audioRef} loop preload="auto">
        {audioSrc && <source src={audioSrc} type="audio/mpeg" />}
      </audio>

      {/* Barra superior */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
          {sinLuz ? (
            <Package className="size-5 text-mb-blue" aria-hidden />
          ) : (
            <Lightbulb className="size-5 text-mb-amber" aria-hidden />
          )}
          <span className="text-sm font-semibold text-mb-ink">{sinLuz ? "Sin Luz" : "Con Luz"}</span>
          <button
            type="button"
            className={`relative h-6 w-11 rounded-full transition-colors ${
              !sinLuz ? "bg-mb-amber" : "bg-mb-blue"
            }`}
            onClick={() => setSinLuz(!sinLuz)}
            aria-label={sinLuz ? "Sin luz" : "Con luz"}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                !sinLuz ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Botón mute */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-30 flex size-12 items-center justify-center rounded-full bg-mb-blue text-white shadow-lg transition hover:bg-mb-blue-dark"
        onClick={toggleAudio}
        aria-label={isMuted ? "Activar sonido" : "Silenciar"}
        title={isMuted ? "Activar música" : "Silenciar música"}
      >
        {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      {/* Hero */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          src={videoSrc}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center text-white animate-fade-up">
          <h1 className="flex items-center justify-center gap-3 font-heading text-4xl font-bold sm:text-5xl">
            {sinLuz ? (
              <Package className="size-9" aria-hidden />
            ) : (
              <Lightbulb className="size-9 text-mb-amber" aria-hidden />
            )}
            Cajita de la Memoria
          </h1>
          <p className="mt-4 text-lg text-white/90">Cajas de fotos personalizadas</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/cliente" className="mm-btn mm-btn-primary">
              <Package className="size-5" aria-hidden />
              Crear Mi Caja Personalizada
            </Link>
            <a href="#precios" className="mm-btn mm-btn-outline">
              <Wallet className="size-5" aria-hidden />
              Ver Precios
            </a>
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="mm-container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Palette className="size-7 text-mb-blue" aria-hidden />,
              title: "Variantes",
              desc: "Elige entre Grafito, Madera, Negro y Mármol. Cada variante ofrece un acabado único.",
            },
            {
              icon: <Scissors className="size-7 text-mb-blue" aria-hidden />,
              title: "Recorte Inteligente",
              desc: "Sistema de recorte automático que optimiza tus fotos para el formato perfecto de la caja.",
            },
            {
              icon: <Printer className="size-7 text-mb-blue" aria-hidden />,
              title: "Alta Calidad",
              desc: "Imágenes procesadas en la mejor calidad, listas para impresión profesional.",
            },
          ].map((f) => (
            <div key={f.title} className="mm-card p-6 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-mb-blue-light">
                {f.icon}
              </div>
              <h3 className="font-heading text-lg font-bold text-mb-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-mb-gray">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="mm-container py-16">
        <h2 className="flex items-center justify-center gap-2 font-heading text-2xl font-bold text-mb-ink">
          <Wallet className="size-6 text-mb-blue" aria-hidden />
          Precios y Formas de Pago
        </h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="mm-card flex flex-col p-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-mb-blue-light">
              <CreditCard className="size-7 text-mb-blue" aria-hidden />
            </div>
            <h3 className="font-heading text-lg font-bold text-mb-ink">Mercado Libre</h3>
            <p className="my-2 text-2xl font-bold text-mb-blue">{formatPrice(prices.price_mercadolibre)}</p>
            <p className="flex-1 text-sm text-mb-gray">
              Pago seguro con tarjeta de crédito, débito o efectivo a través de Mercado Libre.
            </p>
            <a
              href={prices.link_mercadolibre || "https://mercadolibre.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-btn mm-btn-primary mt-4"
            >
              Comprar en Mercado Libre
            </a>
          </div>

          <div className="mm-card flex flex-col border-2 border-mb-blue p-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-mb-blue-light">
              <Wallet className="size-7 text-mb-blue" aria-hidden />
            </div>
            <h3 className="font-heading text-lg font-bold text-mb-ink">Cajita Sin Luz</h3>
            <p className="my-2 text-2xl font-bold text-mb-blue">{formatPrice(prices.price_sin_luz)}</p>
            <span className="mm-badge mx-auto bg-mb-green/15 text-mb-green">Precio Directo</span>
            <p className="mt-2 flex-1 text-sm text-mb-gray">
              Cajita tradicional sin iluminación. Pago directo por transferencia bancaria o en efectivo.
              Sin comisiones adicionales.
            </p>
          </div>

          <div className="mm-card flex flex-col p-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-mb-amber/15">
              <Lightbulb className="size-7 text-mb-amber" aria-hidden />
            </div>
            <h3 className="font-heading text-lg font-bold text-mb-ink">Cajita Con Luz</h3>
            <p className="my-2 text-2xl font-bold text-mb-blue">
              {formatPrice((Number(prices.price_con_luz) || 0) + (Number(prices.price_pilas) || 0))}
            </p>
            <span className="mm-badge mx-auto bg-mb-green/15 text-mb-green">Nueva</span>
            <p className="mt-2 flex-1 text-sm text-mb-gray">
              Cajita con iluminación LED e incluye pilas. Pago directo por transferencia o en efectivo.
            </p>
          </div>
        </div>

        <div className="mm-card mx-auto mt-10 max-w-2xl p-6">
          <h3 className="font-heading text-lg font-bold text-mb-ink">Datos para Transferencia</h3>
          <div className="mt-3 space-y-1 text-sm text-mb-ink">
            <p>
              <strong>Alias:</strong> {alias}
            </p>
            <p>
              <strong>Banco:</strong> {prices.transfer_bank || "Mercado Pago"}
            </p>
            <p>
              <strong>Titular:</strong> {prices.transfer_holder || "Manuel Perea"}
            </p>
          </div>
          <p className="mt-4 font-semibold text-mb-ink">Enviar Comprobante</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <a
              href={`https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(
                WHATSAPP_COMPROBANTE_MSG,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-btn mm-btn-green"
            >
              Enviar por WhatsApp
            </a>
            <a href={`mailto:${email}`} className="mm-btn mm-btn-primary">
              {email}
            </a>
          </div>
          <button type="button" onClick={copiarAlias} className="mm-btn mm-btn-outline mt-3">
            Copiar Alias
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-mb-border py-6 text-center text-sm text-mb-gray">
        <p>© {new Date().getFullYear()} Cajita de la Memoria - Cajas de fotos personalizadas</p>
      </footer>
    </div>
  );
}
