"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) router.replace("/admin");
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (!ok) setError("Credenciales inválidas");
  };

  return (
    <div className="mm-page flex min-h-screen items-center justify-center px-4">
      <div className="mm-card w-full max-w-md p-8 animate-fade-up">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-mb-blue-light">
            <Lock className="size-6 text-mb-blue" />
          </div>
          <h1 className="font-heading text-xl font-bold text-mb-ink">
            Admin · Cajita de la Memoria
          </h1>
          <p className="mt-1 text-sm text-mb-gray">Iniciá sesión para gestionar pedidos</p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="mm-label">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="mm-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mm-label">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              className="mm-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm font-medium text-mb-red">{error}</p>}
          <button type="submit" className="mm-btn mm-btn-primary w-full" disabled={submitting}>
            {submitting ? "Ingresando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm">
          <Link href="/" className="text-mb-blue hover:underline">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
