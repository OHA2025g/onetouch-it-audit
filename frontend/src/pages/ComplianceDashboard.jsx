import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from "recharts";
import { fmtDate } from "@/lib/format";
import { Calendar, ShieldCheck, AlertTriangle } from "lucide-react";

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/compliance-summary").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;

  const radarData = (data.frameworks || []).map(f => ({ axis: f.framework, value: f.readiness_pct, full: 100 }));

  return (
    <div className="space-y-6" data-testid="compliance-dashboard">
      <PageHeader eyebrow="MULTI-FRAMEWORK READINESS" title="Compliance Command Center" subtitle={`Overall ${data.overall_compliance_score}% · Strongest: ${data.strongest_framework} · Weakest: ${data.weakest_framework}`} />
      <InsightsSection scope="compliance" eyebrow="COMPLIANCE · COCKPIT" title="Compliance AI Insights" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="crt-card p-5 lg:col-span-5">
          <SectionHeader eyebrow="RADAR">Framework Readiness</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radarData} onClick={(e) => { const fw = e?.activePayload?.[0]?.payload?.axis; if (fw) navigate(`/controls?framework=${encodeURIComponent(fw)}`); }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#0047AB" fill="#0047AB" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="crt-card p-5 lg:col-span-7">
          <SectionHeader eyebrow="DETAIL">Framework Status</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.frameworks?.map(f => (
              <div key={f.framework} role="link" tabIndex={0} onKeyDown={(ev) => ev.key === "Enter" && navigate(`/controls?framework=${encodeURIComponent(f.framework)}`)} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-sm hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer" onClick={() => navigate(`/controls?framework=${encodeURIComponent(f.framework)}`)} data-testid={`fw-card-${f.framework}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-bold tracking-tight">{f.framework}</div>
                  <span className={`text-xs font-bold crt-num ${f.readiness_pct >= 80 ? 'text-emerald-600' : f.readiness_pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{f.readiness_pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-sm overflow-hidden mb-2">
                  <div className={`h-full transition-all ${f.readiness_pct >= 80 ? 'bg-emerald-500' : f.readiness_pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${f.readiness_pct}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
                  <div><span className="font-mono">{f.controls_passed}</span> passed</div>
                  <div><span className="font-mono">{f.controls_failed}</span> failed</div>
                  <div className={`font-semibold ${f.trend_delta > 0 ? 'text-emerald-600' : f.trend_delta < 0 ? 'text-red-600' : 'text-zinc-500'}`}>
                    {f.trend_delta > 0 ? "+" : ""}{f.trend_delta?.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${data.deadlines?.length || 0} UPCOMING`}><Calendar className="w-4 h-4 inline-block mr-1" /> Regulatory Deadlines</SectionHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.deadlines?.map(d => (
              <div key={d.deadline_id} className="flex items-start gap-3 p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-sm cursor-pointer hover:border-blue-400" onClick={() => navigate(`/compliance/deadline/${d.deadline_id}`)} data-testid={`deadline-row-${d.deadline_id}`}>
                <div className={`w-1 self-stretch rounded-sm ${d.days_remaining < 0 ? 'bg-red-500' : d.days_remaining < 14 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <StatusBadge value={d.status} />
                    <span className="text-[10px] text-zinc-500 font-mono">{d.framework}</span>
                  </div>
                  <div className="text-xs font-semibold">{d.event_name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Due {fmtDate(d.due_date)} · {d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d overdue` : `${d.days_remaining}d remaining`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="crt-card p-5">
          <SectionHeader eyebrow="EVIDENCE REUSE OPPORTUNITY"><ShieldCheck className="w-4 h-4 inline-block mr-1" /> Cross-Framework Mapping</SectionHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.control_cross_mapping?.map((m, i) => (
              <div key={i} className="p-3 border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 rounded-sm cursor-pointer hover:border-blue-500" onClick={() => navigate(`/controls?control_code=${encodeURIComponent(m.control_code)}`)} data-testid={`cross-map-${m.control_code}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300 font-bold">{m.control_code}</span>
                  <span className="text-[9px] text-zinc-500">satisfies {m.frameworks_satisfied.length} frameworks</span>
                </div>
                <div className="text-xs font-medium mb-1.5">{m.control_name}</div>
                <div className="flex flex-wrap gap-1">
                  {m.frameworks_satisfied.map(fw => (
                    <span key={fw} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm">{fw}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
