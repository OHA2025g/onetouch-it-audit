import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/auth";
import {
  LayoutDashboard, Users, Shield, Cloud, Server, Building2, ListChecks,
  Eye, FileSearch, MessagesSquare, FileText, BarChart3, BookOpen,
  AlertTriangle, Bell, Sun, Moon, LogOut, Search, Settings,
  ChevronDown, Compass, FileCheck2, Activity, ShieldCheck, Plug, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import api from "@/api";
import NotificationDrawer from "@/components/NotificationDrawer";
import useAlertSocket from "@/hooks/useAlertSocket";

const NAV_GROUPS = [
  {
    title: "OVERVIEW",
    items: [
      { to: "/dashboard", label: "CIO Home", icon: LayoutDashboard },
      { to: "/copilot", label: "AI Copilot", icon: MessagesSquare, badge: "AI" },
    ],
  },
  {
    title: "DASHBOARDS",
    items: [
      { to: "/dashboard/identity", label: "Identity & Access", icon: Users },
      { to: "/dashboard/compliance", label: "Compliance", icon: Shield },
      { to: "/dashboard/applications", label: "Applications", icon: Server },
      { to: "/dashboard/cloud", label: "Cloud", icon: Cloud },
      { to: "/dashboard/vendors", label: "Vendors", icon: Building2 },
      { to: "/dashboard/remediation", label: "Remediation", icon: FileCheck2 },
    ],
  },
  {
    title: "AUDIT WORK",
    items: [
      { to: "/risks", label: "Risk Register", icon: AlertTriangle },
      { to: "/observations", label: "Observations", icon: Eye },
      { to: "/audits", label: "Audit Plans", icon: ListChecks },
      { to: "/universe", label: "Audit Universe", icon: Compass },
      { to: "/controls", label: "Control Library", icon: BookOpen },
      { to: "/remediation", label: "Remediation register", icon: ClipboardList },
      { to: "/evidence", label: "Evidence", icon: FileSearch },
      { to: "/policies", label: "Policies", icon: FileText },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { to: "/analytics", label: "Trends & Prediction", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

const ADMIN_GROUP = {
  title: "ADMIN",
  items: [
    { to: "/admin/users", label: "User Management", icon: Settings },
    { to: "/admin/integrations", label: "Integrations", icon: Plug },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [unread, setUnread] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await api.get("/notifications/unread-count");
        setUnread(r.data.count || 0);
      } catch {}
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 60000);
    return () => clearInterval(id);
  }, []);

  // Real-time CCM alerts via WebSocket
  useAlertSocket(() => setUnread(u => u + 1));

  const showAdmin = user?.role === "Admin" || user?.role === "CIO";

  return (
    <div className="min-h-screen flex bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
        <div className="px-4 h-14 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="w-7 h-7 bg-blue-700 dark:bg-blue-600 rounded-sm flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="crt-overline text-[8px] leading-none">ONE TOUCH</div>
            <div className="font-display font-black text-sm tracking-tight leading-tight">IT AUDIT AI</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {NAV_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="crt-overline text-[9px] px-2 mb-1.5">{g.title}</div>
              {g.items.map((it) => (
                <NavLink
                  key={it.to} to={it.to}
                  data-testid={`nav-${it.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-1.5 mb-0.5 text-[13px] rounded-sm transition-colors ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`
                  }
                >
                  <it.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-sm font-bold tracking-wider">
                      {it.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
          {showAdmin && (
            <div>
              <div className="crt-overline text-[9px] px-2 mb-1.5">{ADMIN_GROUP.title}</div>
              {ADMIN_GROUP.items.map((it) => (
                <NavLink
                  key={it.to} to={it.to}
                  data-testid={`nav-${it.label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-1.5 mb-0.5 text-[13px] rounded-sm transition-colors ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`
                  }
                >
                  <it.icon className="w-4 h-4" />
                  <span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">v1.0 · MUMBAI · ap-south-1</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="hidden md:flex items-center gap-2 px-3 h-9 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm w-72 max-w-md">
              <Search className="w-4 h-4 text-zinc-400" />
              <input
                placeholder="Search controls, observations, vendors..."
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-zinc-400"
                data-testid="global-search-input"
              />
              <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 rounded-sm font-mono text-zinc-500">⌘K</kbd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon" className="rounded-sm h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="theme-toggle-btn"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="rounded-sm h-9 w-9 relative"
              onClick={() => setDrawerOpen(true)}
              data-testid="notification-bell-btn"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="notification-unread-count">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2 gap-2 rounded-sm" data-testid="user-menu-btn">
                  <div className="w-7 h-7 bg-blue-700 dark:bg-blue-600 text-white rounded-sm flex items-center justify-center text-xs font-bold">
                    {user?.name?.[0] || "U"}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-semibold leading-none">{user?.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{user?.role}</div>
                  </div>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-sm">
                <DropdownMenuLabel>
                  <div className="text-xs">{user?.email}</div>
                  <div className="text-[10px] text-zinc-500">{user?.designation}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 cursor-pointer" data-testid="logout-btn">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 fade-up" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      <NotificationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onChange={setUnread} />
    </div>
  );
}
