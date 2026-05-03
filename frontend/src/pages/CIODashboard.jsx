import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, KPICard, ScoreGauge, SectionHeader, Empty, SeverityBadge } from "@/components/Primitives";
import { formatINR, fmtDate } from "@/lib/format";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart
} from "recharts";
import { ShieldCheck, ShieldAlert, AlertTriangle, FileText, IndianRupee, FileCheck2, Building2, BarChart3, Sparkles, Calendar, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import CIOInsightsSection from "@/components/CIOInsightsSection";

export default function CIODashboard() {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/dashboard/cio-summary"),
      api.get("/analytics/score-trend?days=90"),
      api.get("/dashboard/risk-heatmap"),
      api.get("/ai/anomalies"),
    ]).then(([s, t, h, a]) => {
      setData(s.data);
      setTrend(t.data);
      setHeatmap(h.data);
      setAnomalies(a.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72 rounded-sm" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-sm" />)}
        </div>
        <Skeleton className="h-72 rounded-sm" />
      </div>
    );
  }

  const k = data.kpis;
  const radarData = Object.entries(data.sub_scores).map(([k, v]) => ({
    axis: k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: v,
    full: 100,
  }));
  const fwData = (data.compliance_frameworks || []).map(f => ({
    name: f.name, readiness: f.readiness, fill: f.readiness >= 80 ? "#059669" : f.readiness >= 60 ? "#F59E0B" : "#DC2626",
  }));

  return (
    <div className="space-y-6" data-testid="cio-dashboard">
      <PageHeader
        eyebrow="CIO COMMAND CENTER · LIVE"
        title="Audit Posture, Right Now."
        subtitle={`As of ${fmtDate(new Date().toISOString())} · ${data.trend_7d?.direction === 'up' ? '↑' : data.trend_7d?.direction === 'down' ? '↓' : '→'} ${Math.abs(data.trend_7d?.delta || 0)} pts in 7 days`}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-sm" onClick={() => navigate("/copilot")} data-testid="ask-copilot-btn">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ask Copilot
            </Button>
            <Button size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800" onClick={() => navigate("/reports")} data-testid="generate-report-btn">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Generate CIO Report
            </Button>
          </>
        }
      />

      {/* CIO AI Insights — pinned to top */}
      <CIOInsightsSection />

      {/* Row 1 — 8 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard testId="kpi-enterprise-score" label="Enterprise Score" value={k.enterprise_score?.toFixed(1)} sub={k.score_band} accent={k.enterprise_score >= 70 ? "success" : "warning"} trend={data.trend_7d} onClick={() => navigate("/analytics")} />
        <KPICard testId="kpi-readiness" label="Audit Readiness" value={`${k.audit_readiness_pct}%`} sub="Predicted today" accent="info" onClick={() => navigate("/observations")} />
        <KPICard testId="kpi-critical-risks" label="Critical Risks" value={k.critical_risks} sub="Open • Severity Critical" accent={k.critical_risks > 0 ? "danger" : "success"} onClick={() => navigate("/risks?severity=Critical")} />
        <KPICard testId="kpi-open-obs" label="Open Observations" value={k.open_observations} sub="Across all audits" accent="default" onClick={() => navigate("/observations")} />
        <KPICard testId="kpi-overdue" label="Overdue Remediations" value={k.overdue_remediations} sub="SLA breached" accent={k.overdue_remediations > 0 ? "danger" : "success"} onClick={() => navigate("/remediation?sla_status=Overdue")} />
        <KPICard testId="kpi-financial-exposure" label="Financial Exposure" value={formatINR(k.financial_exposure_inr)} sub="Probability-weighted" accent="warning" onClick={() => navigate("/risks")} />
        <KPICard testId="kpi-compliance" label="Compliance Score" value={`${k.compliance_score}%`} sub="Across 8 frameworks" accent="info" onClick={() => navigate("/dashboard/compliance")} />
        <KPICard testId="kpi-vendor-risk" label="Vendor Risk" value={k.vendor_risk_score?.toFixed(0)} sub="Avg risk · 100=worst" accent={k.vendor_risk_score > 50 ? "danger" : "default"} onClick={() => navigate("/dashboard/vendors")} />
      </div>

      {/* Row 2 — Radar + Heatmap + Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="crt-card p-5 lg:col-span-5">
          <SectionHeader eyebrow="9-AXIS POSTURE">Sub-Score Radar</SectionHeader>
          <div className="flex items-center gap-4">
            <ScoreGauge value={k.enterprise_score} label="OVERALL" />
            <div className="flex-1 h-64 cursor-pointer" onClick={() => navigate("/analytics")} data-testid="radar-drill" role="link" title="Open analytics">
              <ResponsiveContainer>
                <RadarChart data={radarData} onClick={() => navigate("/analytics")}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#0047AB" fill="#0047AB" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: "#0047AB" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="crt-card p-5 lg:col-span-4">
          <SectionHeader eyebrow="LIKELIHOOD × IMPACT">Risk Heatmap</SectionHeader>
          <div className="flex items-center gap-2">
            <div className="flex flex-col-reverse gap-0.5 text-[9px] text-zinc-400 font-mono pr-1">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-[42px] flex items-center">{i}</div>)}
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-0.5">
                {[5,4,3,2,1].map(impact =>
                  [1,2,3,4,5].map(lik => {
                    const cell = heatmap.find(c => c.likelihood === lik && c.impact === impact);
                    const count = cell?.count || 0;
                    const score = lik * impact;
                    const bg = score >= 16 ? (count > 0 ? "bg-red-500" : "bg-red-100 dark:bg-red-950") :
                              score >= 9 ? (count > 0 ? "bg-amber-500" : "bg-amber-100 dark:bg-amber-950") :
                              (count > 0 ? "bg-emerald-500" : "bg-emerald-50 dark:bg-emerald-950/40");
                    const intensity = count >= 4 ? "opacity-100" : count >= 2 ? "opacity-70" : count >= 1 ? "opacity-50" : "opacity-100";
                    return (
                      <button
                        type="button"
                        key={`${lik}-${impact}`}
                        className={`${bg} ${intensity} h-[42px] flex items-center justify-center font-mono text-xs font-bold ${count > 0 ? 'text-white' : 'text-zinc-400'} rounded-sm cursor-pointer hover:scale-105 transition-transform border-0`}
                        title={`L${lik}×I${impact}: ${count} risks`}
                        data-testid={`heatmap-cell-${lik}-${impact}`}
                        onClick={() => count > 0 && navigate(`/risks?heatmap_likelihood=${lik}&heatmap_impact=${impact}`)}
                      >
                        {count || ""}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="flex justify-between mt-1.5 text-[9px] text-zinc-400 font-mono">
                {[1,2,3,4,5].map(i => <span key={i}>{i}</span>)}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-zinc-500">
                <span>← Likelihood</span>
                <span>Impact ↑</span>
              </div>
            </div>
          </div>
        </div>

        <div className="crt-card p-5 lg:col-span-3">
          <SectionHeader eyebrow="REGULATORY">Framework Readiness</SectionHeader>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={fwData} layout="vertical" margin={{ left: 5, right: 30, top: 5, bottom: 5 }} onClick={(e) => {
                const name = e?.activePayload?.[0]?.payload?.name;
                if (name) navigate(`/controls?framework=${encodeURIComponent(name)}`);
              }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Bar dataKey="readiness" fill="#0047AB" radius={[0, 0, 0, 0]} data-testid="fw-readiness-bar" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3 — Top risks + Business impact + AI insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="crt-card p-5 lg:col-span-6" data-testid="top-risks-table">
          <SectionHeader eyebrow={`${data.top_risks?.length || 0} OPEN`} action={<Button variant="ghost" size="sm" className="text-xs rounded-sm" onClick={() => navigate("/risks")}>View All <ArrowUpRight className="w-3 h-3 ml-1" /></Button>}>Top 10 Risks</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="text-left font-semibold pb-2 pr-3">Title</th>
                  <th className="text-left font-semibold pb-2 px-2">Severity</th>
                  <th className="text-right font-semibold pb-2 px-2">Score</th>
                  <th className="text-right font-semibold pb-2 pl-2">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {(data.top_risks || []).slice(0, 10).map((r, i) => (
                  <tr key={r.risk_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer" onClick={() => navigate(`/risks/${r.risk_id}`)} data-testid={`top-risk-row-${r.risk_id}`}>
                    <td className="py-2 pr-3 font-medium truncate max-w-md"><Link to={`/risks/${r.risk_id}`} className="hover:underline text-inherit" onClick={e => e.stopPropagation()}>{i + 1}. {r.title}</Link></td>
                    <td className="px-2"><SeverityBadge value={r.severity} /></td>
                    <td className="px-2 text-right crt-num font-bold">{r.risk_score?.toFixed(1)}</td>
                    <td className="pl-2 text-right crt-num">{formatINR(r.financial_impact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crt-card p-5 lg:col-span-3">
          <SectionHeader eyebrow="BUSINESS CONSEQUENCE">Impact Profile</SectionHeader>
          <div className="space-y-2">
            {[
              { l: "Revenue", v: data.business_impact?.revenue, ic: IndianRupee, cat: "Application" },
              { l: "Customer", v: data.business_impact?.customer, ic: Building2, cat: "Data" },
              { l: "Legal / DPDP", v: data.business_impact?.legal, ic: ShieldAlert, cat: "Compliance" },
              { l: "Operational", v: data.business_impact?.operational, ic: BarChart3, cat: "Infrastructure" },
            ].map(b => {
              const col = b.v === "Critical" ? "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900" :
                         b.v === "High" ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900" :
                         "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900";
              return (
                <div key={b.l} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/risks?category=${encodeURIComponent(b.cat)}`)} className={`flex items-center justify-between p-2.5 border rounded-sm cursor-pointer ${col}`} onClick={() => navigate(`/risks?category=${encodeURIComponent(b.cat)}`)} data-testid={`biz-impact-${b.l.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                  <div className="flex items-center gap-2">
                    <b.ic className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{b.l}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{b.v}</span>
                </div>
              );
            })}
            <button type="button" className="w-full text-left pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800 cursor-pointer" onClick={() => navigate("/risks")} data-testid="biz-impact-total">
              <div className="crt-overline mb-1">Aggregate Exposure</div>
              <div className="font-display font-black text-2xl crt-num text-red-600 dark:text-red-400">{formatINR(data.business_impact?.exposure_inr)}</div>
            </button>
          </div>
        </div>

        <div className="crt-card p-5 lg:col-span-3">
          <SectionHeader eyebrow="AI INSIGHTS · LIVE" action={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}>Anomalies</SectionHeader>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {anomalies.slice(0, 6).map(a => (
              <div key={a.id} className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-sm hover:border-blue-300 dark:hover:border-blue-800 cursor-pointer" onClick={() => navigate(a.deep_link || "/copilot")} data-testid={`anomaly-row-${a.id}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <SeverityBadge value={a.severity} />
                  <span className="text-[9px] text-zinc-400 font-mono">{a.type}</span>
                </div>
                <div className="text-xs font-medium leading-snug">{a.title}</div>
              </div>
            ))}
            {anomalies.length === 0 && <Empty msg="No anomalies detected" />}
          </div>
        </div>
      </div>

      {/* Row 4 — Score trend */}
      <div className="crt-card p-5">
        <SectionHeader eyebrow="LAST 90 DAYS">Enterprise Audit Score Trend</SectionHeader>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ left: 0, right: 10, top: 5, bottom: 5 }} onClick={() => navigate("/analytics")}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0047AB" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0047AB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="score_date" tick={{ fontSize: 10 }} interval={Math.floor(trend.length / 8)} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} domain={[60, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
              <Area type="monotone" dataKey="score" stroke="#0047AB" strokeWidth={2} fill="url(#scoreGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5 — removed; AI Insights moved to top */}
    </div>
  );
}
