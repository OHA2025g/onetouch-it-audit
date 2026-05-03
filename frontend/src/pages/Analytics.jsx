import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, KPICard } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";

export default function Analytics() {
  const [trend, setTrend] = useState([]);
  const [pred, setPred] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [depts, setDepts] = useState([]);
  const [days, setDays] = useState(90);

  useEffect(() => {
    Promise.all([
      api.get(`/analytics/score-trend?days=${days}`),
      api.get("/analytics/audit-readiness-prediction"),
      api.get("/analytics/control-failure-patterns"),
      api.get("/analytics/department-risk-ranking"),
    ]).then(([a, b, c, d]) => { setTrend(a.data); setPred(b.data); setPatterns(c.data); setDepts(d.data); });
  }, [days]);

  if (!pred) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="analytics-page">
      <PageHeader eyebrow="TRENDS · PREDICTIONS · PATTERNS" title="Advanced Analytics" subtitle="Score trajectories, readiness forecasts, and weakness clustering" />
      <InsightsSection scope="analytics" eyebrow="ANALYTICS · COCKPIT" title="Analytics AI Insights" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Current Readiness" value={`${pred.current_readiness}%`} accent={pred.current_readiness >= 75 ? "success" : "warning"} testId="kpi-current-ready" />
        <KPICard label="Predicted 30d" value={`${pred.predicted_30d}%`} sub="At current closure rate" accent="info" testId="kpi-pred-30" />
        <KPICard label="Closures to 80%" value={pred.required_closures_to_reach_80pct} sub="Observations to close" accent="warning" testId="kpi-closures" />
        <KPICard label="Closure Rate" value={`${pred.current_closure_rate_pct}%`} sub="Cumulative" testId="kpi-closure-rate" />
      </div>

      <div className="crt-card p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader eyebrow="ENTERPRISE">Score Trend</SectionHeader>
          <div className="flex gap-1">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} data-testid={`trend-${d}d-btn`} className={`px-3 py-1 text-[11px] border rounded-sm font-mono ${days === d ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>{d}D</button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="score_date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} interval={Math.floor(trend.length / 8)} />
              <YAxis tick={{ fontSize: 10 }} domain={[60, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
              <Line type="monotone" dataKey="score" stroke="#0047AB" strokeWidth={2} dot={false} name="Enterprise Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow="WEAK SPOTS">Top Failing Controls</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={patterns.slice(0, 12)} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="control_code" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Bar dataKey="failure_count" fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow="RISK CONCENTRATION">Department Ranking</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={depts.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="department_name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Bar dataKey="total_risk" fill="#0047AB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
