"use client";

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, LogOut, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import useOrdersWebSocket from "@/hooks/useOrdersWebSocket";
import { cn } from "@/lib/utils";

const formatNotificationTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffMin >= 60) return `Hace ${Math.floor(diffMin / 60)} h`;
  if (diffMin > 0) return `Hace ${diffMin} min`;
  if (diffSec > 5) return `Hace ${diffSec} s`;
  return "Ahora mismo";
};

const VARIANT_LABELS: Record<string, string> = {
  graphite: "Grafito",
  wood: "Madera",
  black: "Negro",
  marble: "Mármol",
  graphite_light: "Grafito (con luz)",
  wood_light: "Madera (con luz)",
  black_light: "Negro (con luz)",
  marble_light: "Mármol (con luz)",
};

const getVariantLabel = (variant?: string) => {
  if (!variant) return "";
  return VARIANT_LABELS[variant] || VARIANT_LABELS[variant.toLowerCase()] || variant;
};

interface Notification {
  id: string;
  orderId: number;
  clientName: string;
  variant: string;
  withLight: boolean;
  createdAt: Date;
}

const NAV_ITEMS: { href: string; label: string; section?: string; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", section: "PRINCIPAL", exact: true },
  { href: "/admin/stock", label: "Stock", section: "GESTIÓN" },
  { href: "/admin/precios", label: "Precios" },
  { href: "/admin/costos", label: "Costos" },
  { href: "/admin/fondo", label: "Video y Música" },
  { href: "/admin/variantes", label: "Variantes" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { userEmail, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const addNotification = useCallback((payload: Record<string, unknown>) => {
    if (payload.order_id == null || payload.status !== "in_progress") return;
    const newNotif: Notification = {
      id: `${payload.order_id}-${Date.now()}`,
      orderId: payload.order_id as number,
      clientName: (payload.client_name as string) || "Cliente",
      variant: (payload.variant as string) || "",
      withLight: payload.with_light === true,
      createdAt: new Date(),
    };
    setNotifications((prev) => {
      const recentSame = prev.some(
        (n) => n.orderId === payload.order_id && Date.now() - n.createdAt.getTime() < 3000,
      );
      if (recentSame) return prev;
      return [newNotif, ...prev.slice(0, 49)];
    });
  }, []);

  const handleOrdersUpdate = useCallback(
    (data: Record<string, unknown>) => {
      if (data && data.order_id != null && data.status === "in_progress") addNotification(data);
      window.dispatchEvent(new CustomEvent("orders-update"));
    },
    [addNotification],
  );

  useOrdersWebSocket(handleOrdersUpdate);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const unreadCount = notifications.length;

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-screen bg-mb-gray-light">
      {/* Overlay móvil */}
      <div
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-mb-border bg-white transition-transform md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 border-b border-mb-border px-5 py-4 text-mb-ink">
          <Package className="size-5 text-mb-blue" />
          <span className="font-heading text-base font-bold">Cajita de la Memoria</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <div key={item.href}>
              {item.section && (
                <div className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wider text-mb-gray">
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item)
                    ? "bg-mb-blue text-white"
                    : "text-mb-ink hover:bg-mb-gray-light",
                )}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="border-t border-mb-border px-4 py-3">
          <p className="mb-2 truncate text-xs text-mb-gray">{userEmail}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mm-btn mm-btn-outline w-full text-sm"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-mb-border bg-white px-4 py-3">
          <button
            type="button"
            className="rounded-md p-2 hover:bg-mb-gray-light md:hidden"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={sidebarOpen}
          >
            <Menu className="size-5" />
          </button>
          <div className="relative ml-auto" ref={dropdownRef}>
            <button
              type="button"
              className="relative rounded-full p-2 hover:bg-mb-gray-light"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-label={unreadCount ? `${unreadCount} notificaciones` : "Notificaciones"}
              aria-expanded={dropdownOpen}
            >
              <Bell className="size-5 text-mb-ink" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mb-red px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-mb-border bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-mb-border px-4 py-2.5">
                  <span className="text-sm font-semibold">Notificaciones</span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-mb-blue hover:underline"
                      onClick={() => setNotifications([])}
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-mb-gray">
                      No hay notificaciones nuevas
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 border-b border-mb-border px-4 py-3 text-left hover:bg-mb-gray-light"
                        onClick={() => {
                          setNotifications((prev) => prev.filter((notif) => notif.id !== n.id));
                          setDropdownOpen(false);
                          router.push(`/admin?ver=${n.orderId}`);
                        }}
                      >
                        <span className="text-sm font-semibold">Nuevo pedido #{n.orderId}</span>
                        {n.clientName && <span className="text-xs text-mb-gray">{n.clientName}</span>}
                        {(n.variant || n.withLight) && (
                          <span className="text-xs text-mb-gray">
                            {[getVariantLabel(n.variant), n.withLight ? "Con luz" : "Sin luz"]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        <span className="text-[11px] text-mb-gray">
                          {formatNotificationTime(n.createdAt)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-mb-border px-4 py-2.5">
                  <Link
                    href="/admin"
                    className="text-sm text-mb-blue hover:underline"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Ver todos los pedidos
                  </Link>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
