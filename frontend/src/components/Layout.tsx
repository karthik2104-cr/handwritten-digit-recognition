import { Grid3x3, Images, Info, LayoutDashboard, Menu, Moon, PanelLeft, Pencil, Sun, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth, toErrorMessage } from "../services/api";
import type { Health } from "../types/api";
import { modelLabel } from "../lib/format";

const NAV: { to: string; label: string; icon: LucideIcon; end: boolean }[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/studio", label: "Recognition Studio", icon: Pencil, end: false },
  { to: "/evaluation", label: "Model Evaluation", icon: Grid3x3, end: false },
  { to: "/explorer", label: "Prediction Explorer", icon: Images, end: false },
  { to: "/about", label: "About the Model", icon: Info, end: false },
];

export interface ShellHealth {
  data: Health | null;
  error: string | null;
  loading: boolean;
  status: string;
  detail: string;
}

export function Layout() {
  const health = useHealth();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("neural-studio-sidebar") === "collapsed");
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));
  const page = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))) ?? NAV[0];

  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (drawerWasOpen.current && !drawer) menuRef.current?.focus();
    drawerWasOpen.current = drawer;
  }, [drawer]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("neural-studio-theme", next);
  }

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("neural-studio-sidebar", next ? "collapsed" : "open");
  }

  return (
    <div className="ns-app">
      <div className="ns-shell">
        <aside className={collapsed ? "ns-side is-collapsed" : "ns-side"}>
          <Brand compact={collapsed} />
          <nav className="mt-4 flex flex-1 flex-col gap-1" aria-label="Primary">
            {NAV.map((item) => (
              <SideLink key={item.to} item={item} />
            ))}
          </nav>
          <StatusBlock health={health} compact={collapsed} />
        </aside>
        <div className="ns-main">
          <header className="ns-top">
            <button ref={menuRef} type="button" className="ns-icon-btn lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <button type="button" className="ns-icon-btn hidden lg:inline-flex" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}>
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[var(--ns-muted)]">Neural Studio / {page.label}</p>
              <h1 className="truncate text-lg font-semibold tracking-tight">{page.label}</h1>
            </div>
            <button type="button" className="ns-icon-btn" aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <StatusChip status={health.status} />
              <span className="rounded-full border border-[var(--ns-border)] px-3 py-1 text-xs text-[var(--ns-muted)]">
                {modelLabel(health.data?.model_name)}
              </span>
            </div>
          </header>
          <main className="ns-content">
            <div className="rise">
              <Outlet context={health} />
            </div>
          </main>
        </div>
      </div>
      {drawer ? (
        <div className="ns-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="ns-drawer-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setDrawer(false)} />
          <div ref={panelRef} className="ns-drawer-panel">
            <div className="mb-2 flex items-center justify-between">
              <Brand compact={false} />
              <button ref={closeRef} type="button" className="ns-icon-btn" aria-label="Close navigation" onClick={() => setDrawer(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </nav>
            <StatusBlock health={health} compact={false} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SideLink({ item }: { item: (typeof NAV)[number] }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-label={item.label}
      className={({ isActive }) => `ns-link ${isActive ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="ns-label">{item.label}</span>
    </NavLink>
  );
}

function Brand({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--ns-border)] bg-[color-mix(in_srgb,var(--ns-accent)_16%,transparent)]">
        <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke="var(--ns-accent-2)" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="3" fill="var(--ns-accent)" />
          <path d="M16 4v4M16 24v4M4 16h4M24 16h4" stroke="var(--ns-accent)" strokeWidth="1.5" />
        </svg>
      </span>
      {compact ? null : (
        <div className="ns-brand-copy">
          <p className="text-sm font-semibold">Neural Studio</p>
          <p className="text-xs text-[var(--ns-muted)]">Digit recognition</p>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = status === "Ready" ? "var(--ns-ok)" : status === "Offline" ? "var(--ns-danger)" : "var(--ns-muted)";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--ns-muted)]">
      <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
      {status}
    </span>
  );
}

function StatusBlock({ health, compact }: { health: ShellHealth; compact: boolean }) {
  return (
    <div className="ns-card mt-auto p-3" title={health.detail}>
      <StatusChip status={health.status} />
      {compact ? null : <p className="ns-status-copy mt-2 line-clamp-3 text-xs leading-5 text-[var(--ns-muted)]">{health.detail}</p>}
    </div>
  );
}

function useHealth(): ShellHealth {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(initial: boolean) {
      try {
        const value = await getHealth();
        if (!active) return;
        setData(value);
        setError(null);
      } catch (caught: unknown) {
        if (!active) return;
        setData(null);
        setError(toErrorMessage(caught));
      } finally {
        if (active && initial) setLoading(false);
      }
    }

    void load(true);
    const timer = window.setInterval(() => void load(false), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const status = error ? "Offline" : loading ? "Checking" : data?.status === "ok" ? "Ready" : "Needs training";
  const detail = error ?? data?.detail ?? (data?.model_name ? modelLabel(data.model_name) : "Connecting");
  return { data, error, loading, status, detail };
}
