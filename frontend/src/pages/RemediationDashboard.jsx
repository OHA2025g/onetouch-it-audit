import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, KPICard, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { fmtDate } from "@/lib/format";

export default function RemediationDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/remediation-summary").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="remediation-dashboard">
      <PageHeader eyebrow="REMEDIATION TRACKER" title="Closure Pipeline" subtitle={`${data.overdue_count} overdue · ${data.on_time_closure_rate}% on-time closure rate · ${data.reopened_count} reopened`} />
      <InsightsSection scope="remediation" eyebrow="REMEDIATION · COCKPIT" title="Remediation AI Insights" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(data.open_by_severity || {}).map(([sev, n]) => (
          <KPICard key={sev} label={`${sev} Open`} value={n}
            accent={sev === "Critical" ? "danger" : sev === "High" ? "warning" : "default"}
            testId={`kpi-rem-${sev.toLowerCase()}`}
            onClick={() => navigate(`/remediation?priority=${encodeURIComponent(sev)}`)} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${data.top_overdue?.length || 0} ITEMS`}>Top Overdue Observations</SectionHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(data.top_overdue || []).slice(0, 10).map(o => (
              <div key={o.observation_id} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/observations/${o.observation_id}`)} className="p-2.5 border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 rounded-sm cursor-pointer hover:border-red-400" onClick={() => navigate(`/observations/${o.observation_id}`)} data-testid={`overdue-obs-${o.observation_id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge value={o.severity} />
                  <StatusBadge value={o.status} />
                  <span className="text-[10px] text-red-600 font-mono ml-auto">Due {fmtDate(o.due_date)}</span>
                </div>
                <div className="text-xs font-medium">{o.title}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow="OWNER PERFORMANCE">Closure Leaderboard</SectionHeader>
          <div className="h-[400px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500 sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="text-left py-2 px-2 font-semibold">Owner</th>
                  <th className="text-right px-2 font-semibold">Assigned</th>
                  <th className="text-right px-2 font-semibold">Closed</th>
                  <th className="text-right px-2 font-semibold">Overdue</th>
                  <th className="text-right px-2 font-semibold">On-Time %</th>
                </tr>
              </thead>
              <tbody>
                {(data.owner_performance || []).map((p, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50" onClick={() => p.owner_id && navigate(`/remediation?owner_id=${encodeURIComponent(p.owner_id)}`)} data-testid={`owner-perf-row-${i}`}>
                    <td className="py-2 px-2 font-medium">{p.owner_name}</td>
                    <td className="px-2 text-right crt-num">{p.assigned}</td>
                    <td className="px-2 text-right crt-num text-emerald-600">{p.closed}</td>
                    <td className="px-2 text-right crt-num text-red-600">{p.overdue}</td>
                    <td className="px-2 text-right crt-num font-bold">{p.on_time_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
