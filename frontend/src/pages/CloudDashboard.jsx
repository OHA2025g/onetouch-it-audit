import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, KPICard, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatINR, formatNumber } from "@/lib/format";
import { Cloud as CloudIcon, AlertTriangle } from "lucide-react";

export default function CloudDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/cloud-risk").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  const s = data.summary;
  const providers = Object.keys(data.by_provider || {});
  return (
    <div className="space-y-6" data-testid="cloud-dashboard">
      <PageHeader eyebrow="MULTI-CLOUD GOVERNANCE" title="Cloud Risk & FinOps" subtitle={`${formatINR(s.cost_leakage_inr)} monthly leakage · ${s.total_misconfigs} misconfigurations`} />
      <InsightsSection scope="cloud" eyebrow="CLOUD · COCKPIT" title="Cloud AI Insights" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Monthly Spend" value={formatINR(s.monthly_spend_inr)} sub="Across AWS, Azure, GCP" testId="kpi-cloud-spend" onClick={() => navigate("/observations?control_code=CLD-001")} />
        <KPICard label="Cost Leakage" value={formatINR(s.cost_leakage_inr)} sub="Idle + zombie resources" accent="danger" testId="kpi-cloud-leak" onClick={() => navigate("/observations?control_code=CLD-001")} />
        <KPICard label="Idle Compute" value={formatINR(s.idle_compute_inr)} sub="Right-sizing opportunity" accent="warning" testId="kpi-cloud-idle" onClick={() => navigate("/observations?control_code=CLD-001")} />
        <KPICard label="Misconfigs" value={s.total_misconfigs} sub="Public + IAM + encryption" accent="danger" testId="kpi-cloud-misconfig" onClick={() => navigate("/observations?control_code=CLD-001")} />
      </div>

      <Tabs defaultValue={providers[0] || "AWS"}>
        <TabsList className="rounded-sm">
          {providers.map(p => <TabsTrigger key={p} value={p} className="rounded-sm" data-testid={`tab-${p}`}>{p}</TabsTrigger>)}
        </TabsList>
        {providers.map(p => {
          const r = data.by_provider[p];
          const m = [
            { name: "Public Buckets", value: r.public_buckets, fill: "#DC2626" },
            { name: "Unencrypted", value: r.unencrypted_resources, fill: "#F59E0B" },
            { name: "Public IPs", value: r.public_ips, fill: "#F59E0B" },
            { name: "Weak IAM", value: r.weak_iam_policies, fill: "#DC2626" },
            { name: "Unused Keys", value: r.unused_access_keys, fill: "#0047AB" },
            { name: "SG Misconfig", value: r.security_group_misconfigs, fill: "#DC2626" },
            { name: "Zombie", value: r.zombie_resources, fill: "#52525B" },
          ];
          return (
            <TabsContent key={p} value={p} className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                <KPICard label={`${p} Score`} value={r.audit_score?.toFixed(1)} accent={r.audit_score >= 80 ? "success" : "warning"} testId={`kpi-${p}-score`} onClick={() => r.result_id && navigate(`/cloud/result/${r.result_id}`)} />
                <KPICard label="Monthly Spend" value={formatINR(r.monthly_spend_inr)} testId={`kpi-${p}-spend`} />
                <KPICard label="Account ID" value={r.account_id} sub={r.cloud_provider} testId={`kpi-${p}-acct`} onClick={() => r.result_id && navigate(`/cloud/result/${r.result_id}`)} />
                <KPICard label="Non-compliant Regions" value={r.non_compliant_regions} accent={r.non_compliant_regions > 0 ? "danger" : "success"} testId={`kpi-${p}-regions`} />
              </div>
              <div className="crt-card p-5">
                <SectionHeader eyebrow="CATEGORY">Misconfiguration Counts</SectionHeader>
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={m} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 2, fontSize: 11 }} />
                      <Bar dataKey="value" fill="#0047AB" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
