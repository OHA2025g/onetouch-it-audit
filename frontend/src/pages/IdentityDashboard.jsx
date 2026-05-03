import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, KPICard, SectionHeader, SeverityBadge, Empty } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export default function IdentityDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/identity-risk").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  const s = data.summary;
  const mfaData = [
    { name: "MFA Enabled", value: s.total_users - s.users_without_mfa, fill: "#059669" },
    { name: "No MFA", value: s.users_without_mfa, fill: "#DC2626" },
  ];
  return (
    <div className="space-y-6" data-testid="identity-dashboard">
      <PageHeader eyebrow="ZERO-TRUST POSTURE" title="Identity & Access Risk" subtitle="Active Directory + cloud IAM. Last sync 2h ago." />
      <InsightsSection scope="identity" eyebrow="IDENTITY · COCKPIT" title="Identity AI Insights" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Users" value={s.total_users?.toLocaleString("en-IN")} sub={`${s.active_users} active`} testId="kpi-total-users" onClick={() => navigate("/observations")} />
        <KPICard label="Dormant Users" value={s.dormant_users} sub="Inactive >90 days" accent="danger" testId="kpi-dormant" onClick={() => navigate("/observations?control_code=IAM-002")} />
        <KPICard label="Orphan Accounts" value={s.orphan_users} sub="No active manager" accent="danger" testId="kpi-orphan" onClick={() => navigate("/observations?control_code=IAM-002")} />
        <KPICard label="Privileged Users" value={s.privileged_users} sub="Domain/cloud admin" accent="warning" testId="kpi-privileged" onClick={() => navigate("/observations?control_code=IAM-001")} />
        <KPICard label="No MFA" value={s.users_without_mfa} sub={`${100 - s.mfa_coverage_pct}% gap`} accent="danger" testId="kpi-no-mfa" onClick={() => navigate("/observations?control_code=IAM-003")} />
        <KPICard label="SoD Violations" value={s.sod_violations} sub="Conflicting roles" accent="danger" testId="kpi-sod" onClick={() => navigate("/observations?control_code=IAM-005")} />
        <KPICard label="MFA Coverage" value={`${s.mfa_coverage_pct}%`} sub="Target ≥95%" accent={s.mfa_coverage_pct >= 95 ? "success" : "warning"} testId="kpi-mfa-cov" onClick={() => navigate("/observations?control_code=IAM-003")} />
        <KPICard label="Avg Review Age" value={`${s.avg_access_review_age_days}d`} sub="Target ≤90d" testId="kpi-review-age" onClick={() => navigate("/observations?control_code=IAM-004")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="crt-card p-5 lg:col-span-2">
          <SectionHeader eyebrow="LAST 30 DAYS">Identity Trends</SectionHeader>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.trend_30d?.slice().reverse() || []}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={5} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="dormant" stroke="#DC2626" name="Dormant" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="orphan" stroke="#F59E0B" name="Orphan" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="no_mfa" stroke="#0047AB" name="No MFA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow="COVERAGE">MFA Distribution</SectionHeader>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={mfaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {mfaData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${data.top_risky_users?.length || 0} FLAGGED`}>Top Risky Users</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800"><tr>
                <th className="text-left py-2 px-2 font-semibold">User</th>
                <th className="text-left px-2 font-semibold">Risk</th>
                <th className="text-left px-2 font-semibold">Issues</th>
              </tr></thead>
              <tbody>
                {data.top_risky_users?.slice(0, 12).map(u => (
                  <tr key={u.risk_id} className="border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50" onClick={() => navigate(`/identity/user-risk/${u.risk_id}`)} data-testid={`uar-row-${u.risk_id}`}>
                    <td className="py-2 px-2 font-mono text-[11px]">{u.user_email}</td>
                    <td className="px-2"><SeverityBadge value={u.risk_level} /></td>
                    <td className="px-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">{u.issues?.map(i => i.type).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${data.sod_conflicts?.length || 0} CONFLICTS`}>Segregation of Duties Violations</SectionHeader>
          {(data.sod_conflicts?.length || 0) === 0 ? <Empty msg="No SoD violations" /> : (
            <div className="space-y-2">
              {data.sod_conflicts?.slice(0, 8).map(c => (
                <div key={c.conflict_id} className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-sm cursor-pointer hover:border-blue-400" onClick={() => navigate(`/identity/sod/${c.conflict_id}`)} data-testid={`sod-card-${c.conflict_id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <SeverityBadge value={c.risk_level} />
                    <span className="text-[10px] text-zinc-400 font-mono">{c.system}</span>
                  </div>
                  <div className="text-xs font-mono">{c.user_email}</div>
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">{c.role_1} <span className="text-red-600">+</span> {c.role_2}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
