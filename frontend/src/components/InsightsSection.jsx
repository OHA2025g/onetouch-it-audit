import React, { useEffect, useState } from "react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, ChevronUp, ChevronDown, Zap, Lightbulb, CheckSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const SEV_BORDER = {
  CRITICAL: "border-l-red-500", WARNING: "border-l-amber-500", OK: "border-l-emerald-500",
  HIGH: "border-l-red-500", MEDIUM: "border-l-amber-500", LOW: "border-l-emerald-500",
};
const SEV_TAG = {
  CRITICAL: "text-red-600 border-red-500/50 bg-red-500/5",
  WARNING: "text-amber-600 border-amber-500/50 bg-amber-500/5",
  OK: "text-emerald-600 border-emerald-500/50 bg-emerald-500/5",
  HIGH: "text-red-600 border-red-500/50 bg-red-500/5",
  MEDIUM: "text-amber-600 border-amber-500/50 bg-amber-500/5",
  LOW: "text-emerald-600 border-emerald-500/50 bg-emerald-500/5",
};

function Pill({ value, kind = "sev" }) {
  const cls = kind === "priority"
    ? "border-red-500/50 text-red-600 bg-red-500/5"
    : (SEV_TAG[value] || "text-zinc-500 border-zinc-300 dark:border-zinc-700");
  return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-sm ${cls}`}>{value}</span>;
}

function Card({ children, severity, className = "" }) {
  return (
    <div className={`relative bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 border-l-2 ${SEV_BORDER[severity] || "border-l-zinc-300 dark:border-l-zinc-700"} rounded-sm p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors ${className}`}>
      {children}
    </div>
  );
}

/**
 * InsightsSection — generic AI Insights / Recommendations / Action Items panel.
 * props:
 *   scope: one of cio | identity | compliance | applications | cloud | vendors |
 *          remediation | risks | observations | audits | controls | evidence |
 *          policies | analytics   (default "cio")
 *   eyebrow: small label above title (default derived from scope)
 *   title: section heading (default "AI Insights")
 *   defaultCollapsed: bool
 */
export default function InsightsSection({
  scope = "cio",
  eyebrow,
  title = "AI Insights",
  defaultCollapsed = false,
  testId,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const endpoint = scope === "cio" ? "/dashboard/cio-insights" : `/dashboard/insights/${scope}`;
  const rootTestId = testId || `insights-${scope}-section`;
  const refreshTestId = `${rootTestId.replace(/-section$/, "")}-refresh-btn`;
  const collapseTestId = `${rootTestId.replace(/-section$/, "")}-collapse-btn`;

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(endpoint);
      setData(r.data);
    } catch { toast.error("Failed to load insights"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  const eyebrowText = eyebrow || `${scope.toUpperCase()} · COCKPIT`;

  return (
    <div className="crt-card overflow-hidden" data-testid={rootTestId}>
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-sm border border-blue-500/40 bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="crt-overline">{eyebrowText}</div>
            <div className="font-display text-xl sm:text-2xl font-black tracking-tighter mt-1 text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-500 mt-1">
              {data?.mode || "HEURISTIC · LLM PAUSED"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="rounded-sm h-8" onClick={load} disabled={loading} data-testid={refreshTestId}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} /> REFRESH
          </Button>
          <Button variant="outline" size="icon" className="rounded-sm h-8 w-8" onClick={() => setCollapsed(c => !c)} data-testid={collapseTestId}>
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {!collapsed && data && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
          {/* Insights */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 crt-overline">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> INSIGHTS
              </div>
              <span className="text-xs font-mono text-zinc-500">{data.insights?.length || 0}</span>
            </div>
            <div className="space-y-3">
              {data.insights?.map(it => (
                <Card key={it.id} severity={it.severity}>
                  <div className="text-sm font-medium leading-snug mb-2 text-zinc-900 dark:text-zinc-100">{it.title}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{it.body}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill value={it.severity} />
                    {(it.deep_links || []).map((dl, j) => (
                      <Link key={j} to={dl.path} className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 hover:underline" data-testid={`insight-deeplink-${it.id}-${j}`}>
                        {dl.label || dl.type}
                      </Link>
                    ))}
                  </div>
                </Card>
              ))}
              {data.insights?.length === 0 && <div className="text-xs text-zinc-500 py-8 text-center">No insights to surface</div>}
            </div>
          </div>

          {/* Recommendations */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 crt-overline">
                <Lightbulb className="w-3.5 h-3.5 text-blue-500" /> RECOMMENDATIONS
              </div>
              <span className="text-xs font-mono text-zinc-500">{data.recommendations?.length || 0}</span>
            </div>
            <div className="space-y-3">
              {data.recommendations?.map(r => (
                <Card key={r.id} severity={r.severity}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100 flex-1">{r.title}</div>
                    <Pill value={r.severity} />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{r.body}</div>
                </Card>
              ))}
              {data.recommendations?.length === 0 && <div className="text-xs text-zinc-500 py-8 text-center">All processes within tolerance</div>}
            </div>
          </div>

          {/* Action Items */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 crt-overline">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> ACTION ITEMS
              </div>
              <span className="text-xs font-mono text-zinc-500">{data.action_items?.length || 0}</span>
            </div>
            <div className="space-y-3">
              {data.action_items?.map(a => (
                <Card key={a.id} severity="HIGH">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100 flex-1">{a.title}</div>
                    <Pill value={a.priority} kind="priority" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                    <span>{a.assignee}</span>
                    <Link to={a.link || "/observations"} className="text-blue-600 dark:text-blue-400 hover:underline" data-testid={`action-item-link-${a.id}`}>{a.reference}</Link>
                    {(a.deep_links || []).map((dl, j) => (
                      <Link key={j} to={dl.path} className="text-blue-600 dark:text-blue-400 hover:underline" data-testid={`action-deeplink-${a.id}-${j}`}>
                        {dl.label || "Open"}
                      </Link>
                    ))}
                  </div>
                </Card>
              ))}
              {data.action_items?.length === 0 && <div className="text-xs text-zinc-500 py-8 text-center">No urgent action items</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
