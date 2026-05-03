import React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { scoreColor } from "@/lib/format";

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
      <div>
        {eyebrow && <div className="crt-overline mb-1">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tighter" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KPICard({ label, value, sub, trend, accent = "default", testId, onClick }) {
  const accents = {
    default: "border-zinc-200 dark:border-zinc-800",
    danger: "border-red-200 dark:border-red-900",
    warning: "border-amber-200 dark:border-amber-900",
    success: "border-emerald-200 dark:border-emerald-900",
    info: "border-blue-200 dark:border-blue-900",
  };
  const TrendIc = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendCol = !trend ? "" : trend.direction === "up"
    ? (accent === "danger" ? "text-red-600" : "text-emerald-600 dark:text-emerald-400")
    : trend.direction === "down"
    ? (accent === "danger" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600")
    : "text-zinc-500";
  const base = `bg-white dark:bg-zinc-900 border ${accents[accent]} rounded-sm p-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700`;
  const drill = onClick ? " cursor-pointer text-left w-full" : "";
  const inner = (
    <>
      <div className="crt-overline mb-3">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="font-display font-black text-3xl tracking-tighter crt-num">{value}</div>
        {trend && (
          <div className={`flex items-center text-xs font-semibold ${trendCol}`}>
            <TrendIc className="w-3 h-3" />
            {trend.delta != null && <span className="ml-0.5">{trend.delta > 0 ? "+" : ""}{trend.delta}</span>}
          </div>
        )}
      </div>
      {sub && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={base + drill} data-testid={testId} onClick={onClick} role="link">
        {inner}
      </button>
    );
  }
  return (
    <div className={base} data-testid={testId}>
      {inner}
    </div>
  );
}

export function ScoreGauge({ value, label, size = 140 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = (size / 2) - 12;
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;
  const stroke = v >= 85 ? "#059669" : v >= 70 ? "#0047AB" : v >= 55 ? "#F59E0B" : "#DC2626";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth={10} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={stroke} strokeWidth={10} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`font-display font-black text-3xl tracking-tighter crt-num ${scoreColor(v)}`}>{v.toFixed(1)}</div>
        {label && <div className="crt-overline text-[9px] mt-0.5">{label}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ children, action, eyebrow }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div>
        {eyebrow && <div className="crt-overline text-[9px] mb-0.5">{eyebrow}</div>}
        <h3 className="font-display font-bold text-sm tracking-tight">{children}</h3>
      </div>
      {action}
    </div>
  );
}

export function Empty({ msg = "No data" }) {
  return <div className="py-12 text-center text-sm text-zinc-400">{msg}</div>;
}

export function SeverityBadge({ value }) {
  const cls = {
    Critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    High: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
    Medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Low: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  }[value] || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${cls}`}>{value}</span>;
}

export function StatusBadge({ value }) {
  const cls = {
    Open: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
    Closed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    In_Progress: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Submitted: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
    Response_Pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Evidence_Submitted: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-900",
    Under_Review: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
    Reopened: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    Action_Plan_Submitted: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-900",
    Active: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    Inactive: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
    Expired: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    Pending: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
    Overdue: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    On_Time: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    At_Risk: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Sufficient: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    Partially_Sufficient: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Insufficient: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    Success: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    Failed: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    Partial: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Pass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
    Fail: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
    Warning: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
    Upcoming: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
    Completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  }[value] || "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300";
  const display = (value || "").replace(/_/g, " ");
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-sm whitespace-nowrap ${cls}`}>{display}</span>;
}
