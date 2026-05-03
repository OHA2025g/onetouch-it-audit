import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/api";
import { PageHeader, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function RemediationList() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = {};
    const pr = searchParams.get("priority");
    const ow = searchParams.get("owner_id");
    const cs = searchParams.get("closure_status");
    const ss = searchParams.get("sla_status");
    if (pr) p.priority = pr;
    if (ow) p.owner_id = ow;
    if (cs) p.closure_status = cs;
    if (ss) p.sla_status = ss;
    setLoading(true);
    api.get("/remediation", { params: p }).then(r => setItems(r.data)).finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="remediation-list">
      <PageHeader eyebrow="CLOSURE PIPELINE" title="Remediation register" subtitle={`${items.length} items`} />
      <div className="crt-card overflow-hidden">
        <table className="w-full text-xs crt-table">
          <thead className="text-zinc-500 border-b bg-zinc-50 dark:bg-zinc-900/50">
            <tr>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left px-2">Priority</th>
              <th className="text-left px-2">Progress</th>
              <th className="text-left px-2">SLA</th>
              <th className="text-right px-2">Open</th>
            </tr>
          </thead>
          <tbody>
            {items.map(rm => (
              <tr key={rm.remediation_id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                <td className="py-2 px-3"><StatusBadge value={rm.closure_status} /></td>
                <td className="px-2">{rm.priority}</td>
                <td className="px-2 crt-num">{rm.progress}%</td>
                <td className="px-2"><StatusBadge value={rm.sla_status} /></td>
                <td className="px-2 text-right"><Link className="text-blue-700 hover:underline font-medium" to={`/remediation/${rm.remediation_id}`} data-testid={`rem-row-${rm.remediation_id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
