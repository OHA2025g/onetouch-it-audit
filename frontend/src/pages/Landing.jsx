import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldCheck,
  LayoutDashboard,
  Activity,
  MessagesSquare,
  AlertTriangle,
  Eye,
  ListChecks,
  BookOpen,
  FileSearch,
  FileText,
  BarChart3,
  Plug,
  Zap,
  Globe2,
  Lock,
  Sun,
  Moon,
  ArrowRight,
  Sparkles,
  Radio,
  CheckCircle2,
} from "lucide-react";

const FRAMEWORKS = ["ISO 27001", "SOC 2", "DPDP", "RBI IT", "SEBI Cyber", "ITGC"];

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "CIO command center",
    desc: "Eight KPIs, nine-axis posture radar, risk heatmap, and CIO-level AI insights — one screen for board-ready narrative.",
    accent: "from-blue-600/20 to-transparent",
  },
  {
    icon: Radio,
    title: "Continuous controls monitoring",
    desc: "Synthetic CCM alerts on a live ticker with WebSocket delivery. Spot threshold breaches and anomalies before they become findings.",
    accent: "from-violet-600/20 to-transparent",
  },
  {
    icon: MessagesSquare,
    title: "AI Copilot & scoped insights",
    desc: "Natural-language copilot plus scope-specific recommendations across Identity, Compliance, Cloud, Vendors, and more.",
    accent: "from-emerald-600/20 to-transparent",
  },
  {
    icon: AlertTriangle,
    title: "Risk & audit workflow",
    desc: "Risk register, observations, audit plans, universe mapping, and control library — linked from evidence to remediation.",
    accent: "from-amber-600/20 to-transparent",
  },
  {
    icon: FileText,
    title: "Reports & analytics",
    desc: "CIO PDF packs, remediation Excel exports, and trend analytics for defensible, repeatable reporting cycles.",
    accent: "from-rose-600/20 to-transparent",
  },
  {
    icon: Plug,
    title: "Integrations",
    desc: "Connect AWS, LDAP, ServiceNow, GitHub, and more. Credentials are encrypted at rest; test and sync from the admin console.",
    accent: "from-cyan-600/20 to-transparent",
  },
];

