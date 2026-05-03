import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, KPICard, SectionHeader, SeverityBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ScatterChart, Scatter, ZAxis } from "recharts";
import { fmtDate } from "@/lib/format";

export default function ApplicationDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/application-risk").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  const s = data.summary;
  const vulnData = (data.apps || []).slice(0, 12).map(a => ({
    name: a.app_name?.slice(0, 18),
    Critical: a.vulnerability_count_critical || 0,
    High: a.vulnerability_count_high || 0,
    Medium: a.vulnerability_count_medium || 0,
  }));
  const sensMap = { PII: 4, Financial: 5, Confidential: 3, Internal: 2, Public: 1 };
  const scatter = (data.apps || []).map(a => ({
    x: sensMap[a.data_sensitivity] || 1,
    y: (a.vulnerability_count_critical || 0) * 4 + (a.vulnerability_count_high || 0),
    z: a.audit_score || 50,
    name: a.app_name,
    app_id: a.app_id,
  }));

  return (
    <div className="space-y-6" data-testid="application-dashboard">
      <PageHeader eyebrow="APPSEC POSTURE" title="Application Risk" subtitle={`${s.total_apps} apps tracked · ${s.critical_apps} mission-critical · DR ready ${s.dr_ready_pct}%`} />
      <InsightsSection scope="applications" eyebrow="APPLICATIONS · COCKPIT" title="Application AI Insights" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total Apps" value={s.total_apps} testId="kpi-app-total" onClick={() => navigate("/universe")} />
        <KPICard label="Critical Apps" value={s.critical_apps} accent="danger" testId="kpi-app-crit" onClick={() => navigate("/universe")} />
        <KPICard label="Critical Vulns" value={s.vuln_critical} accent="danger" testId="kpi-vuln-crit" onClick={() => navigate("/observations?control_code=VUL-001")} />
        <KPICard label="High Vulns" value={s.vuln_high} accent="warning" testId="kpi-vuln-high" onClick={() => navigate("/observations?control_code=VUL-001")} />
        <KPICard label="DR Ready" value={`${s.dr_ready_pct}%`} accent={s.dr_ready_pct >= 80 ? "success" : "warning"} testId="kpi-dr-ready" onClick={() => navigate("/observations?control_code=BCK-002")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow="VULNERABILITIES">Top 12 Apps by Severity</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={vulnData}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Bar dataKey="Critical" stackId="v" fill="#DC2626" />
                <Bar dataKey="High" stackId="v" fill="#F59E0B" />
                <Bar dataKey="Medium" stackId="v" fill="#0047AB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow="DATA SENSITIVITY × VULN">Risk Distribution</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" />
                <XAxis dataKey="x" type="number" name="Sensitivity" tick={{ fontSize: 10 }} domain={[0, 6]} ticks={[1,2,3,4,5]} tickFormatter={(v) => ["Pub","Int","Conf","PII","Fin"][v-1] || ""} />
                <YAxis dataKey="y" type="number" name="Vuln Severity Score" tick={{ fontSize: 10 }} />
                <ZAxis dataKey="z" range={[40, 200]} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatter} fill="#0047AB" onClick={(pt) => { if (pt?.app_id) navigate(`/universe/applications/${pt.app_id}`); }} cursor="pointer" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="crt-card p-5">
        <SectionHeader eyebrow={`${data.apps?.length} APPS`}>Application Risk Register</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs crt-table">
            <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="text-left py-2 px-2 font-semibold">Application</th>
                <th className="text-left px-2 font-semibold">Crit.</th>
                <th className="text-left px-2 font-semibold">Sensitivity</th>
                <th className="text-left px-2 font-semibold">Hosting</th>
                <th className="text-right px-2 font-semibold">Score</th>
                <th className="text-right px-2 font-semibold">Crit. CVE</th>
                <th className="text-right px-2 font-semibold">High CVE</th>
                <th className="text-left px-2 font-semibold">DR</th>
                <th className="text-left px-2 font-semibold">Last Pen Test</th>
              </tr>
            </thead>
            <tbody>
              {data.apps?.map(a => (
                <tr key={a.app_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer" onClick={() => navigate(`/universe/applications/${a.app_id}`)} data-testid={`app-row-${a.app_id}`}>
                  <td className="py-2 px-2 font-medium">{a.app_name}</td>
                  <td className="px-2"><SeverityBadge value={a.criticality} /></td>
                  <td className="px-2 text-zinc-600 dark:text-zinc-400">{a.data_sensitivity}</td>
                  <td className="px-2 text-zinc-600 dark:text-zinc-400">{a.hosting_type}</td>
                  <td className="px-2 text-right crt-num font-bold">{a.audit_score?.toFixed(1)}</td>
                  <td className="px-2 text-right crt-num text-red-600">{a.vulnerability_count_critical}</td>
                  <td className="px-2 text-right crt-num text-amber-600">{a.vulnerability_count_high}</td>
                  <td className="px-2">{a.dr_readiness ? <span className="text-emerald-600 text-[11px] font-bold">✓</span> : <span className="text-red-600 text-[11px] font-bold">✗</span>}</td>
                  <td className="px-2 text-zinc-500 text-[10px] font-mono">{fmtDate(a.last_security_test_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
