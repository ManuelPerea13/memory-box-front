"use client";

import { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/api";

interface AuthContextValue {
  token: string | null;
  userEmail: string;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // Hidratar desde localStorage tras montar (evita mismatch SSR/CSR).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setToken(localStorage.getItem("authToken"));
    setUserEmail(localStorage.getItem("userEmail") || "");
  }, []);

  useEffect(() => {
    if (token) {
      try {
        jwtDecode(token);
      } catch {
        setToken(null);
        setUserEmail("");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userEmail");
      }
    }
  }, [token]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const data = await api.authenticate(email, password);
      if (!data.access) throw new Error("Invalid response");
      setToken(data.access);
      setUserEmail(email);
      localStorage.setItem("authToken", data.access);
      localStorage.setItem("userEmail", email);
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUserEmail("");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
  };

  return (
    <AuthContext.Provider
      value={{ token, userEmail, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
