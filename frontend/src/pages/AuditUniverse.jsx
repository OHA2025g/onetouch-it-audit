import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, SeverityBadge, StatusBadge } from "@/components/Primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { Compass } from "lucide-react";

export default function AuditUniverse() {
  const [entities, setEntities] = useState([]);
  const [apps, setApps] = useState([]);
  const [assets, setAssets] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/universe/entities"),
      api.get("/universe/applications"),
      api.get("/universe/assets"),
      api.get("/universe/vendors"),
    ]).then(([a, b, c, d]) => {
      setEntities(a.data); setApps(b.data); setAssets(c.data); setVendors(d.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="audit-universe">
      <PageHeader eyebrow="AUDITABLE INVENTORY" title="Audit Universe" subtitle={`${entities.length} entities · ${apps.length} apps · ${assets.length} assets · ${vendors.length} vendors`} />
      <Tabs defaultValue="entities">
        <TabsList className="rounded-sm">
          <TabsTrigger value="entities" className="rounded-sm" data-testid="tab-entities">Entities ({entities.length})</TabsTrigger>
          <TabsTrigger value="applications" className="rounded-sm" data-testid="tab-applications">Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="assets" className="rounded-sm" data-testid="tab-assets">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="vendors" className="rounded-sm" data-testid="tab-vendors">Vendors ({vendors.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="entities">
          <div className="crt-card p-5 mt-4">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left px-2">Type</th>
                  <th className="text-left px-2">Criticality</th>
                  <th className="text-right px-2">Risk</th>
                  <th className="text-left px-2">Frequency</th>
                  <th className="text-left px-2">Last Audited</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(e => (
                  <tr key={e.entity_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <td className="py-2 px-2 font-medium">{e.entity_name}</td>
                    <td className="px-2 text-zinc-500">{e.entity_type}</td>
                    <td className="px-2"><SeverityBadge value={e.criticality} /></td>
                    <td className="px-2 text-right crt-num font-bold">{e.risk_score?.toFixed(1)}</td>
                    <td className="px-2 text-zinc-500">{e.audit_frequency}</td>
                    <td className="px-2 font-mono text-[10px] text-zinc-500">{fmtDate(e.last_audited_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="applications">
          <div className="crt-card p-5 mt-4">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800"><tr>
                <th className="text-left py-2 px-2">App</th><th className="text-left px-2">Crit</th><th className="text-left px-2">Sensitivity</th><th className="text-left px-2">Hosting</th><th className="text-right px-2">Score</th>
              </tr></thead>
              <tbody>{apps.map(a => (
                <tr key={a.app_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-2 px-2 font-medium">{a.app_name}</td>
                  <td className="px-2"><SeverityBadge value={a.criticality} /></td>
                  <td className="px-2 text-zinc-500">{a.data_sensitivity}</td>
                  <td className="px-2 text-zinc-500">{a.hosting_type}</td>
                  <td className="px-2 text-right crt-num">{a.audit_score?.toFixed(1)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="assets">
          <div className="crt-card p-5 mt-4">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800"><tr>
                <th className="text-left py-2 px-2">Asset</th><th className="text-left px-2">Type</th><th className="text-left px-2">Env</th><th className="text-left px-2">Patch</th><th className="text-left px-2">Backup</th><th className="text-right px-2">Score</th>
              </tr></thead>
              <tbody>{assets.map(a => (
                <tr key={a.asset_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-2 px-2 font-mono text-[11px]">{a.asset_name}</td>
                  <td className="px-2 text-zinc-500">{a.asset_type}</td>
                  <td className="px-2 text-zinc-500">{a.environment}</td>
                  <td className="px-2"><StatusBadge value={a.patch_status === "Current" ? "Pass" : a.patch_status?.includes("Missing") ? "Fail" : "Warning"} /></td>
                  <td className="px-2"><StatusBadge value={a.backup_status === "Enabled" ? "Pass" : a.backup_status === "Failed" ? "Fail" : "Warning"} /></td>
                  <td className="px-2 text-right crt-num">{a.audit_score?.toFixed(1)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="vendors">
          <div className="crt-card p-5 mt-4">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800"><tr>
                <th className="text-left py-2 px-2">Vendor</th><th className="text-left px-2">Service</th><th className="text-left px-2">Crit</th><th className="text-right px-2">Risk</th><th className="text-left px-2">Status</th>
              </tr></thead>
              <tbody>{vendors.map(v => (
                <tr key={v.vendor_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                  <td className="py-2 px-2 font-medium">{v.vendor_name}</td>
                  <td className="px-2 text-zinc-500">{v.service_type}</td>
                  <td className="px-2"><SeverityBadge value={v.criticality} /></td>
                  <td className="px-2 text-right crt-num">{v.risk_score?.toFixed(0)}</td>
                  <td className="px-2"><StatusBadge value={v.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