const PILLARS = [
  { icon: Lock, label: "RBAC & MFA-ready", text: "Role-based access with optional TOTP enforcement for privileged roles." },
  { icon: Globe2, label: "India-ready", text: "DPDP-aware framing; frameworks aligned to local and global regimes." },
  { icon: Zap, label: "Fast to value", text: "Seeded demo universe so teams can explore controls and risks on day one." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 antialiased">
      {/* Subtle grid */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <header className="relative z-20 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-sm bg-blue-700 dark:bg-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="crt-overline text-[9px] leading-none text-zinc-500 dark:text-zinc-400">ONE TOUCH</div>
              <div className="font-display font-black text-sm tracking-tight">IT AUDIT AI</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-sm h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" asChild className="rounded-sm text-sm font-semibold">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="rounded-sm bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold shadow-sm">
              <Link to="/login">Open app</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.08] via-transparent to-violet-600/[0.06] dark:from-blue-500/10 dark:to-violet-600/10" />
          <div className="absolute top-0 right-0 w-[min(100%,720px)] h-[min(100%,520px)] -translate-y-1/4 translate-x-1/4 rounded-full bg-blue-500/10 dark:bg-blue-400/5 blur-3xl" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-8 fade-up">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              AI-assisted IT audit & continuous assurance
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] max-w-4xl fade-up" style={{ animationDelay: "0.05s" }}>
              One pane for audit,
              <span className="text-blue-700 dark:text-blue-400"> risk,</span>
              <br className="hidden sm:block" />
              and compliance velocity.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed fade-up" style={{ animationDelay: "0.1s" }}>
              One Touch IT Audit AI is the command center for CIOs and audit leaders: unify controls, observations, evidence,
              and real-time monitoring — then brief the board with clarity, not spreadsheets.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4 fade-up" style={{ animationDelay: "0.15s" }}>
              <Button asChild size="lg" className="rounded-sm h-12 px-8 text-base font-semibold bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-lg shadow-blue-900/20">
                <Link to="/login">
                  Get started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-sm h-12 px-6 border-zinc-300 dark:border-zinc-700 font-semibold bg-white/50 dark:bg-zinc-900/50">
                <Link to="/login">View demo login</Link>
              </Button>
            </div>
            <div className="mt-14 flex flex-wrap gap-3 fade-up" style={{ animationDelay: "0.2s" }}>
              {FRAMEWORKS.map((f) => (
                <span
                  key={f}
                  className="px-3 py-1.5 text-xs font-semibold tracking-wide uppercase rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {[
              { v: "50+", l: "Continuous controls" },
              { v: "8+", l: "CIO KPI lenses" },
              { v: "Live", l: "CCM alert stream" },
              { v: "1", l: "Unified workspace" },
            ].map((s) => (
              <div key={s.l} className="text-center md:text-left">
                <div className="font-display text-3xl md:text-4xl font-black text-blue-700 dark:text-blue-400 tabular-nums">{s.v}</div>
                <div className="crt-overline mt-2 text-zinc-500">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features bento */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <div className="max-w-2xl mb-14">
            <div className="crt-overline mb-3">Platform</div>
            <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Everything your IT audit program expects.</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed">
              From executive dashboards to working papers — modules share the same risk language, permissions model, and audit trail.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {FEATURES.map((f, i) => (
              <Card
                key={f.title}
                className={`crt-card p-6 md:p-7 relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors fade-up`}
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <div className="relative">
                  <div className="w-11 h-11 rounded-sm bg-blue-700/10 dark:bg-blue-500/15 flex items-center justify-center mb-4 border border-blue-200/50 dark:border-blue-800/50">
                    <f.icon className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <h3 className="font-display text-lg font-bold tracking-tight mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Module strip */}
        <section className="bg-zinc-900 dark:bg-black text-zinc-100 py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
              <div>
                <div className="crt-overline text-zinc-500 mb-3">Coverage</div>
                <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight max-w-xl">Depth across the ITGC stack.</h2>
              </div>
              <p className="text-zinc-400 max-w-md text-sm leading-relaxed lg:text-right">
                Dedicated dashboards for Identity & Access, Compliance, Applications, Cloud, Vendors, and Remediation — each with scoped AI insights.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { icon: Activity, label: "Identity & Access" },
                { icon: ShieldCheck, label: "Compliance" },
                { icon: BarChart3, label: "Applications" },
                { icon: Globe2, label: "Cloud" },
                { icon: ListChecks, label: "Vendors" },
                { icon: CheckCircle2, label: "Remediation" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col items-center text-center p-4 rounded-sm border border-zinc-800 bg-zinc-950/50 hover:border-zinc-600 transition-colors"
                >
                  <m.icon className="w-5 h-5 text-blue-400 mb-2" />
                  <span className="text-xs font-semibold text-zinc-300 leading-snug">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-24">
          <div className="grid md:grid-cols-3 gap-6">
            {PILLARS.map((p) => (
              <div key={p.label} className="flex gap-4 p-6 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
                <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <p.icon className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm tracking-tight mb-1">{p.label}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Secondary: quick links to concepts */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
          <Card className="crt-card p-8 md:p-10 border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-zinc-900">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-sm mb-2">
                  <Eye className="w-4 h-4" />
                  Evidence to insight
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-black tracking-tight max-w-lg">
                  Tie observations to controls, policies, and evidence — without losing context.
                </h3>
                <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-xl text-sm leading-relaxed">
                  Upload and track evidence, run audit plans, and export board-ready reports. Notifications and CCM keep the team aligned on what changed and why it matters.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-w-[200px]">
                {[
                  { icon: BookOpen, t: "Control library" },
                  { icon: FileSearch, t: "Evidence vault" },
                  { icon: FileText, t: "Policies & reports" },
                ].map((x) => (
                  <div key={x.t} className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <x.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    {x.t}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">Ready when your audit committee is.</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
              Sign in with your organization account or explore the seeded demo environment.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-sm h-12 px-8 font-semibold bg-blue-700 hover:bg-blue-800 dark:bg-blue-600">
                <Link to="/login">Sign in to One Touch</Link>
              </Button>
            </div>
            <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-500">
              One Touch IT Audit AI · Continuous assurance for modern IT governance
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
