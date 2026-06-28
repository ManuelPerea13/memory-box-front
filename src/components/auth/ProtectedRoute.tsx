"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Guard de rutas admin. Mientras AuthContext hidrata el token desde localStorage,
 * mostramos un estado neutro; si no hay token, redirigimos a /login.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Damos un tick para que AuthContext hidrate desde localStorage.
    const id = setTimeout(() => setChecked(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (checked && !token) {
      router.replace("/login");
    }
  }, [checked, token, router]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mb-gray">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
