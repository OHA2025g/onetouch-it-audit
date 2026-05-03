import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import { PageHeader, KPICard, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import InsightsSection from "@/components/InsightsSection";
import { fmtDate } from "@/lib/format";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard/vendor-risk").then(r => setData(r.data)); }, []);
  if (!data) return <Skeleton className="h-96" />;
  const s = data.summary;
  return (
    <div className="space-y-6" data-testid="vendor-dashboard">
      <PageHeader eyebrow="THIRD-PARTY RISK" title="Vendor Risk Management" subtitle={`${s.total} vendors · ${s.critical} critical · ${s.expiring_contracts_30d} contracts expire in 30 days`} />
      <InsightsSection scope="vendors" eyebrow="VENDORS · COCKPIT" title="Vendor AI Insights" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Total Vendors" value={s.total} testId="kpi-vendor-total" onClick={() => navigate("/universe")} />
        <KPICard label="Critical Tier" value={s.critical} accent="warning" testId="kpi-vendor-crit" onClick={() => navigate("/universe")} />
        <KPICard label="SLA Breaches" value={s.sla_breaches} accent="danger" testId="kpi-vendor-sla" onClick={() => navigate("/observations?control_code=VEN-001")} />
        <KPICard label="Expiring 30d" value={s.expiring_contracts_30d} accent="warning" testId="kpi-vendor-exp" onClick={() => navigate("/universe")} />
        <KPICard label="Expired SOC 2" value={s.expired_soc2} accent="danger" testId="kpi-vendor-soc2" onClick={() => navigate("/observations?control_code=VEN-001")} />
      </div>
      <div className="crt-card p-5">
        <SectionHeader eyebrow={`${data.vendors?.length} VENDORS · SORTED BY RISK`}>Vendor Risk Register</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs crt-table">
            <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="text-left py-2 px-2 font-semibold">Vendor</th>
                <th className="text-left px-2 font-semibold">Service</th>
                <th className="text-left px-2 font-semibold">Critic.</th>
                <th className="text-left px-2 font-semibold">Access</th>
                <th className="text-right px-2 font-semibold">Risk</th>
                <th className="text-right px-2 font-semibold">SLA</th>
                <th className="text-left px-2 font-semibold">Contract End</th>
                <th className="text-left px-2 font-semibold">SOC 2</th>
                <th className="text-left px-2 font-semibold">DPA</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors?.map(v => (
                <tr key={v.vendor_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer" onClick={() => navigate(`/universe/vendors/${v.vendor_id}`)} data-testid={`vendor-row-${v.vendor_id}`}>
                  <td className="py-2 px-2 font-medium">{v.vendor_name}</td>
                  <td className="px-2 text-zinc-600 dark:text-zinc-400">{v.service_type}</td>
                  <td className="px-2"><SeverityBadge value={v.criticality} /></td>
                  <td className="px-2 text-zinc-600 dark:text-zinc-400">{v.data_access_level}</td>
                  <td className="px-2 text-right crt-num font-bold">{v.risk_score?.toFixed(0)}</td>
                  <td className="px-2 text-right crt-num">{v.sla_score?.toFixed(0)}</td>
                  <td className="px-2 text-[10px] font-mono text-zinc-500">{fmtDate(v.contract_end)}</td>
                  <td className="px-2 text-[10px] font-mono text-zinc-500">{fmtDate(v.soc2_expiry)}</td>
                  <td className="px-2">{v.dpa_signed ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-red-600 font-bold">✗</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
