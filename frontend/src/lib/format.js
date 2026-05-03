// Indian numbering helpers + formatters
export function formatINR(amount, opts = {}) {
  if (amount == null || isNaN(amount)) return "—";
  const num = Number(amount);
  const { compact = true } = opts;
  if (compact) {
    if (Math.abs(num) >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
    if (Math.abs(num) >= 1e5) return `₹${(num / 1e5).toFixed(2)} L`;
    if (Math.abs(num) >= 1e3) return `₹${(num / 1e3).toFixed(1)}K`;
  }
  return `₹${new Intl.NumberFormat("en-IN").format(Math.round(num))}`;
}

export function formatNumber(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

export function severityColor(sev) {
  return {
    Critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    High: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900",
    Medium: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    Low: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  }[sev] || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300";
}

export function statusColor(s) {
  return {
    Open: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    Closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    "In_Progress": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Submitted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    Response_Pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Action_Plan_Submitted: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
    Evidence_Submitted: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    Under_Review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    Reopened: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    Pending: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
    Overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    On_Time: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    At_Risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    Inactive: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    Expired: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    Pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    Fail: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    Warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Sufficient: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    Partially_Sufficient: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    Insufficient: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    Success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    Failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    Partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  }[s] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export function scoreColor(s) {
  if (s >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (s >= 70) return "text-blue-600 dark:text-blue-400";
  if (s >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function scoreBg(s) {
  if (s >= 85) return "bg-emerald-500";
  if (s >= 70) return "bg-blue-500";
  if (s >= 55) return "bg-amber-500";
  return "bg-red-500";
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
